import { describe, expect, it } from 'vitest';
import { segunda, inicioTrimestre, previsao, realizado, ganhosPerdas, esfriando, carteiraRisco, porPerfil, resumoSemana, expansao, canalAgencias } from '../src/lib/semana';
import { mesmaEmpresa } from '../src/lib/nomes';
import type { Alvo } from '../src/lib/tipos';

const H = '2026-11-25'; // quarta-feira

describe('semana comercial', () => {
  it('acha a segunda-feira e o trimestre', () => {
    expect(segunda(H)).toBe('2026-11-23');
    expect(segunda('2026-11-23')).toBe('2026-11-23');
    expect(segunda('2026-11-29')).toBe('2026-11-23');
    expect(inicioTrimestre(H)).toBe('2026-10-01');
    expect(inicioTrimestre('2026-03-31')).toBe('2026-01-01');
  });

  it('pondera o funil pelo estágio e soma o ganho do trimestre', () => {
    const P = previsao([
      { id: 'a', estagio: 'Proposta', valor: 10000 },
      { id: 'b', estagio: 'Negociação', valor: 20000 },
      { id: 'c', estagio: 'Contato', valor: null },
      { id: 'd', estagio: 'Ganha', valor: 5000, fechadoEm: '2026-11-02T10:00:00Z' },
      { id: 'e', estagio: 'Ganha', valor: 9000, fechadoEm: '2026-08-02T10:00:00Z' },
      { id: 'f', estagio: 'Perdida', valor: 7000 },
    ], H);
    expect(P.ponderado).toBe(4000 + 12000);
    expect(P.ganho).toBe(5000);
    expect(P.linhas.find((l) => l.estagio === 'Contato')!.semValor).toBe(1);
  });

  it('conta o realizado da semana: toques, e-mails, respostas, propostas e clientes', () => {
    const alvos = [
      { id: '1', nome: 'A', toques: [{ em: '2026-11-24T10:00:00Z', canal: 'E-mail', resultado: 'Respondeu' }, { em: '2026-11-10T10:00:00Z', canal: 'E-mail', resultado: 'Sem resposta' }], etapas: { Proposta: '2026-11-24T11:00:00Z' } },
      { id: '2', nome: 'B', toques: [{ em: '2026-11-23T09:00:00Z', canal: 'LinkedIn', resultado: 'Sem resposta' }], etapas: { Cliente: '2026-11-25T09:00:00Z' } },
    ] as Alvo[];
    const disparos = [{ id: 'x', enviadoEm: '2026-11-24T08:00:00Z', respostaEm: '2026-11-25T08:00:00Z', situacao: 'respondeu' }, { id: 'y', enviadoEm: '2026-11-24T08:00:00Z', respostaEm: '2026-11-24T09:00:00Z', situacao: 'voltou' }];
    expect(realizado(alvos, disparos, '2026-11-23')).toEqual({ contatos: 4, respostas: 2, propostas: 1, clientes: 1 });
    expect(realizado(alvos, disparos, '2026-11-16', '2026-11-23').contatos).toBe(0);
  });

  it('separa ganhos e perdas com o motivo', () => {
    const G = ganhosPerdas([
      { id: 'a', estagio: 'Ganha', eixo: 'Privado', valor: 1000, fechadoEm: '2026-11-01' },
      { id: 'b', estagio: 'Perdida', eixo: 'Privado', motivo: 'Preço', fechadoEm: '2026-11-03' },
      { id: 'c', estagio: 'Perdida', eixo: 'Público', motivo: 'Preço', fechadoEm: '2026-10-03' },
      { id: 'd', estagio: 'Perdida', eixo: 'Público', fechadoEm: '2026-10-05' },
      { id: 'e', estagio: 'Perdida', eixo: 'Público', motivo: 'Prazo', fechadoEm: '2026-01-05' },
    ], '2026-08-27');
    expect(G.ganhas).toBe(1);
    expect(G.perdidas).toBe(3);
    expect(G.taxa).toBe(0.25);
    expect(G.motivos[0]).toEqual(['Preço', 2]);
    expect(G.motivos).toContainEqual(['Sem motivo', 1]);
  });

  it('mostra o sinal que esfria e esquece o que já foi tocado', () => {
    const E = esfriando(
      [{ id: 'al1', titulo: 'Troca de agência', status: 'novo', data: '2026-11-13' }, { id: 'al2', titulo: 'Feito', status: 'feito', data: '2026-11-20' }],
      [{ id: 'a', nome: 'Marca X', status: 'Mapeado', gatilho: 'contratou', criadoEm: '2026-11-20T10:00:00Z' }, { id: 'b', nome: 'Tocada', status: 'Mapeado', gatilho: 'x', criadoEm: '2026-11-20', toques: [{ em: '2026-11-21', canal: 'E-mail', resultado: 'Sem resposta' }] }] as Alvo[],
      H,
    );
    expect(E.map((x) => x.titulo)).toEqual(['Troca de agência', 'Marca X']);
    expect(E[0].resta).toBe(2);
    expect(E[1].vence).toBe('2026-12-04');
  });

  it('aponta cliente parado e o andamento por perfil', () => {
    const A = [
      { id: '1', nome: 'Velho', status: 'Cliente', perfil: 'independente', ultimoToque: '2026-08-01T00:00:00Z' },
      { id: '2', nome: 'Novo', status: 'Cliente', perfil: 'inhouse', ultimoToque: '2026-11-01T00:00:00Z' },
      { id: '3', nome: 'Conversa', status: 'Conversa', perfil: 'independente' },
      { id: '4', nome: 'Fora', status: 'Descartado', perfil: 'rede' },
    ] as Alvo[];
    expect(carteiraRisco(A, H).map((x) => x.a.nome)).toEqual(['Velho']);
    expect(porPerfil(A)[0]).toEqual({ perfil: 'independente', andamento: 1, conversa: 1, clientes: 1 });
  });

  it('resume a semana: entrou, avançou, travou e sem próximo passo', () => {
    const S = resumoSemana(
      [{ id: 'o1', titulo: 'Nova', estagio: 'Identificada', criadoEm: '2026-11-24', proximoPasso: 'ligar' }, { id: 'o2', titulo: 'Andou', estagio: 'Proposta', criadoEm: '2026-10-01', movidoEm: '2026-11-24', prazo: '2026-11-20', proximoPasso: '' }],
      [{ id: 'a', nome: 'Subiu', status: 'Conversa', criadoEm: '2026-10-01', etapas: { Conversa: '2026-11-24T10:00:00Z' } }] as Alvo[],
      '2026-11-23', H,
    );
    expect(S.entrou.map((l) => l.titulo)).toEqual(['Nova']);
    expect(S.avancou.map((l) => l.titulo).sort()).toEqual(['Andou', 'Subiu']);
    expect(S.travou.map((l) => l.titulo)).toEqual(['Andou']);
    expect(S.semPasso.map((l) => l.titulo).sort()).toEqual(['Andou', 'Subiu']);
  });

  it('sugere expansão pelo que os outros clientes compram', () => {
    const cat = (id: number) => ({ 1: 'VÍDEO', 2: 'OOH', 3: 'ANÚNCIO' } as Record<number, string>)[id];
    const pr = (...ids: number[]) => ({ itens: ids.map((servico) => ({ servico })) });
    const X = expansao([
      { id: '1', nome: 'A', status: 'Cliente', proposta: pr(1) },
      { id: '2', nome: 'B', status: 'Cliente', proposta: pr(1, 2) },
      { id: '3', nome: 'C', status: 'Proposta', proposta: pr(2, 3) },
      { id: '4', nome: 'D', status: 'Cliente' },
    ] as Alvo[], cat);
    expect(X.find((x) => x.a.nome === 'A')).toMatchObject({ ja: ['VÍDEO'], oferecer: ['OOH', 'ANÚNCIO'] });
    expect(X.find((x) => x.a.nome === 'D')).toMatchObject({ ja: [], oferecer: [] });
  });

  it('ordena agências pelo alcance e separa as que já estão na Captação', () => {
    const C = canalAgencias([
      { nome: 'AGENCIA UM LTDA', contas: [{ anunciante: 'M1' }, { anunciante: 'M2' }, { anunciante: 'M2' }] },
      { nome: 'Agência Dois', contas: [{ anunciante: 'M3' }, { anunciante: 'M4' }, { anunciante: 'M5' }] },
      { nome: 'Vazia', contas: [] },
    ], [{ id: 'a', nome: 'Agencia Um', status: 'Conversa' }] as Alvo[], mesmaEmpresa);
    expect(C.naCaptacao.map((x) => [x.nome, x.marcas, x.alvo?.status])).toEqual([['AGENCIA UM LTDA', 2, 'Conversa']]);
    expect(C.abrir.map((x) => x.nome)).toEqual(['Agência Dois']);
  });
});
