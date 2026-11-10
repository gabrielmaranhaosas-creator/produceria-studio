import { describe, expect, it } from 'vitest';
import { SERVICOS, buscar, calcular, itemDe, rotulo } from '../src/lib/servicos';

describe('tabela de serviços', () => {
  it('tem os 709 serviços da planilha', () => {
    expect(SERVICOS.length).toBe(709);
    expect(rotulo(SERVICOS[0])).toBe('ANÚNCIO JORNAL · 1 PÁGINA · adaptação');
  });
  it('busca sem acento e com todas as palavras', () => {
    const r = buscar('anuncio jornal criacao');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.cat === 'ANÚNCIO JORNAL' && s.etapa === 'CRIAÇÃO')).toBe(true);
  });
  it('calcula em centavos com desconto por item', () => {
    const s = SERVICOS[0]; // R$ 2.154,01
    const a = { ...itemDe(s, { [String(s.id)]: 10 }, 'a'), qtd: 2 };
    const t = calcular([a]);
    expect(t.bruto).toBe(430802);
    expect(t.desconto).toBe(43080);
    expect(t.total).toBe(387722);
  });
});

import { totalOrcamento, orcamentoVigente } from '../src/lib/servicos';
describe('orçamento de projeto', () => {
  it('soma desconto, fee, reserva e tributo como o legado', () => {
    // 1 × R$ 1.000,00, desconto geral 10%, fee 10%, reserva 5%, tributo 10%
    const o = { itens: [{ qtd: 1, unit: 100000 }], params: { desconto: 10, fee: 10, reserva: 5, tributo: 10 } };
    // líquido 90000 · base 90000+9000+4500=103500 · total 103500+10350=113850
    expect(totalOrcamento(o)).toBe(113850);
  });
  it('usa a última versão aprovada, senão a última salva', () => {
    const a = { status: 'Aprovado internamente', itens: [] }, b = { status: 'Rascunho', itens: [] };
    expect(orcamentoVigente([a, b])).toBe(a);
    expect(orcamentoVigente([b])).toBe(b);
    expect(orcamentoVigente([])).toBeUndefined();
  });
});

import { mesclarDescontos, pctDe } from '../src/paginas/tabela';
describe('descontos da tabela', () => {
  it('arredonda, limita e tira os zerados', () => {
    expect(mesclarDescontos({ a: 5, b: 7 }, { a: 0, c: 12.345, d: 150 })).toEqual({ b: 7, c: 12.35, d: 100 });
    expect(pctDe('12,5')).toBe(12.5); expect(pctDe('abc')).toBe(0); expect(pctDe('-3')).toBe(0);
  });
});
