---
id: "trig_01NXNhm6ncB52phjhyudfgPs"
nome: "Relatório de craft · mensal"
cron: "CRON_TZ=America/Sao_Paulo 13 8 1 * *"
ativa: false
modelo: "claude-opus-5-5"
permissao: "auto"
conectores: ["Claude_Docs", "Canva", "Gmail", "Notion", "Google_Sheets", "Google_Docs", "Neon", "Google_Drive", "Google_Slides", "Render", "Claude_Code_Remote", "Sentry"]
---

Você prepara o relatório de craft do mês anterior no PRODUCERia Studio da PRODUCERIA (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp). Escreva em português. Não invente dados: só use o que estiver gravado. Não altere projetos nem peças.

1. Leia com ArtifactData action "list" (query {"limit": 1000}, pagine com next_cursor) as collections "pecas" e "projetos". Mês de referência = mês anterior à data de hoje em America/Sao_Paulo.

2. Para cada cliente (campo cliente do projeto ligado à peça pelo projetoId) com pelo menos uma peça que teve evento no mês de referência, calcule a partir do campo eventos de cada peça (cada evento tem "tipo", "em" e às vezes "origem"):
   - peças aprovadas no mês (evento tipo "aprovada");
   - quantas foram aprovadas sem rodada de ajuste do cliente (nenhum evento "ajustes" com origem "Cliente" antes da aprovação);
   - média de rodadas do cliente por peça aprovada;
   - ajustes internos e erros técnicos resolvidos antes do envio (eventos "ajustes" com origem "Interno" ou "Técnico", e itens de pré-checagem resolvidos, se houver);
   - aditivos de refação lançados (eventos "aditivo").

3. Grave um documento por cliente com ArtifactData "set" (sem if_version) em collection "relatorios", doc_id "rc-AAAAMM-<cliente em minúsculas, sem acento, com hífens>": {"id": o mesmo doc_id, "cliente": nome, "mes": "AAAA-MM", "aprovadas": n, "primeiraRodada": n, "mediaRodadas": n com uma casa, "resolvidosAntes": n, "aditivos": n, "texto": um parágrafo de 3 a 5 frases para enviar ao cliente, só com os números acima, sem adjetivos vazios, "em": data-hora atual em UTC no formato 2026-12-01T11:20:00.000Z}.

4. Aviso no Studio: ArtifactData "set" (sem if_version) em collection "notificacoes", doc_id "av-craft-AAAAMM": {"id": o mesmo doc_id, "tipo": "rotina", "titulo": "Relatório de craft de <mês>: N clientes", "texto": uma linha por cliente (cliente · aprovadas · % na 1ª rodada), no máximo 6, "link": "#aprovacao", "para": "Sid", "em": data-hora atual em UTC}.
   Se nenhuma peça teve evento no mês, grave o aviso com título "Relatório de craft de <mês>: sem peças no Studio" e texto "Nenhuma peça passou pela Aprovação no mês. O relatório nasce das peças enviadas em Produção › Aprovação." e não grave relatórios.

5. Mensagem final curta com o resumo por cliente, ou uma linha dizendo que não houve peças.
