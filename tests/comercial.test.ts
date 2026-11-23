import { describe, expect, it } from 'vitest';
import { montarUniverso, reacao, multiverso, ORIGEM, type OrgGrafo, type PessoaInv } from '../src/lib/investigacao';
import { destinos, impedimento, pedidoMensagem, htmlEmail, textoEmail, resumo, RODAPE, LIMITE_DIA, conferir, consultas, lerResposta, pendente, placar, type ContatoOrg, type Disparo } from '../src/lib/comercial';

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

describe('ciclo depois do rascunho', () => {
  it('lê o Gmail real: endereço sem pontos na busca e resposta pela conversa completa', () => {
    const d: Disparo = { id: 'g1', para: 'ana.souza@cliente1.com.br', nome: 'Ana', no: 'p:x', assunto: 'Produção', corpo: 'x', modo: 'rascunho', em: '2026-11-10T10:00:00Z' };
    // formato devolvido pela busca do Gmail em 23/11: sem date, sem snippet e com o endereço sem pontos
    const envio = { threads: [{ id: 't1', messages: [{ id: 'm1', sender: 'eu@exemplo.com', subject: 'Produção', threadId: 't1', toRecipients: ['anasouza@cliente1.com.br'] }] }] };
    const ida = conferir(d, { envio }, '2026-11-12T10:00:00Z');
    expect(ida).toMatchObject({ situacao: 'enviado', threadId: 't1', enviadoEm: '2026-11-12T10:00:00Z' });
    // formato do get_thread (PLAIN_TEXT): mensagens soltas, com data e corpo
    const resposta = { id: 't1', viewUrl: 'https://mail.google.com/x', messages: [{ id: 'm2', sender: 'Ana.Souza@cliente1.com.br', subject: 'Re: Produção', date: '2026-11-13T15:00:00Z', plaintextBody: 'Sair, por favor.\n\nEm 12/11 voce escreveu:\n> texto' }] };
    expect(conferir({ ...d, ...ida }, { resposta }, '2026-11-14T10:00:00Z')).toMatchObject({ situacao: 'sair', respostaEm: '2026-11-13T15:00:00.000Z', link: 'https://mail.google.com/x' });
  });

  const ras: Disparo = { id: 'r1', para: 'novosnegocios@cliente1.com.br', nome: 'Cliente 1', no: 'o:cliente 1', org: 'Cliente 1', assunto: 'Produção para a campanha de verão', corpo: 'x', modo: 'rascunho', em: '2026-11-10T10:00:00Z', porta: 'comercial', tipoNo: 'empresa', ger: 1, objetivo: 'desdobramento' };
  const th = (m: object) => ({ threads: [{ id: 't1', viewUrl: 'https://mail.google.com/x', messages: [{ threadId: 't1', date: '2026-11-11T09:00:00Z', ...m }] }] });

  it('acha o rascunho na pasta Enviados pelo destinatário e pelo assunto', () => {
    const up = conferir(ras, { envio: th({ toRecipients: ['Novos Negócios <novosnegocios@cliente1.com.br>'], subject: 'Produção para a campanha de verão' }) }, '2026-11-12T00:00:00Z');
    expect(up).toMatchObject({ modo: 'enviado', situacao: 'enviado', enviadoEm: '2026-11-11T09:00:00.000Z', threadId: 't1' });
    expect(conferir(ras, { envio: {} }).situacao).toBeUndefined();
  });

  it('lê resposta, pedido para sair e e-mail que voltou', () => {
    const env: Disparo = { ...ras, modo: 'enviado', situacao: 'enviado', enviadoEm: '2026-11-11T09:00:00Z' };
    expect(conferir(env, { resposta: th({ sender: 'Ana <novosnegocios@cliente1.com.br>', snippet: 'Olá! Vamos marcar uma conversa na semana que vem?' }) }).situacao).toBe('respondeu');
    expect(conferir(env, { resposta: th({ sender: 'novosnegocios@cliente1.com.br', snippet: 'Sair' }) }).situacao).toBe('sair');
    expect(conferir(env, { resposta: th({ sender: 'novosnegocios@cliente1.com.br', snippet: 'Obrigada, mas no momento não temos interesse.' }) }).situacao).toBe('sem interesse');
    expect(conferir(env, { devolucao: th({ sender: 'mailer-daemon@googlemail.com', snippet: 'Endereço não encontrado' }), resposta: {} }).situacao).toBe('voltou');
    // mensagem de outra pessoa no mesmo filtro não conta
    expect(conferir(env, { resposta: th({ sender: 'outro@x.com', snippet: 'oi' }) }).situacao).toBeUndefined();
  });

  it('não confunde o rodapé citado com pedido para sair', () => {
    expect(lerResposta(`Obrigado, gostei! Em 10/11, PRODUCERIA escreveu: ... ${RODAPE}`)).toBe('respondeu');
    expect(lerResposta('Podem remover meu e-mail da lista, por favor')).toBe('sair');
  });

  it('só confere o que ainda está em aberto', () => {
    expect(pendente(ras, '2026-11-20')).toBe(true);
    expect(pendente(ras, '2026-12-20')).toBe(false);
    expect(pendente({ ...ras, situacao: 'respondeu' }, '2026-11-20')).toBe(false);
    expect(consultas(ras).envio).toBe('to:novosnegocios@cliente1.com.br in:sent after:2026/11/10');
  });

  it('placar: taxa sobre os entregues, por porta e por tipo', () => {
    const L: Disparo[] = [
      { ...ras, id: 'a', situacao: 'respondeu', enviadoEm: '2026-11-10T00:00:00Z', respostaEm: '2026-11-12T00:00:00Z' },
      { ...ras, id: 'b', situacao: 'enviado' },
      { ...ras, id: 'c', situacao: 'voltou', porta: 'geral' },
      { ...ras, id: 'd', situacao: 'rascunho' },
      { ...ras, id: 'e', situacao: 'sair', porta: 'geral', tipoNo: 'agencia' },
    ];
    const p = placar(L);
    expect(p).toMatchObject({ rascunhos: 1, enviados: 4, voltaram: 1, respostas: 2, positivas: 1, sair: 1, taxa: 67, diasResposta: 2 });
    expect(p.porPorta.find((x) => x.rotulo === 'E-mail comercial')).toMatchObject({ enviados: 2, respostas: 1, taxa: 50 });
    expect(p.porTipo.find((x) => x.rotulo === 'Agência')).toMatchObject({ enviados: 1, respostas: 1 });
  });
});
