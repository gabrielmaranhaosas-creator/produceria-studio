---
id: "trig_01LdaShBQma41iWpxNiy4MrE"
nome: "PCA · coleta mensal"
cron: "0 9 5 * *"
ativa: true
modelo: "claude-sonnet-5-5"
permissao: null
conectores: []
---

Você atualiza a aba "PCA dos órgãos" do PRODUCERia Studio (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp, chamado de STUDIO abaixo). Responda em português. Não apague nada no banco. Não invente dados: tudo sai do script.

1. Preparação. Com a ferramenta Artifact, action "read", url do STUDIO e paths ["pca/pca.py", "cerebro/cerebro.py", "cerebro/perfil.json"], baixe os três arquivos (escritos para este Studio; só usam a biblioteca padrão do Python 3 e só leem a API pública do PNCP) e guarde mantendo as pastas: ./trabalho/pca/pca.py, ./trabalho/cerebro/cerebro.py e ./trabalho/cerebro/perfil.json (o pca.py importa o cérebro de ../cerebro).

2. Coleta: rode `python3 trabalho/pca/pca.py out` (pode levar de 5 a 30 minutos; rode em segundo plano e aguarde terminar). Ele grava out/resumo.json, out/pca.json e out/lote_NN.json.

3. Leia out/resumo.json. Se "orgaos" for 0 e "falhas" não estiver vazio, não grave nada no banco: vá direto ao passo 6 com o título "PCA: coleta falhou" e as falhas no texto.

4. Gravação: para cada out/lote_NN.json, chame ArtifactData action "batch" com url do STUDIO e writes = o conteúdo do arquivo (cada entrada já é {"op": "set", "collection": "pca", "doc_id", "file_path"}; os file_path são relativos à pasta onde o script rodou). Nunca use force. Se um lote for recusado, tente uma vez de novo e, se falhar, registre o erro e siga para o próximo.

5. Status: ArtifactData action "set", collection "cerebro", doc_id "pca", data = {"em": data-hora atual ISO 8601 com -03:00, "anos", "orgaos", "itens", "valor", "falhas", "perfil"} copiados de out/resumo.json.

6. Aviso: ArtifactData action "set", collection "notificacoes", doc_id "av-pca-" seguido do ano e mês atuais (AAAAMM), data = {"id": o mesmo doc_id, "tipo": "rotina", "titulo": "PCA: N órgãos com demanda no escopo" (N = orgaos do resumo), "texto": até 3 linhas com os maiores de out/pca.json no formato "órgão · UF · R$ total", e, se houver, quantos são de SP; se houve falhas, acrescente "Classes com falha: " e a lista, "link": "#b2g", "em": data-hora atual em UTC no formato 2026-12-05T09:30:00.000Z}.

7. Termine com um resumo curto: órgãos, itens, valor, lotes gravados e falhas.
