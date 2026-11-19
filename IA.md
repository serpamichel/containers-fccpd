# Registro de uso de IA

## Prompt 1 — Resumo do artigo
Solicitei extrair afirmações verificáveis sobre a saída da nuvem, seus custos e o cronograma.
**Aceito:** a estimativa de US$ 10 milhões em cinco anos, US$ 700 mil de hardware e a migração
de serviços em etapas.
**Mudado:** o texto foi ligado apenas às seções do artigo e não foram usadas inferências como
fatos explícitos.
**Descartado:** estimativas externas não presentes no artigo.

## Prompt 2 — Projeto da miniatura
Solicitei um desenho com três containers, duas redes e uma migração cloud/on-prem.
**Aceito:** proxy, backend cloud e backend on-prem.
**Mudado:** adicionei fallback para tornar a mitigação medível.
**Descartado:** orquestração complexa por não agregar ao mecanismo central.

## Prompt 3 — Script de experimento
Solicitei medir erro, vazão e recuperação antes/depois.
**Aceito:** requisições concorrentes e JSON-Lines.
**Mudado:** acrescentei custo projetado por backend.
**Descartado:** nenhuma métrica sem origem em execução foi mantida no laudo.

## Prompt 4 — Estrutura do laudo
Solicitei organizar mecanismo, linha do tempo, limitações, evidências e parecer.
**Aceito:** estrutura em partes A-D.
**Mudado:** revisei os títulos e limites de página.
**Descartado:** linguagem promocional sobre saída da nuvem.

## Prompt 5 — Revisão da reprodutibilidade
Solicitei verificar Compose, README e presença dos logs.
**Aceito:** instruções de Docker Compose.
**Mudado:** corriigi orientação para gerar e validar saídas JSONL.
**Descartado:** sugestões que dependiam de recursos não disponíveis.

## Erros encontrados e correções

1. **O Docker Compose não tinha um comando de inicialização explícito no Dockerfile.**
   Correção: adicionei `CMD ["node", "proxy.js"]`.
2. **O script registrava falha no backend no formato de resposta, mas o proxy só tratava HTTP.**
   Correção: o `/health` passou a retornar status 503 em falha aleatória e o proxy passou a
   aceitar esse status na mitigação.
3. **Os logs iniciais foram gravados em UTF-16 pelo `Tee-Object` do PowerShell.**
   Correção: o README agora padroniza comandos dentro do container e saída JSON-Lines.
