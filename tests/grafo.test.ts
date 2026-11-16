import { describe, expect, it } from 'vitest';
import { montarGrafo } from '../src/lib/grafo';

describe('montarGrafo', () => {
  it('junta grafias da mesma empresa e não repete a mesma ligação no mesmo mês', () => {
    const g = montarGrafo({
      mercado: { agencias: [{ nome: 'Artplan', rede: false, contas: [{ anunciante: 'Sebrae Nacional', data: '2026-03-01', fonte: 'f1' }] }], anunciantes: [{ pos: 1, nome: 'Genomma', valor2025: 10, valor2024: 9, fonte: 'r' }] },
      movimentos: [{ data: '2026-03-10', anunciante: 'Sebrae Nacional', agencia: 'Artplan Comunicação', fonte: 'f2' }],
      pessoas: [{ id: 'p', nome: 'Rodolfo Medina', cargo: 'CEO', organizacao: 'Artplan', fonte: 'x' }],
    });
    expect(g.agencias.filter((a) => a.nome.startsWith('Artplan')).length).toBe(1);
    expect(g.ligacoes.length).toBe(1);
    expect(g.agencias[0].pessoas[0].nome).toBe('Rodolfo Medina');
    expect(g.empresas.find((e) => e.nome === 'Genomma')?.ranking).toBe(1);
  });
});
