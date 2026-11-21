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

## Executar a falha

```bash
$env:MIGRATION_MODE="onprem"
$env:MIGRATION_PERCENT="100"
$env:FAILURE_RATE="0"
$env:FORCE_FAILURE="true"
$env:MITIGATION="off"
docker compose up --build
```

Em outro terminal:

```bash
docker compose exec proxy sh -c "EXPERIMENT_MODE=before MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/before.jsonl node experiment.js"
docker compose logs > logs/containers-before.log
```

Pare a execução antes do cenário seguinte:

```bash
docker compose down
```

## Executar a mitigação

Pare os containers e execute:

```bash
$env:MIGRATION_MODE="onprem"
$env:MIGRATION_PERCENT="100"
$env:FAILURE_RATE="0"
$env:FORCE_FAILURE="true"
$env:MITIGATION="on"
docker compose up --build
```

Em outro terminal:

```bash
docker compose exec proxy sh -c "EXPERIMENT_MODE=after MIGRATION_PERCENT=100 REQUESTS=200 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/after.jsonl node experiment.js"
docker compose logs > logs/containers-after.log
```

Com `MITIGATION=on`, o proxy desvia para o backend cloud quando o destino on-prem reporta
falha/indisponibilidade. `FORCE_FAILURE=true` mantém o on-prem indisponível de forma determinística;
`FAILURE_RATE` permanece disponível para testes probabilísticos.

## Estrutura

- `docker-compose.yml`: proxy, backend cloud e backend on-prem em redes separadas.
- `src/`: serviços Node.js da miniatura.
- `logs/`: evidências brutas das execuções.

## Interpretação

O experimento mede vazão, erro, custo por requisição projetado e recuperação. O artigo mede
savings corporativos em dólares ao longo de cinco anos. Por isso, os valores financeiros são
diretamente comparáveis apenas como sinal do modelo de custos, não como previsão da empresa
discente.