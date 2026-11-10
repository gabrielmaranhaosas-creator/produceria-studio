import { describe, expect, it } from 'vitest';
import { etapaDepois, registrarContato, sugerirProximo } from '../src/lib/cadencia';
import type { Alvo } from '../src/lib/tipos';

const REF = '2026-11-10'; // terça-feira
const comCadencia: Alvo = {
  id: 'a', nome: 'Ogilvy', status: 'Mapeado',
  abordagem: { cadencia: [{ dia: 'D0', canal: 'LinkedIn', texto: 'mensagem' }, { dia: 'D+4', canal: 'E-mail', texto: 'versão curta' }, { dia: 'D+10', canal: 'Telefone', texto: 'ligar' }] },
};

describe('sugerirProximo', () => {
  it('segue a cadência a partir do primeiro toque', () => {
    expect(sugerirProximo(comCadencia, 'sem', REF)).toEqual({ data: '2026-11-14', texto: 'versão curta' });
  });
  it('sem cadência: 5 dias úteis', () => {
    expect(sugerirProximo({ id: 'b', nome: 'B' }, 'sem', REF).data).toBe('2026-11-17');
  });
  it('sem interesse: retoma em 90 dias', () => {
    expect(sugerirProximo({ id: 'b', nome: 'B' }, 'nao', REF).data).toBe('2027-02-08');
  });
});

describe('etapaDepois', () => {
  it('avança e nunca regride', () => {
    expect(etapaDepois('Mapeado', 'sem')).toBe('Abordado');
    expect(etapaDepois('Mapeado', 'reun')).toBe('Conversa');
    expect(etapaDepois('Abordado', 'prop')).toBe('Proposta');
    expect(etapaDepois('Proposta', 'sem')).toBe('Proposta');
  });
});

describe('registrarContato', () => {
  it('grava o toque, a etapa nova e o carimbo de cada etapa', () => {
    const p = registrarContato({ ...comCadencia, criadoEm: '2026-11-01T00:00:00Z' }, { canal: 'LinkedIn', resultado: 'resp', proxima: '2026-11-12', oQueFazer: 'seguir' }, '2026-11-10T12:00:00Z');
    expect(p.status).toBe('Conversa');
    expect(p.toques).toHaveLength(1);
    expect(p.etapas).toEqual({ Mapeado: '2026-11-01T00:00:00Z', Conversa: '2026-11-10T12:00:00Z' });
    expect(p.prazo).toBe('2026-11-12');
  });
});
