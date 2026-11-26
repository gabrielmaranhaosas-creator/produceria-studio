# Plano de migração

## Fase 0 · fundação (feito)
- Repositório, build (Vite + TypeScript), testes (Vitest), CI.
- Regras de negócio extraídas para `src/lib` com testes: nomes, prioridade, cadência.
- Central, Agenda, Casos e Mapa de contas servidos a partir do código-fonte, com o legado como reserva.

## Fase 1 · tipar e componentizar as páginas migradas (concluída em 10/11/2026)
- ~~Converter `src/paginas/*.js` para TypeScript.~~ Feito: as quatro páginas em `.ts`, com `src/paginas/dom.ts`
  (busca tipada, diálogo com retorno de foco, documento com id).
- ~~Kit de componentes compartilhados~~ Feito em 10/11/2026: `src/componentes` com indicadores, estado vazio,
  etiqueta, diálogo com retorno de foco e confirmação no próprio botão (o claude.ai bloqueia `confirm()`, o que
  impedia excluir casos e contas). Barra de filtros, pílulas e tabela ordenável entram quando a Fase 2 precisar.
- ~~Testes de interface com banco simulado~~ Feito: `tests/paginas.test.ts` (happy-dom) monta Central, Agenda,
  Casos e Mapa de contas sobre um banco em memória, inclusive a exclusão com confirmação.
- ~~Tirar do legado as cópias antigas dessas quatro páginas~~ Feito: `scripts/cortar.mjs` corta as funções no build
  (66 KB) e o build confere a sintaxe do legado; no lugar fica um aviso para o caso de o pacote não carregar.

## Fase 2 · migrar o Comercial que ainda é legado
- ~~Licitações (radar, carteira, habilitação, vias)~~ Feito em 10/11/2026: `src/paginas/licitacoes.ts`, com
  Disputar / Monitorar / Descartar com motivo, descartes revisáveis (e desfazíveis), carteira por etapa com análise
  go/no-go por IA, habilitação por empresa e leitura de edital por IA. O componente antigo fica de reserva.
- ~~Captação (alvos, triagem, abordagem, proposta)~~ Feito em 10/11/2026: `src/paginas/captacao.ts`, com quadro
  por etapa, triagem (abordar, monitorar, descartar com motivo), sinais do radar de licitações, extração de alvos de
  texto colado e abordagem por IA, atração levada ao funil e proposta com a tabela de serviços (`src/lib/servicos.ts`,
  709 serviços, cálculo em centavos) e download em .md. O componente antigo fica de reserva.
- ~~Vencedores de licitações~~ Feito em 10/11/2026: `src/paginas/vencedores.ts`, com quem abordar por segmento
  (guias revistos: comunicação visual, OOH e gráfica como núcleo; eventos só na parte de craft), órgãos e recompra,
  preços e calendário, contratos, CSV de cada lista, virar alvo na Captação e levar recompra ao funil.
- ~~Contas e agências~~ Feito em 10/11/2026: `src/paginas/mercado.ts`, com movimentações de conta (período, só
  criação, CSV), agências por prioridade, maiores anunciantes, guias de abordagem (ofertas no escopo atual) e virar
  alvo na Captação. As movimentações da Captação semanal entram sozinhas.
- ~~Estratégia e funil~~ Feito em 10/11/2026: `src/paginas/funil.ts` (receita orçada por canal, funil de
  oportunidades, estratégias anticíclicas, mapa de receitas com HHI e diagnóstico por IA) e `src/paginas/estrategia.ts`
  (matriz SWOT com evidência, sinais dos dados, revisar e cruzar por IA, TOWS, frentes priorizadas, ofertas de IA
  aplicada). A base da pesquisa foi revista para o escopo atual (três empresas, sem eventos). Fase 2 concluída.
- Uma página por entrega, sempre com o legado como reserva.

## Fase 3 · Oficina e casca
- ~~Tabela de serviços~~ Feito em 10/11/2026: `src/paginas/tabela.ts`, com filtros, desconto por linha e em lote
  (zerar pede confirmação), situação frente ao SINAPRO e CSV. O componente antigo fica de reserva.
- ~~Rotinas do Claude e Ajustes~~ Feito em 11/11/2026: `src/paginas/rotinas.ts` (lista pelo conector, rodar agora,
  pausar, instrução, último resultado do radar e do backup; descrições das rotinas atuais) e `src/paginas/ajustes.ts`
  (tema, contagens, exportação, remover exemplos com confirmação, estado da IA). Os componentes antigos ficam de reserva.
- ~~Bancada, Gráfica, Plugins e Biblioteca~~ Feito em 11/11/2026: `src/paginas/bancada.ts` (desdobramento de KV pela
  tabela com desconto, revisão de texto e pré-checagem de peça por IA, cotação de fornecedor registrada em `cotacoes`),
  `grafica.ts` (ficha técnica sem depender de projeto, aproveitamento de folha, fechamento de arquivo, pacote do job,
  formatos de OOH), `plugins.ts` (o Produceria Bridge agora vive como arquivos em `src/oficina/bridge/`) e
  `biblioteca.ts` (envio e remoção de arquivos com `src/lib/arquivos.ts`). Os componentes antigos ficam de reserva.
- ~~Agentes~~ Feito em 11/11/2026: `src/paginas/agentes.ts`, com 24 agentes (os de tráfego e produção executiva saíram
  com a produção), ferramentas de memória da casa, tabela, radar e funil (`conversar` em `src/lib/ia.ts`), conversas
  salvas e lista de ações. O componente antigo fica de reserva. A Oficina está toda em código-fonte.
- ~~Início e shell próprio~~ Feito em 11/11/2026: `src/paginas/inicio.ts` e `src/casca/casca.ts` (menu, rotas,
  busca Ctrl K, avisos com "para mim", tema, aviso de conexão). O app React do legado saiu do Studio publicado
  (`dist/index.html` caiu de ~1,6 MB para ~0,8 MB); `dist/legado.html` fica como reserva. **Fase 3 concluída.**
- Pendências: as fontes ainda vêm de `legacy/studio.html` (ver Fase 4); a barra "Desfazer" do
  legado não foi trazida (as telas novas gravam direto e confirmam exclusões no próprio botão).

## Fase 4 · operação
- ~~Prompts das tarefas agendadas versionados em `rotinas/`, com script que confere se o que está agendado
  bate com o repositório.~~ Feito em 10/11/2026 (`rotinas/conferir.py`), com vigia de rotina parada e backup semanal.
- ~~CSS global do legado para `src/estilos/`~~ Feito em 11/11/2026 (`studio.css` e `reset.css`, conferidos regra a regra).
- ~~Fontes com licença resolvida~~ Decidido em 11/11/2026: a equipe tem licença da ABC Whyte e ela fica. As fontes
  seguem embutidas (lidas de `legacy/studio.html` no build). Falta confirmar a licença da PTYPE (títulos).
- ~~Publicação automática a partir do `main`~~ Feito em 11/11/2026: rotina "Studio · publicação automática do main"
  (todo dia 06h30, `rotinas/studio-publicacao-automatica-do-main.md`). Compara o commit carimbado no Studio publicado
  com o `main`, só publica se mudou código (`src`, `scripts`, `legacy`, `package*.json`, configs), roda o
  `npm run check` antes e deixa aviso no sino (publicou, testes falharam ou conflito). **Fase 4 concluída.**

## Depois do roteiro
- ~~Alerta de habilitação e prazos no Início~~ Feito em 11/11/2026: certidões vencidas ou que vencem em 30 dias e
  propostas da carteira que vencem em 7 dias aparecem no Início, com link para Licitações.
- ~~PCA dos órgãos~~ Feito em 11/11/2026: `jobs/pca` coleta os Planos de Contratações Anuais do PNCP por classe
  CATSER (escolha em `docs/DADOS.md`), filtra pelo perfil do cérebro e agrupa por órgão; aba "PCA dos órgãos" em
  Licitações, com "Levar ao funil". Rotina mensal "PCA · coleta mensal".

- ~~Oficina com ferramentas da casa~~ Feito em 11/11/2026: o Kit Produceria v1.0 (núcleo Python, painéis do Photoshop,
  servidor do Claude) ganhou as mesmas regras no Studio (`src/oficina/kit.ts`) e três telas novas, todas lendo os
  arquivos no navegador, sem enviar nada:
  - **Ateliê** (`#atelie`), nova porta da Oficina: princípios da casa (ofício e vanguarda) e o mapa das ferramentas,
    no Studio e na mesa do arte-finalista.
  - **Desdobra de KV** (`#desdobra`): peça-mãe em todos os formatos (digital, mídia exterior, impresso e próprios),
    ponto de foco clicado no KV, cobrir ou conter, aviso de ampliação acima de 2x, zip com nomes no padrão e
    `manifesto_entrega.csv`. É rascunho para aprovar layout; a arte-final continua à mão.
  - **Conferência e entrega** (`#entrega/checar|nomes|entrega`): checar arquivo (medidas, ppi, CMYK, perfil ICC,
    nome; JPG, PNG, PSD, WebP, GIF), nomes e estrutura do job em zip, e montar entrega com sha256 e manifesto.
  - A aba "Desdobramento de KV" da Bancada virou "Orçar desdobramento" (é o orçamento pela tabela).
  - Divergência conhecida: no Studio o ponto de foco fica no centro do recorte; no núcleo Python é a posição do
    recorte na sobra. Com foco no meio, o resultado é igual.
- ~~Retoque e especialistas de imagem~~ Feito em 11/11/2026, depois do primeiro teste real da Desdobra (um resumo
  visual 1354x4832 com várias peças foi usado como KV e os recortes pegaram pedaços da prancha):
  - Desdobra avisa proporção de prancha, imagem pequena e formatos com as mesmas medidas (stories e dooh-vertical).
  - **Retoque** (`#retoque`): exposição, contraste, realces, sombras, temperatura, saturação e nitidez com antes e
    depois, ampliação clássica até 4x (passos de 2x, limite de 12.000 px), saída na próxima versão do nome.
  - **Especialistas de imagem** (`src/oficina/personas.ts`): Diretor de Arte, Arte-finalista Sênior, Prompts de
    Retoque e Geração, Upscale e Grande Formato. Estão em Agentes (grupo "Craft e imagem", com anexo de imagem) e na
    leitura da imagem do Retoque. Fazem contas pela ferramenta `calcular_pixels` e seguem as regras do kit.
  - Upscale com IA continua fora do navegador: a chave do Magnific não pode ficar no Studio. O caminho é o
    `magnific_lote.py` do Kit; o especialista de Upscale monta o plano e os parâmetros de partida.
- ~~Plugins da casa para download, com tutorial e roteiro de teste~~ Feito em 11/11/2026, a partir de um levantamento
  da Adobe Exchange (4.406 plugins de Photoshop; buscas por retoque, exportação, lote, renomear, mockup, impressão,
  redimensionar, camadas, cor e guias). Os painéis do Kit saíram de `~/Documents/produceria-kit` para `plugins/`
  (CommonJS, como o UXP espera; testes em `tests/plugins.test.ts`):
  - Já existiam: Desdobra KV, Retoque (v1.1 ganhou separação de frequência, experimental), Checar Arquivo,
    Exportador, Textos. Novos: **Guias** (sangria, margem, stories, colunas), **Camadas** (renomear em lote, prefixos
    da casa, relatório) e **Prova** (JPG de aprovação com marca d'água e rodapé). Mais o Bridge e o script de
    variações do After Effects.
  - Oficina › Plugins ganhou as abas Plugins (kit completo em .zip com .ccx, código-fonte, After Effects e tutorial,
    ou um plugin por vez), Instalar (três caminhos: duplo clique no .ccx, Terminal com o instalador da Adobe e UXP
    Developer Tool), Roteiro de teste (Passou/Falhou e nota por passo, na coleção `testes_plugins`, com relatório
    .md) e Integrações.
  - Nenhum painel foi aberto ainda dentro do Photoshop (não há Photoshop nesta máquina): a primeira rodada de
    testes é da equipe.
