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

## Arquitetura

- `proxy` (redes `public_cloud` e `own_dc`): decide, por requisição, se o destino é o cloud ou o on-prem (`MIGRATION_PERCENT`). Com `MITIGATION=on`, faz healthcheck periódico do on-prem e desvia para o cloud quando ele falha.
- `cloud` (rede `public_cloud`): representa o provedor de nuvem pública.
- `onprem` (rede `own_dc`): representa o hardware próprio. A falha é injetada em tempo de execução por `POST /admin/fail` e desfeita por `POST /admin/restore` (só alcançáveis dentro das redes do Compose; a única porta publicada é a do proxy, `8080`).

Cada backend devolve o custo por requisição (`COST_PER_REQUEST`, definido no `docker-compose.yml`); o proxy repassa esse valor e o `experiment.js` soma o que recebe. Existe, portanto, uma única fonte dos preços.

## Pré-requisitos

- Docker Engine com Docker Compose v2 (`docker compose up --wait`)
- Porta local 8080 disponível
- PowerShell (Windows) ou Bash (Linux/macOS)

## Reproduzir tudo (recomendado)

Um único comando sobe cada cenário, roda o experimento e grava **todas** as evidências em `logs/`.

```powershell
# Windows / PowerShell
.\run-experiments.ps1
```

```bash
# Linux / macOS
chmod +x run-experiments.sh && ./run-experiments.sh
```

| Cenário | Proxy | Experimento | Pergunta |
| --- | --- | --- | --- |
| `before` | 100% on-prem, `MITIGATION=off` | falha no on-prem em 500 ms, restaurada em 1500 ms | O que ocorre sem mitigação? |
| `after` | 100% on-prem, `MITIGATION=on` | idem | O healthcheck com fallback reduz o dano? |
| `cloud-baseline` | 0% on-prem | sem falha, rajada de 200 requisições | vazão e custo 100% cloud |
| `onprem-baseline` | 100% on-prem | sem falha, rajada de 200 requisições | vazão e custo 100% on-prem |

Cada cenário executa 3 rodadas de aquecimento (descartadas nas estatísticas, mas registradas com `warmup: true`) e 10 rodadas medidas, cada uma com 200 requisições. O resumo traz a **mediana** (e mín./máx.) das rodadas.

### Arquivos gerados em `logs/` (por cenário `<nome>`)

| Arquivo | Origem |
| --- | --- |
| `<nome>.jsonl` | resultado de cada rodada (`type: "run"`) e resumo (`type: "summary"`), gravado por `experiment.js` |
| `<nome>-config.jsonl` | configuração real lida dos containers (proxy e backends) no início da execução, gravada por `experiment.js` |
| `containers-<nome>.log` | `docker compose logs` (todos os serviços, com prefixo) |
| `container-{proxy,cloud,onprem}-<nome>.log` | logs de cada serviço, sem prefixo; contêm os eventos `fault_injected`, `fault_restored`, `onprem_unhealthy` e `onprem_healthy` |

## Execução manual de um cenário

```powershell
$env:MIGRATION_MODE="onprem"; $env:MIGRATION_PERCENT="100"; $env:MITIGATION="off"
$env:FAILURE_RATE="0"; $env:FORCE_FAILURE="false"
docker compose up -d --build --wait
docker compose exec -T proxy sh -c "EXPERIMENT_MODE=before REQUESTS=200 RUNS=10 WARMUP_RUNS=3 INTERVAL_MS=10 FAULT_AT_MS=500 RESTORE_AT_MS=1500 TARGET_URL=http://localhost:3000 LOG_FILE=/app/logs/before.jsonl node experiment.js"
docker compose logs --no-color | Out-File -Encoding utf8 logs/containers-before.log
docker compose down
```

Em Bash, use `export VAR=valor` no lugar de `$env:VAR="valor"` e `docker compose logs --no-color > logs/containers-before.log`. Para o cenário `after`, use `MITIGATION=on` e `EXPERIMENT_MODE=after`.

Variáveis do `experiment.js`: `REQUESTS`, `RUNS`, `WARMUP_RUNS`, `INTERVAL_MS` (0 = rajada), `FAULT_AT_MS`, `RESTORE_AT_MS`, `TARGET_URL`, `LOG_FILE`.

Para montar a tabela do laudo a partir dos logs (mediana e faixa mín.–máx. de cada métrica), rode no host `node src/summarize-logs.js`.

## Métricas (campos dos `.jsonl`)

| Campo | Definição |
| --- | --- |
| `errorPercent` | % de requisições que o cliente recebeu com status ≥ 500 ou erro de conexão |
| `timeToFailureMs` | da injeção da falha até o primeiro erro visto pelo cliente (`null` = nenhum erro) |
| `timeToRecoveryMs` | do primeiro erro até a primeira resposta bem-sucedida depois do último erro (`0` = nenhum erro; `null` = sem falha injetada ou sem recuperação na janela) |
| `failoverMs` | da injeção da falha até a primeira resposta servida pelo cloud como fallback (só com mitigação) |
| `failbackMs` | da restauração do on-prem até a primeira resposta servida por ele |
| `totalReqPerSec` | requisições enviadas ÷ duração (inclui as que falharam) |
| `goodputReqPerSec` | requisições bem-sucedidas ÷ duração; é a vazão útil e a usada nas comparações |
| `projectedCostCloud` / `projectedCostOnprem` | soma dos custos devolvidos pelos backends nas respostas bem-sucedidas |

## Limitações e leitura dos resultados

- Os preços por requisição (`0.002` no cloud e `0.0002` no on-prem, uma razão de 10×) são **premissas ilustrativas**, não dados do artigo. O artigo da 37signals trata de gastos anuais de US$ 3,2 milhões que cairiam para US$ 1,3 milhão (razão de cerca de 0,4×). Os custos da miniatura servem só para mostrar o modelo de custo, não para prever a economia real.
- O caso da 37signals é uma decisão de custo, não um incidente. A falha injetada no on-prem é um risco da migração que a miniatura expõe, e não um evento descrito no artigo.
- Cada cenário usa um proxy com um único percentual fixo (0% ou 100%); a migração gradual intermediária não foi medida.
- Os tempos vêm de containers numa mesma máquina. A latência de rede, o hardware real e a carga real não são reproduzidos.
- Os valores de `INTERVAL_MS` são aproximados: o agendador de timers do Node pode atrasar os envios em alguns milissegundos.

## Estrutura

- `docker-compose.yml`: proxy, backend cloud e backend on-prem em redes separadas.
- `src/`: serviços Node.js da miniatura (`proxy.js`, `backend.js`, `experiment.js`).
- `run-experiments.ps1` / `run-experiments.sh`: roteiro que reproduz todos os cenários.
- `logs/`: evidências brutas das execuções.
- `IA.md`: registro de uso de IA.
