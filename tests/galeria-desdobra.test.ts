import { describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';

const arquivos = import.meta.glob('../plugins/photoshop/produceria-desdobra/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
function carregar(nome: string, host?: unknown): any {
  const m = { exports: {} };
  new Function('module', 'require', arquivos['../plugins/photoshop/produceria-desdobra/' + nome])(m, (r: string) => r === 'photoshop' ? host : carregar(r.replace('./', ''), host));
  return m.exports;
}
const G = carregar('galeria.js'), P = carregar('previa.js');
const alvo = (nome: string, largura: number, altura: number) => ({ nome, largura, altura });
const plano = (nome = 'google-banner', largura = 300, altura = 250): any => ({ alvo: alvo(nome, largura, altura), mestreNome: 'KV.psd', bloqueios: [], avisos: [], elementos: [], area: { left: 15, top: 12, right: largura - 15, bottom: altura - 12 } });

describe('galeria de formatos e folha de revisão', () => {
  it('classifica dimensões coladas, reconhece nomes e separa telas Mac de formatos de mídia', () => {
    expect(G.contexto(alvo('728x90', 728, 90))).toBe('google');
    expect(G.contexto(alvo('1080x1920', 1080, 1920))).toBe('meta');
    expect(G.contexto(alvo('mac-pagina', 1920, 1080))).toBe('mac');
    expect(G.contexto(alvo('celular-pagina', 1080, 1920))).toBe('celular');
    expect(G.contexto(alvo('meu-formato', 842, 953))).toBe('personalizado');
  });
  it('mantém a proporção de banners extremos no palco e não modifica o alvo', () => {
    expect(G.encaixar(728, 90, 220, 170)).toEqual({ largura: 220, altura: 27 });
    expect(G.encaixar(160, 600, 220, 170)).toEqual({ largura: 45, altura: 170 });
    const item = G.novoItem(plano()), antes = JSON.stringify(item);
    const html = G.palco(item, { forcarContexto: 'mac' });
    expect(html).toContain('Navegador no Mac'); expect(JSON.stringify(item)).toBe(antes);
    expect(G.palco(item, { contexto: false })).not.toContain('Publicidade');
  });
  it('desenha o fundo primeiro, a área segura por último e remove guias só da apresentação', () => {
    const p = plano(); p.elementos = [
      { nome: 'LOGO', papel: 'marca', bounds: { left: 20, top: 20, right: 90, bottom: 40 } },
      { nome: 'FUNDO', papel: 'fundo', bounds: { left: 0, top: 0, right: 300, bottom: 250 } },
    ];
    const item = G.novoItem(p), html = G.palco(item);
    expect(html.indexOf('title="FUNDO"')).toBeLessThan(html.indexOf('title="LOGO"'));
    expect(html.indexOf('gv-segura')).toBeGreaterThan(html.indexOf('title="LOGO"'));
    expect(G.palco(item, { guias: false })).not.toContain('gv-segura');
  });
  it('encaixe global acompanha o corte e a âncora, em vez de usar o plano por papéis', () => {
    const m = { largura: 1000, altura: 1000, camadas: [{ nome: 'LOGO', papel: 'marca', visivel: true, bounds: { left: 0, top: 0, right: 100, bottom: 100 } }] };
    const topo = G.elementosGlobais(m, alvo('banner', 1000, 100), 'cobrir', 'TOPCENTER')[0];
    const base = G.elementosGlobais(m, alvo('banner', 1000, 100), 'cobrir', 'BOTTOMCENTER')[0];
    expect(topo.bounds.top).toBe(0); expect(base.bounds.top).toBe(-900);
  });
  it('folha offline escapa nomes hostis e não injeta URLs de imagens externas', () => {
    const item = G.novoItem(plano('<script>alert(1)</script>'));
    item.erro = '<img src=x onerror=alert(1)>';
    item.previa = { src: 'https://example.com/rastrear' };
    const html = G.folhaHtml([item], '</title><script>ataque()</script>', carregar('galeria-estilo.js'));
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('https://example.com'); expect(html).not.toContain('<button');
    expect(html).toContain('&lt;script&gt;'); expect(html).toContain('Não é comprovação de veiculação');
  });
  it('miniatura real substitui o esquema sem perder o recuo transparente', () => {
    const item = G.novoItem(plano()); item.status = 'previa';
    item.previa = { src: 'data:image/jpeg;base64,YWJj', bounds: { left: 30, top: 25, right: 270, bottom: 225 } };
    const html = G.cartao(item, 0);
    expect(html).toContain('left:10%;top:10%;width:80%;height:80%');
    expect(html).toContain('Prévia real'); expect(html).not.toContain('gv-elemento');
  });
});

describe('captura de pixels sem vazamento e sem alterar o documento', () => {
  it('reduz a miniatura, pede sRGB/8 e libera o buffer', async () => {
    const dispose = vi.fn(), getPixels = vi.fn(async (_options: any) => ({ imageData: { dispose }, level: 2, sourceBounds: { left: 10, top: 20, right: 100, bottom: 150 } }));
    const r = await P.capturar({ getPixels, encodeImageData: async () => 'YWJj' }, { id: 7, width: 1080, height: 1920 });
    expect(getPixels.mock.calls[0][0]).toMatchObject({ documentID: 7, targetSize: { width: 248, height: 440 }, colorSpace: 'RGB', colorProfile: 'sRGB IEC61966-2.1', componentSize: 8, applyAlpha: true });
    expect(r.bounds).toEqual({ left: 40, top: 80, right: 400, bottom: 600 });
    expect(dispose).toHaveBeenCalledOnce();
  });
  it('libera o buffer mesmo em erro de codificação e trata a API ausente', async () => {
    const dispose = vi.fn();
    await expect(P.capturar({ getPixels: async () => ({ imageData: { dispose } }), encodeImageData: async () => { throw new Error('memória'); } }, { id: 1, width: 300, height: 250 })).rejects.toThrow('memória');
    expect(dispose).toHaveBeenCalledOnce();
    await expect(P.capturar(undefined, {})).rejects.toThrow('Imaging API');
  });
});

function hostSimulado(imaging?: any) {
  let fechado = 0, duplicado = 0, gravado = 0;
  const copia = { id: 2, width: 1000, height: 1000, layers: [], mode: 'RGBColorMode', bitsPerChannel: 8,
    resizeImage: async () => {}, resizeCanvas: async () => {}, closeWithoutSaving: async () => { fechado++; },
    saveAs: { psd: async () => { gravado++; } } };
  const fonte: any = { id: 1, name: 'KV.psd', width: 1000, height: 1000, resolution: 72, mode: 'RGBColorMode', bitsPerChannel: 8,
    layers: [], artboards: [], activeHistoryState: { id: 1 }, duplicate: async () => { duplicado++; return copia; } };
  const host = { app: { documents: [fonte], activeDocument: fonte }, imaging,
    core: { executeAsModal: async (fn: any) => fn({ isCancelled: false }) }, constants: { AnchorPosition: { MIDDLECENTER: 'centro' } } };
  return { host, fonte, copia, contagem: () => ({ fechado, duplicado, gravado }) };
}
describe('cópias temporárias para prévia real', () => {
  it('captura e fecha a cópia, sem gravar arquivos nem alterar a fonte', async () => {
    const e = hostSimulado({ getPixels: async () => ({ imageData: { dispose() {} } }), encodeImageData: async () => 'YWJj' });
    const PS = carregar('photoshop.js', e.host), m = PS.lerMestre(e.fonte);
    const p = { ...plano(), mestreId: 1, assinatura: m.assinatura, historico: m.historico };
    const r = await PS.gerar(p, { modo: 'cobrir', somentePrevia: true }, {});
    expect(r.previa.src).toContain('data:image/jpeg;base64,'); expect(r.arquivos).toEqual([]);
    expect(e.contagem()).toEqual({ fechado: 1, duplicado: 1, gravado: 0 }); expect(e.fonte.width).toBe(1000);
  });
  it('falha na captura fecha só a cópia e não anuncia sucesso', async () => {
    const e = hostSimulado({ getPixels: async () => { throw new Error('captura falhou'); }, encodeImageData: async () => '' });
    const PS = carregar('photoshop.js', e.host), m = PS.lerMestre(e.fonte);
    await expect(PS.gerar({ ...plano(), mestreId: 1, assinatura: m.assinatura, historico: m.historico }, { modo: 'cobrir', somentePrevia: true }, {})).rejects.toThrow('captura falhou');
    expect(e.contagem()).toEqual({ fechado: 1, duplicado: 1, gravado: 0 });
  });
  it('captura opcional não impede a cópia de entrega quando somente a miniatura falha', async () => {
    const e = hostSimulado({ getPixels: async () => { throw new Error('sem memória para miniatura'); }, encodeImageData: async () => '' });
    const PS = carregar('photoshop.js', e.host), m = PS.lerMestre(e.fonte);
    const r = await PS.gerar({ ...plano(), mestreId: 1, assinatura: m.assinatura, historico: m.historico }, { modo: 'cobrir', capturarPrevia: true }, {});
    expect(r.previa).toBeNull(); expect(r.avisoPrevia).toContain('sem memória');
    expect(e.contagem()).toEqual({ fechado: 0, duplicado: 1, gravado: 0 });
  });
  it('cancelamento durante captura libera pixels e fecha a cópia antes de sair', async () => {
    const ctl = { cancelado: false }, dispose = vi.fn();
    const e = hostSimulado({ getPixels: async () => { ctl.cancelado = true; return { imageData: { dispose } }; }, encodeImageData: async () => 'YWJj' });
    const PS = carregar('photoshop.js', e.host), m = PS.lerMestre(e.fonte);
    await expect(PS.gerar({ ...plano(), mestreId: 1, assinatura: m.assinatura, historico: m.historico }, { modo: 'cobrir', somentePrevia: true }, ctl)).rejects.toThrow('Cancelado');
    expect(dispose).toHaveBeenCalledOnce(); expect(e.contagem().fechado).toBe(1);
  });
  it('falha ao fechar cópia temporária é explícita e não anuncia arquivos gravados', async () => {
    const e = hostSimulado({ getPixels: async () => ({ imageData: { dispose() {} } }), encodeImageData: async () => 'YWJj' });
    e.copia.closeWithoutSaving = async () => { throw new Error('fechamento recusado'); };
    const PS = carregar('photoshop.js', e.host), m = PS.lerMestre(e.fonte);
    await expect(PS.gerar({ ...plano(), mestreId: 1, assinatura: m.assinatura, historico: m.historico }, { modo: 'cobrir', somentePrevia: true }, {})).rejects.toThrow('cópia temporária');
  });
});

describe('painel: galeria, filtros e invalidação', () => {
  it('diagnóstico preenche cartões sem modificar o Photoshop; alterações invalidam a captura', async () => {
    const win = new Window(), doc = win.document, e = hostSimulado();
    doc.body.innerHTML = arquivos['../plugins/photoshop/produceria-desdobra/index.html'];
    const req = (r: string): any => r === 'photoshop' ? e.host : r === 'uxp' ? { storage: { localFileSystem: {} } } : carregar(r.replace('./', ''), e.host);
    new Function('require', 'window', 'document', 'localStorage', arquivos['../plugins/photoshop/produceria-desdobra/index.js'])(req, win, doc, win.localStorage);
    const valor = (id: string, v: string) => { (doc.getElementById(id) as any).value = v; };
    valor('cliente', 'TESTE'); valor('campanha', 'galeria'); valor('modo', 'cobrir');
    valor('formatos', '728x90\nmac-navegador;1440;900\n1080x1920');
    doc.getElementById('btnDiagnosticar')!.dispatchEvent(new win.MouseEvent('click'));
    expect(doc.querySelectorAll('.gv-card')).toHaveLength(3); expect(e.contagem().duplicado).toBe(0);
    valor('filtroContexto', 'google'); doc.getElementById('filtroContexto')!.dispatchEvent(new win.Event('change'));
    expect(doc.querySelectorAll('.gv-card')).toHaveLength(1);
    doc.querySelector('button[data-detalhe]')!.dispatchEvent(new win.MouseEvent('click'));
    expect(doc.getElementById('detalheGaleria')!.textContent).toContain('728x90');
    doc.getElementById('btnPrevias')!.dispatchEvent(new win.MouseEvent('click')); await Promise.resolve();
    expect(doc.getElementById('resumo')!.textContent).toContain('Imaging API'); expect(e.contagem().duplicado).toBe(0);
    valor('formatos', '300x250'); doc.getElementById('formatos')!.dispatchEvent(new win.Event('input'));
    expect(doc.querySelectorAll('.gv-card')).toHaveLength(0); expect((doc.getElementById('btnFolha') as any).disabled).toBe(true);
    win.happyDOM.abort();
  });
});
