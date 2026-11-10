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
