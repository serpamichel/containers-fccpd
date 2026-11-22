const http = require("http");

const kind = process.argv[2] || process.env.SERVICE || "cloud";
const port = Number(process.env.PORT || (kind === "cloud" ? 3001 : 3002));
const cost = Number(process.env.COST_PER_REQUEST || (kind === "cloud" ? 0.002 : 0.0002));
const failureRate = Number(process.env.FAILURE_RATE || 0);
const initialForceFailure = process.env.FORCE_FAILURE === "true";

// Estado de falha em tempo de execução. Pode ser alternado pelos endpoints
// /admin/fail e /admin/restore (alcançáveis só dentro das redes do Compose).
let forceFailure = initialForceFailure;
const shouldFail = () => forceFailure || Math.random() < failureRate;

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

http.createServer((req, res) => {
  if (req.url === "/admin/state") {
    return json(res, 200, {
      service: kind,
      forceFailure,
      initialForceFailure,
      failureRate,
      costPerRequest: cost
    });
  }
  if (req.url === "/admin/fail" || req.url === "/admin/restore") {
    forceFailure = req.url === "/admin/fail";
    console.log(JSON.stringify({
      event: forceFailure ? "fault_injected" : "fault_restored",
      service: kind,
      timestampUtc: new Date().toISOString()
    }));
    return json(res, 200, { service: kind, forceFailure });
  }
  if (req.url === "/health") {
    return shouldFail()
      ? json(res, 503, { status: "failed", service: kind })
      : json(res, 200, { status: "ok", service: kind });
  }
  if (shouldFail()) return json(res, 503, { service: kind, error: "simulated_failure" });
  return json(res, 200, { service: kind, cost });
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "backend_started", service: kind, port }));
});
