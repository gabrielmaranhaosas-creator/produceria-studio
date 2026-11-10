# Modelo de dados (coleções do banco do Studio)

Tipos completos em `src/lib/tipos.ts`.

| Coleção | Quem escreve | Conteúdo |
|---|---|---|
| `alvos` | equipe, Central, Mapa, radar semanal, nota.py | Leads da Captação: perfil, gatilho, etapa, cadência, toques, próximo toque, proposta |
| `noticias` | coleta diária da Central | Notícias de mercado com categoria, empresas e lead sugerido |
| `movimentos` | coleta diária da Central | Trocas de conta (anunciante → agência) |
| `central` | equipe | Estado de cada sinal da Central: salvo ou arquivado |
| `b2g` | cérebro de licitações, equipe | Radar de licitações abertas, triagem e carteira |
| `b2g_arquivo` | cérebro de licitações | Resumo mensal das licitações arquivadas (vencidas há 60+ dias, nunca tocadas) |
| `contratos_novos` | atualização mensal de vencedores | Contratos públicos novos do PNCP |
| `contas` | equipe | Contas cadastradas à mão no Mapa de contas |
| `casos` | equipe | Portfólio citável em propostas e abordagens |
| `pipeline`, `ofertas`, `frentes`, `swot`, `tows`, `linhas` | equipe | Estratégia e funil |
| `biblioteca`, `fichas` | equipe | Arquivos de cliente e fichas técnicas da Oficina |
| `cerebro` | tarefas agendadas | Status e relatórios das rotinas |
| `notificacoes` | tarefas agendadas | Avisos que aparecem no Studio |
| `projetos`, `pecas` | (desativado) | Produção, fora do escopo atual. Dados guardados, sem tela |

Arquivos publicados junto da página: `vencedores.bin.wasm` (contratos públicos, gzip), `mercado.json`
(movimentos de conta curados), `jobs/*`.

## Backup

Toda segunda às 07:30 a tarefa local "Studio · backup semanal do banco" exporta todas as coleções, gera
`studio-backup-AAAA-MM-DD.json.gz` com `jobs/backup/empacotar.py`, confere que ele restaura
(`jobs/backup/restaurar.py`) e copia para a pasta "PRODUCERia Studio - backups" do Google Drive (12 semanas
guardadas). O status fica em `cerebro/backup`; uma falha vira aviso em `notificacoes`.

O backup tem dados da equipe (leads, contatos): **nunca vai para o repositório**, que é público. A pasta local
`backups/` fica fora do git (`.git/info/exclude`). Para restaurar: `python3 jobs/backup/restaurar.py ARQUIVO SAIDA`
gera os lotes de escrita, que alguém revisa e envia pelo ArtifactData `batch`. O mesmo arquivo serve para a
migração para um banco próprio.
