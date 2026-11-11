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
- Bancada, Gráfica, Plugins, Agentes, Biblioteca.
- Shell próprio (navegação, busca Ctrl K, avisos, tema). O legado sai.

## Fase 4 · operação
- ~~Prompts das tarefas agendadas versionados em `rotinas/`, com script que confere se o que está agendado
  bate com o repositório.~~ Feito em 10/11/2026 (`rotinas/conferir.py`), com vigia de rotina parada e backup semanal.
- Publicação automática a partir do `main`.
