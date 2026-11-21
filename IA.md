# Registro de uso de IA

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
**Aceito:** execução concorrente de 200 requisições e saída JSON-Lines.
**Mudado:** a taxa probabilística foi complementada por `FORCE_FAILURE=true`.
**Descartado:** métricas de recuperação sem uma origem direta no estado do proxy.

## Prompt 4 — Revisão da reprodutibilidade
Solicitei comparar comandos do README, portas do Compose e caminhos dos logs.
**Aceito:** variáveis de ambiente do Compose e volume compartilhado em `logs/`.
**Mudado:** os exemplos passaram a usar sintaxe PowerShell e `localhost:3000` dentro do container.
**Descartado:** gravar `logs/` usando caminhos absolutos do ambiente local.

## Prompt 5 — Registro de erros e correções
Solicitei identificar pelo menos dois erros que poderiam ser encontrados ao executar o código.
**Aceito:** falha aleatória, destino errado no experimento e ausência de configuração bruta.
**Mudado:** cada correção foi associada ao arquivo que a implementa.
**Descartado:** alegações sobre PDF ou execução Docker não observadas neste ambiente.

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
