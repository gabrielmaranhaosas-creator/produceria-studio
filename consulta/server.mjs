// Servidor da cópia de consulta do Studio (Render). Serve dist/consulta.html e a fotografia dos dados guardada no
// Postgres (Neon), tudo atrás de uma senha da equipe (HTTP Basic). Só leitura: não há rota que grave.
// Variáveis: DATABASE_URL (Neon), SENHA (senha da equipe), PORT (o Render define).
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { timingSafeEqual, createHash } from 'node:crypto';
import pg from 'pg';

const SENHA = process.env.SENHA || '';
if (!SENHA || SENHA.length < 8) { console.error('Defina SENHA (mínimo 8 caracteres).'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL.'); process.exit(1); }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, ssl: { rejectUnauthorized: true } });

// Coleções que a consulta mostra (as conversas com agentes e a lixeira ficam de fora).
export const COLECOES = new Set(['alvos', 'b2g', 'habilitacao', 'pca', 'pipeline', 'linhas', 'swot', 'tows', 'frentes', 'ofertas',
  'casos', 'contas', 'central', 'agenda', 'biblioteca', 'fichas', 'cotacoes', 'config', 'notificacoes', 'noticias', 'movimentos',
  'contratos_novos', 'cerebro', 'testes_plugins']);
const ARQUIVOS = new Set(['vencedores.json', 'mercado.json']);

const hash = (s) => createHash('sha256').update(s).digest();
const ALVO = hash(SENHA);
function autorizado(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const senha = Buffer.from(h.slice(6), 'base64').toString('utf8').split(':').slice(1).join(':');
  return timingSafeEqual(hash(senha), ALVO);
}

const cache = new Map(); // caminho → { em, corpo (gzip), tipo }
const MINUTOS = 10;
async function conteudo(caminho) {
  const c = cache.get(caminho);
  if (c && Date.now() - c.em < MINUTOS * 60000) return c;
  let corpo, tipo = 'application/json; charset=utf-8';
  if (caminho === '/' || caminho === '/index.html') {
    corpo = readFileSync(new URL('../dist/consulta.html', import.meta.url)); tipo = 'text/html; charset=utf-8';
  } else if (caminho === '/dados/_meta') {
    const r = await pool.query("select valor from meta where chave = 'atualizadoEm'");
    corpo = JSON.stringify({ atualizadoEm: r.rows[0]?.valor || null });
  } else if (caminho.startsWith('/dados/')) {
    const col = decodeURIComponent(caminho.slice(7));
    if (!COLECOES.has(col)) return null;
    const r = await pool.query('select id, dados from docs where colecao = $1 order by id', [col]);
    corpo = JSON.stringify(r.rows.map((x) => ({ id: x.id, data: x.dados })));
  } else if (ARQUIVOS.has(caminho.slice(1))) {
    const r = await pool.query('select conteudo::text as c from arquivos where nome = $1', [caminho.slice(1)]);
    if (!r.rows.length) return null;
    corpo = r.rows[0].c;
  } else return null;
  const item = { em: Date.now(), corpo: gzipSync(Buffer.from(corpo)), tipo };
  cache.set(caminho, item);
  return item;
}

createServer(async (req, res) => {
  const caminho = new URL(req.url, 'http://x').pathname;
  if (caminho === '/saude') { res.writeHead(200).end('ok'); return; }
  // Qual commit está no ar (o Render define RENDER_GIT_COMMIT): sem dados, serve para conferir o deploy.
  if (caminho === '/versao') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end((process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7)); return; }
  if (!autorizado(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="PRODUCERia Studio · consulta", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Senha da equipe necessária.');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  try {
    const c = await conteudo(caminho);
    if (!c) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado.'); return; }
    res.writeHead(200, { 'Content-Type': c.tipo, 'Content-Encoding': 'gzip', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "frame-ancestors 'none'", 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    res.end(req.method === 'HEAD' ? undefined : c.corpo);
  } catch (e) {
    console.error(caminho, e);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Erro ao ler os dados.');
  }
}).listen(Number(process.env.PORT) || 10000, () => console.log('consulta no ar'));
