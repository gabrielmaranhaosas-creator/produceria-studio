import { describe, expect, it } from 'vitest';
import { calibrar, prioridade, prioridadeDoAlvo } from '../src/lib/prioridade';
import type { Alvo } from '../src/lib/tipos';

const REF = '2026-11-10';

describe('prioridade', () => {
  it('soma perfil, sinais, valor, recência e contato, com teto 100', () => {
    const p = prioridade({ perfil: 'independente', sinais: 2, valor: 2e6, ultimo: '2026-11-05', contato: 'Ana' }, {}, REF);
    expect(p.nota).toBe(30 + 16 + 15 + 15 + 8);
    expect(p.motivo).toContain('perfil independente +30');
    expect(prioridade({ perfil: 'independente', sinais: 9, valor: 9e9, ultimo: REF, contato: 'x', status: 'Proposta', notaCaptacao: 100 }, {}, REF).nota).toBe(100);
  });
  it('perfil desconhecido vale 15', () => {
    expect(prioridade({}, {}, REF).nota).toBe(15);
  });
});

describe('calibrar', () => {
  const alvo = (perfil: string, triagem: string): Alvo => ({ id: perfil + triagem + Math.random(), nome: 'x', perfil, triagem, triadoEm: '2026-11-01' });
  it('reduz o peso de perfis muito descartados, com piso de 0,4', () => {
    const cal = calibrar([alvo('rede', 'Descartar'), alvo('rede', 'Descartar'), alvo('rede', 'Descartar'), alvo('independente', 'Abordar')], REF);
    expect(cal.rede).toBe(0.4);
    expect(cal.independente).toBe(1);
    expect(prioridade({ perfil: 'rede' }, cal, REF).nota).toBe(4);
  });
  it('ignora triagens com mais de 90 dias', () => {
    const velho = { ...alvo('rede', 'Descartar'), triadoEm: '2026-01-01' };
    expect(calibrar([velho, velho, velho], REF)).toEqual({});
  });
});

describe('prioridadeDoAlvo', () => {
  it('conta o alvo novo como um sinal', () => {
    const a: Alvo = { id: 'a', nome: 'X', perfil: 'inhouse', criadoEm: '2026-11-09T10:00:00Z' };
    expect(prioridadeDoAlvo(a, {}, REF).nota).toBe(25 + 8 + 15);
  });
});
