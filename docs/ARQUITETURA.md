# Arquitetura

## Onde o Studio roda

- **Artifact no claude.ai.** Uma página HTML publicada numa URL fixa. A página pede ao claude.ai as
  *capabilities* que usa: `db` (banco compartilhado), `sample` (pedir texto ao Claude), `downloads`
  (baixar CSV), `assets` (arquivos da Biblioteca), `user` e `mcp` (tarefas agendadas).
- **Banco do artifact.** Documentos em coleções (ver `DADOS.md`). Ele é **do artifact**: um artifact novo
  nasce vazio. Por isso a migração publica sempre na mesma URL.
- **Tarefas agendadas do Claude.** Leem e gravam o mesmo banco (coleta de notícias, varredura do PNCP,
  nota da captação). Os scripts que elas rodam ficam em `jobs/`.

## Migração por estrangulamento (strangler)

O Studio anterior existe só como bundle montado (`legacy/studio.html`, ~1 MB, sem fonte). Reescrever
tudo de uma vez tiraria o Studio do ar e arriscaria o banco. Então:

1. Este repositório gera um pacote (`studio-modulos.js`) que registra as páginas migradas em
   `window.__studio`.
2. `scripts/montar.mjs` injeta o pacote **antes** do script legado e troca, no legado, cada chamada de
   montagem (`initCN(r.current)` etc.) por "pergunte primeiro ao registro; se não houver, use a cópia
   antiga". Se o pacote falhar, o Studio continua funcionando com a cópia antiga.
3. Quando uma página migrada estabiliza, a cópia antiga sai do legado.
4. As páginas que ainda são React montado (Captação, Licitações, Vencedores, Contas e agências, Oficina)
   migram uma a uma, até o legado sobrar só como casca e ser substituído por um shell próprio.

## Regras de negócio (src/lib)

- `nomes.ts`: nomes legíveis (o PNCP publica em CAIXA ALTA), chave de comparação e "mesma empresa".
- `prioridade.ts`: **nota única 0–100** usada na Agenda e nos leads da Central, calibrada pelos descartes
  da equipe nos últimos 90 dias.
- `cadencia.ts`: próximo toque sugerido, avanço de etapa (nunca regride) e o registro de contato.
- `db.ts`: acesso tipado ao banco, assinatura com timeout de 10 s e leitura de arquivos publicados
  (inclusive gzip).

## Escopo do radar de licitações

O perfil do cérebro (`jobs/cerebro/perfil.json`) define as frentes que entram no radar `b2g`. Produção e
organização de eventos está **fora do escopo** desde o perfil `2026-11-10a`: a frente saiu e os termos de
eventos (organização, produção, estandes, cerimonial) viraram penalidade zero, o que também zera as
licitações de eventos já gravadas quando o cérebro roda com `--repontuar`. Foto, transmissão e
cenografia **de** eventos continuam, pelas próprias frentes. `scripts/montar.mjs` tira as duas frentes de
eventos da lista de Licitações do legado.

## Publicação

`npm run build` gera `dist/index.html`. Publicar = Artifact `publish` com esse arquivo na URL do Studio,
mantendo os arquivos de apoio já publicados (`vencedores.bin.wasm`, `mercado.json`, scripts de `jobs/`).
O arquivo `vencedores.bin.wasm` é o `vencedores.json` comprimido com gzip: o claude.ai não serve `.gz`,
e a extensão `.wasm` é só o tipo binário aceito.
