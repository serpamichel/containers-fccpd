const PDFDocument = require("pdfkit");
const fs = require("fs");

const out = "Laudo-37signals-Containers-e-Nuvem.pdf";
const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: "Laudo de Incidente Reproduzido - 37signals" } });
doc.pipe(fs.createWriteStream(out));

function h(text) { doc.moveDown(0.35).font("Helvetica-Bold").fontSize(15).fillColor("#1f3a5f").text(text); doc.moveDown(0.2); }
function sh(text) { doc.moveDown(0.25).font("Helvetica-Bold").fontSize(11).fillColor("#334e68").text(text); doc.moveDown(0.12); }
function p(text) { doc.font("Helvetica").fontSize(9).fillColor("#111").text(text, { align: "justify", lineGap: 2 }); }
function bullets(items) { doc.font("Helvetica").fontSize(9).fillColor("#111"); items.forEach(v => doc.text("• " + v, { indent: 12, lineGap: 2 })); }
function page() { doc.addPage(); }

doc.font("Helvetica-Bold").fontSize(22).fillColor("#1f3a5f").text("Laudo Técnico: saída da nuvem da 37signals", { align: "center" });
doc.moveDown();
doc.font("Helvetica").fontSize(11).fillColor("#334e68").text("Fundamentos de Computação Concorrente — Contêineres e Nuvem", { align: "center" });
doc.moveDown(2);
p("Equipe: Michel dos Santos Serpa e demais integrantes definidos na sala.");
p("Caso analisado: artigo oficial de David Heinemeier Hansson, publicado em 17 de outubro de 2024.");
p("Fonte: https://world.hey.com/dhh/our-cloud-exit-savings-will-now-top-ten-million-over-five-years-c7d9b5bd");
doc.moveDown();
p("Escopo: este trabalho não trata de uma indisponibilidade relatada no artigo. A pergunta foi convertida em uma reprodução do mecanismo operacional central — migração em ondas de aplicações para hardware próprio e o risco de acoplamento a um destino único — e em uma comparação de vazão e custo.");

page();
h("Parte A — Mecanismo e conceito");
sh("Mecanismo em uma frase");
p("A 37signals concentrou, migrou e validou workloads em infraestrutura própria enquanto removia dependências gerenciadas da AWS, fazendo uma mudança controlada de plataforma para reduzir custo recorrente e evitar dependência de uma nuvem.");
sh("Linha do tempo localizada no artigo");
bullets([
"19 de outubro de 2022 — artigo “Why we're leaving the cloud”: 37signals tinha cargas estáveis e considerou que o custo de aluguel não compensava; o artigo também identifica imprevisibilidade de carga como situação em que nuvem faz sentido.",
"21 de fevereiro de 2023 — artigo “We stand to save $7m”: o hardware era estimado em cerca de US$ 600 mil; o plano amortizava servidores em cinco anos e previa US$ 7 milhões de economia.",
"23 de junho de 2023 — artigo “We have left the cloud”: seis meses levaram à saída das seis primeiras famílias de serviços e da HEY; a migração ocorreu em etapas independentes, não como uma mudança única.",
"17 de outubro de 2024 — seção introdutória deste artigo: o gasto anual caiu de US$ 3,2 milhões para US$ 1,3 milhões, quase US$ 2 milhões por ano de economia.",
"17 de outubro de 2024 — seção “Move out next summer”: o restante seria S3; a compra de hardware de 18 PB para dois DCs custaria aproximadamente o gasto anual com S3 e elevaria a economia projetada para mais de US$ 10 milhões em cinco anos."
]);
sh("Conceito da disciplina");
p("O conceito principal é acoplamento e dependência operacional do destino único. Durante a migração, uma aplicação pode depender simultaneamente de provedores ou locais. Uma falha em um destino migrado pode degradar o fluxo inteiro se não houver fallback ou isolamento. Também aparece ponto único de falha: o destino on-prem concentrado na miniatura é único. A mitigação usa healthcheck funcional e rerroteamento.");

page();
h("Parte B — Miniatura e limitações");
p("Diagrama: Cliente → proxy (rede pública + rede do DC próprio) → backend cloud, ou → backend on-prem. São três containers em duas redes Docker.");
sh("Correspondência das peças");
bullets([
"proxy: roteador de tráfego, controlador de migração e healthcheck; representa o ponto em que a equipe escolhe uma plataforma durante a transição.",
"cloud: backend disponível da AWS; representa um serviço gerenciado antes da saída.",
"onprem: backend próprio com falha simulada; representa hardware próprio em um data center.",
"rede public_cloud: alcança o proxy e o backend cloud.",
"rede own_dc: alcança o proxy e o backend on-prem."
]);
sh("Limitações específicas")
bullets([
"Falha sintética probabilística em /health. Efeito: mede 50% configurado de indisponibilidade, não uma falha real de migração ou hardware.",
"Ausência de dados, identidade, cache e DNS reais. Efeito: não avalia consistência, perda de dados ou latência geográfica.",
"Custo usa constantes de US$ 0,002/cloud e US$ 0,0002/on-prem por requisição. Efeito: demonstra diferença relativa, não o custo real da 37signals.",
"Um único host por destino. Efeito: não captura redundância intra-DC nem latência/replicações entre regiões.",
"O experimento não mede migração passo a passo de um banco ou armazenamento real. Efeito: não avalia downtime ou integridade de dados."
]);

page();
h("Parte C — Experimento e evidência");
sh("Método")
p("Foram geradas 200 requisições HTTP concorrentes contra o proxy com MIGRATION_PERCENT=100. Sem mitigação, o proxy não desvia uma resposta 503. Com mitigation=on, a resposta 503 provoca fallback ao backend cloud.");
sh("Medidas antes e depois")
bullets([
"Antes: 200 requisições, 116 sucessos, 84 erros, 42% de erro, vazão 487,80 req/s e primeira falha em 357 ms — logs/before.jsonl.",
"Depois: 200 requisições, 200 sucessos, 0 erros, 0% de erro, vazão 272,11 req/s e corrida concluída em 735 ms — logs/after.jsonl.",
"Custos projetados da amostra: antes, US$ 0,0232 em on-prem; depois, US$ 0,20 em fallback cloud e US$ 0,0200 em on-prem — logs/after.jsonl.",
"A relação on-prem/cloud após o fallback foi 0,10, isto é, um custo projetado on-prem dez vezes menor por evento da amostra."
]);
p("Comparação com o caso real: o artigo não fornece duração de falha, vazão ou disponibilidade. Reporta economia, hardware e migração: gasto anual cloud de US$ 3,2 milhões para US$ 1,3 milhão em 2024, US$ 700 mil de hardware já recuperados e projeção acima de US$ 10 milhões em cinco anos. Os números da miniatura são relativos à disponibilidade; não validam nem recalculam esses savings.");
sh("Surpresa observada")
p("A mitigação reduziu erros de 42% para 0%, mas a vazão caiu de 487,80 para 272,11 req/s. Uma explicação encontrada é o custo adicional da verificação de saúde e do encaminhamento para outro backend por falhas aleatórias. Esse resultado não prova piora operacional real; mostra que disponibilidade e vazão podem exigir medições separadas.");

page();
h("Parte D — Parecer para a diretora");
p("A recomendação não é migrar tudo de uma vez. Para este projeto acadêmico, o mesmo mecanismo poderia aparecer no proxy/Docker Compose atual se ele fosse usado em produção sem healthcheck e com uma dependência exclusiva em um único backend. Neste repositório, o ponto está em docker-compose.yml: proxy depende apenas de cloud e onprem; a mitigação é controlada por MITIGATION e MIGRATION_PERCENT nas linhas de ambiente. README.md explica executar antes e depois.");
p("O parecer é: a saída da nuvem pode ser economicamente plausível apenas quando cargas são previsíveis, o hardware existe ou pode ser contratado, storage/maturidade são dimensionados e a equipe aceita operar servidores. Para um projeto estudantil ou startup em carga irregular, nuvem ainda oferece elasticidade e menor custo inicial. Não usar o artigo como garantia; fazer benchmark próprio de custo total, disponibilidade e equipe.");
sh("Mitigação implementada e medição")
p("Fallback por healthcheck: com MITIGATION=on, o destino on-prem com 503 ou erro de rede é substituído pelo backend cloud. Antes: 42% de erro. Depois: 0% de erro. Tempo medido da execução após a mitigação: 735 ms, registrado em logs/after.jsonl. Esta não é uma métrica de tempo de recuperação do evento real, mas o tempo completo da bateria após o fallback.");
sh("Decisão")
p("Recomendação condicional: iniciar prova limitada em uma carga estável e reversível, medir custo total e disponibilidade, manter rollback para nuvem e ampliar em ondas. Não mover dados críticos ou workloads de pico sem testes de consistência e redundância.");

page();
h("Reprodutibilidade e rastreabilidade");
sh("Arquivos exigidos")
bullets([
"docker-compose.yml — três serviços e duas redes.",
"src/backend.js — backends cloud/on-prem e parâmetro FAILURE_RATE.",
"src/proxy.js — migração e fallback com healthcheck.",
"src/experiment.js — batelada de 200 requisições e JSON-Lines.",
"logs/before.jsonl — execução sem mitigação.",
"logs/after.jsonl — execução com fallback.",
"README.md — passos para Docker Compose.",
"IA.md — prompts e erros corrigidos."
]);
sh("Comandos principais")
p("Sem mitigação: MIGRATION_MODE=onprem MIGRATION_PERCENT=100 FAILURE_RATE=0.5 MITIGATION=off docker compose up --build.");
p("Com mitigação: MIGRATION_MODE=onprem MIGRATION_PERCENT=100 FAILURE_RATE=0.5 MITIGATION=on docker compose up --build.");
p("A execução final de referência desta versão foi realizada em 19 de novembro de 2026 com os registros brutos em logs/. Como Docker não estava disponível no ambiente, a execução do script foi feita localmente em processos Node.js equivalentes; o Compose permanece a interface reproduzível indicada no README.");
sh("Nota bibliográfica")
p("DHH, “Our cloud-exit savings will now top ten million over five years”, 17 de outubro de 2024. Links complementares citados no texto: “Why we're leaving the cloud” (19/10/2022), “We stand to save $7m over five years” (21/02/2023) e “We have left the cloud” (23/06/2023).");

doc.end();
