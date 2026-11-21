# Miniatura do caso 37signals — saída da nuvem

## Integrantes

| Integrante | Perfil | Foto |
| --- | --- | --- |
| Davi Lucas Da Silva Pinheiro | [github.com/davi081dev](https://github.com/davi081dev) | [![Davi Lucas](https://github.com/davi081dev.png?size=96)](https://github.com/davi081dev) |
| Hugo Mendonça | [github.com/BRKHugz](https://github.com/BRKHugz) | [![Hugo Vinicius de Lima Mendonça](https://github.com/BRKHugz.png?size=96)](https://github.com/BRKHugz) |
| Luiz Fernando Ramos de Toledo | [github.com/FernandoToledo69](https://github.com/FernandoToledo69) | [![Luiz Fernando Ramos de Toledo](https://github.com/FernandoToledo69.png?size=96)](https://github.com/FernandoToledo69) |
| Michel dos Santos Serpa | [github.com/serpamichel](https://github.com/serpamichel) | [![Michel dos Santos Serpa](https://github.com/serpamichel.png?size=96)](https://github.com/serpamichel) |

Este experimento representa o mecanismo central da decisão apresentada por 37signals:
a concentração de infraestrutura em fornecedores gerenciados e a transição gradual para
hardware próprio. Não representa a operação real de migração nem uma avaliação completa
do retorno financeiro.

## Pré-requisitos

- Docker Engine com Docker Compose v2
- Uma porta local 8080 disponível

## Executar os cenários

### PowerShell (Windows)

#### Antes da mitigação

```powershell
$env:MIGRATION_MODE="onprem"
$env:MIGRATION_PERCENT="100"
$env:FAILURE_RATE="0"
$env:FORCE_FAILURE="true"
$env:MITIGATION="off"
docker compose up --build
```

Em outro terminal:

```powershell
docker compose exec proxy sh -c "EXPERIMENT_MODE=before MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/before.jsonl node experiment.js"
docker compose logs | Out-File -Encoding utf8 logs/containers-before.log
docker compose down
```

#### Depois da mitigação

```powershell
$env:MIGRATION_MODE="onprem"
$env:MIGRATION_PERCENT="100"
$env:FAILURE_RATE="0"
$env:FORCE_FAILURE="true"
$env:MITIGATION="on"
docker compose up --build
```

Em outro terminal:

```powershell
docker compose exec proxy sh -c "EXPERIMENT_MODE=after MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/after.jsonl node experiment.js"
docker compose logs | Out-File -Encoding utf8 logs/containers-after.log
docker compose down
```

### Bash (Linux/macOS)

```bash
MIGRATION_MODE=onprem MIGRATION_PERCENT=100 FAILURE_RATE=0 FORCE_FAILURE=true MITIGATION=off docker compose up --build
```

Em outro terminal:

```bash
docker compose exec proxy sh -c "EXPERIMENT_MODE=before MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/before.jsonl node experiment.js"
docker compose logs > logs/containers-before.log
docker compose down
```

Depois da mitigação:

```bash
MIGRATION_MODE=onprem MIGRATION_PERCENT=100 FAILURE_RATE=0 FORCE_FAILURE=true MITIGATION=on docker compose up --build
```

Em outro terminal:

```bash
docker compose exec proxy sh -c "EXPERIMENT_MODE=after MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/after.jsonl node experiment.js"
docker compose logs > logs/containers-after.log
docker compose down
```

Com `MITIGATION=on`, o proxy desvia para o backend cloud quando o destino on-prem reporta
falha/indisponibilidade. `FORCE_FAILURE=true` mantém o on-prem indisponível de forma determinística;
`FAILURE_RATE` permanece disponível para testes probabilísticos.

### Baselines de custo e vazão

Para a comparação limpa exigida pelos artigos 7 e 8:

```powershell
# Cenário 100% cloud
$env:MIGRATION_PERCENT="0"
$env:MIGRATION_MODE="cloud"
$env:FORCE_FAILURE="false"
$env:MITIGATION="off"
docker compose up --build
docker compose exec proxy sh -c "EXPERIMENT_MODE=cloud-baseline MIGRATION_PERCENT=0 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/cloud-baseline.jsonl node experiment.js"

# Cenário 100% on-prem saudável
$env:MIGRATION_PERCENT="100"
$env:MIGRATION_MODE="onprem"
$env:FORCE_FAILURE="false"
$env:FAILURE_RATE="0"
$env:MITIGATION="off"
docker compose up --build
docker compose exec proxy sh -c "EXPERIMENT_MODE=onprem-baseline MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/onprem-baseline.jsonl node experiment.js"
```

## Estrutura

- `docker-compose.yml`: proxy, backend cloud e backend on-prem em redes separadas.
- `src/`: serviços Node.js da miniatura.
- `logs/`: evidências brutas das execuções.

## Interpretação

O experimento mede vazão, erro, custo por requisição projetado e recuperação. O artigo mede
savings corporativos em dólares ao longo de cinco anos. Por isso, os valores financeiros são
diretamente comparáveis apenas como sinal do modelo de custos, não como previsão da empresa
discente.