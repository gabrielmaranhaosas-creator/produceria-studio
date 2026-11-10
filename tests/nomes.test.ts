import { describe, expect, it } from 'vitest';
import { chave, mesmaEmpresa, nomeLegivel, slug } from '../src/lib/nomes';

describe('nomeLegivel', () => {
  it.each([
    ['ARTPLAN COMUNICACAO S/A', 'Artplan Comunicacao S/A'],
    ['INSTITUTO NACIONAL DE METROLOGIA, QUALIDADE E TECNOLOGIA', 'Instituto Nacional de Metrologia, Qualidade e Tecnologia'],
    ['BNDES (RJ)', 'BNDES (RJ)'],
    ['MINISTERIO DA EDUCACAO (DF)', 'Ministerio da Educacao (DF)'],
    ['SOLUCTION LOGISTICA E EVENTOS LTDA', 'Soluction Logistica e Eventos LTDA'],
    ['MAX COMÉRCIO, REPRESENTAÇÕES e SERVIÇOS LTDA', 'Max Comércio, Representações e Serviços LTDA'],
  ])('%s → %s', (a, b) => expect(nomeLegivel(a)).toBe(b));

  it('não mexe em nomes de caixa mista', () => {
    expect(nomeLegivel('BETC Havas')).toBe('BETC Havas');
    expect(nomeLegivel('Galeria.ag')).toBe('Galeria.ag');
  });
});

describe('chave e mesmaEmpresa', () => {
  it('ignora acento e sufixo societário', () => {
    expect(chave('Comunicação LTDA')).toBe('comunicacao');
    expect(slug('Mangalô Propaganda')).toBe('mangalo-propaganda');
  });
  it('reconhece o nome curto dentro do nome completo', () => {
    expect(mesmaEmpresa('Artplan', 'ARTPLAN COMUNICACAO S/A')).toBe(true);
    expect(mesmaEmpresa('Art', 'ARTPLAN COMUNICACAO S/A')).toBe(false);
    expect(mesmaEmpresa('Nova', 'Novabrasil FM')).toBe(false);
  });
});
