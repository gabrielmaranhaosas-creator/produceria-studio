// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo do Node, só nos testes
import { inflateRawSync, inflateSync } from 'node:zlib';
import { extrair, numero, tipar, xlsx, pdf, ansi, coluna, crc32, type Relatorio } from '../src/lib/saidas';

const R: Relatorio = {
  titulo: 'Semana comercial', olho: 'Comercial · Semana', descricao: 'Meta, previsão e o que travou.', filtros: ['Esta semana'],
  kpis: [{ rotulo: 'Contatos', valor: '12 de 25', nota: 'meta da semana' }, { rotulo: 'Previsão', valor: 'R$ 16.000,00' }],
  blocos: [
    { t: 'secao', titulo: 'Previsão do funil' },
    { t: 'tabela', colunas: ['Estágio', 'Oportunidades', 'Valor'], linhas: [['Proposta', '2', 'R$ 10.000,00'], ['Negociação', '1', 'R$ 20.000,00']] },
    { t: 'barras', titulo: 'Motivos de perda', itens: [{ rotulo: 'Preço', valor: 2, texto: '2' }, { rotulo: 'Prazo', valor: 1, texto: '1' }] },
    { t: 'lista', titulo: 'Sinais esfriando', itens: [{ titulo: 'Troca de agência', detalhe: 'vence em 2 dias', link: 'https://exemplo.com/a' }] },
  ],
  em: new Date('2026-11-23T12:00:00Z'), versao: '121', endereco: '#semana',
};

function unzip(b: Uint8Array) {
  const v = new DataView(b.buffer, b.byteOffset), out: Record<string, string> = {};
  let o = 0;
  while (v.getUint32(o, true) === 0x04034b50) {
    const m = v.getUint16(o + 8, true), c = v.getUint32(o + 14, true), n = v.getUint32(o + 18, true), l = v.getUint16(o + 26, true), x = v.getUint16(o + 28, true);
    const nome = new TextDecoder().decode(b.slice(o + 30, o + 30 + l)), corpo = b.slice(o + 30 + l + x, o + 30 + l + x + n);
    const dados = m === 8 ? new Uint8Array(inflateRawSync(corpo)) : corpo;
    expect(crc32(dados)).toBe(c);
    out[nome] = new TextDecoder().decode(dados); o += 30 + l + x + n;
  }
  return out;
}

describe('saídas do Studio', () => {
  it('lê números, moeda, porcentagem e data em pt-BR', () => {
    expect(numero('1.234,56')).toBe(1234.56);
    expect(numero('Contato')).toBeNull();
    expect(tipar('R$ 10.000,00')).toEqual({ v: 10000, f: 3 });
    expect(tipar('25%')).toEqual({ v: 0.25, f: 4 });
    expect(tipar('30/12/1899')).toEqual({ v: 0, f: 5 });
    expect(coluna(0)).toBe('A'); expect(coluna(26)).toBe('AA');
    expect(ansi('Ação → próximo ✓')).toBe('Ação -> próximo +');
  });

  it('lê a tela: cabeçalho, filtros, indicadores, tabela, barras e listas, sem o que está escondido', () => {
    document.body.innerHTML = `<main><header class="page-head"><span class="eyebrow">Comercial</span><h1>Semana</h1><p class="lead">Resumo</p></header>
      <div class="cs-exp"><button aria-pressed="true">PDF</button></div>
      <button class="chip" aria-pressed="true">Esta semana 4</button><button class="chip" aria-pressed="true">Todos</button>
      <div class="kpi"><span class="kl">Contatos</span><b>12</b><span class="kn">de 25</span></div>
      <h2>Funil</h2><table><thead><tr><th>Estágio</th><th>Valor</th></tr></thead><tbody><tr><td>Proposta</td><td>R$ 1.000,00</td></tr><tr hidden><td>X</td><td>1</td></tr></tbody></table>
      <figure class="pn-c"><figcaption>Motivos <small>90 dias</small></figcaption><ol class="pn-b"><li><span class="pn-r">Preço <small>2</small></span><b>2</b></li></ol></figure>
      <ul class="vc-l"><li><b>Marca X</b> contratou <a href="https://exemplo.com">fonte</a></li></ul>
      <div hidden><h2>Escondido</h2></div></main>`;
    const E = extrair(document.querySelector('main')!);
    expect(E.titulo).toBe('Semana');
    expect(E.filtros).toEqual(['Esta semana']);
    expect(E.kpis).toEqual([{ rotulo: 'Contatos', valor: '12', nota: 'de 25' }]);
    expect(E.blocos.map((b) => b.t)).toEqual(['secao', 'tabela', 'barras', 'lista']);
    expect(E.blocos[1]).toMatchObject({ colunas: ['Estágio', 'Valor'], linhas: [['Proposta', 'R$ 1.000,00']] });
    expect(E.blocos[2]).toMatchObject({ titulo: 'Motivos', itens: [{ rotulo: 'Preço', valor: 2 }] });
    expect(E.blocos[3]).toMatchObject({ itens: [{ titulo: 'Marca X', link: 'https://exemplo.com/' }] });
  });

  it('gera um .xlsx válido: resumo, uma aba por bloco, valores tipados, totais e links', async () => {
    const z = unzip(await xlsx(R));
    expect(Object.keys(z)).toContain('xl/workbook.xml');
    expect(z['xl/workbook.xml']).toContain('name="Resumo"');
    expect(z['xl/workbook.xml']).toContain('name="Previsão do funil"');
    const s2 = z['xl/worksheets/sheet2.xml'];
    expect(s2).toContain('<v>10000</v>');
    expect(s2).toContain('SUBTOTAL(109,C4:C5)');
    expect(s2).toContain('state="frozen"');
    expect(s2).toContain('<autoFilter ref="A3:C5"/>');
    expect(z['xl/worksheets/sheet4.xml']).toContain('HYPERLINK(&quot;https://exemplo.com/a&quot;,&quot;abrir&quot;)');
    for (const x of Object.values(z)) if (x.startsWith('<?xml')) expect(() => new DOMParser().parseFromString(x, 'application/xml')).not.toThrow();
  });

  it('gera um PDF válido: xref certo, páginas, marcadores, link e texto na identidade', async () => {
    const b = await pdf(R), t = new TextDecoder('latin1').decode(b);
    expect(t.startsWith('%PDF-1.4')).toBe(true);
    expect(t.trimEnd().endsWith('%%EOF')).toBe(true);
    const sx = Number(t.match(/startxref\n(\d+)/)![1]);
    expect(t.slice(sx, sx + 4)).toBe('xref');
    const offs = [...t.slice(sx).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    offs.forEach((o, i) => expect(t.slice(o, o + 12)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
    expect(t).toContain('/URI (https://exemplo.com/a)');
    expect(t).toContain('/Outlines');
    const fluxos = [...t.matchAll(/\/FlateDecode \/Length (\d+) >>\nstream\n/g)].map((m) => inflateSync(b.slice(m.index! + m[0].length, m.index! + m[0].length + Number(m[1]))).toString('latin1'));
    const tudo = fluxos.join('\n') + t;
    expect(tudo).toContain('(PRODUCERIA)');
    expect(tudo).toContain('Filtros ativos: Esta semana');
    expect(tudo).toContain('(1 / 1)');
    expect(tudo).not.toMatch(/1 0 0 rg|0\.72 0\.15/); // nada de vermelho
  });
});
