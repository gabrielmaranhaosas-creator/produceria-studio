import { describe, expect, it } from 'vitest';
import { lerArquivos, lerCsv, data, pessoaDosArquivos } from '../src/exportacao';
import { montarRede, reacao, multiverso, radar, emComum, caminho, csvRadar, nivelDoCargo, ZERO } from '../src/rede';
import { CONEXOES_A, CONEXOES_B, POSICOES_A, POSICOES_B, PERFIL_A, PERFIL_B, zipar } from './exemplo';

describe('Arquivo de dados do LinkedIn', () => {
  it('lê o .zip oficial, só os três CSVs que interessam (nunca as mensagens)', async () => {
    const arq = await lerArquivos([{ nome: 'Basic_LinkedInDataExport_11-26-2026.zip', dados: await zipar({ 'Connections.csv': CONEXOES_A, 'Positions.csv': POSICOES_A, 'Profile.csv': PERFIL_A }) }]);
    expect(Object.keys(arq).sort()).toEqual(['connections.csv', 'positions.csv', 'profile.csv']);
    const p = pessoaDosArquivos('1', arq);
    expect(p).toMatchObject({ nome: 'Fulana de Tal', titulo: 'Diretora de Mídia na Mento Publicidade' });
    expect(p.conexoes).toHaveLength(6);
    expect(p.conexoes[5]).toMatchObject({ nome: 'Pedro, Jr. Alves', empresa: 'Natura &Co', cargo: 'Gerente de Marca, Natura', desde: '2026-10-20' });
    expect(p.posicoes[0]).toMatchObject({ empresa: 'Mento Publicidade', inicio: '2022-01', atual: true });
    expect(p.posicoes[1]).toMatchObject({ fim: '2021-12', atual: false });
  });
  it('aceita um CSV solto, aspas com vírgula e datas em português', async () => {
    const arq = await lerArquivos([{ nome: 'Connections.csv', dados: new TextEncoder().encode(CONEXOES_B).buffer as ArrayBuffer }]);
    expect(pessoaDosArquivos('2', arq).conexoes).toHaveLength(3);
    expect(lerCsv('a,"b, c",d\n1,"x\ny",3')).toEqual([['a', 'b, c', 'd'], ['1', 'x\ny', '3']]);
    expect(data('26 nov. 2026')).toBe('2026-11-26');
    expect(data('jan de 2022')).toBe('2022-01');
  });
});

describe('Rede da MENTO', () => {
  const A = pessoaDosArquivos('1', { 'connections.csv': CONEXOES_A, 'positions.csv': POSICOES_A, 'profile.csv': PERFIL_A });
  const B = pessoaDosArquivos('2', { 'connections.csv': CONEXOES_B, 'positions.csv': POSICOES_B, 'profile.csv': PERFIL_B });
  const R = montarRede([A, B], { hoje: '2026-11-26' }), M = multiverso(R), Q = reacao(R);
  it('MENTO no centro, equipe na 1ª volta, conhecidos e trajetória na 2ª, empresas dos conhecidos na 3ª', () => {
    expect(M.voltas[1].sort()).toEqual(['m:1', 'm:2']);
    expect(M.voltas[2]).toEqual(expect.arrayContaining(['c:linkedin.com/in/juliana-prado', 'e:publicis', 'e:heineken']));
    expect(M.voltas[3]).toEqual(expect.arrayContaining(['e:itau unibanco', 'e:volkswagen', 'e:natura e co']));
    expect(R.nos.has('c:linkedin.com/in/carla-dias')).toBe(false); // colega da Mento não é prospecção
    expect(M.total).toBe(M.voltas.slice(1).flat().length);
  });
  it('quem as duas pessoas conhecem vira um ponto só e pesa mais', () => {
    const ju = R.nos.get('c:linkedin.com/in/juliana-prado')!;
    expect(ju.quem.sort()).toEqual(['m:1', 'm:2']);
    expect(ju.fatos).toContain('Conhecido por Fulana e Ciclano');
    expect(emComum(R).map((n) => n.nome)).toEqual(['Juliana Prado']);
    expect(radar(R, 'contato')[0].nome).toBe('Juliana Prado');
  });
  it('lê o cargo: quem decide, quem influencia', () => {
    expect(nivelDoCargo('CMO')).toBe('decide');
    expect(nivelDoCargo('Diretora de Marketing')).toBe('decide');
    expect(nivelDoCargo('Coordenador de Trade Marketing')).toBe('influencia');
    expect(nivelDoCargo('Analista de Dados')).toBe('outro');
  });
  it('empresa onde a equipe já trabalhou e conhece gente pesa; agência fica marcada', () => {
    const hk = R.nos.get('e:heineken')!;
    expect(hk.fatos).toEqual(expect.arrayContaining(['Ciclano já trabalhou lá', '2 conhecido(s) lá dentro']));
    expect(R.nos.get('e:publicis')!.agencia).toBe(true);
    expect(radar(R, 'empresa')[0].nome).not.toBe('Publicis Brasil');
  });
  it('a reação abre volta por volta e cada ponto tem caminho até a MENTO; a planilha sai com tudo', () => {
    expect(Q.geracoes[0][0].id).toBe(ZERO);
    expect(Q.geracoes[1]).toHaveLength(2);
    expect(caminho(M, 'e:itau unibanco').map((id) => R.nos.get(id)!.nome)).toEqual(['MENTO', expect.any(String), 'Juliana Prado', 'Itaú Unibanco']);
    const csv = csvRadar(R, M);
    expect(csv.split('\r\n')[0]).toBe('﻿Nota;Tipo;Nome;Cargo;Empresa;Quem conhece;Caminho;Por que;LinkedIn;E-mail');
    expect(csv).toContain('rafael@exemplo.com');
    expect(csv).not.toContain('segredo');
  });
});
