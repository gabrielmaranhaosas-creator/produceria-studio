import { expect, it } from 'vitest';
import { Window } from 'happy-dom';
const arq = import.meta.glob('../plugins/photoshop/produceria-desdobra/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
it('Cobrir + Salvar ao lado do KV, ponta a ponta', async () => {
  const win = new Window(), doc = win.document;
  doc.body.innerHTML = arq['../plugins/photoshop/produceria-desdobra/index.html'];
  const ev: string[] = [], arquivos: string[] = [];
  const pasta = (p: string): any => ({ isFolder: true, nativePath: p, name: p.split('/').pop(),
    getEntry: async (n: string) => { throw new Error('x' + n); }, getEntries: async () => [],
    createFolder: async (n: string) => pasta(p + '/' + n),
    createFile: async (n: string) => { arquivos.push(p + '/' + n); return { nativePath: p + '/' + n, write: async () => {}, delete: async () => {} }; } });
  const camada = { id: 9, name: 'Plano de fundo', kind: 'pixel', visible: true, opacity: 100, isBackgroundLayer: true, locked: true, layers: [], linkedLayers: [], boundsNoEffects: { left: 0, top: 0, right: 2000, bottom: 1000 } };
  const fonte: any = { id: 1, name: 'KV.psd', path: '/Users/ana/job/KV.psd', width: 2000, height: 1000, resolution: 72, mode: 'RGBColorMode', bitsPerChannel: 'bitDepth8', artboards: [], layers: [camada], activeHistoryState: { id: 3 } };
  let n = 10;
  fonte.duplicate = async (nome: string) => { ev.push('dup:' + nome); const c: any = { ...fonte, id: n++, name: nome,
    resizeImage: async (w: number, h: number) => ev.push('img:' + w + 'x' + h), resizeCanvas: async (w: number, h: number) => ev.push('canvas:' + w + 'x' + h),
    saveAs: { psd: async (f: any) => ev.push('psd:' + f.nativePath) }, closeWithoutSaving: async () => ev.push('fechou') }; return c; };
  const host = { app: { activeDocument: fonte, documents: [fonte] }, core: { executeAsModal: async (fn: any) => fn({ isCancelled: false }) }, action: { batchPlay: async () => [] }, imaging: undefined,
    constants: { AnchorPosition: { MIDDLECENTER: 'mc', TOPLEFT: 'tl' }, DocumentMode: { RGB: 'RGBColorMode' }, BitsPerChannelType: { EIGHT: 'bitDepth8' } } };
  const lfs = { getEntryWithUrl: async (u: string) => pasta(u.replace(/^file:(\/\/)?/, '')), getFolder: async () => null, getFileForSaving: async () => ({ nativePath: '/Users/ana/entregas/escolher-esta-pasta.txt' }) };
  function req(r: string): any {
    if (r === 'photoshop') return host;
    if (r === 'uxp') return { storage: { localFileSystem: lfs } };
    const m = { exports: {} }; new Function('module', 'require', arq['../plugins/photoshop/produceria-desdobra/' + r.replace('./', '')])(m, req); return m.exports;
  }
  new Function('require', 'window', 'document', 'localStorage', arq['../plugins/photoshop/produceria-desdobra/index.js'])(req, win, doc, win.localStorage);
  const $ = (id: string) => doc.getElementById(id) as any;
  expect($('estadoPainel').textContent).toMatch(/Painel pronto · Desdobra KV 1\.4\.2/);
  // botão de pasta: o clique fica registrado; janela fechada sem pasta é explicada
  $('btnPasta').dispatchEvent(new win.MouseEvent('click'));
  expect($('pasta').textContent).toMatch(/Clique recebido \(1\)/);
  await new Promise((r) => setTimeout(r, 10));
  expect($('pasta').textContent).toMatch(/sem pasta escolhida/);
  // plano B 1: janela Salvar define a pasta pelo arquivo escolhido
  $('btnPastaSalvar').dispatchEvent(new win.MouseEvent('click'));
  await new Promise((r) => setTimeout(r, 10));
  expect($('caminho').value).toBe('/Users/ana/entregas');
  expect($('pasta').textContent).toMatch(/janela Salvar/);
  // plano B 2: sem janela, pasta desdobra ao lado do KV
  $('btnPastaKv').dispatchEvent(new win.MouseEvent('click'));
  expect($('caminho').value).toBe('');
  expect($('pasta').textContent).toContain('/Users/ana/job/desdobra');
  expect($('modo').value).toBe('cobrir');
  $('cliente').value = 'TESTE'; $('campanha').value = 'piloto'; $('formatos').value = 'stories;1080;1920\n300x250'; $('salvar').checked = true;
  $('btnDesdobrar').dispatchEvent(new win.MouseEvent('click'));
  for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 5));
  expect($('resumo').textContent).toMatch(/2 formato\(s\) gerado/);
  expect(arquivos.some((a) => a.includes('/Users/ana/job/desdobra/rodada-') && a.endsWith('/PSD/TESTE_piloto_stories_v01.psd'))).toBe(true);
  win.happyDOM.abort();
});
