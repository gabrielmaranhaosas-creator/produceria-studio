import { describe, expect, it } from 'vitest';

const arquivos = import.meta.glob('../plugins/photoshop/produceria-desdobra/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
function carregar(nome: string, host?: unknown): any {
  const m = { exports: {} };
  const fonte = arquivos['../plugins/photoshop/produceria-desdobra/' + nome];
  new Function('module', 'require', fonte)(m, (r: string) => r === 'photoshop' ? host : carregar(r.replace('./', ''), host));
  return m.exports;
}
const A = carregar('adaptacao.js');
const D = carregar('desdobra.js');
const outros = import.meta.glob('../plugins/photoshop/{produceria-guias,produceria-checar-arquivo}/*.js', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
function puro(caminho: string): any { const m = { exports: {} }; new Function('module', outros['../plugins/photoshop/' + caminho])(m); return m.exports; }
const caixa = (l: number, t: number, w: number, h: number) => ({ left: l, top: t, right: l + w, bottom: t + h });
function mestre(id = 1, w = 1000, h = 1000): any {
  const m = { id, nome: 'KV-' + id, largura: w, altura: h, ppi: 72, modo: 'RGBColorMode', bits: '8', camadas: [
    { chave: '0', nome: 'LOGO', tipo: 'smartObject', papel: 'marca', visivel: true, bounds: caixa(40, 40, 180, 60) },
    { chave: '1', nome: 'TITULO', tipo: 'text', papel: 'titulo', visivel: true, fontePx: 40, conteudo: 'Campanha', bounds: caixa(50, 150, 500, 100) },
    { chave: '2', nome: 'FUNDO', tipo: 'pixel', papel: 'fundo', visivel: true, bounds: caixa(0, 0, w, h) },
  ] };
  return { ...m, assinatura: A.assinatura(m) };
}

describe('adaptação de campanha, critérios de produção', () => {
  it('nomes em português, limites de palavra e ambiguidade preservam revisão', () => {
    expect(A.identificar({ nome: 'TXT_Título', tipo: 'text' }).papel).toBe('titulo');
    expect(A.identificar({ nome: 'catalogo', tipo: 'pixel' }).papel).toBe('desconhecido');
    expect(A.identificar({ nome: 'logo_produto', tipo: 'smartObject' }).papel).toBe('desconhecido');
    expect(A.identificar({ nome: 'logo_produto' }, 'marca')).toMatchObject({ papel: 'marca', manual: true });
    expect(A.identificar({ nome: 'Camada 7' }, 'toString').papel).toBe('desconhecido');
  });
  it('escolhe o KV mais próximo da proporção sem mudar a lista de fontes', () => {
    const m = [mestre(1, 1080, 1920), mestre(2, 1920, 1080), mestre(3)];
    expect(A.escolherMestre(m, { largura: 1200, altura: 628 }).id).toBe(2);
    expect(A.escolherMestre(m, { largura: 900, altura: 1600 }).id).toBe(1);
    expect(m.map((x) => x.id)).toEqual([1, 2, 3]);
  });
  it('adapta sem deformar logo, respeita margens assimétricas e preserva o mestre', () => {
    const m = mestre(), original = JSON.stringify(m);
    const p = A.planejar(m, { nome: 'vertical', largura: 1080, altura: 1920 }, { topo: 10, base: 20, esquerda: 5, direita: 7 });
    expect(p.bloqueios).toEqual([]);
    const logo = p.elementos.find((e: any) => e.papel === 'marca');
    expect((logo.bounds.right - logo.bounds.left) / (logo.bounds.bottom - logo.bounds.top)).toBeCloseTo(3);
    for (const e of p.elementos.filter((x: any) => x.papel !== 'fundo')) {
      expect(e.bounds.left).toBeGreaterThanOrEqual(p.area.left - 0.01);
      expect(e.bounds.top).toBeGreaterThanOrEqual(p.area.top - 0.01);
      expect(e.bounds.right).toBeLessThanOrEqual(p.area.right + 0.01);
      expect(e.bounds.bottom).toBeLessThanOrEqual(p.area.bottom + 0.01);
    }
    expect(JSON.stringify(m)).toBe(original);
    expect(p.revisao).toMatch(/obrigatória/);
  });
  it('bloqueia papel desconhecido, estrutura incompatível e áreas impossíveis', () => {
    const m = mestre(); m.camadas[0].papel = 'desconhecido'; m.pranchetas = true;
    expect(A.planejar(m, { largura: 500, altura: 500 }).bloqueios).toHaveLength(2);
    for (const margens of [{ topo: 70, base: 30 }, { esquerda: -1 }, { topo: 'abc' }]) {
      expect(() => A.areaSegura(100, 100, margens)).toThrow();
    }
  });
  it('sinaliza texto pequeno e perda de proporção como triagem, sem aprovação automática', () => {
    const p = A.planejar(mestre(), { largura: 728, altura: 90 });
    expect(p.avisos.join(' ')).toMatch(/proporção/);
    expect(p.avisos.join(' ')).toMatch(/12 px/);
    expect(p.escore).toBeLessThan(50);
  });
  it('diferenças entre KVs viram avisos e não sobrescrevem textos', () => {
    const a = mestre(1), b = mestre(2); b.camadas[1].conteudo = 'Outro texto';
    expect(A.compararMestres([a, b], a).join(' ')).toMatch(/difere/);
    expect(a.camadas[1].conteudo).toBe('Campanha');
    b.camadas[0].papel = 'outro';
    expect(A.compararMestres([a, b], b).join(' ')).toMatch(/Marca/);
  });
  it('detecção de mudança inclui conteúdo e ignora o ID volátil do documento', () => {
    const a = mestre(), b = { ...a, id: 900 };
    expect(A.assinatura(a)).toBe(A.assinatura(b));
    b.camadas = a.camadas.map((c: any) => ({ ...c })); b.camadas[1].conteudo = 'Corrigido';
    expect(A.assinatura(a)).not.toBe(A.assinatura(b));
  });
  it('não aceita dimensões parcialmente numéricas em listas coladas', () => {
    const r = D.lerFormatos('banner;300abc;250\nbanner2;300;250px\n300x250\n1080 × 1920');
    expect(r.erros).toHaveLength(2); expect(r.formatos).toHaveLength(2);
  });
  it('fila mantém sucessos e caminhos parciais, segue após falha e grava checkpoints', async () => {
    const planos = [0, 1, 2].map((i) => A.planejar(mestre(), { nome: String(i), largura: 500, altura: 500 }));
    const chamadas: string[] = [], checkpoints: any[] = [];
    const r = await A.executarLote(planos, {
      gerar: async (p: any) => { chamadas.push(p.alvo.nome); if (p.alvo.nome === '1') throw Object.assign(new Error('disco cheio'), { arquivos: [{ caminho: '/parcial.psd' }] }); return { arquivos: [{ caminho: '/feito.psd' }] }; },
      registrar: async (x: any) => checkpoints.push(x),
    });
    expect(chamadas).toEqual(['0', '1', '2']);
    expect(r.itens.map((x: any) => x.status)).toEqual(['gerado_para_revisao', 'falhou', 'gerado_para_revisao']);
    expect(r.itens[1].arquivos).toHaveLength(1);
    expect(checkpoints.map((x) => x.itens.length)).toEqual([1, 2, 3]);
  });
  it('cancelamento não inicia os próximos itens e falha do checkpoint interrompe a fila', async () => {
    const plano = A.planejar(mestre(), { nome: 'a', largura: 500, altura: 500 });
    const ctl = { cancelado: false }; let n = 0;
    const r = await A.executarLote([plano, plano, plano], { gerar: async () => { n++; ctl.cancelado = true; return {}; }, registrar: async () => {} }, ctl);
    expect(n).toBe(1); expect(r.pendentes).toBe(2); expect(r.cancelado).toBe(true);
    await expect(A.executarLote([plano, plano], { gerar: async () => ({}), registrar: async () => { throw new Error('checkpoint indisponível'); } })).rejects.toThrow(/checkpoint/);
  });
  it('guias usam os mesmos percentuais assimétricos da adaptação', () => {
    const G = puro('produceria-guias/guias.js'), a = A.areaSegura(1080, 1920, { topo: 10, base: 20, esquerda: 3, direita: 7 });
    const g = G.guiasSeguras(1080, 1920, 10, 7, 20, 3);
    expect(g.map((x: any) => x.pos)).toEqual([Math.round(a.top), Math.round(a.bottom), Math.round(a.left), Math.round(a.right)]);
    expect(() => G.guiasSeguras(100, 100, 60, 0, 40, 0)).toThrow(/Margens/);
  });
  it('checagem digital confronta pixels do job sem reprovar apenas o ppi', () => {
    const C = puro('produceria-checar-arquivo/checks.js');
    const info = { nome: 'CLI_camp_feed_v01.psd', modo: 'RGB', resolucao: 36, largura: 1080, altura: 1350, camadas: [] };
    const r = C.analisar(info, { destino: 'digital', alvo: { largura: '1080', altura: '1350' } });
    expect(r.itens.find((i: any) => i.titulo === 'Dimensões do job').nivel).toBe('OK');
    expect(r.itens.find((i: any) => i.titulo === 'Resolução').nivel).toBe('INFO');
    const errado = C.analisar(info, { destino: 'digital', alvo: { largura: 1080, altura: 1920 } });
    expect(errado.itens.find((i: any) => i.titulo === 'Dimensões do job').nivel).toBe('ERRO');
    const incompleto = C.analisar(info, { destino: 'digital', alvo: { largura: 1080, altura: '' } });
    expect(incompleto.itens.find((i: any) => i.titulo === 'Dimensões do job').nivel).toBe('ERRO');
  });
});

function ambiente() {
  const eventos: string[] = [];
  function camada(id: number, nome: string, b: any): any {
    return { id, name: nome, kind: 'smartObject', boundsNoEffects: { ...b }, visible: true, opacity: 100, layers: [], linkedLayers: [], locked: false,
      async scale(w: number, h: number) { eventos.push('escala:' + id); const v = this.boundsNoEffects; const cx = (v.left + v.right) / 2, cy = (v.top + v.bottom) / 2;
        const rw = (v.right - v.left) * w / 100, rh = (v.bottom - v.top) * h / 100; this.boundsNoEffects = caixa(cx - rw / 2, cy - rh / 2, rw, rh); },
      async translate(x: number, y: number) { eventos.push('move:' + id); const b = this.boundsNoEffects; b.left += x; b.right += x; b.top += y; b.bottom += y; },
    };
  }
  const fonte: any = { id: 1, name: 'KV.psd', width: 1000, height: 1000, resolution: 72, mode: 'RGBColorMode', bitsPerChannel: 8, layers: [camada(10, 'LOGO', caixa(50, 50, 180, 60)), camada(20, 'FUNDO', caixa(0, 0, 1000, 1000))], artboards: [] };
  const copias: any[] = [];
  fonte.duplicate = async () => {
    eventos.push('duplicou');
    const c = { ...fonte, id: 2, name: 'copia', layers: fonte.layers.map((l: any, i: number) => camada(100 + i, l.name, l.boundsNoEffects)),
      async resizeCanvas(w: number, h: number) { eventos.push('canvas:' + w + 'x' + h); this.width = w; this.height = h; },
      closeWithoutSaving() { eventos.push('fechou'); },
    };
    copias.push(c); return c;
  };
  const host = { app: { documents: [fonte] }, core: { executeAsModal: async (fn: any) => fn({ isCancelled: false }) }, constants: { AnchorPosition: { TOPLEFT: 'TOPLEFT', MIDDLECENTER: 'MIDDLECENTER' } } };
  return { host, fonte, eventos, copias };
}

describe('execução com adaptador Photoshop simulado', () => {
  it('resolve camadas da cópia, preserva fonte e expande antes de adaptar', async () => {
    const e = ambiente(), PS = carregar('photoshop.js', e.host), original = JSON.stringify(e.fonte);
    const m = PS.lerMestre(e.fonte), plano = A.planejar(m, { nome: 'vertical', largura: 500, altura: 1500 }, { topo: 5, base: 10, esquerda: 5, direita: 5 });
    await PS.gerar(plano, { nome: 'saida', modo: 'camadas', pasta: null }, {});
    expect(JSON.stringify(e.fonte)).toBe(original);
    expect(e.eventos[1]).toBe('canvas:1000x1500');
    expect(e.eventos).toContain('escala:100'); expect(e.eventos).not.toContain('escala:10');
    expect(e.eventos.at(-1)).toBe('canvas:500x1500'); expect(e.copias[0].height).toBe(1500);
  });
  it('não duplica fonte alterada depois do diagnóstico', async () => {
    const e = ambiente(), PS = carregar('photoshop.js', e.host);
    const p = A.planejar(PS.lerMestre(e.fonte), { nome: 'a', largura: 500, altura: 500 });
    e.fonte.layers[0].name = 'ALTERADO';
    await expect(PS.gerar(p, { modo: 'camadas' }, {})).rejects.toThrow(/mudou/);
    expect(e.copias).toHaveLength(0);
  });
  it('mudança de histórico detecta edição de pixels que não altera os bounds', async () => {
    const e = ambiente(), PS = carregar('photoshop.js', e.host);
    e.fonte.activeHistoryState = { id: 50 };
    const p = A.planejar(PS.lerMestre(e.fonte), { nome: 'a', largura: 500, altura: 500 });
    e.fonte.activeHistoryState = { id: 51 };
    await expect(PS.gerar(p, { modo: 'camadas' }, {})).rejects.toThrow(/mudou/);
    expect(e.copias).toHaveLength(0);
  });
  it('fecha só a cópia após falha e registra saídas parciais', async () => {
    const e = ambiente(), PS = carregar('photoshop.js', e.host);
    const p = A.planejar(PS.lerMestre(e.fonte), { nome: 'a', largura: 500, altura: 500 });
    const duplicar = e.fonte.duplicate;
    e.fonte.duplicate = async () => { const c = await duplicar(); c.layers[0].scale = async () => { throw new Error('transformação indisponível'); }; return c; };
    await expect(PS.gerar(p, { modo: 'camadas' }, {})).rejects.toThrow(/transformação/);
    expect(e.eventos.at(-1)).toBe('fechou'); expect(e.host.app.documents[0]).toBe(e.fonte);
  });
  it('não converte CMYK/16 silenciosamente para entregas web', () => {
    const PS = carregar('photoshop.js', ambiente().host);
    expect(() => PS.conferirWeb({ mode: 'CMYKColorMode', bitsPerChannel: 16 }, ['psd', 'jpg'])).toThrow(/RGB/);
    expect(() => PS.conferirWeb({ mode: 'CMYKColorMode', bitsPerChannel: 16 }, ['psd'])).not.toThrow();
  });
  it('não sobrescreve arquivos e conserva o PSD concluído se o JPG falhar', async () => {
    const e = ambiente(), PS = carregar('photoshop.js', e.host), p = A.planejar(PS.lerMestre(e.fonte), { nome: 'a', largura: 500, altura: 500 });
    const duplicar = e.fonte.duplicate, escritas: string[] = [], removidos: string[] = [];
    e.fonte.duplicate = async () => { const c = await duplicar(); c.saveAs = {
      psd: async (f: any) => escritas.push(f.nativePath), jpg: async () => { throw new Error('sem espaço'); },
    }; return c; };
    const pasta = { getEntry: async (n: string) => ({ isFolder: true,
      createFile: async (nome: string, op: any) => { expect(op.overwrite).toBe(false); return { nativePath: '/rodada/' + n + '/' + nome, delete: async () => removidos.push(nome) }; },
    }) };
    let falha: any;
    try { await PS.gerar(p, { modo: 'camadas', nome: 'TESTE', pasta, extensoes: ['psd', 'jpg'] }, {}); } catch (x) { falha = x; }
    expect(falha.message).toBe('sem espaço');
    expect(falha.arquivos).toEqual([{ formato: 'psd', caminho: '/rodada/PSD/TESTE.psd', status: 'gravado' }]);
    expect(escritas).toEqual(['/rodada/PSD/TESTE.psd']); expect(removidos).toEqual(['TESTE.jpg']);
    expect(e.eventos.at(-1)).toBe('fechou');
  });
});
