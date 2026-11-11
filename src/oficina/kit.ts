/**
 * Regras do Kit Produceria, as mesmas do núcleo Python (produceria-kit/produceria-core/produceria_core.py),
 * do servidor MCP e dos painéis do Photoshop. Um arquivo nomeado no Studio, no Photoshop ou pelo Claude sai igual.
 *
 * Padrão de nome: CLIENTE_campanha_formato_v01.ext (sem acento, espaço nem símbolo; versão com 2 dígitos).
 * Estrutura do job: 00_briefing … 05_entrega. Originais nunca são editados; a entrega sai sempre de 05_entrega.
 * Divergências conhecidas: o painel de desdobra do Photoshop chama o formato de paisagem só de "paisagem" (aqui vale
 * o nome do núcleo, "paisagem-1200x628"); e no Studio o ponto de foco é o ponto que fica no centro do recorte (clicado
 * sobre o KV), enquanto no núcleo Python ele é a posição do recorte na sobra (ImageOps.fit). Com foco no meio, iguais.
 */

export interface Formato { nome: string; largura: number; altura: number; grupo?: string }

/** Formatos padrão de desdobra do kit (núcleo Python). */
export const FORMATOS_PADRAO: Record<string, [number, number]> = {
  stories: [1080, 1920],
  'feed-retrato': [1080, 1350],
  'feed-quadrado': [1080, 1080],
  'paisagem-1200x628': [1200, 628],
  'banner-300x250': [300, 250],
  'banner-728x90': [728, 90],
  'banner-160x600': [160, 600],
  'banner-970x250': [970, 250],
};

/** Formatos extras da casa: mídia exterior em pixels de prova, na proporção real (o arquivo final de OOH sai da
 * Gráfica, em milímetros) e impressos A4/A3 a 300 ppi. */
export const FORMATOS_EXTRAS: Formato[] = [
  { nome: 'outdoor-9x3', largura: 3000, altura: 1000, grupo: 'Mídia exterior' },
  { nome: 'front-light-4x2', largura: 2000, altura: 1000, grupo: 'Mídia exterior' },
  { nome: 'busdoor', largura: 2200, altura: 600, grupo: 'Mídia exterior' },
  { nome: 'dooh-vertical', largura: 1080, altura: 1920, grupo: 'Mídia exterior' },
  { nome: 'dooh-horizontal', largura: 1920, altura: 1080, grupo: 'Mídia exterior' },
  { nome: 'a4-retrato', largura: 2480, altura: 3508, grupo: 'Impresso (300 ppi)' },
  { nome: 'a3-retrato', largura: 3508, altura: 4961, grupo: 'Impresso (300 ppi)' },
];

export const ESTRUTURA = ['00_briefing', '01_originais', '02_trabalho/psd', '02_trabalho/motion', '02_trabalho/3d',
  '03_revisao', '04_saidas/digital', '04_saidas/impressao', '05_entrega'];

/** CLIENTE_campanha_formato_v01 (o nome sem extensão precisa começar assim). */
export const PADRAO_NOME = /^[^_\s]+_[^_\s]+_[^_\s]+_v\d{2,}/i;

/** Texto seguro para nome de arquivo: sem acento, espaço ou símbolo (só letras, números e hífen). */
export function limpar(txt: unknown): string {
  return String(txt ?? '').normalize('NFKD').replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

export class ErroKit extends Error {}

/** Aceita nomes padrão ('stories'), extras ('outdoor-9x3') ou medidas ('1080x1350' ou 'meu-nome:1080x1350'). */
export function interpretarFormatos(formatos: string[]): Formato[] {
  return formatos.map((f) => {
    const t = String(f).trim();
    if (FORMATOS_PADRAO[t]) return { nome: t, largura: FORMATOS_PADRAO[t][0], altura: FORMATOS_PADRAO[t][1] };
    const ex = FORMATOS_EXTRAS.find((x) => x.nome === t);
    if (ex) return { ...ex };
    const m = /^(?:([^:]+):)?(\d{2,5})x(\d{2,5})$/.exec(t);
    if (!m) throw new ErroKit(`Formato inválido: '${t}'. Use um nome padrão (${Object.keys(FORMATOS_PADRAO).join(', ')}) ou medidas como 1080x1350.`);
    const w = Number(m[2]), h = Number(m[3]);
    return { nome: limpar(m[1] || `${w}x${h}`), largura: w, altura: h };
  });
}

/** Nome no padrão: CLIENTE_campanha_formato_v01.ext */
export function nomeArquivo(cliente: string, campanha: string, formato: string, versao = 1, extensao = 'psd'): string {
  const c = limpar(cliente), p = limpar(campanha);
  if (!c || !p) throw new ErroKit('Informe cliente e campanha.');
  const v = Math.max(1, Math.min(99, Math.round(Number(versao) || 1)));
  return `${c}_${p}_${limpar(formato)}_v${String(v).padStart(2, '0')}.${extensao.replace(/^\./, '')}`;
}

export function gerarNomes(cliente: string, campanha: string, formatos: string[], versao = 1, extensao = 'psd'): string[] {
  return interpretarFormatos(formatos).map((f) => nomeArquivo(cliente, campanha, f.nome, versao, extensao));
}

/** "CLI_camp_stories_v03.psd" → "CLI_camp_stories_v04.psd"; sem versão, acrescenta _v02 (painel de retoque). */
export function proximaVersao(nome: string): string {
  const m = /^(.*?)(_v)(\d+)(\.[^.]*)?$/i.exec(nome || '');
  if (m) return m[1] + m[2] + String(Number(m[3]) + 1).padStart(Math.max(2, m[3].length), '0') + (m[4] || '');
  const ext = /(\.[^.]*)$/.exec(nome || '');
  const base = ext ? nome.slice(0, -ext[1].length) : nome || 'sem-nome';
  return `${base}_v02${ext ? ext[1] : ''}`;
}

export const nomeNoPadrao = (arquivo: string) => PADRAO_NOME.test(arquivo.replace(/\.[^.]*$/, ''));

/** Recorte de origem para preencher o formato ('cobrir'), centrado no ponto de foco (0 a 1), sem sair da imagem. */
export function recorteCobrir(origW: number, origH: number, alvoW: number, alvoH: number, focoX = 0.5, focoY = 0.5) {
  const s = Math.max(alvoW / origW, alvoH / origH);
  const w = alvoW / s, h = alvoH / s;
  const x = Math.min(Math.max(focoX * origW - w / 2, 0), origW - w);
  const y = Math.min(Math.max(focoY * origH - h / 2, 0), origH - h);
  return { x, y, w, h, escala: s };
}

/** Tamanho e posição da imagem inteira dentro do formato ('conter'), centralizada. */
export function encaixeConter(origW: number, origH: number, alvoW: number, alvoH: number) {
  const s = Math.min(alvoW / origW, alvoH / origH);
  const w = Math.max(1, Math.round(origW * s)), h = Math.max(1, Math.round(origH * s));
  return { x: Math.floor((alvoW - w) / 2), y: Math.floor((alvoH - h) / 2), w, h, escala: s };
}

/** Quanto a imagem é ampliada para o formato. Acima de 2x a desdobra perde nitidez (aviso do painel do Photoshop). */
export function ampliacao(origW: number, origH: number, alvoW: number, alvoH: number, modo: 'cobrir' | 'conter'): number {
  return modo === 'cobrir' ? Math.max(alvoW / origW, alvoH / origH) : Math.min(alvoW / origW, alvoH / origH);
}

/** Texto do LEIA-ME da estrutura do job (o mesmo do núcleo). */
export function leiaMe(cliente: string, campanha: string, hoje = new Date().toISOString().slice(0, 10)): string {
  return `Job: ${cliente} / ${campanha}\nCriado em: ${hoje}\n\nPadrão de nome: CLIENTE_campanha_formato_v01\nOriginais nunca são editados. Trabalho em 02_trabalho. Entrega sempre de 05_entrega.\n`;
}

export interface InfoImagem { arquivo: string; formato: string; largura: number; altura: number; dpi: number | null; cmyk: boolean; perfilIcc: boolean; tamanhoKb: number }

/** Alertas de uma imagem, os mesmos do núcleo (checar_imagem), mais o de resolução baixa para impressão. */
export function alertasImagem(i: InfoImagem): string[] {
  const a: string[] = [];
  if (!nomeNoPadrao(i.arquivo)) a.push('Nome fora do padrão CLIENTE_campanha_formato_v01.');
  if (i.cmyk) a.push('Imagem em CMYK: serve para impressão, não para tela.');
  if (!i.perfilIcc) a.push('Sem perfil de cor embutido.');
  if (i.dpi === null) a.push('Resolução (dpi) não informada no arquivo.');
  else if (i.dpi < 150) a.push(`Resolução de ${i.dpi} ppi: abaixo de 150 ppi aparecem falhas na impressão (vale para tela).`);
  return a;
}

export interface LinhaEntrega { arquivo: string; dimensoes: string; tamanhoKb: number; noPadrao: boolean; sha256: string }
export const MANIFESTO = 'manifesto_entrega.csv';

/** manifesto_entrega.csv igual ao do núcleo: separador ";", UTF-8 com BOM (abre direto no Excel), sha256 em 16 dígitos. */
export function manifestoCsv(linhas: LinhaEntrega[]): string {
  const cab = ['arquivo', 'dimensoes', 'tamanho_kb', 'nome_no_padrao', 'sha256_16'];
  const cel = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const corpo = linhas.map((l) => [l.arquivo, l.dimensoes, String(Math.round(l.tamanhoKb * 10) / 10), l.noPadrao ? 'sim' : 'nao', l.sha256.slice(0, 16)].map(cel).join(';'));
  return '\ufeff' + [cab.join(';'), ...corpo].join('\r\n') + '\r\n';
}

/** Pastas do job com o LEIA-ME, prontas para o zip (CLIENTE_campanha/00_briefing/ …). */
export function estruturaJob(cliente: string, campanha: string, hoje?: string): { caminho: string; dados?: string }[] {
  const raiz = `${limpar(cliente)}_${limpar(campanha)}`;
  if (raiz.startsWith('_') || raiz.endsWith('_')) throw new ErroKit('Informe cliente e campanha.');
  return [...ESTRUTURA.map((p) => ({ caminho: `${raiz}/${p}/` })), { caminho: `${raiz}/LEIA-ME.txt`, dados: leiaMe(cliente, campanha, hoje) }];
}
