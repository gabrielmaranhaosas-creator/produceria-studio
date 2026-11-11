# PRODUCERia Studio

Oficina e Comercial da PRODUCERIA: central de notícias e leads, agenda de contatos, captação, licitações,
mapa de contas, casos da casa e as ferramentas de produção. Publicado como Artifact no claude.ai, com banco
compartilhado pela equipe.

## Como está organizado

| Pasta | O que tem |
|---|---|
| `src/lib/` | Regras de negócio em TypeScript, com testes: nomes, datas, prioridade única, cadência de contato, acesso ao banco |
| `src/paginas/` | Páginas já migradas para código-fonte: Central, Agenda, Casos, Mapa de contas, Licitações, Captação, Vencedores, Contas e agências, Funil e receita, SWOT e frentes, Tabela de serviços, Rotinas, Ajustes |
| `src/componentes/` | Kit de componentes compartilhados pelas páginas |
| `src/estilos/` | CSS das páginas migradas |
| `legacy/studio.html` | O Studio publicado antes da migração (bundle montado). Sai página por página |
| `scripts/montar.mjs` | Junta legado + módulos em `dist/index.html`, pronto para publicar |
| `jobs/` | Scripts Python usados pelas tarefas agendadas (cérebro de licitações, nota da captação, vencedores) |
| `rotinas/` | Catálogo das tarefas agendadas do Claude que alimentam o Studio |
| `docs/` | Arquitetura, modelo de dados e plano de migração |

## Comandos

```bash
npm install
npm test          # testes das regras (vitest)
npm run typecheck # TypeScript
npm run build     # gera dist/index.html
```

## Publicar

`dist/index.html` é publicado no Artifact do Studio (mesma URL, mesmo banco). Hoje a publicação é feita
pelo Claude numa sessão com este repositório; ver `docs/ARQUITETURA.md#publicação`.
