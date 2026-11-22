const http = require("http");
const fs = require("fs");

const num = (value, fallback) => (value === undefined || value === "" ? fallback : Number(value));

const mode = process.env.EXPERIMENT_MODE || "before";
const requests = num(process.env.REQUESTS, 200);
const runs = num(process.env.RUNS, 5);
const warmupRuns = num(process.env.WARMUP_RUNS, 1);
const intervalMs = num(process.env.INTERVAL_MS, 0); // 0 = rajada (todas as requisições de uma vez)
const faultAtMs = num(process.env.FAULT_AT_MS, null); // injeta falha no on-prem neste instante (ms)
const restoreAtMs = num(process.env.RESTORE_AT_MS, null); // restaura o on-prem neste instante (ms)
const target = new URL(process.env.TARGET_URL || "http://localhost:3000");
const onpremAdmin = new URL(process.env.ONPREM_ADMIN_URL || process.env.ONPREM_URL || "http://onprem:3002");
const cloudAdmin = new URL(process.env.CLOUD_ADMIN_URL || process.env.CLOUD_URL || "http://cloud:3001");
const logFile = process.env.LOG_FILE || null;
const configFile = logFile ? logFile.replace(/\.jsonl$/, "") + "-config.jsonl" : null;

function call(base, path, method = "GET") {
  return new Promise(resolve => {
    const req = http.request(
      { hostname: base.hostname, port: base.port, path, method },
      res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => {
          let json = {};
          try { json = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, json });
        });
      }
    );
    req.on("error", () => resolve({ status: 0, json: {} }));
    req.end();
  });
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const round = (value, digits = 2) => (value === null ? null : Number(value.toFixed(digits)));

async function resetState() {
  await call(onpremAdmin, "/admin/restore", "POST");
  for (let i = 0; i < 40; i++) {
    const { json } = await call(target, "/config");
    if (json.healthy === true) return;
    await sleep(250);
  }
}

async function runOnce() {
  await resetState();
  const t0 = Date.now();
  const now = () => Date.now() - t0;
  const results = [];
  let faultAt = null;
  let restoreAt = null;
  const pending = [];
  const timers = [];

  if (faultAtMs !== null) {
    timers.push(setTimeout(async () => {
      await call(onpremAdmin, "/admin/fail", "POST");
      faultAt = now();
    }, faultAtMs));
  }
  if (restoreAtMs !== null) {
    timers.push(setTimeout(async () => {
      await call(onpremAdmin, "/admin/restore", "POST");
      restoreAt = now();
    }, restoreAtMs));
  }

  const fire = () => new Promise(resolve => {
    const sent = now();
    const req = http.request(
      { hostname: target.hostname, port: target.port, path: "/", method: "GET" },
      res => {
        let body = "";
        res.on("data", chunk => (body += chunk));
        res.on("end", () => {
          let payload = {};
          try { payload = JSON.parse(body); } catch {}
          results.push({
            sent,
            end: now(),
            ok: res.statusCode < 500,
            target: payload.target || null,
            rerouted: payload.rerouted === true,
            cost: Number.isFinite(payload.cost) ? payload.cost : 0
          });
          resolve();
        });
      }
    );
    req.on("error", () => {
      results.push({ sent, end: now(), ok: false, target: null, rerouted: false, cost: 0 });
      resolve();
    });
    req.end();
  });

  for (let i = 0; i < requests; i++) {
    pending.push(fire());
    if (intervalMs > 0) await sleep(intervalMs);
  }
  await Promise.all(pending);
  const elapsedMs = now();
  timers.forEach(clearTimeout);
  await resetState();

  const errors = results.filter(r => !r.ok);
  const successes = results.filter(r => r.ok);
  const firstError = errors.length ? errors.reduce((a, b) => (a.end <= b.end ? a : b)) : null;
  const lastError = errors.length ? errors.reduce((a, b) => (a.sent >= b.sent ? a : b)) : null;
  const afterLastError = lastError ? successes.filter(r => r.sent > lastError.sent) : [];
  const firstRecovered = afterLastError.length ? Math.min(...afterLastError.map(r => r.end)) : null;
  const rerouted = results.filter(r => r.ok && r.rerouted);
  const failbacks = restoreAt === null ? [] : successes.filter(r => r.target === "onprem" && r.sent >= restoreAt);
  const sum = list => list.reduce((acc, r) => acc + r.cost, 0);
  const cloudCost = sum(successes.filter(r => r.target === "cloud"));
  const onpremCost = sum(successes.filter(r => r.target === "onprem"));

  return {
    requests,
    elapsedMs,
    successes: successes.length,
    errors: errors.length,
    errorPercent: round(errors.length * 100 / requests),
    totalReqPerSec: round(requests * 1000 / elapsedMs),
    goodputReqPerSec: round(successes.length * 1000 / elapsedMs),
    faultInjectedAtMs: faultAt,
    faultRestoredAtMs: restoreAt,
    // tempo (ms) entre a injeção da falha e o primeiro erro visto pelo cliente
    timeToFailureMs: faultAt !== null && firstError ? Math.max(0, firstError.end - faultAt) : null,
    // tempo (ms) entre o primeiro erro e a primeira resposta bem-sucedida depois do último erro
    // (0 = nenhum erro; null = sem falha injetada ou sem recuperação dentro da execução)
    timeToRecoveryMs: faultAt === null ? null
      : (errors.length === 0 ? 0 : (firstRecovered === null ? null : Math.max(0, firstRecovered - firstError.end))),
    // tempo (ms) entre a injeção da falha e a primeira resposta servida pelo cloud como fallback
    failoverMs: faultAt !== null && rerouted.length ? Math.max(0, Math.min(...rerouted.map(r => r.end)) - faultAt) : null,
    // tempo (ms) entre a restauração do on-prem e a primeira resposta servida por ele
    failbackMs: failbacks.length ? Math.max(0, Math.min(...failbacks.map(r => r.end)) - restoreAt) : null,
    cloudRequests: successes.filter(r => r.target === "cloud").length,
    onpremRequests: successes.filter(r => r.target === "onprem").length,
    reroutedRequests: rerouted.length,
    projectedCostCloud: round(cloudCost, 4),
    projectedCostOnprem: round(onpremCost, 4),
    projectedCostTotal: round(cloudCost + onpremCost, 4)
  };
}

function median(values) {
  const sorted = values.filter(v => v !== null).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : round((sorted[mid - 1] + sorted[mid]) / 2, 4);
}

function summarize(measured) {
  const keys = [
    "elapsedMs", "errorPercent", "totalReqPerSec", "goodputReqPerSec", "timeToFailureMs",
    "timeToRecoveryMs", "failoverMs", "failbackMs", "projectedCostCloud", "projectedCostOnprem", "projectedCostTotal"
  ];
  const summary = { type: "summary", experiment: mode, measuredRuns: measured.length, statistic: "median" };
  for (const key of keys) {
    summary[key] = median(measured.map(r => r[key]));
    const values = measured.map(r => r[key]).filter(v => v !== null);
    summary[key + "Min"] = values.length ? Math.min(...values) : null;
    summary[key + "Max"] = values.length ? Math.max(...values) : null;
  }
  return summary;
}

async function main() {
  const proxyConfig = (await call(target, "/config")).json;
  const onprem = (await call(onpremAdmin, "/admin/state")).json;
  const cloud = (await call(cloudAdmin, "/admin/state")).json;
  const config = {
    timestampUtc: new Date().toISOString(),
    experiment: mode,
    targetUrl: target.href.replace(/\/$/, ""),
    migrationPercent: proxyConfig.migrationPercent,
    mitigation: proxyConfig.mitigation ? "on" : "off",
    healthIntervalMs: proxyConfig.healthIntervalMs,
    onprem,
    cloud,
    requests,
    runs,
    warmupRuns,
    intervalMs,
    faultAtMs,
    restoreAtMs
  };
  console.log(JSON.stringify({ type: "config", ...config }));
  if (configFile) fs.writeFileSync(configFile, JSON.stringify(config) + "\n", "utf8");
  if (logFile) fs.writeFileSync(logFile, "", "utf8");

  const measured = [];
  for (let i = 0; i < warmupRuns + runs; i++) {
    const warmup = i < warmupRuns;
    const metrics = await runOnce();
    const line = {
      type: "run",
      experiment: mode,
      run: warmup ? null : i - warmupRuns + 1,
      warmup,
      migrationPercent: config.migrationPercent,
      mitigation: config.mitigation,
      ...metrics,
      timestampUtc: new Date().toISOString()
    };
    if (!warmup) measured.push(metrics);
    console.log(JSON.stringify(line));
    if (logFile) fs.appendFileSync(logFile, JSON.stringify(line) + "\n", "utf8");
  }
  const summary = { ...summarize(measured), timestampUtc: new Date().toISOString() };
  console.log(JSON.stringify(summary));
  if (logFile) fs.appendFileSync(logFile, JSON.stringify(summary) + "\n", "utf8");
}

main();
