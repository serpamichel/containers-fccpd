const http = require("http");
const fs = require("fs");

const mode = process.env.EXPERIMENT_MODE || "before";
const percent = Number(process.env.MIGRATION_PERCENT || 100);
const requests = Number(process.env.REQUESTS || 200);
const target = process.env.TARGET_URL || "http://localhost:3000";
const cloudCostPerRequest = Number(process.env.CLOUD_COST_PER_REQUEST || 0.002);
const onpremCostPerRequest = Number(process.env.ONPREM_COST_PER_REQUEST || 0.0002);
const url = new URL(target);
const started = Date.now();
let completed = 0;
let errors = 0;
let successes = 0;
let firstFailureMs = null;
let cloudRequests = 0;
let onpremRequests = 0;
let recoverySamples = [];
let firstRerouteMs = null;

function runOne() {
  const req = http.request({ hostname: url.hostname, port: url.port, path: "/", method: "GET" }, res => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
      const elapsed = Date.now() - started;
      if (res.statusCode >= 500) {
        errors++;
        if (firstFailureMs === null) firstFailureMs = elapsed;
      } else {
        successes++;
        try {
          const payload = JSON.parse(body);
          if (payload.rerouted || payload.target === "cloud") {
            cloudRequests++;
            if (payload.rerouted && firstRerouteMs === null) firstRerouteMs = elapsed;
          } else {
            onpremRequests++;
          }
          if (Number.isFinite(payload.recoveryMs)) recoverySamples.push(payload.recoveryMs);
        } catch {
          cloudRequests++;
        }
      }
      completed++;
      if (completed === requests) finish();
    });
  });
  req.on("error", () => {
    errors++;
    completed++;
    if (firstFailureMs === null) firstFailureMs = Date.now() - started;
    if (completed === requests) finish();
  });
  req.end();
}

function finish() {
  const elapsed = Date.now() - started;
  const projectedCostCloud = Number((cloudRequests * cloudCostPerRequest).toFixed(4));
  const projectedCostOnprem = Number((onpremRequests * onpremCostPerRequest).toFixed(4));
  const recoveryMs = firstRerouteMs !== null && firstFailureMs !== null
    ? Math.max(0, firstRerouteMs - firstFailureMs)
    : (recoverySamples.length ? Math.max(...recoverySamples) : null);
  const costRatio = projectedCostCloud === 0
    ? null
    : Number((projectedCostOnprem / projectedCostCloud).toFixed(4));
  const result = {
    experiment: mode,
    migrationPercent: percent,
    requests,
    elapsedMs: elapsed,
    successes,
    errors,
    errorPercent: Number((errors * 100 / requests).toFixed(2)),
    throughputReqPerSec: Number((requests * 1000 / elapsed).toFixed(2)),
    firstFailureMs: firstFailureMs,
    recoveryMs,
    projectedCostCloud,
    projectedCostOnprem,
    costRatioOnpremCloud: costRatio,
    timestampUtc: new Date().toISOString()
  };
  console.log(JSON.stringify(result));
  if (process.env.LOG_FILE) {
    fs.writeFileSync(process.env.LOG_FILE, JSON.stringify(result) + "\n", "utf8");
  }
}

for (let i = 0; i < requests; i++) runOne();
