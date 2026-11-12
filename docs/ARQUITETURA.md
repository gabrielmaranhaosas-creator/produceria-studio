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
4. As páginas que ainda eram React montado migraram uma a uma (Fases 2 e 3).

**Desde 11/11/2026 o Studio publicado não carrega mais o app do legado.** `dist/index.html` traz só o reset do
`<head>` e o bloco de estilos do legado (CSS + fontes) e o pacote de módulos; `src/casca/casca.ts` monta o menu
(Oficina, Comercial, Gestão), as rotas por hash, a busca Ctrl K, os avisos, o tema e o aviso de conexão, e cada
tela vem do registro de páginas. `dist/legado.html` continua sendo gerado como reserva: é o Studio antigo com as
telas novas injetadas. Se algo der errado, basta publicar a versão anterior do artifact.

O CSS global (classes `page-head`, `rail`, `chip`, `tag`, `paleta`...) e o reset do `<head>` estão em
`src/estilos/studio.css` e `src/estilos/reset.css` desde 11/11/2026 (Fase 4). Do legado, o Studio publicado só usa
as 4 fontes (`@font-face`), lidas no build. A equipe tem licença da ABC Whyte (confirmado em 11/11/2026), então elas
ficam; se um dia saírem do legado, o lugar delas é um arquivo próprio em `src/estilos/`.

## Publicação

O Studio publicado é o `dist/index.html` montado do `main`. Duas vias: uma sessão do Claude Code publica na hora
(Artifact, mesma URL), ou a rotina diária "Studio · publicação automática do main" faz isso sozinha quando o código
mudou e o `npm run check` passa. A versão publicada leva o carimbo `versão+commit` (ver `vite.config.ts`), que a
rotina usa para saber se há algo novo. Para voltar atrás, restaure uma versão anterior do artifact.

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
licitações de eventos já gravadas quando o cérebro roda com `--repontuar`. Desde o `2026-11-10b`, estande e
stand só contam em expressões de feira ("montagem de estande", "cota de estande", "stand de feira"…):
sozinhos casavam com "stand by", "stand alone" e "estande de tiro". Foto, transmissão e
cenografia **de** eventos continuam, pelas próprias frentes. `scripts/montar.mjs` tira as frentes fora do
escopo da lista de Licitações do legado.

Desde o `2026-11-10c` o critério é este (pesquisa no radar de 10/11/2026: só ~1 em 8 visíveis era trabalho
do hub):

1. **Porta pelo objeto.** O objeto precisa citar o serviço (padrões `porta` de cada frente). O texto
   complementar do PNCP não abre mais a porta.
2. **Frentes só onde há CNAE.** Saíram mídia exterior, comunicação visual/placas e produção gráfica:
   nenhuma empresa do hub tem CNAE de impressão, sinalização ou agenciamento de mídia, e publicidade de
   agência exige certificação (Lei 12.232). A aderência vem do CNAE das empresas em `entidades`; direção de
   arte e cenografia não tem CNAE no hub e fica "condicionada".
3. **Exclusões rígidas** (curso, software, compra, obra, agência, eventos, fora do ramo) valem sempre, mas
   só nos primeiros `assunto_chars` caracteres, para não derrubar um bom objeto por palavra incidental.
4. **Exclusões brandas** (shows, decoração, locação de estrutura, veiculação, assessoria de imprensa,
   gráfica) cedem só quando um serviço forte (audiovisual, fotografia, transmissão) aparece antes delas no
   objeto; nesse caso a nota leva redutor de 0,85 e um aviso.
5. **Nota:** valor ideal entre R$ 20 mil e R$ 1,5 mi (acima, alerta de porte), e redutor para serviço
   presencial pequeno longe de São Paulo. Desde o `2026-11-10d`, valor abaixo de R$ 5 mil (×0,7) e acima de
   R$ 10 mi (×0,7) ficam no radar, mas abaixo da linha de triagem (60). Os testes ficam em
   `jobs/cerebro/test_cerebro.py`.

A varredura diária (rotina "Cérebro de licitações · varredura diária", 06:17) lê `cerebro/perfil.json` e
`cerebro/cerebro.py` publicados no Studio: publicar o Studio com esses arquivos já muda o critério da rotina.
`scripts/montar.mjs` tira da lista de frentes do Licitações (cadastro manual) só as de eventos: arte-finalização,
produção gráfica, comunicação visual e mídia exterior são o núcleo da PRODUCERIA e ficam.

## Escopo do mapa de vencedores

`jobs/vencedores/classes.py` usa o mesmo escopo, adaptado: eventos saem; gráfica, comunicação visual e mídia exterior
ficam (núcleo). O ruído sai por regras rígidas no início do objeto (curso, software, compra de equipamento, obra,
eventos, fora do ramo) e brandas que cedem a filmagem, foto ou transmissão citadas antes (shows, Natal, locação de
palco e som, veiculação em jornal/rádio/site, assessoria de imprensa). Rádio, TV e jornal que vendem veiculação também
saem. `jobs/vencedores/limpar.py` aplica isso ao `vencedores.json` publicado; a rotina mensal
usa o mesmo `classes.py` publicado em `vencedores/`. Limpeza de 10/11/2026: 15.318 → 7.978 contratos no arquivo.

Desde o `2026-11-10e`, comunicação visual e sinalização (letreiros, totens, fachadas em ACM, placas de
identificação e inauguração, adesivação, sinalização interna e turística) e mídia exterior OOH/DOOH (outdoor, front
light, empenas, mobiliário urbano, painel de LED de mídia) voltaram como frentes. Para elas, as exclusões de
"gráfica em massa", "veiculação" e "locação de estrutura" não valem (campo `exceto` da exclusão no perfil);
sinalização viária e placas de veículo saem sempre. Gráfica em massa (folders, cartilhas, banners, impressos)
continua fora do radar.

No `--repontuar`, o que não passa vai a nota 0, exceto licitações em que a equipe já mexeu (carteira, etapa
ou decisão).

## Publicação

`npm run build` gera `dist/index.html`. Publicar = Artifact `publish` com esse arquivo na URL do Studio,
mantendo os arquivos de apoio já publicados (`vencedores.json`, `mercado.json`, scripts de `jobs/`).
Até 12/11/2026 havia também um `vencedores.bin.wasm` (o mesmo JSON em gzip, disfarçado de WebAssembly). Ele saiu:
a revisão de compartilhamento do claude.ai recusa binários que não são imagem, vídeo ou áudio, e o Studio não podia
ser compartilhado. Não publique arquivos binários junto da página.
Pelo mesmo motivo, desde 12/11/2026 as 4 fontes (PTYPE e ABC Whyte) não vão mais embutidas na página: o build as grava
em `dist/fontes/*.woff2` e a página as carrega de `fontes/`. Na primeira publicação depois de mudar uma fonte, publique
também esses arquivos (`files`); a publicação automática manda só o `index.html` e mantém os que já estão lá. O build
falha se a página voltar a embutir `data:` que não seja imagem.
