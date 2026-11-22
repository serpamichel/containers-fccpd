const http = require("http");

const port = Number(process.env.PORT || 3000);
const cloudUrl = new URL(process.env.CLOUD_URL);
const onpremUrl = new URL(process.env.ONPREM_URL);
const migrationPercent = Number(process.env.MIGRATION_PERCENT || 0);
const mitigation = process.env.MITIGATION === "on";
const healthIntervalMs = Number(process.env.HEALTH_INTERVAL_MS || 500);

// `healthy` descreve SOMENTE o destino on-prem (healthcheck ativo + resultado
// das requisições encaminhadas a ele). Falhas do cloud não alteram esse estado.
let healthy = true;
let rerouteCount = 0;

function setHealthy(value) {
  if (value !== healthy) {
    console.log(JSON.stringify({
      event: value ? "onprem_healthy" : "onprem_unhealthy",
      timestampUtc: new Date().toISOString()
    }));
  }
  healthy = value;
}

function get(base, path) {
  return new Promise(resolve => {
    const request = http.request(
      { hostname: base.hostname, port: base.port, path, method: "GET" },
      response => {
        let body = "";
        response.on("data", chunk => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body }));
      }
    );
    request.on("error", () => resolve({ status: 0, body: "" }));
    request.end();
  });
}

function parse(body) {
  try { return JSON.parse(body); } catch { return {}; }
}

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

// Serve a requisição pelo backend cloud. `rerouted` indica desvio por mitigação.
async function viaCloud(res, rerouted) {
  const r = await get(cloudUrl, "/");
  if (r.status === 200) {
    return send(res, 200, { ok: true, target: "cloud", rerouted, cost: parse(r.body).cost });
  }
  return send(res, 503, { ok: false, target: "cloud", rerouted });
}

async function handle(res) {
  const wantsOnprem = Math.random() * 100 < migrationPercent;
  if (!wantsOnprem) return viaCloud(res, false);

  // Mitigação (circuit breaker simples): com o on-prem marcado como doente,
  // nem tenta; vai direto ao cloud.
  if (mitigation && !healthy) {
    rerouteCount++;
    return viaCloud(res, true);
  }

  const r = await get(onpremUrl, "/");
  if (r.status === 200) {
    setHealthy(true);
    return send(res, 200, { ok: true, target: "onprem", rerouted: false, cost: parse(r.body).cost });
  }
  setHealthy(false);
  if (!mitigation) return send(res, 503, { ok: false, target: "onprem", rerouted: false });
  rerouteCount++;
  return viaCloud(res, true);
}

async function checkOnpremHealth() {
  const r = await get(onpremUrl, "/health");
  setHealthy(r.status === 200);
}

setInterval(checkOnpremHealth, healthIntervalMs).unref();
checkOnpremHealth();

http.createServer((req, res) => {
  if (req.url === "/config") {
    return send(res, 200, { migrationPercent, mitigation, healthIntervalMs, healthy, rerouteCount });
  }
  handle(res);
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "proxy_started", port, migrationPercent, mitigation }));
});
