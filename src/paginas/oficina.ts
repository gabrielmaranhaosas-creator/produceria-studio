// Peças comuns às telas da Oficina: a navegação entre elas, o cabeçalho e o download de arquivos.
import { esc } from '../lib/formato';

const TELAS: [string, string][] = [['atelie', 'Ateliê'], ['desdobra', 'Desdobra'], ['entrega', 'Conferência'], ['ferramentas', 'Bancada'], ['grafica', 'Gráfica'], ['plugins', 'Plugins'], ['agentes', 'Agentes'], ['biblioteca', 'Biblioteca'], ['casos', 'Casos']];

/** Navegação da Oficina (mesmo markup do legado: nav.oficina). */
export const navOficina = (atual: string) => `<nav class="oficina" aria-label="Oficina">${TELAS.map(([h, t]) => `<a href="#${h}"${h === atual ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>`;
export const cabecalho = (sobre: string, titulo: string, texto: string) => `<header class="page-head"><span class="eyebrow">${esc(sobre)}</span><h1 class="d d-title">${esc(titulo)}</h1><p class="lead measure muted">${esc(texto)}</p></header>`;

interface Downloads { save(o: { filename: string; data: string | Blob | Uint8Array }): Promise<{ status?: string } | void> }
/** Entrega um arquivo (texto, imagem ou zip) pelo download do claude.ai. Devolve a mensagem para o aviso (ou '' se a
 * pessoa recusou). Extensões aceitas pelo claude.ai: png, jpg, csv, txt, json, md, pdf, svg, zip, entre outras. */
export async function baixarArquivo(nome: string, data: string | Blob | Uint8Array): Promise<string> {
  try {
    const d = (await window.claude?.use('downloads')) as Downloads | undefined;
    if (!d) return 'Download disponível só com o Studio aberto no Claude.';
    const r = await d.save({ filename: nome, data });
    return r && r.status === 'saved' ? 'Arquivo salvo: ' + nome : '';
  } catch (e) {
    const c = (e as { code?: string })?.code;
    return c === 'declined' ? '' : c === 'rate_limited' ? 'Já há um download aguardando confirmação.' : c === 'too_large' ? 'Arquivo grande demais para este download: baixe por partes.' : 'Não foi possível gerar o arquivo agora.';
  }
}
/** "Folder A4 dobrado" → "folder-a4-dobrado" */
export const nomeArquivo = (s: string, padrao = 'job') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || padrao;
