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
| `pca` | PCA mensal (`jobs/pca`) | Plano de Contratações Anual: um documento por órgão, unidade e ano, só com itens no escopo |
| `cotacoes` | equipe (Bancada) | Cotações de fornecedor: item, três preços e o escolhido |
| `conversas` | equipe (Agentes) | Conversas salvas com os agentes e as ações que eles fizeram |
| `contas` | equipe | Contas cadastradas à mão no Mapa de contas |
| `casos` | equipe | Portfólio citável em propostas e abordagens |
| `pipeline`, `ofertas`, `frentes`, `swot`, `tows`, `linhas` | equipe | Estratégia e funil |
| `biblioteca`, `fichas` | equipe | Arquivos de cliente e fichas técnicas da Oficina |
| `cerebro` | tarefas agendadas | Status e relatórios das rotinas |
| `notificacoes` | tarefas agendadas | Avisos que aparecem no Studio |
| `projetos`, `pecas` | (desativado) | Produção, fora do escopo atual. Dados guardados, sem tela |

Arquivos publicados junto da página: `vencedores.json` (contratos públicos), `mercado.json`
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

## PCA dos órgãos

`jobs/pca/pca.py` consulta o PNCP (`/v1/pca/`) por **classe do catálogo de serviços (CATSER)** e ano do PCA, passa a
descrição de cada item pelo filtro do cérebro (`jobs/cerebro/perfil.json`) e grava um documento por órgão, unidade e
ano. O código `classificacaoSuperiorCodigo` do PCA é a classe CATSER de 4 dígitos (não o grupo de 3).

Classes escolhidas em 11/11/2026, cruzando os CNAEs das três empresas (Cria, Produções e Digitais; sem a Produceria
Eventos) com o que aparece de fato nos PCAs de 2026 e 2027:

| Classe | Nome | CNAE de origem | Por quê |
|---|---|---|---|
| 9612 | Produção de imagem e vídeo | 5911-1/01, 5911-1/02 | filmagem, transmissão ao vivo |
| 9614 | Produção de filmes | 5911-1/02 | vídeo institucional, filmagem aérea |
| 8381 | Serviços fotográficos | 7420-0/01, 7420-0/04 | fotografia, cobertura, transmissão de sessões |
| 8369 | Outros serviços de publicidade | (núcleo: comunicação visual e OOH) | divulgação institucional, marketing digital, conteúdo |
| 8361 | Publicação e divulgação | 5812-3/02, 5822-1/02 | spots, cobertura jornalística |
| 8912 | Impressão e reprodução | 1821-1/00, 1822-9/99 | placas de fachada e identificação (gráfica em massa sai pelo filtro) |

Fora: 9611 (gravação de som: nos PCAs só aparece locação e operação de som), 8911 (publicação: ruído de catalogação),
8439 (informação on-line: TI), 8399, 5469 e 8739 (genéricas demais; o PNCP não consegue responder), 9621 e 8597
(espetáculos, feiras: eventos, fora do escopo). Nenhuma das três empresas tem CNAE de comunicação visual,
sinalização ou mídia exterior (ex.: 7319-0/02, 7312-2/00, 1813-0/99, 7410-2/99): risco de inabilitação nessas frentes.

