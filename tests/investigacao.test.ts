// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { citados, montarCaso, linhagem, montarUniverso, reacao, caminho, leads, buscarNo, novidades, chegadas, idDeOrg, ORIGEM, type PessoaInv, type OrgInv, type OrgGrafo } from '../src/lib/investigacao';

const equipe: PessoaInv[] = [
  { id: 'pe-renato-siqueira', nome: 'Renato Siqueira', organizacao: 'PRODUCERIA', trajetoria: 'Suno United Creators (2018-2023); F.biz (2015-2018)' },
  { id: 'pe-davi-prado', nome: 'Davi Prado', organizacao: 'PRODUCERIA' },
  { id: 'pe-lucas-moreira', nome: 'Lucas Moreira', organizacao: 'PRODUCERIA' },
];
const agencias: OrgInv[] = [
  { id: 'ag-loducca', nome: 'Loducca', perfil: 'extinta', sucessora: 'ag-lola', nota: 'EXTINTA. Ponte PRODUCERIA: Renato Siqueira e Lucas Moreira.' },
  { id: 'ag-lola', nome: 'Lola\\TBWA', nota: 'Herdeira.' },
  { id: 'ag-suno', nome: 'Suno United Creators' },
  { id: 'ag-solta', nome: 'Agência sem fio' },
];
const contatos: PessoaInv[] = [
  { id: 'pe-marta', nome: 'Marta Ishida', cargo: 'Produtora gráfica', organizacao: 'Lola\\TBWA', conexao: 'Ponte PRODUCERIA: Lew\'Lara foi cliente; Renato Siqueira (ex-DM9)' },
  { id: 'pe-ana', nome: 'Ana Lima Alves', cargo: 'CPO', organizacao: 'Suno United Creators', conexao: 'Ponte PRODUCERIA: Renato, Davi e Luiz' },
  { id: 'pe-sem', nome: 'Sem Ponte', organizacao: 'Suno United Creators' },
];

describe('Investigação: ligar os pontos', () => {
  it('reconhece a equipe pelo nome completo e, depois da ponte, pelo primeiro nome', () => {
    expect(citados('Ponte PRODUCERIA: Renato, Davi e Luiz', equipe)).toEqual(['pe-renato-siqueira', 'pe-davi-prado']);
    expect(citados('Davi Chaves deixou a agência', equipe)).toEqual([]);
    expect(citados('Lucas Moreira foi produtor gráfico', equipe)).toEqual(['pe-lucas-moreira']);
  });
  it('monta o caso com fios de equipe, organização, contato e sucessão', () => {
    const C = montarCaso({ pessoas: [...equipe, ...contatos], agencias, empresas: [] });
    expect(C.equipe.map((p) => p.id)).toHaveLength(3);
    expect(C.contatos.map((p) => p.id).sort()).toEqual(['pe-ana', 'pe-marta']);
    expect(C.orgs.map((o) => o.id)).not.toContain('ag-solta');
    const tem = (de: string, para: string, tipo: string) => C.fios.some((f) => f.de === de && f.para === para && f.tipo === tipo);
    expect(tem('pe-renato-siqueira', 'ag-loducca', 'equipe-org')).toBe(true);
    expect(tem('pe-renato-siqueira', 'ag-suno', 'equipe-org')).toBe(true); // pela trajetória
    expect(tem('ag-lola', 'pe-marta', 'org-pessoa')).toBe(true);
    expect(tem('ag-loducca', 'ag-lola', 'sucessao')).toBe(true);
    expect(linhagem(agencias[0], C.orgs).map((o) => o.id)).toEqual(['ag-loducca', 'ag-lola']);
  });
});

const org = (nome: string, ligacoes: OrgGrafo['ligacoes'] = [], extra: Partial<OrgGrafo> = {}): OrgGrafo => ({ k: nome.toLowerCase(), nome, ligacoes, ...extra });
describe('Investigação: reação em cadeia', () => {
  const U = montarUniverso({
    agencias: [org('Loducca'), org('Lola\\TBWA', [{ empresa: 'Natura', agencia: 'Lola\\TBWA', disciplina: 'conta criativa', data: '2026-10-20', fonte: 'https://x' }], { perfil: 'rede' }), org('Suno United Creators')],
    empresas: [org('Natura', [], { radar: { criterios: ['imagem', 'varejo'] } })],
    pessoas: [...equipe, ...contatos, { id: 'pe-nat', nome: 'Paula Lima', cargo: 'Produtora gráfica', organizacao: 'Natura' }, { id: 'pe-gn', nome: 'Gabriel N', cargo: 'Gerente de Projetos - Natura', organizacao: 'Suno United Creators' }],
    orgsInv: agencias, alvos: [{ nome: 'Suno United Creators' }], hoje: '2026-11-17',
  });
  it('liga contas, pessoas, herdeiras e pontes num universo só, com nota e fatos', () => {
    const viz = (id: string) => (U.adj.get(id) || []).map((a) => a.b);
    expect(viz(ORIGEM)).toContain('o:loducca'); // nota da Loducca cita Renato
    expect(viz('o:loducca')).toContain('o:lola tbwa');
    expect(viz('o:natura')).toContain('p:pe-nat');
    const nat = U.nos.get('o:natura')!;
    expect(nat.fatos.join(' ')).toMatch(/Mudou de agência: Lola/);
    expect(nat.nota).toBeGreaterThan(40);
    expect(U.nos.get('p:pe-nat')!.nivel).toBe('contrata');
    expect(U.nos.get('o:suno united creators')!.alvo).toBe(true);
    expect(viz('p:pe-gn')).toContain('o:natura'); // a conta citada no cargo
    expect(U.nos.has('p:pe-renato-siqueira')).toBe(false); // a equipe fica dentro do ponto zero
  });
  it('abre as ramificações a partir de um ponto e mostra o caminho', () => {
    const R = reacao(U, ORIGEM);
    const onde = (id: string) => R.geracoes.findIndex((g) => g.some((r) => r.id === id));
    expect(onde('o:loducca')).toBe(1);
    expect(onde('o:lola tbwa')).toBe(1); // a ponte da Marta abre a casa dela
    expect(onde('p:pe-marta')).toBe(2);
    expect(onde('o:natura')).toBe(2); // cliente da Lola
    expect(onde('p:pe-nat')).toBe(3);
    expect(caminho(R, 'o:natura').map((c) => c.id)[0]).toBe(ORIGEM);
    const L = leads(U, R);
    expect(L.some((x) => x.id === 'o:loducca')).toBe(false); // extinta não é possibilidade
    expect(L.find((x) => x.id === 'p:pe-nat')?.no.fatos).toContain('Contrata produção');
    const R2 = reacao(U, 'o:natura');
    expect(R2.geracoes[1].map((r) => r.id).sort()).toEqual(['o:lola tbwa', 'p:pe-gn', 'p:pe-nat']);
    expect(buscarNo(U, 'nat')[0].id).toBe('o:natura');
  });
});

describe('Investigação: a tela', () => {
  afterEach(() => { delete (window as any).claude; vi.resetModules(); });
  it('abre a reação a partir da PRODUCERIA, acende o caminho e parte de outro ponto', async () => {
    const colecoes: Record<string, unknown[]> = { mapa_pessoas: [...equipe, ...contatos], mapa_agencias: agencias, mapa_empresas: [], movimentos: [], alvos: [] };
    const banco = { collection: (c: string) => ({ onSnapshot(ok: (s: unknown) => void) { queueMicrotask(() => ok({ docs: (colecoes[c] || []).map((d: any) => ({ id: d.id, data: () => d })) })); return () => {}; }, doc: () => ({ set: async () => {} }) }) };
    (window as any).claude = { use: async (n: string) => (n === 'db' ? banco : null) };
    const { montar } = await import('../src/paginas/investigacao');
    const raiz = document.createElement('div'); document.body.appendChild(raiz);
    const fim = montar(raiz);
    // espera os dados chegarem (com folga para a máquina ocupada, quando a suíte inteira roda junto)
    for (let i = 0; i < 40 && !raiz.querySelector('.iv-dos.ext'); i++) await new Promise((r) => setTimeout(r, 50));
    expect(raiz.querySelector('.iv-quadro .iv-zero')).toBeTruthy();
    expect(raiz.querySelector('.iv-dos.ext .iv-car')?.textContent).toBe('Extinta');
    expect(raiz.querySelectorAll('.iv-radar .iv-ld').length).toBeGreaterThan(0);
    const ana = raiz.querySelector<HTMLElement>('.iv-quadro [data-n="p:pe-ana"]')!;
    ana.click();
    expect(raiz.querySelector('.iv-dossie h3')?.textContent).toBe('Ana Lima Alves');
    expect(raiz.querySelector('.iv-dossie [data-alvo]')).toBeTruthy();
    raiz.querySelector<HTMLElement>('.iv-dossie [data-s]')!.click();
    expect(raiz.querySelector('#ivR [aria-current="true"]')?.textContent).toBe('Ana Lima Alves');
    fim();
  });
});

describe('Investigação: o que chegou', () => {
  const U = montarUniverso({
    agencias: [org('Lola\\TBWA', [{ empresa: 'Natura', agencia: 'Lola\\TBWA', disciplina: 'conta criativa', data: '2026-11-17', fonte: 'https://x' }]), org('Agência Velha', [], { perfil: 'extinta' })],
    empresas: [org('Natura', [], { radar: { criterios: ['imagem', 'varejo'] } })],
    pessoas: [
      { id: 'pe-a', nome: 'Pessoa A', cargo: 'Produtora gráfica', organizacao: 'Natura', atualizadoEm: '2026-11-18T10:12:00Z' },
      { id: 'pe-b', nome: 'Pessoa B', cargo: 'Gerente de marketing', organizacao: 'Natura', atualizadoEm: '2026-11-17T10:12:00Z' },
      { id: 'pe-c', nome: 'Pessoa C', cargo: 'Diretora de criação', organizacao: 'Lola\\TBWA' },
    ],
    orgsInv: [], hoje: '2026-11-18',
  });
  const movs = [
    { data: '2026-11-17', anunciante: 'Natura', agencia: 'Lola\\TBWA' },
    { data: '2026-11-10', anunciante: 'Natura', agencia: 'Agência Velha' },
  ];
  it('guarda o dia em que a coleta gravou cada pessoa e acha a casa pelo nome', () => {
    expect(U.nos.get('p:pe-a')!.chegou).toBe('2026-11-18');
    expect(U.nos.get('p:pe-c')!.chegou).toBeUndefined();
    expect(idDeOrg(U, 'Lola\\TBWA')).toBe('o:lola tbwa');
    expect(idDeOrg(U, 'Casa que não existe')).toBeUndefined();
  });
  it('novidades: pessoas da coleta mais recente, casas das trocas mais recentes e a semente do dia', () => {
    const N = novidades(U, movs);
    expect(N.diaP).toBe('2026-11-18'); expect(N.pessoas).toEqual(['p:pe-a']);
    expect(N.diaM).toBe('2026-11-17'); expect(N.trocas).toHaveLength(1);
    expect(N.orgs.sort()).toEqual(['o:lola tbwa', 'o:natura']);
    expect(N.semente).toBe('o:natura'); // a casa mais forte da troca
  });
  it('um dia em foco troca o recorte, e casa extinta não vira semente', () => {
    const F = novidades(U, movs, '2026-11-10');
    expect(F.pessoas).toEqual([]); expect(F.orgs).toContain('o:agencia velha');
    expect(F.semente).toBe('o:natura');
    expect(novidades(U, movs, '2026-11-17').pessoas).toEqual(['p:pe-b']);
    expect(novidades(U, []).semente).toBeUndefined();
  });
  it('chegadas contam pessoas e trocas por dia, só dentro da janela', () => {
    const C = chegadas(U, movs, 7, '2026-11-18');
    expect(C).toHaveLength(7); expect(C[6]).toEqual({ dia: '2026-11-18', pessoas: 1, contas: 0 });
    expect(C[5]).toEqual({ dia: '2026-11-17', pessoas: 1, contas: 1 });
    expect(C[0].dia).toBe('2026-11-12'); // o dia 10 fica fora da janela de 7
    expect(chegadas(U, movs, 30, '2026-11-18').reduce((s, c) => s + c.contas, 0)).toBe(2);
  });
});
