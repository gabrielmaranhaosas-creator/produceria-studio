import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';

const arq = import.meta.glob('../plugins/photoshop/produceria-desdobra/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
function painel() {
  const win = new Window(), doc = win.document;
  doc.body.innerHTML = arq['../plugins/photoshop/produceria-desdobra/index.html'];
  const layers = [{ id: 9, name: '<img src=x onerror=alert(1)>', kind: 'smartObject', visible: true, opacity: 100,
    layers: [], linkedLayers: [], locked: false, boundsNoEffects: { left: 10, top: 10, right: 100, bottom: 100 } }];
  const fonte = { id: 1, name: 'KV.psd', width: 1080, height: 1080, resolution: 72, mode: 'RGBColorMode', bitsPerChannel: 8, artboards: [], layers };
  let mutacoes = 0;
  const host = { app: { activeDocument: fonte, documents: [fonte] }, core: { executeAsModal: async () => { mutacoes++; } }, constants: { AnchorPosition: { MIDDLECENTER: 'centro' } } };
  function req(r: string): any {
    if (r === 'photoshop') return host;
    if (r === 'uxp') return { storage: { localFileSystem: {} } };
    const m = { exports: {} };
    new Function('module', 'require', arq['../plugins/photoshop/produceria-desdobra/' + r.replace('./', '')])(m, req);
    return m.exports;
  }
  new Function('require', 'window', 'document', 'localStorage', arq['../plugins/photoshop/produceria-desdobra/index.js'])(req, win, doc, win.localStorage);
  return { doc, mutacoes: () => mutacoes, win, fonte };
}

describe('fluxo do painel de adaptação', () => {
  it('abre em Cobrir; no modo camadas, papel desconhecido vira aviso e o nome aparece como texto', async () => {
    const { doc, win } = painel();
    expect((doc.getElementById('modo') as any).value).toBe('cobrir');
    (doc.getElementById('modo') as any).value = 'camadas';
    (doc.getElementById('cliente') as any).value = 'TESTE';
    (doc.getElementById('campanha') as any).value = 'piloto';
    doc.getElementById('btnAdicionarKv')!.dispatchEvent(new win.MouseEvent('click'));
    expect(doc.getElementById('mapa')!.textContent).toContain('<img src=x');
    expect(doc.getElementById('mapa')!.querySelector('img')).toBeNull();
    doc.getElementById('btnDiagnosticar')!.dispatchEvent(new win.MouseEvent('click'));
    expect(doc.getElementById('resultado')!.textContent).not.toContain('[CORRIGIR]');
    expect(doc.getElementById('resultado')!.textContent).toContain('sem papel definido');
    win.happyDOM.abort();
  });
  it('diagnóstico após correção não cria arquivos e a memória guarda o papel escolhido', () => {
    const { doc, mutacoes, win } = painel();
    (doc.getElementById('modo') as any).value = 'camadas';
    (doc.getElementById('cliente') as any).value = 'TESTE'; (doc.getElementById('campanha') as any).value = 'piloto';
    doc.getElementById('btnAdicionarKv')!.dispatchEvent(new win.MouseEvent('click'));
    const select = doc.querySelector('#mapa select') as any;
    select.selectedIndex = 2; // Marca / logo.
    select.dispatchEvent(new win.Event('change'));
    doc.getElementById('btnDiagnosticar')!.dispatchEvent(new win.MouseEvent('click'));
    expect(mutacoes()).toBe(0);
    expect(doc.getElementById('resultado')!.textContent).not.toContain('[CORRIGIR]');
    expect(win.localStorage.getItem('desdobra.mapas.v1')).toContain('marca');
    expect(doc.getElementById('resumo')!.textContent).toContain('Revisão visual obrigatória');
    win.happyDOM.abort();
  });
  it('papel manual não migra silenciosamente para outra estrutura de camadas', () => {
    const { doc, win, fonte } = painel();
    (doc.getElementById('modo') as any).value = 'camadas';
    (doc.getElementById('cliente') as any).value = 'TESTE'; (doc.getElementById('campanha') as any).value = 'piloto';
    doc.getElementById('btnAdicionarKv')!.dispatchEvent(new win.MouseEvent('click'));
    const select = doc.querySelector('#mapa select') as any;
    select.selectedIndex = 2; select.dispatchEvent(new win.Event('change'));
    fonte.layers[0].name = 'Camada nova';
    doc.getElementById('btnDiagnosticar')!.dispatchEvent(new win.MouseEvent('click'));
    expect(doc.getElementById('resultado')!.textContent).toContain('sem papel definido');
    expect((doc.querySelector('#mapa select') as any).value).toBe('desconhecido');
    win.happyDOM.abort();
  });
});
