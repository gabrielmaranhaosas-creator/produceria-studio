import { describe, expect, it } from 'vitest';
import { nota, paraRede, oportunidadeDe, agenda, numeros, proximaPelaCadencia, type Registro, type Oportunidade } from '../src/crm';
import { SEMENTE } from '../src/semente';
import { montarRede, multiverso, caminho } from '../src/rede';
import { EQUIPE_PUBLICA } from '../src/publico';

const H = '2026-11-26';
const op = (x: Partial<Oportunidade>): Oportunidade => ({ id: x.id || 'o', nome: 'X', etapa: 'alvo', criadoEm: H, atualizadoEm: H, ...x });

describe('Big Data da MENTO', () => {
  it('toda a base inicial tem fonte (ou sinal) e ids únicos', () => {
    expect(new Set(SEMENTE.map((r) => r.id)).size).toBe(SEMENTE.length);
    expect(SEMENTE.filter((r) => !r.fonte).map((r) => r.nome)).toEqual(['Lucas Leung', 'Erica Migales']);
    expect(SEMENTE.filter((r) => r.fonte && !/^https:\/\//.test(r.fonte))).toEqual([]);
  });
  it('a nota soma quem decide, ranking, sinal recente e a trajetória da equipe', () => {
    const tr = new Set(['band']);
    const cmo: Registro = { id: 'a', tipo: 'pessoa', nome: 'A', cargo: 'CMO', empresa: 'Neon', sinal: 'Novo CMO', data: '2026-10' };
    expect(nota(cmo, { hoje: H }).nota).toBe(70);
    const mobil = SEMENTE.find((r) => r.nome === 'Mobil')!;
    const n = nota(mobil, { hoje: H, trajetoria: tr });
    expect(n.motivos).toContain('Anuncia onde a equipe já trabalhou (Band)');
    expect(nota(SEMENTE.find((r) => r.nome === 'Band')!, { hoje: H, trajetoria: tr }).motivos).toContain('A equipe já trabalhou lá');
  });
  it('alimenta a rede: MENTO → Pet → Band → quem decide → quem anuncia', () => {
    const { pistas, ligacoes } = paraRede(SEMENTE);
    const R = montarRede(EQUIPE_PUBLICA, { pistas, ligacoes, hoje: H }), M = multiverso(R);
    const nome = (id: string) => R.nos.get(id)!.nome;
    expect(caminho(M, 'e:mobil').map(nome)).toEqual(['MENTO', 'Pet Fernandes', 'Band', 'Mobil']);
    expect(R.nos.get('e:galeria')).toBeDefined(); // pessoa do Big Data puxa a agência
  });
});

describe('Funil e agenda', () => {
  it('um registro vira alvo com próximo passo em 2 dias', () => {
    const o = oportunidadeDe({ id: 'pe-x', nome: 'Camila Sousa', tipo: 'pessoa', cargo: 'CMO', empresa: 'P&G Brasil' }, { agora: H + 'T10:00:00Z', responsavel: 'Pet', origem: 'Big Data' });
    expect(o).toMatchObject({ nome: 'P&G Brasil', contato: 'Camila Sousa', etapa: 'alvo', proximaData: '2026-11-28', registroId: 'pe-x', responsavel: 'Pet' });
  });
  it('agenda separa atrasados, hoje e semana; fechados ficam de fora', () => {
    const A = agenda([op({ id: '1', proximaData: '2026-11-20' }), op({ id: '2', proximaData: H }), op({ id: '3', proximaData: '2026-11-30' }), op({ id: '4', proximaData: '2026-11-20', etapa: 'ganho' }), op({ id: '5' })], H);
    expect([A.atrasadas, A.hoje, A.semana, A.semData].map((l) => l.map((o) => o.id))).toEqual([['1'], ['2'], ['3'], ['5']]);
  });
  it('números: pipeline, ponderado pela etapa e conversão', () => {
    const N = numeros([op({ etapa: 'proposta', valor: 100000 }), op({ etapa: 'reuniao', valor: 50000 }), op({ etapa: 'ganho', valor: 80000 }), op({ etapa: 'perdido' })]);
    expect(N).toMatchObject({ abertas: 2, pipeline: 150000, ponderado: 75000, ganho: 80000, conversao: 50 });
    expect(proximaPelaCadencia('proposta', H)).toBe('2026-11-30');
  });
});
