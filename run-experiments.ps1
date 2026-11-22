# Roda os 4 cenarios com Docker Compose e grava TODAS as evidencias em logs/.
# Uso (PowerShell, a partir da raiz do repositorio): .\run-experiments.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
New-Item -ItemType Directory -Force logs | Out-Null

$Requests = 200
$Runs = 10
$WarmupRuns = 3

function Invoke-Compose {
    # Interrompe o script se o docker devolver codigo de saida diferente de zero.
    & docker compose @args
    if ($LASTEXITCODE -ne 0) { throw "docker compose $args falhou (codigo $LASTEXITCODE)" }
}

function Run-Scenario($Name, $Percent, $Mitigation, $ExperimentEnv) {
    Write-Host "=== Cenario: $Name ==="
    & docker compose down --remove-orphans 2>$null | Out-Null
    $env:MIGRATION_PERCENT = "$Percent"
    $env:MIGRATION_MODE = if ($Percent -eq 0) { "cloud" } else { "onprem" }
    $env:MITIGATION = $Mitigation
    $env:FAILURE_RATE = "0"
    $env:FORCE_FAILURE = "false"
    Invoke-Compose up -d --build --wait
    $cmd = "EXPERIMENT_MODE=$Name REQUESTS=$Requests RUNS=$Runs WARMUP_RUNS=$WarmupRuns $ExperimentEnv TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/$Name.jsonl node experiment.js"
    Invoke-Compose exec -T proxy sh -c $cmd
    docker compose logs --no-color | Out-File -Encoding utf8 "logs/containers-$Name.log"
    foreach ($svc in "proxy", "cloud", "onprem") {
        docker compose logs --no-color --no-log-prefix $svc | Out-File -Encoding utf8 "logs/container-$svc-$Name.log"
    }
    Invoke-Compose down --remove-orphans
}

# Falha injetada no on-prem em 500 ms e restaurada em 1500 ms (carga com 1 requisicao a cada 10 ms).
$Fault = "INTERVAL_MS=10 FAULT_AT_MS=500 RESTORE_AT_MS=1500"
Run-Scenario "before"          100 "off" $Fault
Run-Scenario "after"           100 "on"  $Fault
Run-Scenario "cloud-baseline"  0   "off" "INTERVAL_MS=0"
Run-Scenario "onprem-baseline" 100 "off" "INTERVAL_MS=0"
Write-Host "Concluido. Evidencias em logs/"
