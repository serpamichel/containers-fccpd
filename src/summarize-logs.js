// Imprime, em Markdown, a tabela de resultados a partir de logs/*.jsonl (linhas "summary").
// Uso: node src/summarize-logs.js [pasta-de-logs]   (padrão: ./logs ou /app/logs)
const fs = require("fs");
const path = require("path");

const dir = process.argv[2] || (fs.existsSync("logs") ? "logs" : "../logs");
const order = ["cloud-baseline", "onprem-baseline", "before", "after"];
const cols = [
  ["errorPercent", "% erro"],
  ["timeToFailureMs", "tempo até a falha (ms)"],
  ["timeToRecoveryMs", "tempo até a recuperação (ms)"],
  ["failoverMs", "failover (ms)"],
  ["failbackMs", "failback (ms)"],
  ["goodputReqPerSec", "vazão útil (req/s)"],
  ["totalReqPerSec", "vazão total (req/s)"],
  ["projectedCostCloud", "custo cloud"],
  ["projectedCostOnprem", "custo on-prem"]
];
const fmt = v => (v === null || v === undefined ? "–" : String(v));

console.log("| cenário (arquivo) | " + cols.map(c => c[1]).join(" | ") + " |");
console.log("| --- |" + cols.map(() => " --- |").join(""));
for (const name of order) {
  const file = path.join(dir, name + ".jsonl");
  if (!fs.existsSync(file)) { console.log(`| ${name} (ausente) |` + cols.map(() => " |").join("")); continue; }
  const lines = fs.readFileSync(file, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const s = lines.find(l => l.type === "summary");
  if (!s) continue;
  console.log(`| ${name} (logs/${name}.jsonl, mediana de ${s.measuredRuns} rodadas) | ` +
    cols.map(([k]) => `${fmt(s[k])} [${fmt(s[k + "Min"])}–${fmt(s[k + "Max"])}]`).join(" | ") + " |");
}
