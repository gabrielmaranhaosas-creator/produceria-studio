// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { MENTO, PRODUCERIA } from '../src/lib/casa';
import { lerPerfil } from '../src/lib/linkedin';
import { reacaoDaCasa, csvDoRadar, type BaseMercado, type PerfilEquipe } from '../src/lib/reacao-casa';
import { montarUniverso, dadosDoArquivo, ORIGEM, type OrgGrafo } from '../src/lib/investigacao';
import { htmlDoMapa } from '../src/lib/mapa-arquivo';

const org = (nome: string, ligacoes: OrgGrafo['ligacoes'] = []): OrgGrafo => ({ k: nome.toLowerCase(), nome, ligacoes });
const base: BaseMercado = {
  agencias: [org('Africa Creative DDB', [{ empresa: 'Itaú', agencia: 'Africa Creative DDB' }, { empresa: 'Ambev', agencia: 'Africa Creative DDB' }]), org('Publicis Brasil', [{ empresa: 'Heineken', agencia: 'Publicis Brasil' }])],
  empresas: [org('Itaú'), org('Ambev'), org('Heineken'), org('Natura')],
  pessoas: [
    { id: 'x1', nome: 'Diretora Itaú', cargo: 'Diretora de Marketing', organizacao: 'Itaú' },
    { id: 'x2', nome: 'Gerente Heineken', cargo: 'Gerente de Produção', organizacao: 'Heineken', trajetoria: 'Ambev' },
    { id: 'x3', nome: 'Renato Siqueira', organizacao: 'PRODUCERIA', trajetoria: 'Natura' },
  ],
  orgsInv: [], hoje: '2026-11-26',
};
const perfil = (id: string, texto: string): PerfilEquipe => ({ id, ...lerPerfil(texto) });
const A = perfil('mento-1', 'Fulana de Tal\nDiretora de Mídia na Mento Publicidade\nExperiência\nDiretora de Mídia\nMento Publicidade · Tempo integral\njan de 2022 - o momento · 2 anos\nGerente de Mídia\nAfrica Creative DDB · Tempo integral\nmar de 2018 - dez de 2021 · 3 anos\nAnalista\nCasa Nova Ltda · Tempo integral\n2015 - 2018 · 3 anos');
const B = perfil('mento-2', 'Ciclano Souza\nSócio na Mento\nExperiência\nSócio\nMento Publicidade · Tempo integral\n2020 - o momento · 4 anos\nDiretor de Negócios\nPublicis Brasil · Tempo integral\n2015 - 2020 · 5 anos\nAtendimento\nAfrica Creative DDB · Estágio\n2012 - 2014 · 2 anos');

describe('Reação em cadeia de uma casa a partir dos LinkedIns da equipe', () => {
  const r = reacaoDaCasa(MENTO, base, [A, B]);
  it('a casa é o ponto zero, a equipe é a 1ª ramificação e as casas da trajetória, a 2ª', () => {
    expect(r.U.nos.get(ORIGEM)!.nome).toBe('MENTO');
    expect(r.M.camadas[1].ids.sort()).toEqual(['p:mento-1', 'p:mento-2']);
    expect(r.M.camadas[2].ids).toEqual(expect.arrayContaining(['o:africa creative ddb', 'o:publicis brasil', 'o:casa nova']));
    expect(r.U.nos.get('o:casa nova')!.sub).toBe('Organização'); // fora do Big Data, entra pela trajetória
    expect(r.M.camadas[3].ids).toEqual(expect.arrayContaining(['o:itau', 'o:ambev', 'o:heineken']));
    expect(r.M.camadas.flatMap((c) => c.ids)).toContain('p:x1');
  });
  it('a equipe não entra no radar, e a PRODUCERIA não é equipe da MENTO', () => {
    expect(r.radar.some((x) => x.no.equipe)).toBe(false);
    expect(r.radar[0].caminho[0].id).toBe(ORIGEM);
    expect(r.U.nos.has('p:x3')).toBe(true); // Renato é só mais uma pessoa do mapa aqui
    expect(r.U.nos.get('o:africa creative ddb')!.fatos).toContain('Já tem ponte com a MENTO');
  });
  it('mostra por pessoa as casas da trajetória e as pontes em comum entre as duas', () => {
    const fulana = r.porPessoa.find((p) => p.nome === 'Fulana de Tal')!;
    expect(fulana.casas.map((c) => c.nome)).toEqual(expect.arrayContaining(['Africa Creative DDB', 'Casa Nova Ltda']));
    expect(fulana.casas.find((c) => c.nome === 'Africa Creative DDB')).toMatchObject({ conhecida: true, atual: false });
    expect(fulana.casas.find((c) => c.nome === 'Casa Nova Ltda')!.conhecida).toBe(false);
    expect(r.comuns[0]).toMatchObject({ nome: 'Africa Creative DDB', passos: [1, 1] });
  });
  it('baixa o multiverso na identidade da MENTO e a planilha do radar', () => {
    const d = dadosDoArquivo(r.U, r.R, r.M, { geradoEm: '2026-11-26T12:00:00Z' });
    expect(d.nos.filter((n) => n.eq).length).toBe(2);
    const html = htmlDoMapa(d, '', MENTO);
    expect(html).toContain('data-casa="mento"');
    expect(html).toContain('Multiverso · MENTO');
    expect(html).toContain('font-family:"Mento Stencil"');
    expect(html).toContain('"problema":"A MENTO conecta');
    const csv = csvDoRadar(r);
    expect(csv.split('\r\n')[0]).toContain('Força;Ramificação');
    expect(csv).toContain('MENTO →');
  });
  it('a PRODUCERIA segue igual quando não se passa casa', () => {
    const U = montarUniverso(base);
    expect(U.nos.get(ORIGEM)!.nome).toBe('PRODUCERIA');
    expect(U.nos.has('p:x3')).toBe(false); // equipe dentro do ponto zero
    expect(U.adj.get(ORIGEM)!.some((a) => a.b === 'o:natura')).toBe(true);
    expect(htmlDoMapa(dadosDoArquivo(U, { semente: ORIGEM, geracoes: [[]], ocultos: [] }, { semente: ORIGEM, camadas: [], pai: new Map(), alcance: 0, fora: 0, total: 0, foraIds: [] }, { geradoEm: '' }), '', PRODUCERIA)).not.toContain('font-family:"Mento Stencil"');
  });
});
