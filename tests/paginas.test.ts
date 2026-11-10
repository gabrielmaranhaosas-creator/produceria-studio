// @vitest-environment happy-dom
// Testes de tela das páginas migradas, com um banco em memória no lugar do banco do claude.ai.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Docs = Record<string, Record<string, unknown>>;

/** Banco em memória com a mesma forma do `db` do claude.ai (collection, doc, onSnapshot). */
function bancoFalso(inicial: Record<string, Docs>) {
  const dados: Record<string, Docs> = JSON.parse(JSON.stringify(inicial));
  const ouvintes: Record<string, Set<() => void>> = {};
  const snap = (c: string) => ({ docs: Object.entries(dados[c] || {}).map(([id, d]) => ({ id, data: () => d })) });
  const emitir = (c: string) => ouvintes[c]?.forEach((f) => f());
  const consulta = (c: string): any => ({
    where: () => consulta(c), orderBy: () => consulta(c), limit: () => consulta(c),
    onSnapshot(ok: (s: unknown) => void) {
      const f = () => ok(snap(c));
      (ouvintes[c] ||= new Set()).add(f);
      queueMicrotask(f);
      return () => ouvintes[c].delete(f);
    },
    doc: (id: string) => ({
      async set(d: Record<string, unknown>) { (dados[c] ||= {})[id] = d; emitir(c); },
      async update(d: Record<string, unknown>) { (dados[c] ||= {})[id] = { ...(dados[c][id] || {}), ...d }; emitir(c); },
      async delete() { delete dados[c]?.[id]; emitir(c); },
    }),
  });
  return { dados, banco: { collection: (c: string) => consulta(c) } };
}

const espera = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function montar(pagina: string, db: ReturnType<typeof bancoFalso>) {
  vi.resetModules();
  (window as any).claude = { use: async (n: string) => (n === 'db' ? db.banco : null) };
  const mod = await import(`../src/paginas/${pagina}.ts`);
  const raiz = document.createElement('div');
  document.body.appendChild(raiz);
  const desmontar = mod.montar(raiz);
  await espera();
  return { raiz, desmontar };
}

beforeEach(() => {
  document.body.innerHTML = '';
  // arquivos publicados (vencedores, mercado) não existem no teste: a página tem de seguir sem eles
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
});
afterEach(() => { vi.unstubAllGlobals(); delete (window as any).claude; });

const hoje = new Date().toISOString().slice(0, 10);

describe('Agenda', () => {
  it('mostra o resumo e a fila do dia a partir dos alvos', async () => {
    const db = bancoFalso({ alvos: {
      'al-a': { nome: 'Agência A', status: 'Abordado', proximoToque: { data: hoje, texto: 'Ligar para a diretora de produção', canal: 'Telefone' } },
      'al-b': { nome: 'Agência B', status: 'Mapeado', prazo: '2099-01-01' },
    } });
    const { raiz, desmontar } = await montar('agenda', db);
    const kpis = raiz.querySelectorAll('#agK .k');
    expect(kpis.length).toBe(4);
    expect(kpis[0].textContent).toContain('Para hoje');
    expect(kpis[0].querySelector('b')?.textContent).toBe('1');
    expect(raiz.querySelector('#agO')?.textContent).toContain('Agência A');
    expect(raiz.querySelector('#agO')?.textContent).toContain('Ligar para a diretora de produção');
    desmontar();
  });
});

describe('Casos', () => {
  const inicial = { casos: { 'cs-1': { titulo: 'Black Box Cannes', cliente: 'Cliente X', ano: '2019', resumo: 'Finalização', servicos: ['Arte-final'], perfis: ['rede'] } } };

  it('lista os casos do banco e filtra pela busca', async () => {
    const { raiz } = await montar('casos', bancoFalso(inicial));
    expect(raiz.querySelectorAll('.cs-it').length).toBe(1);
    expect(raiz.querySelector('.cs-it .tag')?.textContent).toBe('Arte-final');
    const q = raiz.querySelector<HTMLInputElement>('#csQ')!;
    q.value = 'nada parecido';
    q.dispatchEvent(new Event('input'));
    expect(raiz.querySelectorAll('.cs-it').length).toBe(0);
    expect(raiz.querySelector('.empty h2')?.textContent).toBe('Nenhum caso com esses filtros');
  });

  it('exclui só depois da confirmação na própria página', async () => {
    const db = bancoFalso(inicial);
    const { raiz } = await montar('casos', db);
    raiz.querySelector<HTMLButtonElement>('[data-ed="cs-1"]')!.click();
    const del = raiz.querySelector<HTMLButtonElement>('#c_del')!;
    del.click();
    await espera();
    expect(db.dados.casos['cs-1']).toBeDefined(); // primeiro clique só pede confirmação
    expect(del.textContent).toBe('Confirmar exclusão');
    del.click();
    await espera();
    expect(db.dados.casos['cs-1']).toBeUndefined();
    expect(raiz.querySelector('.empty h2')?.textContent).toBe('Nenhum caso ainda');
  });
});

describe('Central de notícias', () => {
  it('monta com notícias do banco e sem os arquivos publicados', async () => {
    const db = bancoFalso({
      noticias: { 'nt-1': { data: hoje, titulo: 'Agência Z ganha conta de banco', resumo: 'Fato.', categoria: 'conta', empresas: ['Agência Z'], veiculo: 'M&M', url: 'https://exemplo.com/n', lead: { nome: 'Agência Z', perfil: 'independente', porque: 'ganhou conta' } } },
      movimentos: {}, alvos: {}, central: {}, b2g: {},
    });
    const { raiz, desmontar } = await montar('central', db);
    await espera(50);
    expect(raiz.querySelectorAll('#cnK .k').length).toBe(4);
    expect(raiz.textContent).toContain('Agência Z ganha conta de banco');
    desmontar();
  });
});

describe('Mapa de contas', () => {
  it('monta com uma conta cadastrada pela equipe', async () => {
    const db = bancoFalso({ contas: { 'ct-1': { tipo: 'privada', empresa: 'Agência Y', cliente: 'Marca W', servico: 'Publicidade', valor: 120000, fim: '2099-12-31' } }, alvos: {} });
    const { raiz, desmontar } = await montar('mapa-contas', db);
    await espera(50);
    expect(raiz.textContent).toContain('Contas encontradas');
    expect(raiz.textContent).toContain('Agência Y');
    desmontar();
  });
});

describe('Licitações', () => {
  const base = {
    b2g: {
      'pncp-1': { objeto: 'Produção audiovisual institucional', orgao: 'Prefeitura A', uf: 'SP', score: 90, craft: 1, frenteCerebro: 'Produção audiovisual e filmes', aderencia: 'direta', entidades: ['cria'], prazo: '2099-01-10', valor: 100000, fonte: 'Cérebro' },
      'pncp-2': { objeto: 'Placas de identificação em ACM', orgao: 'Câmara B', uf: 'MG', score: 55, craft: 0.6, frenteCerebro: 'Comunicação visual e sinalização', aderencia: 'direta', entidades: ['cria'], prazo: '2099-02-01', fonte: 'Cérebro' },
      'pncp-3': { objeto: 'Show de aniversário', orgao: 'Município C', uf: 'GO', score: 0, frenteCerebro: 'x', prazo: '2099-01-05', fonte: 'Cérebro' },
    },
    habilitacao: { cria: { req: { fgts: { status: 'ok', validade: '2099-12-31' } } } },
    cerebro: { status: { ultimaVarredura: '2026-11-10T06:21:15-03:00', lidos: 5926, novos: 121, perfil: '2026-11-10e' } },
  };

  it('filtra o radar pela nota, pela frente e pela busca', async () => {
    const { filtrarRadar } = await import('../src/paginas/licitacoes');
    const L = Object.entries(base.b2g).map(([id, d]) => ({ id, ...d })) as any[];
    const f = { frente: '', aderencia: '' as const, nota60: true, abertas: true, estudio: false, descartadas: false, q: '', ordem: 'nota' as const };
    expect(filtrarRadar(L, f).map((o) => o.id)).toEqual(['pncp-1']);
    expect(filtrarRadar(L, { ...f, nota60: false }).map((o) => o.id)).toEqual(['pncp-1', 'pncp-2', 'pncp-3']);
    expect(filtrarRadar(L, { ...f, nota60: false, frente: 'Comunicação visual e sinalização' }).map((o) => o.id)).toEqual(['pncp-2']);
    expect(filtrarRadar(L, { ...f, nota60: false, q: 'câmara' }).map((o) => o.id)).toEqual(['pncp-2']);
  });

  it('Disputar manda para a carteira e Descartar grava o motivo', async () => {
    const db = bancoFalso(base);
    const { raiz } = await montar('licitacoes', db);
    expect(raiz.querySelectorAll('.lc-it').length).toBe(1);
    expect(raiz.textContent).toContain('perfil 2026-11-10e');
    raiz.querySelector<HTMLButtonElement>('[data-disp="pncp-1"]')!.click();
    await espera();
    expect(db.dados.b2g['pncp-1']).toMatchObject({ carteira: true, etapa: 'Triagem', triagem: 'Disputar' });
    raiz.querySelector<HTMLButtonElement>('[data-tg="nota60"]')!.click();
    const sel = raiz.querySelector<HTMLSelectElement>('[data-desc="pncp-3"]')!;
    sel.value = 'Fora do escopo';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await espera();
    expect(db.dados.b2g['pncp-3']).toMatchObject({ triagem: 'Descartar', motivoDescarte: 'Fora do escopo' });
    expect(raiz.querySelector('[data-desc="pncp-3"]')).toBeNull(); // sai do radar
  });

  it('a carteira avança de etapa e a habilitação alterna o status', async () => {
    const db = bancoFalso({ ...base, b2g: { ...base.b2g, 'pncp-1': { ...base.b2g['pncp-1'], carteira: true, etapa: 'Triagem' } } });
    const { raiz } = await montar('licitacoes', db);
    raiz.querySelector<HTMLButtonElement>('[data-aba="carteira"]')!.click();
    expect(raiz.querySelectorAll('.lc-card').length).toBe(1);
    raiz.querySelector<HTMLButtonElement>('[data-et="pncp-1"][data-d="1"]')!.click();
    await espera();
    expect(db.dados.b2g['pncp-1'].etapa).toBe('Go / No-go');
    raiz.querySelector<HTMLButtonElement>('[data-aba="habilitacao"]')!.click();
    await espera();
    expect(raiz.querySelector('[data-hab="cria"][data-req="fgts"]')?.textContent).toBe('Em dia');
    raiz.querySelector<HTMLButtonElement>('[data-hab="cria"][data-req="cnae"]')!.click();
    await espera();
    expect((db.dados.habilitacao.cria as any).req.cnae.status).toBe('ok');
    expect((db.dados.habilitacao.cria as any).req.fgts.validade).toBe('2099-12-31'); // não perde os outros
  });
});

describe('Captação', () => {
  const inicial = () => ({
    alvos: {
      'al-1': { nome: 'Agência Um', perfil: 'independente', status: 'Mapeado', proximoPasso: 'Pesquisar', prazo: '2000-01-01', criadoEm: '2026-01-01' },
      'al-2': { nome: 'Agência Dois', perfil: 'publica', status: 'Conversa', criadoEm: '2026-01-02' },
      'al-3': { nome: 'Fora', perfil: 'rede', status: 'Descartado', criadoEm: '2026-01-03' },
    },
    b2g: { 'pncp-1': { orgao: 'Prefeitura X', uf: 'SP', objeto: 'Contratação de agência de publicidade e propaganda', score: 60 } },
    config: { descontos: { valores: { '1': 10 } } },
  });
  beforeEach(() => { try { localStorage.clear(); } catch { /* */ } });

  it('mostra o quadro por etapa, sem os descartados, e marca o vencido', async () => {
    const { raiz } = await montar('captacao', bancoFalso(inicial()));
    expect(raiz.querySelector('#cp-tab-alvos')?.textContent).toBe('Alvos (2)');
    const cols = raiz.querySelectorAll('.lc-col');
    expect(cols.length).toBe(6);
    expect(cols[0].textContent).toContain('Agência Um');
    expect(cols[3].textContent).toContain('Agência Dois');
    expect(raiz.textContent).not.toContain('Fora');
    expect(raiz.querySelector('.cp-venc')?.textContent).toContain('Vencido');
  });

  it('cria um alvo pelo formulário e avança de etapa com aviso à equipe', async () => {
    const db = bancoFalso(inicial());
    const { raiz } = await montar('captacao', db);
    raiz.querySelector<HTMLButtonElement>('#cpN')!.click();
    raiz.querySelector<HTMLInputElement>('#n_nome')!.value = 'Agência Nova';
    raiz.querySelector<HTMLFormElement>('#cpNovo')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await espera();
    const novo = Object.values(db.dados.alvos).find((a) => a.nome === 'Agência Nova')!;
    expect(novo.status).toBe('Mapeado');
    expect(novo.proximoPasso).toBe('Pesquisar quem decide produção');
    raiz.querySelector<HTMLButtonElement>('[data-mv="al-2"][data-para="Proposta"]')!.click();
    await espera();
    expect(db.dados.alvos['al-2'].status).toBe('Proposta');
    expect(Object.values(db.dados.notificacoes || {})[0]?.titulo).toBe('Proposta para Agência Dois');
  });

  it('sinal de licitação de publicidade vira alvo de conta pública', async () => {
    const db = bancoFalso(inicial());
    const { raiz } = await montar('captacao', db);
    raiz.querySelector<HTMLButtonElement>('[data-aba="achar"]')!.click();
    expect(raiz.querySelectorAll('.cp-sinal').length).toBe(1);
    raiz.querySelector<HTMLButtonElement>('[data-sinal="0"]')!.click();
    await espera();
    const a = Object.values(db.dados.alvos).find((x) => x.nome === 'Prefeitura X · agência vencedora')!;
    expect(a.perfil).toBe('publica');
    expect(raiz.querySelectorAll('.cp-sinal').length).toBe(0);
  });

  it('triagem descarta com motivo e a proposta soma com o desconto da tabela', async () => {
    const db = bancoFalso(inicial());
    const { raiz } = await montar('captacao', db);
    raiz.querySelector<HTMLButtonElement>('[data-abre="al-1"]')!.click();
    const d = document.querySelector('#cpD')!;
    const q = d.querySelector<HTMLInputElement>('#pp_q')!;
    q.value = 'anuncio jornal criacao';
    q.dispatchEvent(new Event('input'));
    d.querySelector<HTMLButtonElement>('[data-add]')!.click();
    expect(d.querySelectorAll('.cp-itens tbody tr').length).toBe(1);
    d.querySelector<HTMLButtonElement>('#pp_salva')!.click();
    await espera();
    const pr = db.dados.alvos['al-1'].proposta as { itens: { unit: number }[] };
    expect(pr.itens.length).toBe(1);
    expect(pr.itens[0].unit).toBeGreaterThan(0);
    const sel = d.querySelector<HTMLSelectElement>('#t_desc')!;
    sel.value = 'Momento errado';
    sel.dispatchEvent(new Event('change'));
    await espera();
    expect(db.dados.alvos['al-1']).toMatchObject({ status: 'Descartado', triagem: 'Descartar', motivoDescarte: 'Momento errado' });
  });
});

describe('Vencedores', () => {
  const contrato = (id: string, o: Record<string, unknown> = {}) => ({ id, link: 'https://pncp.gov.br/x', orgao: 'Prefeitura A', cnpjOrgao: '111', esfera: 'Municipal', uf: 'SP', fornecedor: 'Agência Pública Ltda', cnpj: '12345678000199', objeto: 'Serviços de publicidade', frente: 'publicidade', valor: 500000, inicio: '2025-01-01', fim: '2026-12-01', status: 'vigente', ...o });
  const mapa = {
    meta: { geradoEm: '2026-11-05', fonte: 'PNCP', periodo: ['2024-11-05', '2026-11-04'], cobertura: { dias: 730, lidos: 1000 }, noEscopo: 3, empresas: 2, orgaos: 1, valorTotal: 900000, vigentes: 2 },
    precos: { publicidade: { nome: 'Publicidade · agência com conta pública', craft: 0.9, nContratos: 2, vigentes: 2, p25: 1, mediana: 2, p75: 3, p90: 4, total: 900000 }, grafica: { nome: 'Produção gráfica', craft: 0.4, nContratos: 1, vigentes: 0, p25: 1, mediana: 2, p75: 3, p90: 4, total: 1 } },
    calendario: [{ mes: '2026-12', contratos: 2, valor: 900000 }], modalidades: [{ modalidade: 'Dispensa', contratos: 1, valor: 100 }],
    empresas: [
      { cnpj: '12345678000199', raiz: '12345678', cnpjF: '12.345.678/0001-99', nome: 'Agência Pública Ltda', tipo: 'Agência', segmento: 'Agência com conta pública', prioridade: 90, contratos: 2, vigentes: 2, valorTotal: 900000, valorVigente: 900000, frentePrincipal: 'publicidade', frentes: { publicidade: 2 }, ufs: { SP: 2 }, orgaos: ['Prefeitura A'], nOrgaos: 1, proximoFim: '2026-12-01', maior: 'c1' },
      { cnpj: '99999999000100', raiz: '99999999', cnpjF: '99.999.999/0001-00', nome: 'Gráfica Velha', tipo: 'Gráfica', segmento: 'Gráfica e comunicação visual', prioridade: 40, contratos: 1, vigentes: 0, valorTotal: 1, valorVigente: 0, frentePrincipal: 'grafica', frentes: { grafica: 1 }, ufs: { RJ: 1 }, orgaos: ['Câmara B'], nOrgaos: 1, proximoFim: '' },
    ],
    orgaos: [{ cnpj: '111', nome: 'Prefeitura A', uf: 'SP', esfera: 'Municipal', poder: 'Executivo', contratos: 2, valorTotal: 900000, valorCraft: 900000, frentes: { publicidade: 2 }, fornecedores: 1, vencendo: 2, valorVencendo: 900000, proximoVencimento: '2026-12-01' }],
    contratos: [contrato('c1', { valor: 400000 }), contrato('c2'), contrato('c3', { fornecedor: 'Gráfica Velha', cnpj: '99999999000100', status: 'encerrado', frente: 'grafica', valor: 1, orgao: 'Câmara B', uf: 'RJ' })],
  };
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* */ }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(mapa), { status: 200 })));
  });

  it('lista quem abordar por segmento e filtra só vigentes', async () => {
    const { raiz } = await montar('vencedores', bancoFalso({}));
    expect(raiz.querySelectorAll('#vcK .k').length).toBe(4);
    expect(raiz.querySelectorAll('.vc-linha').length).toBe(1);
    expect(raiz.querySelector('.vc-linha')?.textContent).toContain('Agência Pública Ltda');
    // a gráfica sem contrato vigente só aparece ao desmarcar "Só vigentes"
    expect(raiz.querySelector('[data-seg="Gráfica e comunicação visual"]')).toBeNull();
    const vig = raiz.querySelector<HTMLInputElement>('#vcVig')!;
    vig.checked = false; vig.dispatchEvent(new Event('change', { bubbles: true }));
    raiz.querySelector<HTMLButtonElement>('[data-seg="Gráfica e comunicação visual"]')!.click();
    expect(raiz.querySelector('.vc-linha')?.textContent).toContain('Gráfica Velha');
  });

  it('empresa vira alvo na Captação e órgão vai ao funil', async () => {
    const db = bancoFalso({ contratos_novos: { c9: contrato('c9', { fornecedor: 'Produtora Nova', cnpj: '55555555000155', segmento: 'Produtora concorrente', valor: 10 }) } });
    const { raiz } = await montar('vencedores', db);
    expect(raiz.querySelector('#vcK')?.textContent).toContain('1 contrato(s) novo(s)');
    raiz.querySelector<HTMLButtonElement>('[data-emp="12345678000199"]')!.click();
    const d = document.querySelector('#vcD')!;
    expect(d.textContent).toContain('Contratos no período (2)');
    d.querySelector<HTMLButtonElement>('#vcAlvo')!.click();
    await espera();
    const a = Object.values(db.dados.alvos)[0];
    expect(a).toMatchObject({ nome: 'Agência Pública Ltda', perfil: 'publica', status: 'Mapeado', origem: 'Mapa de vencedores' });
    (d as HTMLDialogElement).close();
    raiz.querySelector<HTMLButtonElement>('[data-visao="orgaos"]')!.click();
    raiz.querySelector<HTMLButtonElement>('[data-org="111"]')!.click();
    d.querySelector<HTMLButtonElement>('#vcFunil')!.click();
    await espera();
    expect(Object.values(db.dados.pipeline)[0]).toMatchObject({ eixo: 'Público', titulo: 'Recompra · Prefeitura A', estagio: 'Identificada' });
  });

  it('contratos filtram por busca e preços mostram a tabela', async () => {
    const { raiz } = await montar('vencedores', bancoFalso({}));
    raiz.querySelector<HTMLButtonElement>('[data-visao="contratos"]')!.click();
    expect(raiz.querySelectorAll('.vc-ct tbody tr').length).toBe(2);
    const q = raiz.querySelector<HTMLInputElement>('#vcQ')!;
    q.value = 'nada'; q.dispatchEvent(new Event('input', { bubbles: true }));
    expect(raiz.querySelector('.empty h2')?.textContent).toBe('Nenhum contrato com esses filtros');
    raiz.querySelector<HTMLButtonElement>('[data-visao="precos"]')!.click();
    expect(raiz.querySelectorAll('.vc-t tbody tr').length).toBe(2);
    expect(raiz.querySelectorAll('.vc-mes').length).toBe(1);
  });
});

describe('Contas e agências', () => {
  const dias = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const mercado = {
    meta: { atualizado: '2026-11-06', movimentos: 2, agencias: 2, mudancas2025: 280, fonteMudancas2025: 'https://x', fontes: { 'Fonte A': 'https://a' } },
    agencias: [
      { nome: 'Agência Nova', cenp: 3, uf: 'SP', fonteRanking: 'https://r', contas: [{ data: dias(10), anunciante: 'Marca X', escopo: 'Conta digital', fonte: 'https://f1', tipo: 'conquista', anterior: '' }], perdeu: [], ultima: dias(10), tipo: 'Criação / full service', rede: false, prioridade: 90 },
      { nome: 'Agência de PR', cenp: null, uf: 'RJ', fonteRanking: '', contas: [{ data: dias(300), anunciante: 'Marca Y', escopo: 'PR', fonte: 'https://f2', tipo: 'conquista', anterior: '' }], perdeu: [], ultima: dias(300), tipo: 'Relações públicas', rede: false, prioridade: 30 },
    ],
    movimentos: [
      { data: dias(10), anunciante: 'Marca X', agencia: 'Agência Nova', anterior: '', escopo: 'Conta digital', fonte: 'https://f1', tipo: 'conquista' },
      { data: dias(300), anunciante: 'Marca Y', agencia: 'Agência de PR', anterior: '', escopo: 'PR', fonte: 'https://f2', tipo: 'conquista' },
    ],
    anunciantes: [{ pos: 1, pos2024: 3, nome: 'Genomma', valor2025: 1352312, valor2024: 1213400, variacao: 11, agencias: [], fonte: 'https://m' }],
  };
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* */ }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(mercado), { status: 200 })));
  });

  it('movimentações filtram por período e tipo de agência, e somam as da Captação semanal', async () => {
    const db = bancoFalso({ movimentos: { m1: { data: dias(5), anunciante: 'Marca Z', agencia: 'Agência Recém', fonte: 'https://f3' }, m2: { data: dias(5), anunciante: 'Sem fonte', agencia: 'Ag' } } });
    const { raiz } = await montar('mercado', db);
    expect(raiz.querySelectorAll('.mk-mv').length).toBe(2);
    expect(raiz.querySelector('.mk-mv')?.textContent).toContain('Marca Z');
    const p = raiz.querySelector<HTMLSelectElement>('#mkP')!;
    p.value = 'todos'; p.dispatchEvent(new Event('change', { bubbles: true }));
    expect(raiz.querySelectorAll('.mk-mv').length).toBe(2);
    const c = raiz.querySelector<HTMLInputElement>('#mkC')!;
    c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true }));
    expect(raiz.querySelectorAll('.mk-mv').length).toBe(3);
  });

  it('agência abre com a situação certa e vira alvo na Captação', async () => {
    const db = bancoFalso({});
    const { raiz } = await montar('mercado', db);
    raiz.querySelector<HTMLButtonElement>('[data-visao="agencias"]')!.click();
    expect(raiz.querySelectorAll('.vc-linha').length).toBe(1);
    raiz.querySelector<HTMLButtonElement>('[data-ag="Agência Nova"]')!.click();
    const d = document.querySelector('#mkD')!;
    expect(d.textContent).toContain('acabou de ganhar uma conta');
    d.querySelector<HTMLButtonElement>('#mkAlvo')!.click();
    await espera();
    expect(Object.values(db.dados.alvos)[0]).toMatchObject({ nome: 'Agência Nova', perfil: 'independente', origem: 'Contas e agências', proximoPasso: 'Escrever para a produção oferecendo uma frente da primeira campanha' });
  });
});

describe('Funil e receita', () => {
  const inicial = () => ({
    pipeline: {
      'fn-1': { eixo: 'Privado', titulo: 'Fee Vivo', estagio: 'Contato', proximoPasso: 'Ligar', valor: 50000 },
      'fn-2': { eixo: 'Público', titulo: 'Ata SP', estagio: 'Perdida', proximoPasso: 'x' },
    },
    linhas: { 'ln-1': { nome: 'Audiovisual', grupo: 'Atual', receita12m: 600, meta12m: 500, ordem: 1 }, 'ln-2': { nome: 'Comunicação visual', grupo: 'Nova', receita12m: 400, meta12m: 500, ordem: 2 } },
    projetos: { p1: { cliente: 'Cliente A', canal: 'Privado', orcamentos: [{ status: 'Aprovado internamente', itens: [{ qtd: 1, unit: 100000 }] }] } },
  });

  it('mostra receita por canal, funil e HHI das linhas', async () => {
    const { raiz } = await montar('funil', bancoFalso(inicial()));
    const k = raiz.querySelectorAll('#fnK .k');
    expect(k[0].querySelector('b')?.textContent).toBe('100%');
    expect(k[3].textContent).toContain('Cliente A');
    expect(k[4].querySelector('b')?.textContent).toBe('1');
    expect(raiz.querySelectorAll('.fn-quadro .lc-col').length).toBe(5);
    expect(raiz.querySelector('.fn-perdidas summary')?.textContent).toBe('Perdidas (1)');
    // HHI hoje: 60² + 40² = 5200; na meta: 50² + 50² = 5000
    const m = raiz.querySelectorAll('#fnMK .k b');
    expect(m[2].textContent).toBe('5.200');
    expect(m[3].textContent).toBe('5.000');
  });

  it('cria oportunidade, move de etapa, leva estratégia ao funil e salva valor da linha', async () => {
    const db = bancoFalso(inicial());
    const { raiz } = await montar('funil', db);
    raiz.querySelector<HTMLButtonElement>('#fnNova')!.click();
    raiz.querySelector<HTMLInputElement>('#fo_tit')!.value = 'Nova ata';
    raiz.querySelector<HTMLInputElement>('#fo_passo')!.value = 'Ler edital';
    raiz.querySelector<HTMLInputElement>('#fo_val')!.value = '1.234,50';
    raiz.querySelector('#fnF')!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await espera();
    expect(Object.values(db.dados.pipeline).find((o) => o.titulo === 'Nova ata')).toMatchObject({ estagio: 'Identificada', valor: 1234.5 });
    raiz.querySelector<HTMLButtonElement>('[data-mv="fn-1"][data-para="Proposta"]')!.click();
    await espera();
    expect(db.dados.pipeline['fn-1'].estagio).toBe('Proposta');
    raiz.querySelector<HTMLButtonElement>('[data-ac="0"]')!.click();
    await espera();
    expect(Object.values(db.dados.pipeline).some((o) => o.titulo === 'Pacote Reuse/Remaster' && o.origem === 'Estratégia')).toBe(true);
    const inp = raiz.querySelector<HTMLInputElement>('[data-ln="ln-1"][data-campo="meta12m"]')!;
    inp.value = '900'; inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await espera();
    expect(db.dados.linhas['ln-1'].meta12m).toBe(900);
  });
});

describe('SWOT e frentes', () => {
  const inicial = () => ({
    swot: {
      's-a': { id: 's-a', q: 'S', texto: 'Ouro em Cannes', evidencia: 'diretório', fonte: '', certeza: 'Fonte pública', peso: 3, origem: 'Pesquisa', em: '2026-01-01' },
      's-b': { id: 's-b', q: 'S', texto: 'Núcleos especializados', evidencia: '', fonte: '', certeza: 'Hipótese', peso: 2, origem: 'Equipe', em: '2026-01-02' },
      'o-a': { id: 'o-a', q: 'O', texto: 'Mais formatos', evidencia: '', fonte: '', certeza: 'Hipótese', peso: 2, origem: 'Equipe', em: '2026-01-01' },
    },
    tows: { 't-1': { id: 't-1', tipo: 'SO', titulo: 'Craft em dólar', texto: 'x', liga: ['s-a', 'o-a'], passo: 'Reel', origem: 'Pesquisa', em: '2026-01-01' } },
    frentes: {
      'f-1': { nome: 'Frente baixa', tese: 't', tipo: 'Projeto', potencial: 1, esforco: 5, aderencia: 1, status: 'Hipótese' },
      'f-2': { nome: 'Frente alta', tese: 't', tipo: 'Recorrente', potencial: 5, esforco: 1, aderencia: 5, status: 'Hipótese' },
    },
    b2g: { o1: { score: 70, carteira: true }, o2: { score: 10 } },
  });

  it('monta a matriz com códigos por peso, o sinal do radar e frentes por nota', async () => {
    const { raiz } = await montar('estrategia', bancoFalso(inicial()));
    const cods = [...raiz.querySelectorAll('.q-S .es-cod')].map((x) => x.textContent);
    expect(cods).toEqual(['S1', 'S2']);
    expect(raiz.querySelector('.q-S .es-item')?.textContent).toContain('Ouro em Cannes');
    expect(raiz.querySelector('.es-tw .num')?.textContent).toBe('S1 + O1');
    expect(raiz.querySelector('#esS')?.textContent).toContain('1 oportunidades públicas com nota 60+');
    const frs = [...raiz.querySelectorAll('.es-fr-h b')].map((x) => x.textContent);
    expect(frs).toEqual(['Frente alta', 'Frente baixa']);
    expect(raiz.querySelector('.es-fr-h .es-nota')?.textContent).toBe('100');
  });

  it('adiciona item, leva sinal, vira frente e carrega a base da pesquisa', async () => {
    const db = bancoFalso(inicial());
    const { raiz } = await montar('estrategia', db);
    const f = raiz.querySelector<HTMLFormElement>('.es-add[data-q="T"]')!;
    f.querySelector('input')!.value = 'Automação de formatos';
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await espera();
    expect(Object.values(db.dados.swot).some((i) => i.q === 'T' && i.texto === 'Automação de formatos' && i.certeza === 'Hipótese')).toBe(true);
    raiz.querySelector<HTMLButtonElement>('[data-sinal="0"]')!.click();
    await espera();
    expect(Object.values(db.dados.swot).some((i) => i.certeza === 'Dado do Studio' && i.origem === 'Studio')).toBe(true);
    raiz.querySelector<HTMLButtonElement>('[data-frente="t-1"]')!.click();
    await espera();
    expect(Object.values(db.dados.frentes).find((x) => x.nome === 'Craft em dólar')).toMatchObject({ tipo: 'Projeto', tows: 'SO', ativos: 'S1 + O1', origem: 'SWOT' });
    expect(db.dados.tows['t-1'].frenteId).toBeTruthy();
    raiz.querySelector<HTMLButtonElement>('#esBase')!.click();
    await espera(60);
    expect(db.dados.swot['sw-s3'].texto).toContain('três empresas');
    expect(JSON.stringify(db.dados.swot)).not.toMatch(/eventos/i);
  });
});
