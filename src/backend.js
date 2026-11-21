const http = require("http");

const kind = process.argv[2] || process.env.SERVICE || "cloud";
const port = Number(process.env.PORT || (kind === "cloud" ? 3001 : 3002));
const cost = Number(process.env.COST_PER_REQUEST || (kind === "cloud" ? 0.002 : 0.0002));
const failureRate = Number(process.env.FAILURE_RATE || 0);
const forceFailure = process.env.FORCE_FAILURE === "true";
const shouldFail = () => forceFailure || Math.random() < failureRate;

http.createServer((req, res) => {
  if (req.url === "/health") {
    if (shouldFail()) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "failed", service: kind }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: kind }));
    return;
  }
  if (shouldFail()) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ service: kind, error: "simulated_failure" }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ service: kind, cost }));
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "backend_started", service: kind, port }));
});
