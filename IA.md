# Registro de uso de IA

## Prompt 1 — Resumo verificável do artigo
Solicitamos identificar afirmações explícitas sobre migração, hardware, custos e cronograma.
**Aceito:** as cifras de US$ 3,2 milhões/US$ 1,3 milhão, US$ 700 mil de hardware e projeção acima
de US$ 10 milhões em cinco anos.
**Mudado:** cada afirmação foi separada da interpretação da equipe e limitada ao texto do artigo.
**Descartado:** comparações com incidentes ou provedores não presentes na fonte.

## Prompt 2 — Arquitetura da miniatura
Solicitamos uma arquitetura com três containers, duas redes e mecanismos de migração/fallback.
**Aceito:** proxy, backend cloud e backend on-prem.
**Mudado:** foi acrescido um modo determinístico de falha e healthcheck.
**Descartado:** Kubernetes e múltiplas réplicas, que não eram necessárias ao mecanismo central.

## Prompt 3 — Script de medição
Solicitamos medir vazão, erro, custo projetado e tempo até o fallback.
**Aceito:** execução de 200 requisições e saída JSON-Lines.
**Mudado:** a taxa probabilística foi complementada por `FORCE_FAILURE=true` e, depois, por injeção de falha em tempo de execução (`/admin/fail`).
**Descartado:** métricas de recuperação sem uma origem direta nas respostas do proxy (hoje medidas pelo cliente, em experiment.js: 	imeToRecoveryMs, ailoverMs, ailbackMs).

## Prompt 4 — Revisão da reprodutibilidade
Solicitamos comparar comandos do README, portas do Compose e caminhos dos logs.
**Aceito:** variáveis de ambiente do Compose e volume compartilhado em `logs/`.
**Mudado:** os exemplos passaram a usar sintaxe PowerShell e `localhost:3000` dentro do container.
**Descartado:** gravar `logs/` usando caminhos absolutos do ambiente local.

## Prompt 5 — Organização do registro de erros observados
Solicitamos estruturar o registro dos erros que encontramos ao executar e revisar a implementação.
**Aceito:** o formato que separa observação, correção e arquivo afetado.
**Mudado:** mantive os erros como resultados das nossas execuções e revisões, sem apresentá-los
como diagnósticos originados pela IA.
**Descartado:** afirmar que um erro foi corrigido sem registrar sua evidência ou teste.

## Erros encontrados e correções

1. **O comando do experimento apontava para `localhost:8080`, que é a porta publicada no host,
   não a porta interna do proxy no container.**
   Correção: o README passou a usar `TARGET_URL=http://localhost:3000` dentro do container.

2. **Falhas aleatórias não garantiam um experimento antes/depois comparável.**
   Correção: foi adicionado `FORCE_FAILURE=true`, que mantém o backend on-prem indisponível
   independentemente de `FAILURE_RATE`.

3. **O proxy redirecionava por erros de rede mesmo sem mitigação, misturando os cenários.**
   Correção: o redirecionamento passou a ocorrer exclusivamente quando `MITIGATION=on`.

4. **O código calculava `costRatioOnpremCloud` com divisão por zero.**
   Correção: o campo recebe `null` quando não houve custo cloud na amostra.

5. **Os logs não registravam com precisão a configuração usada em cada execução.**
   Correção: foram adicionados `before-config.jsonl` e `after-config.jsonl`.

## Prompt 6 — Revisão de conformidade com o enunciado
Solicitamos a um assistente de IA que comparasse o repositório com o enunciado do trabalho e corrigisse as inconsistências.
**Aceito:** os apontamentos 6 a 11 abaixo, verificados lendo o código, e o roteiro `run-experiments` que gera todos os logs.
**Mudado:** os números antigos de `logs/` foram removidos (continuam no histórico do Git), porque vinham de portas e de um formato que o README não reproduzia. Eles devem ser regenerados pelo roteiro antes da entrega.
**Descartado:** reaproveitar os logs antigos no laudo.

6. **Os logs antigos mostravam portas 3050–3072 e prefixos ausentes, diferentes do Compose e do `docker compose logs`.**
   Correção: `run-experiments.ps1` e `run-experiments.sh` rodam cada cenário com o Compose e gravam todos os arquivos de `logs/`. Evidência: `logs/containers-*.log` e `logs/*-config.jsonl` regenerados.

7. **`proxy.js` marcava o on-prem como indisponível quando o cloud falhava e fazia o fallback em `/health` do cloud.**
   Correção: `healthy` passou a refletir só o on-prem, e o fallback faz `GET /` no cloud e repassa o custo.

8. **`firstFailureMs` não era um tempo até a falha: a falha existia desde o boot.**
   Correção: o `experiment.js` injeta a falha em `FAULT_AT_MS` e a restaura em `RESTORE_AT_MS`; `timeToFailureMs` e `timeToRecoveryMs` partem desses instantes.

9. **A "vazão" do cenário `before` contava requisições que falharam.**
   Correção: o log traz `goodputReqPerSec` (apenas sucessos) além de `totalReqPerSec`.

10. **Uma única execução por cenário gerava a diferença de vazão cloud × on-prem (588 contra 182 req/s) com código idêntico nos dois backends.**
    Correção: 3 rodadas de aquecimento descartadas e 10 rodadas medidas, com mediana, mínimo e máximo. Evidência: `logs/cloud-baseline.jsonl` e `logs/onprem-baseline.jsonl`.

11. **Os preços estavam duplicados em `experiment.js` e no Compose, sem uso no proxy.**
    Correção: o custo vem de `COST_PER_REQUEST` do Compose, via resposta dos backends.
