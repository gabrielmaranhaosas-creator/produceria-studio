---
id: "trig_01LdaShBQma41iWpxNiy4MrE"
nome: "PCA · coleta mensal"
cron: "0 9 5 * *"
ativa: false
modelo: "claude-sonnet-5-5"
permissao: null
conectores: []
---

Você atualiza a aba "PCA dos órgãos" do PRODUCERia Studio (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp, chamado de STUDIO abaixo). Responda em português. Não faça commit, push nem altere o repositório. Não apague nada no banco. Não invente dados: tudo sai do script.

1. Coleta: na raiz do repositório, rode `python3 jobs/pca/pca.py out` (só biblioteca padrão; lê a API pública do PNCP; pode levar de 5 a 30 minutos, rode em segundo plano e aguarde terminar). Ele grava out/resumo.json, out/pca.json e out/lote_NN.json.

2. Leia out/resumo.json. Se "orgaos" for 0 e "falhas" não estiver vazio, não grave nada no banco: vá direto ao passo 5 com o título "PCA: coleta falhou" e as falhas no texto.

3. Gravação: para cada out/lote_NN.json, chame ArtifactData action "batch" com url do STUDIO e writes = o conteúdo do arquivo (cada entrada já é {"op": "set", "collection": "pca", "doc_id", "file_path"}). Nunca use force. Se um lote for recusado, tente uma vez de novo e, se falhar, registre o erro e siga para o próximo.

4. Status: ArtifactData action "set", collection "cerebro", doc_id "pca", data = {"em": data-hora atual ISO 8601 com -03:00, "anos", "orgaos", "itens", "valor", "falhas", "perfil"} copiados de out/resumo.json.

5. Aviso: ArtifactData action "set", collection "notificacoes", doc_id "av-pca-" seguido do ano e mês atuais (AAAAMM), data = {"id": o mesmo doc_id, "tipo": "rotina", "titulo": "PCA: N órgãos com demanda no escopo" (N = orgaos do resumo), "texto": até 3 linhas com os maiores de out/pca.json no formato "órgão · UF · R$ total", e, se houver, quantos são de SP; se houve falhas, acrescente "Classes com falha: " e a lista, "link": "#b2g", "em": data-hora atual em UTC no formato 2026-12-05T09:30:00.000Z}.

6. Termine com um resumo curto: órgãos, itens, valor, lotes gravados e falhas.
