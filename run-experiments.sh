#!/usr/bin/env bash
# Roda os 4 cenários com Docker Compose e grava TODAS as evidências em logs/.
# Uso: ./run-experiments.sh   (a partir da raiz do repositório)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p logs

REQUESTS=200
RUNS=10
WARMUP_RUNS=3

run_scenario() {
  local name="$1" percent="$2" mitigation="$3" experiment_env="$4"
  echo "=== Cenário: $name ==="
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  export MIGRATION_PERCENT="$percent" MIGRATION_MODE="$([ "$percent" = "0" ] && echo cloud || echo onprem)"
  export MITIGATION="$mitigation" FAILURE_RATE=0 FORCE_FAILURE=false
  docker compose up -d --build --wait
  docker compose exec -T proxy sh -c "EXPERIMENT_MODE=$name REQUESTS=$REQUESTS RUNS=$RUNS WARMUP_RUNS=$WARMUP_RUNS $experiment_env TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/$name.jsonl node experiment.js"
  docker compose logs --no-color > "logs/containers-$name.log"
  for svc in proxy cloud onprem; do
    docker compose logs --no-color --no-log-prefix "$svc" > "logs/container-$svc-$name.log"
  done
  docker compose down --remove-orphans
}

# Falha injetada no on-prem em 500 ms e restaurada em 1500 ms (carga com 1 requisição a cada 10 ms).
FAULT="INTERVAL_MS=10 FAULT_AT_MS=500 RESTORE_AT_MS=1500"
run_scenario before          100 off "$FAULT"
run_scenario after           100 on  "$FAULT"
run_scenario cloud-baseline  0   off "INTERVAL_MS=0"
run_scenario onprem-baseline 100 off "INTERVAL_MS=0"
echo "Concluído. Evidências em logs/"
