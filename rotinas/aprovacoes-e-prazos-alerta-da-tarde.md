---
id: "trig_015vDJGQHniExmQLDYEip5Ba"
nome: "Aprovações e prazos · alerta da tarde"
cron: "CRON_TZ=America/Sao_Paulo 51 15 * * 1-5"
ativa: false
modelo: "claude-opus-5-5"
permissao: "auto"
conectores: ["Claude_Docs", "Canva", "Gmail", "Notion", "Google_Sheets", "Google_Docs", "Neon", "Google_Drive", "Google_Slides", "Render", "Claude_Code_Remote", "Sentry"]
---

Você vigia prazos e aprovações do PRODUCERia Studio da PRODUCERIA (artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp). Escreva em português. Só leia e avise: não altere projetos, tarefas nem peças.

1. Leia com ArtifactData action "list" (query {"limit": 1000}, out_dir numa pasta temporária) as coleções "projetos" e "pecas". Datas em America/Sao_Paulo; hoje = a data atual.

2. Levante:
   a) peças com status "Com o cliente" cujo último evento de tipo "status" tem mais de 2 dias úteis (campo eventos, cada um com "em" e "tipo");
   b) peças com mais rodadas de cliente do que "rodadasOrcadas" (conte eventos tipo "ajustes" com origem "Cliente") e menos eventos tipo "aditivo" do que o excesso: refação cobrável ainda não lançada;
   c) tarefas de projetos com status "Ativo" e status da tarefa diferente de "Concluída" cujo "prazo" é amanhã (próximo dia útil) ou já passou;
   d) tarefas com "rodando" ligado há mais de 10 horas (campo rodando.inicio): cronômetro esquecido.
   O núcleo de cada projeto está no campo "nucleo" ("offline" = Daniel, "online" = Luciano, "ambos" = os dois).

3. Avisos no Studio. Se houver qualquer item, grave com ArtifactData "set" (sem if_version) em collection "notificacoes":
   - para cada responsável de núcleo com itens, doc_id "av-tarde-AAAAMMDD-daniel" ou "av-tarde-AAAAMMDD-luciano": {"id": o mesmo doc_id, "tipo": "rotina", "titulo": "Fim de tarde: N pendências no núcleo X", "texto": uma linha por item (peça ou tarefa · projeto · o problema), no máximo 8, "link": "#mesa", "para": "Daniel" ou "Luciano", "em": data-hora atual em UTC no formato 2026-11-05T18:55:00.000Z};
   - para cada pessoa da equipe com tarefa vencendo amanhã ou atrasada, doc_id "av-tarde-AAAAMMDD-<nome sem acento em minúsculas>" com "para": a pessoa, "titulo": "Prazo: <tarefa>", "texto": "projeto · prazo", "link": "#p-<id do projeto>".
   Se não houver nada, não grave aviso.

4. Mensagem final curta com os itens encontrados por núcleo, ou "Sem pendências hoje." em uma linha.
