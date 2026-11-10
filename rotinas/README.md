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
| Produção · rotina diária do estúdio | — | Distribuía tarefas da produção | pausada (produção fora do escopo) |
| Aprovações e prazos · alerta da tarde | — | Vigiava peças e prazos | pausada |
| Relatório de craft · mensal | — | Relatório de rodadas por cliente | pausada |

Próximo passo (Fase 4 do roadmap): guardar aqui o texto completo de cada tarefa e conferir
automaticamente se o que está agendado bate com o repositório.
