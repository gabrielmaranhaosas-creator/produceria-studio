// Saídas do Studio: o que está na tela (com os filtros ativos) vira um PDF diagramado na identidade da PRODUCERIA e
// uma planilha Excel (.xlsx) com valores tipados, filtro, totais que respeitam o filtro e links vivos.
// Sem biblioteca: o .xlsx é um zip de XML montado aqui; o PDF é escrito à mão (Helvetica para o texto e os títulos
// em PTYPE desenhados num canvas e embutidos como imagem, porque a fonte da casa só existe em woff2).

export interface Kpi { rotulo: string; valor: string; nota?: string }
export interface Item { titulo: string; detalhe?: string; link?: string }
export type Bloco =
  | { t: 'secao'; titulo: string }
  | { t: 'tabela'; titulo?: string; colunas: string[]; linhas: string[][] }
  | { t: 'barras'; titulo: string; itens: { rotulo: string; valor: number; texto: string }[] }
  | { t: 'lista'; titulo?: string; itens: Item[] };
export interface Relatorio { titulo: string; olho?: string; descricao?: string; filtros: string[]; kpis: Kpi[]; blocos: Bloco[]; em: Date; versao?: string; endereco?: string }

const limpo = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').trim();
const dois = (n: number) => String(n).padStart(2, '0');
export const quando = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;

// ---------------------------------------------------------------- leitura da tela

/** Lê a tela montada: cabeçalho, filtros ativos, indicadores, seções, tabelas, gráficos de barras e listas. */
export function extrair(raiz: HTMLElement): Omit<Relatorio, 'em' | 'versao' | 'endereco'> {
  const oculto = (el: Element) => {
    if (el.closest('[hidden],.sr,[aria-hidden="true"],dialog:not([open]),.cs-exp')) return true;
    const d = el.closest('details');
    return !!d && !d.open && !el.closest('summary');
  };
  // texto com espaço entre os elementos ("19/11/2026" + "vence" não grudam), sem o que é só para leitor de tela
  const txt = (el: Element | null | undefined): string => {
    if (!el) return '';
    const p: string[] = [], w = document.createTreeWalker(el, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement?.closest('.sr,.k-seta,[aria-hidden="true"]')) p.push(n.nodeValue || '');
    return limpo(p.join(' ')).replace(/ ([,.;:)])/g, '$1').replace(/\( /g, '(');
  };
  const rotuloDe = (el: Element) => { const a = el.previousElementSibling; return a?.matches('.lab, h3, h4, .caption, .lc-colh') ? txt(a) : undefined; };
  const cab = raiz.querySelector('.page-head');
  const R: Omit<Relatorio, 'em' | 'versao' | 'endereco'> = {
    titulo: txt(cab?.querySelector('h1')) || limpo(document.title.split('·')[0]) || 'PRODUCERIA Studio',
    olho: txt(cab?.querySelector('.eyebrow')), descricao: txt(cab?.querySelector('.lead')), filtros: [], kpis: [], blocos: [],
  };
  R.filtros = [...new Set([...raiz.querySelectorAll('[aria-pressed="true"]')].filter((e) => !oculto(e)).map((e) => e.matches('.k') ? 'Detalhe: ' + txt(e.querySelector('.kl')) : txt(e).replace(/\s*\d[\d.]*$/, ''))
    .filter((t) => t && !/^(tod[oa]s?|tudo)\b/i.test(t)))];
  const feitos: Element[] = [];
  const dentro = (el: Element) => feitos.some((f) => f !== el && f.contains(el));
  for (const el of raiz.querySelectorAll('h2, .k, .kpi, table, figure.pn-c, ul.vc-l, ol.cn-leads, .lc-col')) {
    if (oculto(el) || dentro(el) || el.closest('.page-head')) continue;
    if (el.matches('h2')) { const t = txt(el); if (t) R.blocos.push({ t: 'secao', titulo: t }); continue; }
    feitos.push(el);
    if (el.matches('.k, .kpi')) {
      const r = txt(el.querySelector('.kl')), n = txt(el.querySelector('.kn'));
      R.kpis.push({ rotulo: r, valor: txt(el.querySelector('b')) || limpo(txt(el).replace(r, '').replace(n, '')), nota: n });
    } else if (el.matches('table')) {
      const linhas = [...el.querySelectorAll('tr')].filter((tr) => !oculto(tr)).map((tr) => [...tr.children].map(txt));
      const cabeca = el.querySelector('thead tr') ? linhas.shift()! : linhas.length && el.querySelector('tr')?.querySelector('th:not(:first-child), th:only-child') ? linhas.shift()! : [];
      if (linhas.length) R.blocos.push({ t: 'tabela', titulo: txt(el.querySelector('caption')) || rotuloDe(el), colunas: cabeca, linhas });
    } else if (el.matches('figure')) {
      const cap = el.querySelector('figcaption'), titulo = limpo(cap ? [...cap.childNodes].filter((n) => n.nodeName !== 'SMALL').map((n) => n.textContent).join('') : '');
      const itens = el.querySelector('.pn-m')
        ? [...el.querySelectorAll('.pn-m li')].map((li) => { const t = txt(li.querySelector('.pn-v')); return { rotulo: txt(li.querySelector('.pn-x')), valor: numero(t) ?? 0, texto: t || '0' }; })
        : [...el.querySelectorAll('.pn-b li')].map((li) => { const t = txt(li.querySelector('b')), r = li.querySelector('.pn-r'); return { rotulo: limpo(r ? [...r.childNodes].filter((n) => n.nodeName !== 'SMALL').map((n) => n.textContent).join('') : ''), valor: numero(t) ?? 0, texto: t }; });
      if (itens.length) R.blocos.push({ t: 'barras', titulo, itens });
    } else {
      const col = el.matches('.lc-col'), itens = (col ? [...el.querySelectorAll('.lc-card')] : [...el.children].filter((c) => c.tagName === 'LI')).filter((li) => !oculto(li)).map((li) => {
        const b = li.querySelector('b, strong'), titulo = txt(b) || txt(li).slice(0, 120), a = li.querySelector<HTMLAnchorElement>('a[href^="https://"]');
        return { titulo, detalhe: limpo(txt(li).replace(titulo, '')), link: a?.href };
      }).filter((i) => i.titulo);
      if (itens.length) R.blocos.push({ t: 'lista', titulo: col ? txt(el.querySelector('.lab, .lc-colh')) : rotuloDe(el), itens });
    }
  }
  return R;
}

// ---------------------------------------------------------------- valores

/** "1.234,56" → 1234.56; texto que não é número → null. */
export function numero(s: string): number | null {
  const t = s.replace(/^R\$\s*/, '').replace(/\s*%$/, '').trim();
  if (!/^-?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(t)) return null;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}
/** Valor tipado para a planilha: número, moeda (R$), porcentagem ou data (dd/mm/aaaa). */
export function tipar(s: string): { v: number; f: 0 | 3 | 4 | 5 } | null {
  const d = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (d) return { v: (Date.UTC(+d[3], +d[2] - 1, +d[1]) - Date.UTC(1899, 11, 30)) / 864e5, f: 5 };
  const n = numero(s);
  if (n == null) return null;
  return /%\s*$/.test(s) ? { v: n / 100, f: 4 } : /^R\$/.test(s.trim()) ? { v: n, f: 3 } : { v: n, f: 0 };
}

// ---------------------------------------------------------------- zip e compressão

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export const crc32 = (b: Uint8Array) => { let c = ~0; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
async function comprimir(b: Uint8Array, f: 'deflate' | 'deflate-raw'): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try { return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream(f))).arrayBuffer()); } catch { return null; }
}
const juntar = (p: Uint8Array[]) => { const r = new Uint8Array(p.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of p) { r.set(x, o); o += x.length; } return r; };

export async function zip(arqs: [string, string][]): Promise<Uint8Array> {
  const enc = new TextEncoder(), partes: Uint8Array[] = [], central: Uint8Array[] = [];
  let off = 0;
  for (const [nome, texto] of arqs) {
    const dados = enc.encode(texto), n = enc.encode(nome), c = crc32(dados), z = await comprimir(dados, 'deflate-raw'), corpo = z || dados;
    const h = new Uint8Array(30 + n.length), v = new DataView(h.buffer), e = new Uint8Array(46 + n.length), w = new DataView(e.buffer);
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x800, 2], [8, z ? 8 : 0, 2], [12, 0x21, 2], [14, c, 4], [18, corpo.length, 4], [22, dados.length, 4], [26, n.length, 2]]
      .forEach(([o, x, t]) => (t === 4 ? v.setUint32(o, x, true) : v.setUint16(o, x, true)));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x800, 2], [10, z ? 8 : 0, 2], [14, 0x21, 2], [16, c, 4], [20, corpo.length, 4], [24, dados.length, 4], [28, n.length, 2], [42, off, 4]]
      .forEach(([o, x, t]) => (t === 4 ? w.setUint32(o, x, true) : w.setUint16(o, x, true)));
    h.set(n, 30); e.set(n, 46);
    partes.push(h, corpo); central.push(e); off += h.length + corpo.length;
  }
  const fim = new Uint8Array(22), f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, arqs.length, true); f.setUint16(10, arqs.length, true);
  f.setUint32(12, central.reduce((s, x) => s + x.length, 0), true); f.setUint32(16, off, true);
  return juntar([...partes, ...central, fim]);
}

// ---------------------------------------------------------------- Excel

const xe = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const coluna = (i: number) => { let s = ''; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
type Cel = string | number | { f: string; v?: string; s?: number } | null;
interface Aba { nome: string; linhas: Cel[][]; estilos?: Record<number, number>; cab?: number; larg: number[] }

function planilha(a: Aba): string {
  const linhas = a.linhas.map((l, r) => `<row r="${r + 1}">${l.map((c, i) => {
    if (c == null || c === '') return '';
    const ref = coluna(i) + (r + 1), s = a.estilos?.[r];
    if (typeof c === 'object') return `<c r="${ref}" s="${c.s ?? s ?? 0}"${c.v != null ? ' t="str"' : ''}><f>${xe(c.f)}</f>${c.v != null ? `<v>${xe(c.v)}</v>` : ''}</c>`;
    if (typeof c === 'number') return `<c r="${ref}" s="${s ?? 0}"><v>${c}</v></c>`;
    const t = s == null || s === 7 ? tipar(c) : null;
    return t ? `<c r="${ref}" s="${s === 7 ? 7 : t.f}"><v>${t.v}</v></c>` : `<c r="${ref}" t="inlineStr" s="${s ?? 0}"><is><t xml:space="preserve">${xe(c)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const k = a.cab, fim = a.linhas.length, ult = Math.max(...a.linhas.map((l) => l.length), 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheetViews><sheetView workbookViewId="0"${k == null ? '' : '><pane ySplit="' + (k + 1) + '" topLeftCell="A' + (k + 2) + '" activePane="bottomLeft" state="frozen"/></sheetView'}${k == null ? '/>' : '>'}</sheetViews>`
    + `<cols>${a.larg.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${linhas}</sheetData>`
    + (k != null && fim > k + 1 ? `<autoFilter ref="A${k + 1}:${coluna(ult - 1)}${a.linhas[fim - 1]?.some((c) => typeof c === 'object' && c && 'f' in c && /SUBTOTAL/.test(c.f)) ? fim - 1 : fim}"/>` : '') + '</worksheet>';
}

/** Uma aba por bloco (tabela, gráfico, lista), mais o resumo com origem, filtros e indicadores. */
export function abas(R: Relatorio): Aba[] {
  const meta = `PRODUCERIA Studio · ${R.titulo} · gerado em ${quando(R.em)}${R.filtros.length ? ' · filtros: ' + R.filtros.join(', ') : ''}`;
  const resumo: Aba = {
    nome: 'Resumo', cab: undefined, larg: [34, 22, 60], estilos: { 0: 1, 1: 6 },
    linhas: [[R.titulo], [R.descricao || ''], [], ['Gerado em', quando(R.em)], ['Tela', (R.olho || '') + (R.endereco ? ` (${R.endereco})` : '')], ['Versão do Studio', R.versao || ''], ['Filtros ativos', R.filtros.join(' · ') || 'nenhum']],
  };
  resumo.estilos![3] = 0;
  if (R.kpis.length) {
    resumo.linhas.push([], ['Indicador', 'Valor', 'Nota']);
    resumo.estilos![resumo.linhas.length - 1] = 2;
    for (const k of R.kpis) resumo.linhas.push([k.rotulo, k.valor, k.nota || '']);
  }
  const L: Aba[] = [resumo], nomes = new Set(['Resumo']);
  let secao = '';
  const nomeAba = (t: string) => {
    const base = (t || 'Dados').replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'Dados';
    let n = base, i = 2;
    while (nomes.has(n.toLowerCase() === n ? n : n) && [...nomes].some((x) => x.toLowerCase() === n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
    nomes.add(n); return n;
  };
  for (const b of R.blocos) {
    if (b.t === 'secao') { secao = b.titulo; continue; }
    const titulo = ('titulo' in b && b.titulo) || secao || 'Dados';
    let cab: string[], dados: Cel[][];
    if (b.t === 'tabela') { const n = Math.max(b.colunas.length, ...b.linhas.map((l) => l.length)); cab = Array.from({ length: n }, (_, i) => b.colunas[i] || `Coluna ${i + 1}`); dados = b.linhas; }
    else if (b.t === 'barras') { cab = ['Item', 'Valor']; dados = b.itens.map((i) => [i.rotulo, i.valor]); }
    else { cab = ['Título', 'Detalhe', 'Link']; dados = b.itens.map((i) => [i.titulo, i.detalhe || '', i.link ? { f: `HYPERLINK("${i.link.replace(/"/g, '""')}","abrir")`, v: 'abrir', s: 8 } : '']); }
    const linhas: Cel[][] = [[titulo], [meta], cab, ...dados], estilos: Record<number, number> = { 0: 1, 1: 6, 2: 2 };
    // totais que respeitam o filtro (SUBTOTAL 109): só nas colunas em que todo valor é número
    const numericas = cab.map((_, c) => dados.length > 1 && dados.every((l) => typeof l[c] === 'number' || (typeof l[c] === 'string' && (l[c] === '' || (tipar(l[c] as string)?.f ?? 5) !== 5))) && dados.some((l) => l[c] !== ''));
    if (numericas.some(Boolean)) {
      linhas.push(cab.map((_, c) => (c === 0 && !numericas[0] ? 'Total (linhas visíveis)' : numericas[c] ? { f: `SUBTOTAL(109,${coluna(c)}4:${coluna(c)}${dados.length + 3})`, s: 7 } : null)));
      estilos[linhas.length - 1] = 7;
    }
    const larg = cab.map((h, c) => Math.min(60, Math.max(10, h.length + 2, ...dados.slice(0, 200).map((l) => String(typeof l[c] === 'object' ? 'abrir' : l[c] ?? '').length + 2))));
    L.push({ nome: nomeAba(titulo), linhas, estilos, cab: 2, larg });
  }
  return L;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>`
  + `<fonts count="5"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="15"/><name val="Arial"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><sz val="9"/><color rgb="FF6B6B68"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font></fonts>`
  + `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000000"/><bgColor indexed="64"/></patternFill></fill></fills>`
  + `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF000000"/></top><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">`
  + [[0, 0, 0, 0], [0, 1, 0, 0], [0, 2, 2, 0], [164, 0, 0, 0], [9, 0, 0, 0], [165, 0, 0, 0], [0, 3, 0, 0], [0, 4, 0, 1], [0, 4, 0, 0]]
    .map(([n, f, p, b]) => `<xf numFmtId="${n}" fontId="${f}" fillId="${p}" borderId="${b}" xfId="0"${n ? ' applyNumberFormat="1"' : ''}${f ? ' applyFont="1"' : ''}${p ? ' applyFill="1"' : ''}${b ? ' applyBorder="1"' : ''}/>`).join('')
  + `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export async function xlsx(R: Relatorio): Promise<Uint8Array> {
  const A = abas(R), ns = 'http://schemas.openxmlformats.org/', rel = ns + 'officeDocument/2006/relationships';
  const tipo = (p: string, t: string) => `<Override PartName="/${p}" ContentType="application/vnd.openxmlformats-${t}"/>`;
  return zip([
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
      + tipo('xl/workbook.xml', 'officedocument.spreadsheetml.sheet.main+xml') + tipo('xl/styles.xml', 'officedocument.spreadsheetml.styles+xml') + tipo('docProps/core.xml', 'package.core-properties+xml')
      + A.map((_, i) => tipo(`xl/worksheets/sheet${i + 1}.xml`, 'officedocument.spreadsheetml.worksheet+xml')).join('') + '</Types>'],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="${ns}package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`],
    ['docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="${ns}package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xe(R.titulo)}</dc:title><dc:creator>PRODUCERIA Studio</dc:creator><dc:description>${xe(R.filtros.length ? 'Filtros: ' + R.filtros.join(', ') : 'Sem filtros')}</dc:description><dcterms:created xsi:type="dcterms:W3CDTF">${R.em.toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}spreadsheetml/2006/main" xmlns:r="${rel}"><sheets>${A.map((a, i) => `<sheet name="${xe(a.nome)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}package/2006/relationships">${A.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${A.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', ESTILOS],
    ...A.map((a, i) => [`xl/worksheets/sheet${i + 1}.xml`, planilha(a)] as [string, string]),
  ]);
}

// ---------------------------------------------------------------- PDF

// Larguras da Helvetica e da Helvetica-Bold (1/1000 em), caracteres 32 a 126.
const W1 = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584'.split(',').map(Number);
const W2 = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584'.split(',').map(Number);
const CP: Record<string, number> = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153 };
/** Texto em WinAnsi (o que a Helvetica do PDF entende); setas e sinais viram equivalentes simples. */
export const ansi = (s: string) => limpo(s).replace(/→|↗/g, '->').replace(/←/g, '<-').replace(/✓/g, '+').replace(/✳/g, '*')
  .replace(/./gu, (c) => (CP[c] ? String.fromCharCode(CP[c]) : c.charCodeAt(0) < 256 ? c : ''));
function largura(s: string, tam: number, negrito = false) {
  const W = negrito ? W2 : W1;
  let w = 0;
  for (const c of s) { const k = c.charCodeAt(0); w += k >= 32 && k <= 126 ? W[k - 32] : k >= 192 ? (W[(c.normalize('NFD').charCodeAt(0) || 97) - 32] ?? 556) : 556; }
  return (w * tam) / 1000;
}
function quebrar(s: string, tam: number, max: number, negrito = false): string[] {
  const L: string[] = [];
  let l = '';
  for (const p of ansi(s).split(' ')) {
    let pal = p;
    while (largura(pal, tam, negrito) > max) { let i = pal.length; while (i > 1 && largura(pal.slice(0, i), tam, negrito) > max) i--; if (l) { L.push(l); l = ''; } L.push(pal.slice(0, i)); pal = pal.slice(i); }
    const t = l ? l + ' ' + pal : pal;
    if (largura(t, tam, negrito) > max && l) { L.push(l); l = pal; } else l = t;
  }
  if (l) L.push(l);
  return L.length ? L : [''];
}
const pstr = (s: string) => '(' + s.replace(/[\\()]/g, '\\$&') + ')';
const hex16 = (s: string) => '<FEFF' + [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('') + '>';
const f2 = (n: number) => +n.toFixed(2);

interface Img { w: number; h: number; dados: Uint8Array; pw: number; ph: number }
/** Título em PTYPE (a fonte da casa, já carregada na página) desenhado em tons de cinza; null fora do navegador. */
async function titulo(s: string, pt: number, max: number, claro: boolean): Promise<Img | null> {
  try {
    if (typeof document === 'undefined' || !document.fonts) return null;
    await document.fonts.load(`${pt * 4}px PTYPE`);
    if (!document.fonts.check(`${pt * 4}px PTYPE`)) return null;
    const cv = document.createElement('canvas'), x = cv.getContext('2d');
    if (!x) return null;
    const E = 4, fonte = `${pt * E}px PTYPE`;
    x.font = fonte;
    const linhas: string[] = [];
    let l = '';
    for (const p of s.toUpperCase().split(/\s+/)) { const t = l ? l + ' ' + p : p; if (l && x.measureText(t).width > max * E) { linhas.push(l); l = p; } else l = t; }
    linhas.push(l);
    const alt = pt * 1.05 * E;
    cv.width = Math.ceil(Math.min(max * E, Math.max(...linhas.map((t) => x.measureText(t).width)) + 2)); cv.height = Math.ceil(alt * linhas.length + pt * 0.25 * E);
    x.fillStyle = claro ? '#000' : '#fff'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = fonte; x.fillStyle = claro ? '#f5f4f0' : '#171717'; x.textBaseline = 'alphabetic';
    linhas.forEach((t, i) => x.fillText(t, 0, alt * (i + 0.85)));
    const px = x.getImageData(0, 0, cv.width, cv.height).data, cinza = new Uint8Array(cv.width * cv.height);
    for (let i = 0; i < cinza.length; i++) cinza[i] = px[i * 4];
    const z = await comprimir(cinza, 'deflate');
    return z ? { w: cv.width, h: cv.height, dados: z, pw: cv.width / E, ph: cv.height / E } : null;
  } catch { return null; }
}

/** Relatório em PDF A4 na identidade da PRODUCERIA: capa preta, títulos em PTYPE, marcadores, links e numeração. */
export async function pdf(R: Relatorio): Promise<Uint8Array> {
  const PW = 595.28, PH = 841.89, M = 48, CW = PW - 2 * M, BASE = 56, INK = 0.09, MUT = 0.42, LIN = 0.85;
  const paginas: { ops: string[]; links: [number, number, number, number, string][] }[] = [];
  const imgs: Img[] = [], marcas: { t: string; p: number; y: number }[] = [];
  let ops: string[] = [], y = 0;
  const T = (x: number, yy: number, s: string, tam: number, o: { b?: boolean; c?: number; tc?: number } = {}) =>
    ops.push(`BT /F${o.b ? 2 : 1} ${tam} Tf ${o.c ?? INK} g ${o.tc ?? 0} Tc ${f2(x)} ${f2(yy)} Td ${pstr(s)} Tj ET`);
  const ret = (x: number, yy: number, w: number, h: number, c: number) => ops.push(`${c} g ${f2(x)} ${f2(yy)} ${f2(w)} ${f2(h)} re f`);
  const linha = (x1: number, yy: number, x2: number, c = LIN, w = 0.5) => ops.push(`${c} G ${w} w ${f2(x1)} ${f2(yy)} m ${f2(x2)} ${f2(yy)} l S`);
  const img = (i: Img, x: number, yy: number) => { imgs.push(i); ops.push(`q ${f2(i.pw)} 0 0 ${f2(i.ph)} ${f2(x)} ${f2(yy)} cm /I${imgs.length} Do Q`); };
  const nova = () => {
    ops = []; paginas.push({ ops, links: [] }); y = PH - M;
    if (paginas.length > 1) { T(M, PH - 30, 'PRODUCERIA STUDIO', 6.5, { b: true, tc: 0.8 }); const t = ansi(R.titulo); T(PW - M - largura(t, 7), PH - 30, t, 7, { c: MUT }); linha(M, PH - 36, PW - M); y = PH - 56; }
  };
  const cabe = (h: number) => { if (y - h < BASE) nova(); };
  const secao = async (s: string) => {
    cabe(60); y -= 14;
    const i = await titulo(s, 13, CW, false);
    marcas.push({ t: s, p: paginas.length - 1, y: y + 4 });
    if (i) { y -= i.ph; img(i, M, y); } else { y -= 12; T(M, y, ansi(s).toUpperCase(), 11, { b: true, tc: 0.4 }); }
    y -= 6; linha(M, y, PW - M, 0, 0.8); y -= 12;
  };

  // capa
  nova();
  const capa = await titulo(R.titulo, 30, CW, true), alt = Math.max(210, 120 + (capa ? capa.ph : 34));
  ret(0, PH - alt, PW, alt, 0);
  T(M, PH - 46, 'PRODUCERIA', 10, { b: true, c: 0.96, tc: 2.2 });
  T(PW - M - largura('Das ideias à produção.', 7.5), PH - 46, ansi('Das ideias à produção.'), 7.5, { c: 0.72 });
  if (R.olho) T(M, PH - 92, ansi(R.olho).toUpperCase(), 7, { c: 0.72, tc: 0.9 });
  if (capa) img(capa, M, PH - 104 - capa.ph); else T(M, PH - 130, ansi(R.titulo).toUpperCase(), 26, { b: true, c: 0.96 });
  y = PH - alt - 26;
  for (const l of quebrar(R.descricao || '', 10, CW)) { if (!l) break; T(M, y, l, 10, { c: MUT }); y -= 14; }
  y -= 4;
  const meta = [`Gerado em ${quando(R.em)}`, R.versao ? `Studio ${R.versao}` : '', R.endereco || ''].filter(Boolean).join('  ·  ');
  T(M, y, ansi(meta), 7.5, { c: MUT }); y -= 12;
  if (R.filtros.length) for (const l of quebrar('Filtros ativos: ' + R.filtros.join(' · '), 7.5, CW, true)) { T(M, y, l, 7.5, { b: true }); y -= 11; }
  y -= 10;

  // indicadores
  if (R.kpis.length) {
    const G = 10, n = Math.min(4, R.kpis.length), w = (CW - G * (n - 1)) / n, h = 62;
    for (let i = 0; i < R.kpis.length; i += n) {
      cabe(h + G);
      R.kpis.slice(i, i + n).forEach((k, j) => {
        const x = M + j * (w + G);
        ops.push(`${LIN} G 0.5 w ${f2(x)} ${f2(y - h)} ${f2(w)} ${h} re S`);
        T(x + 9, y - 15, quebrar(k.rotulo, 6.5, w - 18)[0].toUpperCase(), 6.5, { c: MUT, tc: 0.5 });
        T(x + 9, y - 37, quebrar(k.valor, 15, w - 18, true)[0], 15, { b: true });
        if (k.nota) T(x + 9, y - 51, quebrar(k.nota, 7, w - 18)[0], 7, { c: MUT });
      });
      y -= h + G;
    }
  }

  let resto = 0;
  for (const b of R.blocos) {
    if (b.t === 'secao') { await secao(b.titulo); continue; }
    if ('titulo' in b && b.titulo) { cabe(40); y -= 6; T(M, y, ansi(b.titulo).toUpperCase(), 7, { b: true, c: MUT, tc: 0.8 }); y -= 12; }
    if (b.t === 'barras') {
      const top = Math.max(...b.itens.map((i) => i.valor), 1), lr = CW * 0.38, tw = CW * 0.44;
      for (const it of b.itens) {
        cabe(15);
        T(M, y - 9, quebrar(it.rotulo, 7.5, lr - 8)[0], 7.5);
        ret(M + lr, y - 10, tw, 7, 0.93); ret(M + lr, y - 10, Math.max(0.8, (tw * it.valor) / top), 7, 0);
        const v = ansi(it.texto); T(PW - M - largura(v, 7.5, true), y - 9, v, 7.5, { b: true });
        y -= 15;
      }
      y -= 8;
    } else if (b.t === 'lista') {
      for (const it of b.itens) {
        const tl = quebrar(it.titulo, 8.5, CW, true), dl = it.detalhe ? quebrar(it.detalhe, 7.5, CW) : [], h = tl.length * 11 + dl.length * 10 + 9;
        cabe(h);
        linha(M, y, PW - M);
        let yy = y - 11;
        for (const l of tl) { T(M, yy, l, 8.5, { b: true }); yy -= 11; }
        for (const l of dl) { T(M, yy, l, 7.5, { c: MUT }); yy -= 10; }
        if (it.link) { paginas[paginas.length - 1].links.push([M, y - h, PW - M, y, it.link]); T(PW - M - largura('abrir ->', 7), y - 11, 'abrir ->', 7, { c: MUT }); }
        y -= h;
      }
      y -= 10;
    } else {
      const n = Math.max(b.colunas.length, ...b.linhas.map((l) => l.length));
      const nat = Array.from({ length: n }, (_, c) => Math.min(200, Math.max(28, largura(ansi(b.colunas[c] || ''), 7, true), ...b.linhas.slice(0, 200).map((l) => largura(ansi(l[c] || ''), 7.5))) + 10));
      const k = CW / nat.reduce((s, x) => s + x, 0), cw = nat.map((x) => x * k);
      const num = Array.from({ length: n }, (_, c) => b.linhas.every((l) => !l[c] || numero(l[c].replace(/^R\$\s*/, '')) != null || tipar(l[c]) != null));
      const cab = () => {
        if (!b.colunas.length) return;
        const L = b.colunas.map((h, c) => quebrar(h, 7, cw[c] - 8, true)), h = Math.max(...L.map((l) => l.length)) * 9 + 6;
        cabe(h + 14);
        let x = M;
        L.forEach((ls, c) => { ls.forEach((l, i) => T(num[c] ? x + cw[c] - 4 - largura(l, 7, true) : x + 4, y - 9 - i * 9, l, 7, { b: true })); x += cw[c]; });
        y -= h; linha(M, y, PW - M, 0, 0.8);
      };
      cab();
      const max = 400;
      for (const l of b.linhas.slice(0, max)) {
        const L = Array.from({ length: n }, (_, c) => quebrar(l[c] || '', 7.5, cw[c] - 8)), h = Math.max(...L.map((x) => x.length)) * 9.5 + 6;
        if (y - h < BASE) { nova(); cab(); }
        let x = M;
        L.forEach((ls, c) => { ls.forEach((t, i) => T(num[c] ? x + cw[c] - 4 - largura(t, 7.5) : x + 4, y - 10 - i * 9.5, t, 7.5)); x += cw[c]; });
        y -= h; linha(M, y, PW - M);
      }
      if (b.linhas.length > max) { resto += b.linhas.length - max; cabe(14); y -= 11; T(M, y, ansi(`e mais ${b.linhas.length - max} linhas na planilha Excel desta tela`), 7, { c: MUT }); }
      y -= 14;
    }
  }
  void resto;

  // rodapé com numeração (depois de saber o total)
  paginas.forEach((p, i) => {
    ops = p.ops;
    linha(M, 40, PW - M);
    T(M, 28, ansi('PRODUCERIA · Das ideias à produção.'), 7, { c: MUT });
    const n = `${i + 1} / ${paginas.length}`; T(PW - M - largura(n, 7), 28, n, 7, { c: MUT });
  });

  // montagem dos objetos
  const enc = new TextEncoder(), latin = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);
  const objs: (Uint8Array | string)[] = [];
  const novo = (v: Uint8Array | string = '') => objs.push(v);
  novo(); novo(); novo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); novo('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  novo(`<< /Title ${hex16(R.titulo)} /Author ${hex16('PRODUCERIA Studio')} /Subject ${hex16(R.filtros.length ? 'Filtros: ' + R.filtros.join(', ') : R.descricao || '')} /Creator (PRODUCERIA Studio) /CreationDate (D:${R.em.toISOString().replace(/\D/g, '').slice(0, 14)}Z) >>`);
  const fluxo = async (dic: string, b: Uint8Array) => {
    const z = await comprimir(b, 'deflate');
    return juntar([enc.encode(`<< ${dic}${z ? ' /Filter /FlateDecode' : ''} /Length ${(z || b).length} >>\nstream\n`), z || b, enc.encode('\nendstream')]);
  };
  const imgIds: number[] = [];
  for (const i of imgs) { imgIds.push(objs.length + 1); novo(juntar([enc.encode(`<< /Type /XObject /Subtype /Image /Width ${i.w} /Height ${i.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${i.dados.length} >>\nstream\n`), i.dados, enc.encode('\nendstream')])); }
  const recursos = `<< /Font << /F1 3 0 R /F2 4 0 R >>${imgs.length ? ' /XObject << ' + imgIds.map((id, k) => `/I${k + 1} ${id} 0 R`).join(' ') + ' >>' : ''} >>`;
  const pagIds: number[] = [];
  for (const p of paginas) {
    const cont = objs.length + 1; novo(await fluxo('', latin(p.ops.join('\n'))));
    const an = p.links.map(([x1, y1, x2, y2, u]) => { novo(`<< /Type /Annot /Subtype /Link /Rect [${f2(x1)} ${f2(y1)} ${f2(x2)} ${f2(y2)}] /Border [0 0 0] /A << /S /URI /URI ${pstr(u.replace(/[^\x20-\x7e]/g, encodeURI))} >> >>`); return objs.length; });
    pagIds.push(objs.length + 1);
    novo(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources ${recursos} /Contents ${cont} 0 R${an.length ? ` /Annots [${an.map((a) => a + ' 0 R').join(' ')}]` : ''} >>`);
  }
  let raiz = '<< /Type /Catalog /Pages 2 0 R';
  if (marcas.length) {
    const ol = objs.length + 1; novo();
    const ids = marcas.map((_, i) => ol + 1 + i);
    marcas.forEach((m, i) => novo(`<< /Title ${hex16(m.t)} /Parent ${ol} 0 R${i ? ` /Prev ${ids[i - 1]} 0 R` : ''}${i < ids.length - 1 ? ` /Next ${ids[i + 1]} 0 R` : ''} /Dest [${pagIds[m.p]} 0 R /XYZ 0 ${f2(m.y)} 0] >>`));
    objs[ol - 1] = `<< /Type /Outlines /First ${ids[0]} 0 R /Last ${ids[ids.length - 1]} 0 R /Count ${ids.length} >>`;
    raiz += ` /Outlines ${ol} 0 R /PageMode /UseOutlines`;
  }
  objs[0] = raiz + ' /Lang (pt-BR) >>';
  objs[1] = `<< /Type /Pages /Kids [${pagIds.map((i) => i + ' 0 R').join(' ')}] /Count ${pagIds.length} >>`;
  const partes: Uint8Array[] = [latin('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')], offs: number[] = [];
  let pos = partes[0].length;
  objs.forEach((o, i) => { const b = juntar([enc.encode(`${i + 1} 0 obj\n`), typeof o === 'string' ? latin(o) : o, enc.encode('\nendobj\n')]); offs.push(pos); partes.push(b); pos += b.length; });
  partes.push(enc.encode(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${pos}\n%%EOF\n`));
  return juntar(partes);
}
