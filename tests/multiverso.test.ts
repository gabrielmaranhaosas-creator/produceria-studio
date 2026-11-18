// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { montarUniverso, reacao, multiverso, ordenarReacao, dadosDoArquivo, ORIGEM, type OrgGrafo, type OrgInv, type PessoaInv } from '../src/lib/investigacao';
import { htmlDoMapa, fontesDaPagina } from '../src/lib/mapa-arquivo';

const org = (nome: string, ligacoes: OrgGrafo['ligacoes'] = [], extra: Partial<OrgGrafo> = {}): OrgGrafo => ({ k: nome.toLowerCase(), nome, ligacoes, ...extra });
const equipe: PessoaInv[] = [{ id: 'pe-renato', nome: 'Renato Siqueira', organizacao: 'PRODUCERIA', trajetoria: 'Suno United Creators; Agência B' }];
const orgsInv: OrgInv[] = [{ id: 'ag-a', nome: 'Agência A', nota: 'Ponte PRODUCERIA: Renato Siqueira.' }, { id: 'ag-b', nome: 'Agência B' }, { id: 'ag-solta', nome: 'Solta' }];
const U = montarUniverso({
  agencias: [org('Agência A', [{ empresa: 'Cliente 1', agencia: 'Agência A' }, { empresa: 'Cliente 2', agencia: 'Agência A' }]), org('Agência B', [{ empresa: 'Cliente 3', agencia: 'Agência B' }]), org('Solta', [{ empresa: 'Cliente Solto', agencia: 'Solta' }])],
  empresas: [org('Cliente 1'), org('Cliente 2'), org('Cliente 3', [{ empresa: 'Cliente 3', agencia: 'Agência C' }]), org('Cliente Solto')],
  pessoas: [...equipe, { id: 'pe-x', nome: 'Xis </script> Lima', cargo: 'Produtora', organizacao: 'Cliente 3' }],
  orgsInv, hoje: '2026-11-18',
});

describe('Multiverso da investigação', () => {
  const R = reacao(U, ORIGEM, [1, 1, 1]), M = multiverso(U, ORIGEM, R);
  it('mede todas as ramificações alcançáveis, sem o corte da reação, e o que fica fora', () => {
    const ger = (id: string) => M.camadas.findIndex((c) => c.ids.includes(id));
    expect(ger('o:agencia a')).toBe(1);
    expect(ger('o:agencia b')).toBe(1);
    expect(ger('o:cliente 3')).toBe(2);
    expect(ger('p:pe-x')).toBe(3);
    expect(M.alcance).toBe(M.camadas.slice(1).reduce((t, c) => t + c.ids.length, 0));
    expect(M.fora).toBe(2); // Solta e Cliente Solto não têm ligação com a PRODUCERIA
    expect(M.alcance + M.fora).toBe(M.total);
    expect(M.camadas[1].abertos).toBe(1); // a reação abriu 1 por ramificação
    expect(M.pai.get('o:cliente 3')!.id).toBe('o:agencia b');
  });
  it('põe cada ramificação na ordem dos pais, para os fios não se cruzarem', () => {
    const ord = M.camadas[2].ids.map((id) => M.pai.get(id)!.id), primeira = M.camadas[1].ids;
    expect(ord.map((p) => primeira.indexOf(p))).toEqual([...ord.map((p) => primeira.indexOf(p))].sort((a, b) => a - b));
    const Ra = reacao(U, ORIGEM), G = ordenarReacao(Ra);
    const pos = new Map(G[1].map((r, i) => [r.id, i]));
    const chefes = G[2].map((r) => pos.get(r.pais[0].id)!);
    expect(chefes).toEqual([...chefes].sort((a, b) => a - b));
    expect(G.flat()).toHaveLength(Ra.geracoes.flat().length);
  });
  it('a partir de outro ponto, o ponto zero não conta como alcançado', () => {
    const M2 = multiverso(U, 'o:cliente 3');
    expect(M2.camadas.flatMap((c) => c.ids)).not.toContain(ORIGEM);
    expect(M2.alcance + M2.fora + 1).toBe(M2.total);
  });
  it('monta um arquivo HTML único, sem rede, com os dados protegidos dentro do script', () => {
    const d = dadosDoArquivo(U, R, M, { geradoEm: '2026-11-18T12:00:00Z', novos: new Set(['p:pe-x']) });
    expect(d.nos).toHaveLength(M.alcance + 1);
    expect(d.nos.find((n) => n.id === 'p:pe-x')).toMatchObject({ g: 3, novo: 1, p: 'o:cliente 3' });
    expect(d.nos.filter((n) => n.f != null).length).toBe(R.geracoes.flat().length);
    const html = htmlDoMapa(d, '@font-face{font-family:PTYPE;src:url(data:font/woff2;base64,AA)}');
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Multiverso · PRODUCERIA');
    expect(html.match(/<\/script>/g)).toHaveLength(2); // o nome com </script> não fecha o bloco de dados
    expect(html).not.toMatch(/src="http|href="http[^"]*\.css/); // nada carregado de fora
    const dados = JSON.parse(html.split('<script type="application/json" id="dados">')[1].split('</script>')[0]);
    expect(dados.nos.find((n: { id: string }) => n.id === 'p:pe-x').n).toBe('Xis </script> Lima');
  });
  it('leva só as fontes da casa que a página tem', () => {
    document.head.innerHTML = '<style>@font-face{font-family:PTYPE;src:url(a)} @font-face{font-family:Outra;src:url(b)} body{}</style>';
    expect(fontesDaPagina()).toBe('@font-face{font-family:PTYPE;src:url(a)}');
  });
});
