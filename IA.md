# Registro de uso de IA

Os cinco prompts abaixo são os mais relevantes para o trabalho; o registro resume
as solicitações e as decisões da equipe.

## Prompt 1 — Resumo verificável do artigo
Solicitei identificar afirmações explícitas sobre migração, hardware, custos e cronograma.
**Aceito:** as cifras de US$ 3,2 milhões/US$ 1,3 milhão, US$ 700 mil de hardware e projeção acima
de US$ 10 milhões em cinco anos.
**Mudado:** cada afirmação foi separada da interpretação da equipe e limitada ao texto do artigo.
**Descartado:** comparações com incidentes ou provedores não presentes na fonte.

## Prompt 2 — Arquitetura da miniatura
Solicitei uma arquitetura com três containers, duas redes e mecanismos de migração/fallback.
**Aceito:** proxy, backend cloud e backend on-prem.
**Mudado:** foi acrescido um modo determinístico de falha e healthcheck.
**Descartado:** Kubernetes e múltiplas réplicas, que não eram necessárias ao mecanismo central.

## Prompt 3 — Script de medição
Solicitei medir vazão, erro, custo projetado e tempo até o fallback.
**Aceito:** execução de 200 requisições e saída JSON-Lines.
**Mudado:** a taxa probabilística foi complementada por `FORCE_FAILURE=true` e, depois, por injeção de falha em tempo de execução (`/admin/fail`).
**Descartado:** métricas de recuperação sem uma origem direta nas respostas do proxy; elas são medidas pelo cliente em `src/experiment.js` (`timeToRecoveryMs`, `failoverMs` e `failbackMs`).

## Prompt 4 — Revisão da reprodutibilidade
Solicitei comparar comandos do README, portas do Compose e caminhos dos logs.
**Aceito:** variáveis de ambiente do Compose e volume compartilhado em `logs/`.
**Mudado:** os exemplos passaram a usar sintaxe PowerShell e `localhost:3000` dentro do container.
**Descartado:** gravar `logs/` usando caminhos absolutos do ambiente local.

## Prompt 5 — Revisão de conformidade com o enunciado
Solicitei comparar o repositório com o enunciado e apontar inconsistências verificáveis.
**Aceito:** os apontamentos sobre mecanismo, métricas e rastreabilidade, após conferir código e logs.
**Mudado:** o roteiro `run-experiments` passou a gerar as evidências dos quatro cenários.
**Descartado:** reaproveitar números de execuções antigas que não eram reproduzíveis pelos scripts atuais.

## Erros encontrados e correções

Os itens abaixo registram problemas encontrados durante a implementação e revisão.
A equipe confirmou que os itens 4, 5, 6 e 10 foram erros de respostas da IA; os demais
ficam registrados como problemas encontrados, sem atribuição de autoria.

1. **O comando do experimento apontava para `localhost:8080`, que é a porta publicada no host,
   não a porta interna do proxy no container.**
   Correção: o README passou a usar `TARGET_URL=http://localhost:3000` dentro do container.

2. **Falhas aleatórias não garantiam um experimento antes/depois comparável.**
   Correção: foi implementada a injeção programada por `/admin/fail` e `/admin/restore`.
   `FORCE_FAILURE` permanece como opção do backend, mas os cenários registrados começam com
   `FORCE_FAILURE=false` e usam injeção em tempo de execução (`FAULT_AT_MS` e `RESTORE_AT_MS`).

3. **O proxy redirecionava por erros de rede mesmo sem mitigação, misturando os cenários.**
   Correção: o redirecionamento passou a ocorrer exclusivamente quando `MITIGATION=on`.

4. **Erro da IA confirmado:** foi sugerido calcular `costRatioOnpremCloud` por divisão direta.
   Ao executar o cenário 100% on-prem, não havia custo cloud e a razão ficava indefinida.
   Correção: representar a razão como `null` quando o denominador é zero, em vez de publicar
   um número inválido. Esse campo pertencia ao cálculo anterior e não é produzido pelo schema
   atual dos logs.

5. **Erro da IA confirmado:** uma versão do experimento não registrava a configuração efetiva
   de cada cenário, o que impedia conferir os números com a execução.
   Correção: `experiment.js` grava um arquivo de configuração por cenário. Verificação:
   `logs/before-config.jsonl` e `logs/after-config.jsonl` registram a configuração e os
   parâmetros temporais usados.

6. **Erro da IA confirmado:** uma versão anterior do roteiro/log usava portas 3050–3072
   e saídas sem os prefixos esperados pelo Compose.
   Correção: os roteiros atuais sobem os serviços pelo Compose e salvam logs com os nomes
   de serviço e as configurações; conferimos `logs/containers-before.log`,
   `logs/container-proxy-before.log` e `logs/before-config.jsonl`.

7. **`proxy.js` marcava o on-prem como indisponível quando o cloud falhava e fazia o fallback em `/health` do cloud.**
   Correção: `healthy` passou a refletir só o on-prem, e o fallback faz `GET /` no cloud e repassa o custo.

8. **`firstFailureMs` não era um tempo até a falha: a falha existia desde o boot.**
   Correção: o `experiment.js` injeta a falha em `FAULT_AT_MS` e a restaura em `RESTORE_AT_MS`; `timeToFailureMs` e `timeToRecoveryMs` partem desses instantes.

9. **A "vazão" do cenário `before` contava requisições que falharam.**
   Correção: o log traz `goodputReqPerSec` (apenas sucessos) além de `totalReqPerSec`.

10. **Erro da IA confirmado:** uma resposta tratou uma única rodada de vazão como conclusão
    comparativa, embora os backends executem o mesmo código.
    Ao repetir as execuções, observamos grande variação entre rodadas. Correção: o roteiro
    descarta 3 aquecimentos e mede 10 rodadas, reportando mediana e faixa. Os baselines atuais
    têm medianas de 2185,855 req/s (cloud) e 3348,215 req/s (on-prem), com faixas
    1098,9–2941,18 e 921,66–4347,83, respectivamente; por isso não concluímos que o hardware
    on-prem é mais rápido. Evidência: `logs/cloud-baseline.jsonl` e `logs/onprem-baseline.jsonl`.

11. **Os preços estavam duplicados em `experiment.js` e no Compose, sem uso no proxy.**
    Correção: o custo vem de `COST_PER_REQUEST` do Compose, via resposta dos backends.
