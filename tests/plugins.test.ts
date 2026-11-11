import { describe, expect, it } from 'vitest';

// Arquivos dos plugins como texto (o Vite lê no teste, sem módulos do Node) e um require mínimo de CommonJS.
const ARQ = import.meta.glob('../plugins/photoshop/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const caminho = (pasta: string, arq: string) => `../plugins/photoshop/${pasta}/${arq}`;
const existe = (pasta: string, arq: string) => caminho(pasta, arq) in ARQ;
const ler = (pasta: string, arq: string) => ARQ[caminho(pasta, arq)];
function req(rel: string): any {
  const [, pasta, arq] = rel.match(/photoshop\/([^/]+)\/(.+)$/)!;
  const mod = { exports: {} as any };
  new Function('module', 'exports', 'require', ler(pasta, arq))(mod, mod.exports, (r: string) => req(`photoshop/${pasta}/${r.replace(/^\.\//, '')}`));
  return mod.exports;
}
const pastas = [...new Set(Object.keys(ARQ).map((k) => k.split('/')[3]))].filter((p) => p.startsWith('produceria-'));
const arquivosDe = (pasta: string) => Object.keys(ARQ).filter((k) => k.split('/')[3] === pasta).map((k) => k.split('/').slice(4).join('/'));

describe('manifestos e arquivos dos plugins do Photoshop', () => {
  it('são oito plugins com ids únicos', () => {
    expect(pastas.sort()).toEqual(['produceria-camadas', 'produceria-checar-arquivo', 'produceria-desdobra', 'produceria-exportador', 'produceria-guias', 'produceria-prova', 'produceria-retoque', 'produceria-textos']);
    const ids = pastas.map((p) => JSON.parse(ler(p, 'manifest.json')).id);
    expect(new Set(ids).size).toBe(8);
  });
  it.each(pastas)('%s: manifesto válido, main existe, requires locais existem e o JS compila', (p: string) => {
    const m = JSON.parse(ler(p, 'manifest.json'));
    expect(m.manifestVersion).toBe(5);
    expect(m.host.app).toBe('PS');
    expect(m.id).toMatch(/^br\.com\.produceria\./);
    expect(m.entrypoints[0].type).toBe('panel');
    expect(existe(p, m.main)).toBe(true);
    const html = ler(p, m.main);
    expect(html).toContain('<meta charset="utf-8">');
    // sem esta linha o Photoshop mostra o painel mas nenhum botão funciona (erro da v1.0)
    expect(html).toContain('<script src="index.js"></script>');
    for (const f of arquivosDe(p).filter((x) => x.endsWith('.js'))) {
      const src = ler(p, f);
      for (const [, r] of src.matchAll(/require\("\.\/([^"]+)"\)/g)) expect(existe(p, r)).toBe(true);
      expect(() => new Function('require', 'module', 'document', src)).not.toThrow();
    }
    // todo id usado pelo index.js existe no HTML
    const js = ler(p, 'index.js');
    for (const [, id] of js.matchAll(/\$\("([A-Za-z0-9]+)"\)/g)) expect(html, `#${id} em ${p}`).toContain(`id="${id}"`);
    expect(ler(p, 'LEIA-ME.md')).not.toMatch(/sandra/i);
  });
});

describe('Guias', () => {
  const G = req('plugins/photoshop/produceria-guias/guias.js');
  it('converte mm em px pelo ppi', () => {
    expect(G.mmParaPx(3, 300)).toBe(35);
    expect(G.mmParaPx(25.4, 72)).toBe(72);
  });
  it('impresso com sangria: corte e segurança nas quatro bordas', () => {
    const g = G.guiasImpresso(2551, 3579, 300, 3, 5, true);
    expect(g).toHaveLength(8);
    expect(g.filter((x: { dir: string }) => x.dir === 'v').map((x: { pos: number }) => x.pos)).toEqual([35, 2516, 94, 2457]);
    expect(G.guiasImpresso(1000, 1000, 300, 3, 5, false)).toHaveLength(4);
  });
  it('stories, centro, terços e colunas', () => {
    expect(G.guiasStories(1080, 1920).map((x: { pos: number }) => x.pos)).toEqual([269, 1651]);
    expect(G.guiasCentro(1080, 1920)).toEqual([{ dir: 'v', pos: 540, motivo: 'centro' }, { dir: 'h', pos: 960, motivo: 'centro' }]);
    expect(G.guiasTercos(900, 600).map((x: { pos: number }) => x.pos)).toEqual([300, 200, 600, 400]);
    const c = G.guiasColunas(1000, 2, 20, 40);
    expect(c.map((x: { pos: number }) => x.pos)).toEqual([40, 490, 510, 960]);
    expect(() => G.guiasColunas(100, 4, 40, 40)).toThrow();
  });
  it('limpa repetidas e fora do documento', () => {
    expect(G.limpar([{ dir: 'v', pos: 10 }, { dir: 'v', pos: 10 }, { dir: 'h', pos: 9999 }], 100, 100)).toHaveLength(1);
  });
});

describe('Camadas', () => {
  const C = req('plugins/photoshop/produceria-camadas/camadas.js');
  it('reconhece nomes padrão do Photoshop', () => {
    for (const n of ['Camada 1', 'Layer 12 copy', 'Layer 3 copy 2', 'Grupo 4', 'Retângulo 1']) expect(C.ehNomePadrao(n)).toBe(true);
    for (const n of ['TXT_titulo', 'Logo Sicredi', 'Camada de fundo']) expect(C.ehNomePadrao(n)).toBe(false);
  });
  it('renomeia com {nome} e {n}', () => {
    expect(C.novoNome('TXT_{n}', 'x', 0, 1, 2)).toBe('TXT_01');
    expect(C.novoNome('{nome} - feed', 'Título', 4, 1, 2)).toBe('Título - feed');
    expect(C.novoNome('{nome}_{n}', 'foto', 9, 1, 3)).toBe('foto_010');
  });
  it('substitui texto literal', () => {
    expect(C.substituir('Logo cópia (2)', ' cópia (2)', '', false)).toBe('Logo');
    expect(C.substituir('a.b.c', '.', '-', false)).toBe('a-b-c');
    expect(C.substituir('Copy copy', 'copy', 'X', true)).toBe('Copy X');
  });
  it('prefixo por tipo sem repetir', () => {
    expect(C.comPrefixo('Título', 'text')).toBe('TXT_Título');
    expect(C.comPrefixo('Foto', 'pixel')).toBe('IMG_Foto');
    expect(C.comPrefixo('Selo', 'smartObject')).toBe('SO_Selo');
    expect(C.comPrefixo('TXT_Título', 'text')).toBe('TXT_Título');
    expect(C.comPrefixo('Curvas', 'curves')).toBe('AJ_Curvas');
  });
});

describe('Prova', () => {
  const P = req('plugins/photoshop/produceria-prova/prova.js');
  it('versão, data, rodapé e nome', () => {
    expect(P.versaoDoNome('CLI_camp_stories_v03.psd')).toBe('v03');
    expect(P.versaoDoNome('arte.psd')).toBe('v01');
    expect(P.dataBr(new Date(2026, 10, 11))).toBe('11/11/2026');
    expect(P.rodape({ cliente: 'Sicredi', campanha: 'Natal', versao: 'v02', data: '11/11/2026' })).toBe('Sicredi  ·  Natal  ·  v02  ·  11/11/2026  ·  PROVA PARA APROVAÇÃO');
    expect(P.nomeProva('Sicredi_Natal_stories_v02.psd')).toBe('Sicredi_Natal_stories_v02_PROVA.jpg');
    expect(P.nomeProva('Arte Final ção.psd')).toBe('Arte-Final-cao_PROVA.jpg');
  });
  it('reduz só quando passa do limite e calcula pontos', () => {
    expect(P.reduzir(4000, 2000, 2000)).toEqual({ largura: 2000, altura: 1000 });
    expect(P.reduzir(1080, 1920, 2000)).toBeNull();
    expect(P.reduzir(5000, 5000, 0)).toBeNull();
    expect(P.pontos(1080, 1920, 72, 0.09)).toBe(97);
    expect(P.pontos(2480, 3508, 300, 0.09)).toBe(54);
  });
});

describe('Plugins que já existiam', () => {
  it('versão do retoque e formatos da desdobra', () => {
    const V = req('plugins/photoshop/produceria-retoque/versao.js');
    expect(V.proximaVersao('CLI_camp_stories_v03.psd')).toBe('CLI_camp_stories_v04.psd');
    const D = req('plugins/photoshop/produceria-desdobra/desdobra.js');
    const r = D.lerFormatos(D.PADRAO_FORMATOS);
    expect(r.erros).toEqual([]);
    expect(r.formatos.length).toBeGreaterThan(3);
    const x = D.lerFormatos('1920x1080 pixels\ncapa: 29,7x32 cm\n210 x 297 mm\nlixo', 300);
    expect(x.formatos).toEqual([{ nome: '1920x1080', largura: 1920, altura: 1080 }, { nome: 'capa', largura: 3508, altura: 3780 }, { nome: '210x297mm', largura: 2480, altura: 3508 }]);
    expect(x.erros).toHaveLength(1);
  });
  it('checagem marca CMYK como erro em digital e sem nome de pessoa', () => {
    const K = req('plugins/photoshop/produceria-checar-arquivo/checks.js');
    const r = K.analisar({ nome: 'arte.psd', modo: 'CMYKColorMode', perfil: null, resolucao: 72, camadas: [] }, { destino: 'digital', fontesInstaladas: null });
    expect(r.itens.find((i: { titulo: string }) => i.titulo === 'Modo de cor').nivel).toBe('ERRO');
    expect(JSON.stringify(r)).not.toMatch(/sandra/i);
  });
});

import { PLUGINS, ROTEIRO, TUTORIAL, pacoteCompleto, pacotePlugin, ccx, tutorialMarkdown } from '../src/oficina/kit-plugins';
import { relatorio } from '../src/paginas/plugins';

/** Nomes das entradas de um zip (lendo o diretório central). */
function nomesZip(z: Uint8Array): string[] {
  const v = new DataView(z.buffer, z.byteOffset, z.byteLength), fim = z.length - 22, n = v.getUint16(fim + 10, true);
  let o = v.getUint32(fim + 16, true); const out: string[] = [];
  for (let k = 0; k < n; k++) { const len = v.getUint16(o + 28, true); out.push(new TextDecoder().decode(z.subarray(o + 46, o + 46 + len))); o += 46 + len + v.getUint16(o + 30, true) + v.getUint16(o + 32, true); }
  return out;
}

describe('pacotes, tutorial e roteiro', () => {
  it('nove plugins (oito da casa e o Bridge), cada um com roteiro de teste', () => {
    expect(PLUGINS.map((p) => p.id)).toEqual(['desdobra', 'retoque', 'checar', 'exportador', 'textos', 'guias', 'camadas', 'prova', 'bridge']);
    for (const p of PLUGINS) { expect(p.versao).toMatch(/^\d+\.\d+\.\d+$/); expect(ROTEIRO[p.id]?.length).toBeGreaterThan(1); }
  });
  it('o .ccx tem o manifest na raiz e não leva o LEIA-ME', () => {
    const n = nomesZip(ccx(PLUGINS.find((p) => p.id === 'guias')!));
    expect(n).toEqual(expect.arrayContaining(['manifest.json', 'index.html', 'index.js', 'guias.js']));
    expect(n.some((x) => /leia/i.test(x))).toBe(false);
  });
  it('pacote completo com instaladores, código-fonte, After Effects e tutorial', () => {
    const n = nomesZip(pacoteCompleto());
    expect(n.filter((x) => x.startsWith('1-instaladores-ccx/'))).toHaveLength(9);
    expect(n).toEqual(expect.arrayContaining(['LEIA-ME-PRIMEIRO.txt', 'TUTORIAL.md', '2-codigo-fonte-para-UXP-Developer-Tool/produceria-prova/manifest.json', '3-after-effects/produceria_variacoes_template.jsx']));
    expect(nomesZip(pacotePlugin(PLUGINS[0]))).toContain('produceria-desdobra.ccx');
  });
  it('tutorial cobre os três caminhos e o relatório marca cada passo', () => {
    expect(TUTORIAL.map((s) => s.id)).toEqual(['antes', 'baixar', 'caminho-a', 'caminho-c', 'caminho-b', 'ae', 'remover', 'relatar']);
    const md = tutorialMarkdown();
    expect(md).toContain('UnifiedPluginInstallerAgent');
    expect(md).toContain('### Produceria Guias');
    const r = relatorio({ 'guias-v1.0.0': { id: 'guias-v1.0.0', plugin: 'guias', versao: '1.0.0', passos: { 0: 'ok', 1: 'falhou' }, notas: { 1: 'guia em 270' }, em: '' } }, { id: 'ambiente', ps: '26.1', mac: '15.7' }, '2026-11-11');
    expect(r).toContain('Photoshop: 26.1 · macOS: 15.7');
    expect(r).toContain('## Produceria Guias v1.0.0 · 1 passou, 1 falhou, 2 sem teste');
    expect(r).toContain('Nota: guia em 270');
  });
});
