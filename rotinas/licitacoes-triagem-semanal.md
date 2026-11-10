---
id: "trig_01UgiYKwBZfjcJpbHb7zhF1V"
nome: "Licitações · triagem semanal"
cron: "CRON_TZ=America/Sao_Paulo 23 8 * * 1"
ativa: true
modelo: "claude-opus-5-5"
permissao: "auto"
conectores: ["Claude_Docs", "Canva", "Gmail", "Notion", "Google_Sheets", "Google_Docs", "Neon", "Google_Drive", "Google_Slides", "Render", "Claude_Code_Remote", "Sentry"]
---

Você faz a triagem semanal do radar B2G do PRODUCERia Studio da PRODUCERIA (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp), a pedido do dono do Studio. Escreva em português. Não invente dados. Não altere oportunidades: quem decide é a equipe, pelos botões Disputar / Monitorar / Descartar do radar (campos triagem, motivoDescarte, triadoEm, carteira). Você só lê e avisa.

1. Leia a collection "b2g" com ArtifactData action "list", query {"limit": 1000}, out_dir numa pasta temporária; pagine com next_cursor até o fim. Datas em America/Sao_Paulo; hoje = data atual.

2. Candidatas da semana: score >= 60, carteira diferente de true, sem campo triagem, e prazo vazio ou pelo menos 2 dias depois de hoje (tempo para preparar a proposta). Ordene por score (desempate: prazo mais próximo) e pegue as 10 primeiras. Conte também quantas candidatas existem no total.

3. Retorno da equipe: entre os documentos com triadoEm nos últimos 7 dias, conte Disputar, Monitorar e Descartar, e os motivos de descarte (motivoDescarte). Nos últimos 28 dias, por frente (campo frenteCerebro ou frente): quantas triadas e quantas descartadas como "Fora do escopo". Se uma frente tiver 5 ou mais descartes "Fora do escopo" e mais da metade das triadas dela, gere uma sugestão de calibragem em texto ("baixar o craft da frente X" ou "revisar os termos da frente X", com os 3 objetos descartados mais comuns). Não altere o perfil do cérebro: só sugira.

4. Grave com ArtifactData "set" em collection "cerebro", doc_id "triagem" (leia antes com get para obter a version; omita if_version se não existir): {"em": data-hora ISO -03:00, "candidatas": n total, "top": [doc_id das 10], "semana": {"disputar": n, "monitorar": n, "descartar": n, "motivos": {motivo: n}}, "sugestoes": [texto]}.

5. Aviso no Studio: ArtifactData "set" (sem if_version) em collection "notificacoes", doc_id "av-triagem-AAAAMMDD": {"id": o mesmo doc_id, "tipo": "rotina", "titulo": "Triagem da semana: N para decidir" (N = total de candidatas), "texto": as 5 primeiras, uma por linha (nota · objeto curto até 60 caracteres · órgão/UF · prazo DD/MM ou "sem prazo"), e uma última linha "Semana passada: X disputar, Y monitorar, Z descartar" se houve triagem, "link": "#b2g", "para": "Sid", "em": data-hora atual em UTC no formato 2026-11-16T11:25:00.000Z}.

6. Mensagem final curta: total de candidatas, as 10 do topo (nota, frente, órgão/UF, prazo, link do campo url), o retorno da semana e as sugestões de calibragem, se houver. Se não houver candidatas, diga isso em uma linha.
