const http = require("http");

const port = Number(process.env.PORT || 3000);
const cloudUrl = new URL(process.env.CLOUD_URL);
const onpremUrl = new URL(process.env.ONPREM_URL);
const initialMode = process.env.MIGRATION_MODE || "cloud";
let migrationPercent = Number(process.env.MIGRATION_PERCENT || 0);
const mitigation = process.env.MITIGATION === "on";
let healthy = true;
let rerouteCount = 0;

function targetRequest(req) {
  const useOnprem = mitigation
    ? (Math.random() * 100 < migrationPercent && healthy)
    : (initialMode === "onprem" || Math.random() * 100 < migrationPercent);
  return useOnprem ? onpremUrl : cloudUrl;
}

function forward(req, res) {
  const base = targetRequest(req);
  const options = { hostname: base.hostname, port: base.port, path: "/health", method: "GET" };
  const request = http.request(options, response => {
    let body = "";
    response.on("data", chunk => body += chunk);
    response.on("end", () => {
      if (response.statusCode === 200) {
        healthy = true;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, target: base.hostname, reroutes: rerouteCount }));
      } else {
        healthy = false;
        rerouteCount++;
        if (mitigation) forwardToCloud(res);
        else {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, target: base.hostname }));
        }
      }
    });
  });
  request.on("error", () => {
    healthy = false;
    rerouteCount++;
    forwardToCloud(res);
  });
  request.end();
}

function forwardToCloud(res) {
  const base = cloudUrl;
  const request = http.request({ hostname: base.hostname, port: base.port, path: "/health", method: "GET" }, response => {
    res.writeHead(response.statusCode === 200 ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: response.statusCode === 200, target: base.hostname, rerouted: true }));
  });
  request.on("error", () => {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, target: "none" }));
  });
  request.end();
}

http.createServer((req, res) => {
  if (req.url === "/config") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ migrationPercent, mitigation, healthy, rerouteCount }));
    return;
  }
  forward(req, res);
}).listen(port, "0.0.0.0", () => {
  console.log(JSON.stringify({ event: "proxy_started", port, migrationPercent, mitigation }));
});
