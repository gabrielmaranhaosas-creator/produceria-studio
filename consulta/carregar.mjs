// Carrega a fotografia do banco do Studio no Postgres da consulta (Neon).
// Uso: DATABASE_URL=... node consulta/carregar.mjs PASTA_EXPORTADA [vencedores.json mercado.json]
// PASTA_EXPORTADA/<coleção>/<id>.json, como o ArtifactData "list" com out_dir grava ({id, data, version} ou o documento).
// Cada coleção é trocada inteira numa transação: quem abre a consulta nunca vê metade de uma coleção.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import pg from 'pg';

const [pasta, ...arquivos] = process.argv.slice(2);
if (!pasta || !process.env.DATABASE_URL) { console.error('Uso: DATABASE_URL=... node consulta/carregar.mjs PASTA [arquivos.json]'); process.exit(1); }
const COLECOES = new Set(['alvos', 'b2g', 'habilitacao', 'pca', 'pipeline', 'linhas', 'swot', 'tows', 'frentes', 'ofertas',
  'casos', 'contas', 'central', 'agenda', 'biblioteca', 'fichas', 'cotacoes', 'config', 'notificacoes', 'noticias', 'movimentos',
  'contratos_novos', 'cerebro', 'testes_plugins']);

const cli = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });
await cli.connect();
await cli.query(`create table if not exists docs (colecao text not null, id text not null, dados jsonb not null, primary key (colecao, id));
  create table if not exists arquivos (nome text primary key, conteudo jsonb not null, atualizado timestamptz not null default now());
  create table if not exists meta (chave text primary key, valor text not null);`);

const resumo = {};
for (const col of readdirSync(pasta)) {
  const dir = join(pasta, col);
  if (!statSync(dir).isDirectory() || !COLECOES.has(col)) continue;
  const docs = readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('.')).map((f) => {
    const d = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    return { id: d.id ?? f.slice(0, -5), dados: d.data ?? d };
  });
  await cli.query('begin');
  try {
    await cli.query('delete from docs where colecao = $1', [col]);
    for (let i = 0; i < docs.length; i += 200) {
      const lote = docs.slice(i, i + 200);
      const valores = lote.map((_, k) => `($1, $${k * 2 + 2}, $${k * 2 + 3}::jsonb)`).join(',');
      await cli.query(`insert into docs (colecao, id, dados) values ${valores}`, [col, ...lote.flatMap((d) => [d.id, JSON.stringify(d.dados)])]);
    }
    await cli.query('commit');
  } catch (e) { await cli.query('rollback'); throw e; }
  resumo[col] = docs.length;
}
for (const a of arquivos) {
  if (!existsSync(a)) { console.error('Arquivo não encontrado:', a); continue; }
  await cli.query('insert into arquivos (nome, conteudo, atualizado) values ($1, $2::jsonb, now()) on conflict (nome) do update set conteudo = excluded.conteudo, atualizado = now()',
    [basename(a), readFileSync(a, 'utf8')]);
  resumo[basename(a)] = 'ok';
}
await cli.query("insert into meta (chave, valor) values ('atualizadoEm', $1) on conflict (chave) do update set valor = excluded.valor", [new Date().toISOString()]);
await cli.end();
console.log(JSON.stringify(resumo));
