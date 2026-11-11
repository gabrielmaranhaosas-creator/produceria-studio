# Tarefas agendadas que alimentam o Studio

Todas rodam no Claude (nuvem), gravam no banco do Studio e avisam no celular e no Studio.
Horários em America/Sao_Paulo.

| Tarefa | Quando | O que faz | Estado |
|---|---|---|---|
| Central de notícias · coleta diária | dias úteis 07:12 | Notícias de mercado (contas, licitações, in-house, negócios) → `noticias` e `movimentos` | ativa |
| Captação · radar semanal de alvos | sexta 08:35 | Transforma os sinais da semana em até 10 alvos, com próximo toque | ativa |
| Captação · triagem semanal B2B | segunda 08:47 | Recalcula a nota dos alvos (`jobs/captacao/nota.py`) e aponta quem abordar | ativa |
| Cérebro de licitações · varredura diária | todo dia 06:17 | Varre o PNCP (`jobs/cerebro`), grava o radar `b2g`, arquiva vencidas há 60+ dias | ativa |
| Licitações · triagem semanal | segunda 08:23 | Candidatas da semana e retorno da equipe | ativa |
| Vencedores · atualização mensal | dia 2, 05:47 | Contratos novos do PNCP (`jobs/vencedores`) → `contratos_novos` | ativa |
| Studio · publicação automática do main | todo dia 06:30 | Publica o Studio a partir do `main` se o código mudou e os testes passam; aviso no sino | ativa |
| Studio · backup semanal do banco | segunda 07:30 | Exporta todas as coleções, empacota (`jobs/backup`) e copia para o Google Drive; status em `cerebro/backup` | ativa (local: roda neste Mac com o app aberto) |
| Produção · rotina diária do estúdio | — | Distribuía tarefas da produção | pausada (produção fora do escopo) |
| Aprovações e prazos · alerta da tarde | — | Vigiava peças e prazos | pausada |
| Relatório de craft · mensal | — | Relatório de rodadas por cliente | pausada |

Cada rotina do claude.ai tem o texto completo em `rotinas/<nome>.md` (cabeçalho com id, horário, se está ativa,
modelo e conectores). Para conferir se o que está agendado bate com o repositório, salve a listagem das rotinas
(RemoteTrigger `list`) num arquivo e rode:

```bash
python3 rotinas/conferir.py listagem.json
```

Ele sai com erro e lista o que diverge. Depois de mudar uma rotina no claude.ai, `--atualizar` regrava os `.md`.
Para mudar só o texto de uma rotina, o RemoteTrigger `update` aceita `{"prompt": "..."}` e preserva o resto.

A rotina de backup é local (tarefa agendada do app neste Mac) e não entra na conferência; o texto dela fica em
`~/.claude/scheduled-tasks/studio-backup-semanal/SKILL.md`, porque cita a pasta pessoal do Google Drive.

**Vigia:** desde 10/11/2026 o passo 9 da varredura diária do cérebro confere se triagem, captação, vencedores,
backup e Central rodaram no prazo e cria um aviso "Rotina parada" no Studio quando não.
