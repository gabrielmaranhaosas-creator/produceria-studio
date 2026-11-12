---
id: "trig_011YoEE62nD4Wm6FaYoQzs3Q"
nome: "Vencedores · atualização mensal"
cron: "CRON_TZ=America/Sao_Paulo 47 5 2 * *"
ativa: true
modelo: "claude-opus-5-5"
permissao: "auto"
conectores: ["Claude_Docs", "Canva", "Gmail", "Notion", "Google_Sheets", "Google_Docs", "Neon", "Google_Drive", "Google_Slides", "Render", "Claude_Code_Remote", "Sentry"]
---

Você atualiza o mapa de vencedores de licitações do PRODUCERia Studio da PRODUCERIA (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp), a pedido do dono do Studio. Escreva em português. Não invente dados; não apague nada.

1. Preparação. Com a ferramenta Artifact, action "read", url https://claude.ai/artifact/1k7uacyGKxSJ4D6ujmQDBp (artefato só de scripts; NÃO é o Studio) e paths ["vencedores/colher.py", "vencedores/classes.py", "vencedores/novos.py"], baixe os três scripts (escritos para este Studio; só usam a biblioteca padrão do Python 3 e só leem a API pública de contratos do PNCP) para uma pasta ./venc.

2. Período. ArtifactData get, collection "cerebro", doc_id "vencedores": se existir, comece no dia seguinte ao campo "ate"; senão, em 2026-11-05. Termine ontem (America/Sao_Paulo).

3. Coleta: em ./venc, python3 colher.py dados INICIO FIM 10 (datas AAAA-MM-DD), em segundo plano até terminar. Para cada dados/dias/*.ok.parcial, apague-o e rode de novo só aquele dia.

4. ArtifactData "list" na collection "contratos_novos" (query {"limit": 1000}, pagine com next_cursor) e grave os doc_id, um por linha, em existentes.txt.

5. python3 novos.py dados out --existentes existentes.txt. Para cada out/lote_NN.json, ArtifactData "batch" com writes = o conteúdo do arquivo. Se recusar por documento já existente, retire essa entrada e reenvie. Nunca use force.

6. ArtifactData set em collection "cerebro", doc_id "vencedores" (if_version da leitura do passo 2, se existia): {"ate": FIM, "em": data-hora ISO -03:00, "lidos": n, "novos": n}.

7. Aviso: ArtifactData "set" em collection "notificacoes", doc_id "av-vencedores-AAAAMMDD": {"id": o mesmo, "tipo": "rotina", "titulo": "Vencedores: N contratos novos no mapa", "texto": até 3 linhas com os maiores contratos novos de audiovisual, publicidade, fotografia ou cenografia (fornecedor · órgão/UF · valor), "link": "#vencedores", "para": "Sid", "em": data-hora atual em UTC no formato 2026-12-02T08:50:00.000Z}.

8. Mensagem final curta: período, contratos lidos, novos no escopo e os 5 maiores com link; dias que falharam, se houver.
