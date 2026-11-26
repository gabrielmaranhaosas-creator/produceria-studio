/**
 * Leitura do arquivo oficial de dados do LinkedIn ("Obter uma cópia dos seus dados"). Cada pessoa baixa o próprio
 * arquivo, com o consentimento dela, e o entrega à MENTO; tudo é lido aqui, no navegador, sem enviar nada a lugar
 * nenhum. Só três arquivos interessam: Profile.csv (quem é), Positions.csv (por onde passou) e Connections.csv (a rede
 * de 1º grau, com empresa e cargo). Mensagens, convites e o resto do arquivo nunca são lidos.
 */

/* ───────────── ZIP (só leitura: armazenado ou deflate, pelo DecompressionStream do navegador) ───────────── */
const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);
const ARQUIVOS_LIDOS = /^(profile|positions|connections)\.csv$/i;

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** Os CSVs que interessam dentro do .zip, pelo nome do arquivo (em qualquer pasta). */
export async function lerZip(buf: ArrayBuffer): Promise<Record<string, string>> {
  const d = new DataView(buf), b = new Uint8Array(buf);
  let fim = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(d, i) === 0x06054b50) { fim = i; break; }
  if (fim < 0) throw new Error('Este arquivo não é um .zip válido.');
  const total = u16(d, fim + 10);
  let p = u32(d, fim + 16);
  const out: Record<string, string> = {}, txt = new TextDecoder('utf-8');
  for (let k = 0; k < total; k++) {
    if (u32(d, p) !== 0x02014b50) break;
    const metodo = u16(d, p + 10), tam = u32(d, p + 20), nl = u16(d, p + 28), el = u16(d, p + 30), cl = u16(d, p + 32), local = u32(d, p + 42);
    const nome = txt.decode(b.subarray(p + 46, p + 46 + nl)), base = nome.split('/').pop() || '';
    p += 46 + nl + el + cl;
    if (!ARQUIVOS_LIDOS.test(base)) continue;
    const ini = local + 30 + u16(d, local + 26) + u16(d, local + 28), bruto = b.subarray(ini, ini + tam);
    const dados = metodo === 0 ? bruto : metodo === 8 ? await inflar(bruto) : null;
    if (dados) out[base.toLowerCase()] = txt.decode(dados);
  }
  return out;
}

/* ───────────── CSV (aspas, vírgulas e quebras de linha dentro do campo) ───────────── */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, ''), linhas: string[][] = [];
  let campo = '', linha: string[] = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) { if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c; continue; }
    if (c === '"') aspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => x.trim()));
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Linhas como objetos, achando o cabeçalho (o Connections.csv começa com notas antes dele) pelos nomes aceitos. */
function tabela(texto: string, campos: Record<string, string[]>): Record<string, string>[] {
  const L = lerCsv(texto), chaves = Object.entries(campos);
  const iCab = L.findIndex((l) => { const n = l.map(norm); return chaves.filter(([, al]) => al.some((a) => n.includes(a))).length >= 2; });
  if (iCab < 0) return [];
  const cab = L[iCab].map(norm), idx: Record<string, number> = {};
  for (const [k, al] of chaves) idx[k] = cab.findIndex((h) => al.includes(h));
  return L.slice(iCab + 1).map((l) => Object.fromEntries(chaves.map(([k]) => [k, idx[k] >= 0 ? (l[idx[k]] || '').trim() : ''])));
}

const MESES: Record<string, string> = { jan: '01', fev: '02', feb: '02', mar: '03', abr: '04', apr: '04', mai: '05', may: '05', jun: '06', jul: '07', ago: '08', aug: '08', set: '09', sep: '09', out: '10', oct: '10', nov: '11', dez: '12', dec: '12' };
/** "26 Nov 2026", "26 nov. 2026", "Jan 2022", "2022", "11/26/26" → "2026-11-26" / "2022-01" / "2022". */
export function data(s: string): string {
  const t = norm(s).replace(/\./g, '').replace(/\bde\b/g, ' ').replace(/\s+/g, ' ').trim();
  let m = t.match(/^(\d{1,2}) ([a-z]{3})[a-z]* (\d{4})$/); if (m && MESES[m[2]]) return `${m[3]}-${MESES[m[2]]}-${m[1].padStart(2, '0')}`;
  m = t.match(/^([a-z]{3})[a-z]* (\d{4})$/); if (m && MESES[m[1]]) return `${m[2]}-${MESES[m[1]]}`;
  m = t.match(/^(\d{4})-(\d{2})(-\d{2})?$/); if (m) return t;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (m) { const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; }
  m = t.match(/^(\d{4})$/); return m ? m[1] : '';
}

export interface Conexao { nome: string; url: string; email: string; empresa: string; cargo: string; desde: string }
export interface Posicao { empresa: string; cargo: string; inicio: string; fim: string; atual: boolean }
export interface Pessoa { id: string; nome: string; titulo: string; url: string; posicoes: Posicao[]; conexoes: Conexao[]; arquivos: string[] }

const C_CONEXOES = { nome: ['first name', 'nome'], sobrenome: ['last name', 'sobrenome'], url: ['url', 'perfil', 'profile url'], email: ['email address', 'endereco de e-mail', 'e-mail', 'email'], empresa: ['company', 'empresa'], cargo: ['position', 'cargo'], desde: ['connected on', 'conectado em', 'conectado(a) em'] };
const C_POSICOES = { empresa: ['company name', 'nome da empresa', 'empresa'], cargo: ['title', 'cargo', 'titulo'], inicio: ['started on', 'inicio', 'data de inicio'], fim: ['finished on', 'termino', 'data de termino', 'fim'] };
const C_PERFIL = { nome: ['first name', 'nome'], sobrenome: ['last name', 'sobrenome'], titulo: ['headline', 'titulo'], sites: ['websites', 'sites'] };

/** Junta os CSVs de uma pessoa. `id` identifica a pessoa na rede (1, 2…). */
export function pessoaDosArquivos(id: string, arq: Record<string, string>): Pessoa {
  const perfil = arq['profile.csv'] ? tabela(arq['profile.csv'], C_PERFIL)[0] : undefined;
  const posicoes: Posicao[] = arq['positions.csv'] ? tabela(arq['positions.csv'], C_POSICOES).filter((p) => p.empresa || p.cargo)
    .map((p) => ({ empresa: p.empresa, cargo: p.cargo, inicio: data(p.inicio), fim: data(p.fim), atual: !p.fim })) : [];
  const conexoes: Conexao[] = arq['connections.csv'] ? tabela(arq['connections.csv'], C_CONEXOES)
    .map((c) => ({ nome: `${c.nome} ${c.sobrenome}`.trim(), url: c.url.replace(/\/+$/, ''), email: c.email, empresa: c.empresa, cargo: c.cargo, desde: data(c.desde) }))
    .filter((c) => c.nome || c.url) : [];
  const nome = perfil ? `${perfil.nome} ${perfil.sobrenome}`.trim() : '';
  return { id, nome, titulo: perfil?.titulo || '', url: '', posicoes, conexoes, arquivos: Object.keys(arq).sort() };
}

/** Um arquivo solto (o .zip inteiro ou um dos CSVs) vira a parte da pessoa que ele traz. */
export async function lerArquivos(arquivos: { nome: string; dados: ArrayBuffer }[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const a of arquivos) {
    if (/\.zip$/i.test(a.nome)) Object.assign(out, await lerZip(a.dados));
    else { const base = (a.nome.split(/[\\/]/).pop() || '').toLowerCase(); if (ARQUIVOS_LIDOS.test(base)) out[base] = new TextDecoder('utf-8').decode(a.dados); }
  }
  return out;
}
