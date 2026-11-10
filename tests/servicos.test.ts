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
