# Plano de migração

## Fase 0 · fundação (feito)
- Repositório, build (Vite + TypeScript), testes (Vitest), CI.
- Regras de negócio extraídas para `src/lib` com testes: nomes, prioridade, cadência.
- Central, Agenda, Casos e Mapa de contas servidos a partir do código-fonte, com o legado como reserva.

## Fase 1 · tipar e componentizar as páginas migradas
- ~~Converter `src/paginas/*.js` para TypeScript.~~ Feito: as quatro páginas em `.ts`, com `src/paginas/dom.ts`
  (busca tipada, diálogo com retorno de foco, documento com id).
- Kit de componentes compartilhados: barra de filtros, pílulas, indicadores, lista de barras,
  tabela ordenável, diálogo, etiquetas de filtro, estado vazio.
- Testes de interface (Playwright) com banco simulado para Central, Agenda e Mapa.
- Tirar do legado as cópias antigas dessas quatro páginas.

## Fase 2 · migrar o Comercial que ainda é legado
- Captação (alvos, triagem, abordagem, proposta), Licitações (radar, carteira, habilitação),
  Vencedores, Contas e agências, Estratégia e funil.
- Uma página por entrega, sempre com o legado como reserva.

## Fase 3 · Oficina e casca
- Bancada, Gráfica, Plugins, Agentes, Biblioteca, Rotinas, Tabela de serviços, Ajustes.
- Shell próprio (navegação, busca Ctrl K, avisos, tema). O legado sai.

## Fase 4 · operação
- ~~Prompts das tarefas agendadas versionados em `rotinas/`, com script que confere se o que está agendado
  bate com o repositório.~~ Feito em 10/11/2026 (`rotinas/conferir.py`), com vigia de rotina parada e backup semanal.
- Publicação automática a partir do `main`.
