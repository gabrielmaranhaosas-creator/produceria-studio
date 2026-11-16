import { describe, expect, it } from 'vitest';

const AE = import.meta.glob('../plugins/after-effects/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const BR = import.meta.glob('../src/oficina/bridge/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const jsx = AE['../plugins/after-effects/produceria_variacoes_template.jsx'];
const ae = new Function(jsx.replace(/if \(typeof app[\s\S]*$/, '') + ';return { pcLerCsv, pcInterpretar, pcAjustarDuracao, pcTrocarTexto };')();

describe('After Effects: variações de template', () => {
  it('lê o CSV de exemplo com quebra de linha e duração', () => {
    const r = ae.pcInterpretar(ae.pcLerCsv(AE['../plugins/after-effects/exemplo_variacoes.csv']));
    expect(r.erros).toEqual([]);
    expect(r.colunas).toEqual(['TXT_TITULO', 'TXT_OFERTA']);
    expect(r.linhas[1]).toMatchObject({ nome: 'natal', duracao: 15 });
    expect(r.linhas[1].textos.TXT_OFERTA).toBe('Parcele em 12x\rsem juros');
  });
  it('duração maior estica as camadas que iam até o fim e a área de render', () => {
    const cams = [{ name: 'fundo', outPoint: 10 }, { name: 'meio', outPoint: 5 }];
    const comp = { duration: 10, workAreaStart: 2, workAreaDuration: 4, numLayers: 2, layer: (i: number) => cams[i - 1] };
    expect(ae.pcAjustarDuracao(comp, 15)).toEqual([]);
    expect([comp.duration, comp.workAreaStart, comp.workAreaDuration, cams[0].outPoint, cams[1].outPoint]).toEqual([15, 0, 15, 15, 5]);
  });
  it('texto com quadros-chave troca em todos eles', () => {
    const ks = [{ text: 'a' }, { text: 'b' }];
    ae.pcTrocarTexto({ numKeys: 2, keyValue: (k: number) => ({ ...ks[k - 1] }), setValueAtKey: (k: number, v: { text: string }) => { ks[k - 1] = v; } }, 'NOVO');
    expect(ks.map((x) => x.text)).toEqual(['NOVO', 'NOVO']);
  });
  it('é ExtendScript puro (sem recursos que o After Effects não entende)', () => {
    expect(jsx).not.toMatch(/=>|\blet\b|\bconst\b|`|\.includes\(|\.trim\(\)/);
  });
});

describe('Bridge', () => {
  const main = BR['../src/oficina/bridge/main.js'];
  const manifest = JSON.parse(BR['../src/oficina/bridge/manifest.json']);
  it('base64 próprio igual ao padrão, sem btoa', () => {
    const i = main.indexOf('const B64'), j = main.indexOf('};', main.indexOf('const b64')) + 2;
    const b64 = new Function(main.slice(i, j) + ';return b64;')();
    for (const n of [0, 1, 2, 3, 100, 70001]) {
      const u = new Uint8Array(n).map((_, k) => (k * 37) % 256);
      expect(b64(u.buffer)).toBe((globalThis as unknown as { Buffer: { from(u: Uint8Array): { toString(e: string): string } } }).Buffer.from(u).toString('base64'));
    }
    expect(main).not.toMatch(/btoa\(/);
  });
  it('rede liberada para baixar o resultado e leituras seguras', () => {
    expect(manifest.requiredPermissions.network.domains).toBe('all');
    expect(manifest.icons).toBeUndefined();
    expect(main).toContain('valorPicker(');
    expect(main.match(/app\.activeDocument/g)!.length).toBe(1);
  });
});
