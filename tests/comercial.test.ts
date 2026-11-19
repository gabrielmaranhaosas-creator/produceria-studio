import { describe, expect, it } from 'vitest';
import { montarUniverso, reacao, multiverso, ORIGEM, type OrgGrafo, type PessoaInv } from '../src/lib/investigacao';
import { destinos, impedimento, pedidoMensagem, htmlEmail, textoEmail, resumo, RODAPE, LIMITE_DIA, type ContatoOrg, type Disparo } from '../src/lib/comercial';

const org = (nome: string, ligacoes: OrgGrafo['ligacoes'] = []): OrgGrafo => ({ k: nome.toLowerCase(), nome, ligacoes });
const pessoas: (PessoaInv & { email?: string; emailFonte?: string })[] = [
  { id: 'pe-cat', nome: 'Catarina Consentino', organizacao: 'PRODUCERIA', trajetoria: 'Agência A' },
  { id: 'pe-x', nome: 'Xis Lima', cargo: 'Head de produção', organizacao: 'Cliente 1', linkedin: 'https://www.linkedin.com/in/xis/' },
  { id: 'pe-y', nome: 'Ypsilon', cargo: 'RTV', organizacao: 'Agência A', email: 'y@agenciaa.com.br', emailFonte: 'https://agenciaa.com.br/equipe' },
  { id: 'pe-z', nome: 'Zeta', cargo: 'Diretora', organizacao: 'Solta', email: 'zeta@solta.com' }, // sem fonte: não vale
];
const U = montarUniverso({
  agencias: [org('Agência A', [{ empresa: 'Cliente 1', agencia: 'Agência A' }]), org('Solta', [{ empresa: 'Cliente Solto', agencia: 'Solta' }])],
  empresas: [org('Cliente 1'), org('Cliente Solto')], pessoas, orgsInv: [{ id: 'ag-a', nome: 'Agência A' }], hoje: '2026-11-19',
});
const R = reacao(U, ORIGEM, [10, 10, 10]), M = multiverso(U, ORIGEM, R);
const contatos: ContatoOrg[] = [
  { id: 'ct-cliente-1', nome: 'Cliente 1', site: 'https://cliente1.com.br', emails: [{ email: 'contato@cliente1.com.br', tipo: 'geral', fonte: 'https://cliente1.com.br/contato' }, { email: 'novosnegocios@cliente1.com.br', tipo: 'comercial', fonte: 'https://cliente1.com.br/contato' }] },
  { id: 'ct-solta', nome: 'Solta', emails: [{ email: 'imprensa@solta.com', tipo: 'imprensa/marketing', fonte: 'https://solta.com' }] },
];
const base = { U, R, M, pessoas, contatos, alvos: [{ id: 'al-1', nome: 'Cliente 1', status: 'Mapeado' }], disparos: [] as Disparo[], bloqueios: [] };

describe('Mesa comercial', () => {
  const L = destinos(base), d = (id: string) => L.find((x) => x.id === id)!;
  it('lista só quem tem contato publicado e deixa a equipe de fora', () => {
    expect(L.some((x) => x.id === 'p:pe-cat')).toBe(false);
    expect(d('o:cliente 1').emails[0].email).toBe('novosnegocios@cliente1.com.br'); // comercial antes do geral
    expect(d('p:pe-y').emails).toEqual([{ email: 'y@agenciaa.com.br', tipo: 'nominal', fonte: 'https://agenciaa.com.br/equipe' }]);
    expect(d('p:pe-x').emails[0]).toMatchObject({ email: 'novosnegocios@cliente1.com.br', daEmpresa: true });
    expect(d('p:pe-x').linkedin).toBe('https://www.linkedin.com/in/xis/');
    // e-mail sem fonte não vale e a pessoa não recebe pelo e-mail de imprensa da empresa: sem contato, fica fora
    expect(L.some((x) => x.id === 'p:pe-z')).toBe(false);
  });
  it('traz a ponte com a PRODUCERIA, o alvo da Captação e a ordem por alcance', () => {
    expect(d('o:cliente 1').ponte).toContain('PRODUCERIA');
    expect(d('o:cliente 1').ponte).toContain('Agência A');
    expect(d('o:cliente 1').alvo?.id).toBe('al-1');
    expect(d('o:solta').ger).toBe(-1);
    const iSolta = L.findIndex((x) => x.id === 'o:solta'), iCli = L.findIndex((x) => x.id === 'o:cliente 1');
    expect(iCli).toBeLessThan(iSolta);
    expect(resumo(L)).toMatchObject({ total: L.length, viaEmpresa: 1 });
  });
  it('bloqueia quem pediu para sair, repetição em 30 dias e o limite do dia', () => {
    const env: Disparo = { id: 'd1', para: 'novosnegocios@cliente1.com.br', nome: 'Cliente 1', no: 'o:cliente 1', assunto: 'a', corpo: 'b', modo: 'enviado', em: '2026-11-10T10:00:00Z' };
    const L2 = destinos({ ...base, disparos: [env], bloqueios: [{ id: 'b', email: 'y@agenciaa.com.br' }] });
    const c1 = L2.find((x) => x.id === 'o:cliente 1')!, y = L2.find((x) => x.id === 'p:pe-y')!;
    expect(impedimento(c1, 'novosnegocios@cliente1.com.br', 0, '2026-11-19')).toMatch(/30 dias/);
    expect(impedimento(c1, 'novosnegocios@cliente1.com.br', 0, '2026-12-15')).toBeNull();
    expect(impedimento(c1, 'contato@cliente1.com.br', 0, '2026-11-19')).toBeNull();
    expect(impedimento(y, 'y@agenciaa.com.br', 0, '2026-11-19')).toMatch(/não receber/);
    expect(impedimento(c1, 'contato@cliente1.com.br', LIMITE_DIA, '2026-11-19')).toMatch(/Limite/);
    expect(impedimento(c1, 'inventado@cliente1.com.br', 0, '2026-11-19')).toMatch(/fonte/);
  });
  it('o pedido leva a persona, a ponte e proíbe inventar; o e-mail sai monocromático e com a saída da lista', () => {
    const x = d('p:pe-x'), p = pedidoMensagem(x, x.emails[0], [], 'orçar desdobramento');
    expect(p).toContain('diretora comercial');
    expect(p).toContain('canal geral da empresa');
    expect(p).toContain('orçar desdobramento');
    expect(p).toContain('nenhum caso cadastrado');
    const h = htmlEmail('Olá, <b>equipe</b>\n\nSegundo parágrafo');
    expect(h).toContain('&lt;b&gt;');
    expect(h.match(/<p /g)).toHaveLength(2);
    expect(h).not.toMatch(/#(?!171717|57574f|deded8|ffffff)[0-9a-f]{6}/i);
    expect(h).toContain(RODAPE.replace(/"/g, '&quot;'));
    expect(textoEmail('Oi')).toContain(RODAPE);
  });
});
