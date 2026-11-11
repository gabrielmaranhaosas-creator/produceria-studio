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
  history.replaceState(null, '', location.pathname); // a aba fica no endereço: cada teste começa sem aba
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

describe('Tabela de serviços', () => {
  it('filtra, salva desconto por linha e aplica em lote', async () => {
    const db = bancoFalso({ config: { descontos: { valores: { '1': 10 } } } });
    const { raiz } = await montar('tabela', db);
    expect(raiz.querySelectorAll('#tbB tr').length).toBe(100);
    expect(raiz.querySelector('#tbN')?.textContent).toBe('709 serviço(s) · página 1 de 8');
    expect(raiz.querySelector('#tbK .k:nth-child(2) b')?.textContent).toBe('1');
    const q = raiz.querySelector<HTMLInputElement>('#tbQ')!;
    q.value = 'anuncio jornal criacao'; q.dispatchEvent(new Event('input', { bubbles: true }));
    const n = raiz.querySelectorAll('#tbB tr').length;
    expect(n).toBeGreaterThan(0); expect(n).toBeLessThan(10);
    const inp = raiz.querySelector<HTMLInputElement>('#tbB [data-desc]')!;
    inp.value = '12,5'; inp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await espera();
    expect((db.dados.config.descontos.valores as Record<string, number>)[inp.dataset.desc!]).toBe(12.5);
    const l = raiz.querySelector<HTMLInputElement>('#tbL')!;
    l.value = '20'; l.dispatchEvent(new Event('input', { bubbles: true }));
    raiz.querySelector<HTMLButtonElement>('#tbAplicar')!.click();
    await espera();
    const v = db.dados.config.descontos.valores as Record<string, number>;
    expect(Object.values(v).filter((x) => x === 20).length).toBe(n);
    expect(v['1']).toBe(10);
  });
});

describe('Rotinas do Claude', () => {
  it('lista as rotinas pelo conector, roda e pausa', async () => {
    const chamadas: [string, Record<string, unknown>][] = [];
    const rotinas = [
      { id: 'r1', name: 'Cérebro de licitações · varredura diária', enabled: true, cron_expression: 'CRON_TZ=America/Sao_Paulo 17 6 * * *', last_run: { status: 'ROUTINE_RUN_STATUS_SUCCEEDED', fired_at: '2026-11-10T09:17:00Z' } },
      { id: 'r2', name: 'Relatório de craft · mensal', enabled: false, cron_expression: 'CRON_TZ=America/Sao_Paulo 13 8 1 * *' },
    ];
    const mcp = { callTool: async (_s: string, f: string, a: Record<string, unknown>) => { chamadas.push([f, a]); return { payload: f === 'list_triggers' ? { data: rotinas } : {} }; } };
    const db = bancoFalso({ cerebro: { status: { ultimaVarredura: '2026-11-10T06:21:15-03:00', lidos: 5926, novos: 121 } } });
    vi.resetModules();
    (window as any).claude = { use: async (n: string) => (n === 'db' ? db.banco : n === 'mcp' ? mcp : null) };
    const mod = await import('../src/paginas/rotinas');
    const raiz = document.createElement('div'); document.body.appendChild(raiz);
    mod.montar(raiz); await espera();
    const its = raiz.querySelectorAll('.ro-it');
    expect(its.length).toBe(2);
    expect(its[0].textContent).toContain('Todo dia às 06:17');
    expect(its[0].textContent).toContain('Última: deu certo');
    expect(its[1].textContent).toContain('Dia 1 às 08:13');
    expect(raiz.querySelector('#roR')?.textContent).toContain('121');
    raiz.querySelector<HTMLButtonElement>('[data-rodar="r1"]')!.click(); await espera();
    expect(chamadas.some(([f, a]) => f === 'fire_trigger' && a.trigger_id === 'r1')).toBe(true);
    expect(Object.values(db.dados.notificacoes || {})[0]?.titulo).toContain('foi acionada');
    raiz.querySelector<HTMLButtonElement>('[data-pausa="r2"]')!.click(); await espera();
    expect(chamadas.some(([f, a]) => f === 'update_trigger' && a.trigger_id === 'r2' && a.enabled === true)).toBe(true);
  });

  it('sem o conector, explica onde as rotinas aparecem', async () => {
    const { raiz } = await montar('rotinas', bancoFalso({}));
    expect(raiz.querySelector('#roE')?.textContent).toContain('Studio aberto no Claude');
  });
});

describe('Ajustes e dados', () => {
  it('conta as coleções, troca o tema e remove exemplos com confirmação', async () => {
    const db = bancoFalso({ alvos: { a: { nome: 'A' }, b: { nome: 'B' } }, projetos: { p1: { exemplo: true }, p2: {} } });
    const { raiz } = await montar('ajustes', db);
    expect(raiz.querySelector('#ajModo')?.textContent).toBe('Compartilhados');
    const ks = [...raiz.querySelectorAll('#ajN .k')];
    expect(ks.find((k) => k.textContent?.includes('Alvos'))?.querySelector('b')?.textContent).toBe('2');
    raiz.querySelector<HTMLButtonElement>('[data-tema="dark"]')!.click();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    raiz.querySelector<HTMLButtonElement>('[data-tema="sistema"]')!.click();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    const ex = raiz.querySelector<HTMLButtonElement>('#ajEx')!;
    expect(ex.hidden).toBe(false);
    ex.click(); await espera();
    expect(db.dados.projetos.p1).toBeTruthy();
    ex.click(); await espera();
    expect(db.dados.projetos.p1).toBeUndefined();
    expect(db.dados.projetos.p2).toBeTruthy();
  });
});

describe('Oficina', () => {
  it('Gráfica calcula aproveitamento, salva a ficha e monta o pacote do job', async () => {
    const { aproveitamento, folhasNecessarias, pacoteJob, novaFicha } = await import('../src/paginas/grafica');
    // A4 com sangria (216×303) numa BB 660×960 com 10 mm de pinça: 3 × 3 = 9
    expect(aproveitamento(216, 303, 660, 960, 10)).toEqual({ n: 9, girado: false });
    expect(folhasNecessarias(1000, 9, 5)).toBe(117);
    const f = { ...novaFicha(), peca: 'Outdoor', substrato: 'lona' };
    expect(pacoteJob(f).ficha.dpiMin).toBe(100);
    const db = bancoFalso({});
    const { raiz } = await montar('grafica', db);
    expect(raiz.querySelector('nav.oficina [aria-current="page"]')?.textContent).toBe('Gráfica');
    const p = raiz.querySelector<HTMLInputElement>('#gf-peca')!;
    p.value = 'Folder A4'; p.dispatchEvent(new Event('input', { bubbles: true }));
    raiz.querySelector<HTMLButtonElement>('#grSalvar')!.click(); await espera();
    expect(Object.values(db.dados.fichas)[0]).toMatchObject({ peca: 'Folder A4', larguraMm: 210, tiragem: 1000 });
    expect(raiz.querySelector('#grS')?.textContent).toContain('Folder A4');
  });

  it('Bancada orça o desdobramento com o desconto da tabela e registra cotação', async () => {
    const { adaptacoes, totalDesdobramento } = await import('../src/paginas/bancada');
    const a = adaptacoes('', '')[0];
    expect(a.etapa).toBe('ADAPTAÇÃO');
    expect(totalDesdobramento({ [a.id]: 2 }, { [a.id]: 10 }).total).toBeCloseTo(a.ref * 2 * 0.9, 2);
    try { localStorage.clear(); } catch { /* */ }
    const db = bancoFalso({});
    const { raiz } = await montar('bancada', db);
    raiz.querySelector<HTMLButtonElement>('[data-aba="cotacao"]')!.click();
    raiz.querySelector<HTMLInputElement>('#ctI')!.value = '500 folders';
    for (const [i, n, v] of [[0, 'Gráfica A', '2,50'], [1, 'Gráfica B', '1,90']] as const) {
      const nn = raiz.querySelector<HTMLInputElement>(`#ctN${i}`)!; nn.value = n; nn.dispatchEvent(new Event('input', { bubbles: true }));
      const vv = raiz.querySelector<HTMLInputElement>(`#ctV${i}`)!; vv.value = v; vv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(raiz.querySelector('#ctT')?.textContent).toContain('Gráfica B');
    raiz.querySelector<HTMLButtonElement>('#ctB')!.click(); await espera();
    expect(Object.values(db.dados.cotacoes)[0]).toMatchObject({ item: '500 folders', escolhido: 'Gráfica B' });
  });

  it('Biblioteca lista e filtra por cliente; Plugins oferece os 4 arquivos do Bridge', async () => {
    const db = bancoFalso({ biblioteca: {
      a: { nome: 'guia.pdf', categoria: 'Guia de marca', cliente: 'Cliente X', em: '2026-11-01', url: 'https://x/a' },
      b: { nome: 'certidao.pdf', categoria: 'Certidões e habilitação', em: '2026-11-02', url: 'https://x/b' },
    } });
    const { raiz } = await montar('biblioteca', db);
    expect(raiz.querySelectorAll('.bi-it').length).toBe(2);
    raiz.querySelector<HTMLButtonElement>('[data-fcli="Hub Produceria"]')!.click();
    expect(raiz.querySelectorAll('.bi-it').length).toBe(1);
    expect(raiz.querySelector('#biU')?.textContent).toContain('quem edita o Studio');
    const { ARQUIVOS_BRIDGE } = await import('../src/paginas/plugins');
    expect(ARQUIVOS_BRIDGE.map(([n]) => n)).toEqual(['manifest.json', 'index.html', 'main.js', 'LEIAME.md']);
    expect(JSON.parse(ARQUIVOS_BRIDGE[0][1]).id).toBe('br.com.produceria.bridge');
  });
});

describe('Ferramentas da casa (Oficina)', () => {
  const pngMin = (w: number, h: number) => {
    const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    const ch = (t: string, d: number[]) => [...u32(d.length), ...[...t].map((c) => c.charCodeAt(0)), ...d, 0, 0, 0, 0];
    return new Uint8Array([0x89, 80, 78, 71, 13, 10, 26, 10, ...ch('IHDR', [...u32(w), ...u32(h), 8, 2, 0, 0, 0]), ...ch('pHYs', [...u32(2835), ...u32(2835), 1]), ...ch('IEND', [])]);
  };
  const soltar = (el: Element, files: File[]) => { const ev = new Event('drop', { bubbles: true }) as any; ev.dataTransfer = { files }; el.dispatchEvent(ev); };

  it('Ateliê abre a Oficina com os princípios e leva às ferramentas', async () => {
    const { raiz } = await montar('atelie', bancoFalso({}));
    expect(raiz.querySelector('nav.oficina [aria-current="page"]')?.textContent).toBe('Ateliê');
    expect(raiz.querySelectorAll('.at-prin li').length).toBe(4);
    const links = [...raiz.querySelectorAll<HTMLAnchorElement>('.at-card')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(expect.arrayContaining(['#desdobra', '#entrega/checar', '#entrega/nomes', '#entrega/entrega', '#grafica']));
  });

  it('Desdobra lista os formatos, nomeia no padrão e aceita formato próprio', async () => {
    try { localStorage.clear(); } catch { /* */ }
    const { raiz, desmontar } = await montar('desdobra', bancoFalso({}));
    expect(raiz.querySelectorAll('#ddFmts input[type=checkbox]').length).toBe(15);
    expect(raiz.querySelectorAll('#ddFmts input:checked').length).toBe(4);
    expect(raiz.querySelector<HTMLButtonElement>('#ddZip')!.disabled).toBe(true);
    const cli = raiz.querySelector<HTMLInputElement>('#ddCli')!; cli.value = 'Sicredi'; cli.dispatchEvent(new Event('input'));
    const camp = raiz.querySelector<HTMLInputElement>('#ddCamp')!; camp.value = 'Natal Feliz 2026'; camp.dispatchEvent(new Event('input'));
    expect(raiz.querySelector('#ddEx')?.textContent).toBe('Ex.: Sicredi_Natal-Feliz-2026_stories_v01.png');
    raiz.querySelector<HTMLInputElement>('#ddNovoT')!.value = 'capa face:820x312';
    raiz.querySelector<HTMLFormElement>('#ddNovo')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(raiz.querySelector('#ddFmts')?.textContent).toContain('capa-face');
    raiz.querySelector<HTMLInputElement>('#ddNovoT')!.value = '20000x100';
    raiz.querySelector<HTMLFormElement>('#ddNovo')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(raiz.querySelector('#ddLive')?.textContent).toContain('8000 px');
    (desmontar as () => void)();
  });

  it('Conferência: checa o arquivo, gera nomes e só entrega no padrão', async () => {
    location.hash = '#entrega/checar';
    const { raiz, desmontar } = await montar('entrega', bancoFalso({}));
    soltar(raiz.querySelector('#etCZ')!, [new File([pngMin(1080, 1920)], 'arte final.png', { type: 'image/png' })]);
    await espera(60);
    const it1 = raiz.querySelector('#etCL .et-it')!.textContent!;
    expect(it1).toContain('1.080 × 1.920 px');
    expect(it1).toContain('72 ppi');
    expect(it1).toContain('Nome fora do padrão');
    expect(it1).toContain('arte final_v02.png');

    raiz.querySelector<HTMLButtonElement>('[data-aba="nomes"]')!.click();
    expect(location.hash).toBe('#entrega/nomes');
    const f = raiz.querySelector<HTMLFormElement>('#etN')!;
    (f.elements.namedItem('cliente') as HTMLInputElement).value = 'Sicredi';
    (f.elements.namedItem('campanha') as HTMLInputElement).value = 'Natal';
    f.dispatchEvent(new Event('input'));
    expect(raiz.querySelectorAll('#etNL li').length).toBe(8);
    expect(raiz.querySelector('#etNL li')?.textContent).toBe('Sicredi_Natal_stories_v01.psd');
    expect(raiz.querySelector('#etArv')?.textContent).toContain('Sicredi_Natal/');

    raiz.querySelector<HTMLButtonElement>('[data-aba="entrega"]')!.click();
    soltar(raiz.querySelector('#etEZ')!.closest('.et-sec')!.querySelector('label.bi-zona')!, [
      new File([pngMin(1080, 1920)], 'Sicredi_Natal_stories_v01.png', { type: 'image/png' }),
      new File(['x'], 'rascunho.png', { type: 'image/png' }),
    ]);
    await espera(60);
    expect(raiz.querySelectorAll('#etEL li').length).toBe(2);
    expect(raiz.querySelector<HTMLButtonElement>('#etEZ')!.disabled).toBe(true);
    expect(raiz.querySelector('#etES')?.textContent).toContain('1 fora do padrão');
    raiz.querySelector<HTMLButtonElement>('[data-tira="rascunho.png"]')!.click();
    expect(raiz.querySelector<HTMLButtonElement>('#etEZ')!.disabled).toBe(false);
    const salvos: { filename: string; data: unknown }[] = [];
    (window as any).claude = { use: async (n: string) => (n === 'downloads' ? { save: async (o: any) => { salvos.push(o); return { status: 'saved' }; } } : null) };
    raiz.querySelector<HTMLInputElement>('#etEN')!.value = 'Sicredi_Natal_entrega_v01';
    raiz.querySelector<HTMLButtonElement>('#etEZ')!.click();
    await espera(120);
    expect(salvos[0]?.filename).toBe('Sicredi_Natal_entrega_v01.zip');
    const z = salvos[0].data as Uint8Array;
    expect(new TextDecoder().decode(z)).toContain('manifesto_entrega.csv');
    expect(new TextDecoder().decode(z)).toContain('Sicredi_Natal_stories_v01.png;1080x1920;');
    (desmontar as () => void)();
  });
});

describe('Agentes', () => {
  it('ferramentas leem a memória, a tabela e o radar, e registram no funil', async () => {
    const { ferramentas } = await import('../src/paginas/agentes');
    const gravados: Record<string, unknown>[] = [], log: string[] = [];
    const d = { biblioteca: [{ id: 'b', nome: 'guia-sicredi.pdf', categoria: 'Guia de marca', cliente: 'Sicredi' }], swot: [{ id: 's', q: 'S', texto: 'Ouro em Cannes', evidencia: 'x' }], tows: [], alvos: [],
      b2g: [{ id: 'o1', score: 80, objeto: 'Comunicação visual', prazo: '2099-01-01' }, { id: 'o2', score: 90, objeto: 'Vencida', prazo: '2000-01-01' }], pipeline: [], descontos: { '1': 10 } };
    const fs = Object.fromEntries(ferramentas(d as never, async (x) => { gravados.push(x); }, (t) => log.push(t)).map((f) => [f.name, f]));
    const mem = (await fs.memoria_da_casa.execute({ termo: 'sicredi' })) as { biblioteca: unknown[]; swot: unknown[] };
    expect(mem.biblioteca.length).toBe(1); expect(mem.swot.length).toBe(0);
    const tab = (await fs.buscar_tabela.execute({ termo: 'anuncio jornal 1 pagina', etapa: 'ADAPTAÇÃO' })) as { id: number; desconto: number }[];
    expect(tab[0]).toMatchObject({ id: 1, desconto: 10 });
    const op = (await fs.oportunidades.execute({ tipo: 'b2g' })) as { b2g: { nota: number }[] };
    expect(op.b2g.map((o) => o.nota)).toEqual([80]);
    await fs.registrar_oportunidade.execute({ eixo: 'Público', titulo: 'Cadastro SP', proximo_passo: 'Ligar' });
    expect(gravados[0]).toMatchObject({ eixo: 'Público', titulo: 'Cadastro SP', estagio: 'Identificada', origem: 'Agente' });
    expect(log[0]).toContain('Cadastro SP');
  });

  it('conversa com o agente, mostra a resposta e salva a conversa', async () => {
    const db = bancoFalso({});
    vi.resetModules();
    const sample = Object.assign(async (msgs: { content: string }[], o: { tools: { name: string; execute: (a: object) => unknown }[] }) => {
      expect(msgs[0].content).toContain('Orçamentista SINAPRO');
      expect(o.tools.map((t) => t.name)).toContain('buscar_tabela');
      return { text: 'Resposta de teste' };
    }, { json: async () => ({}) });
    (window as any).claude = { use: async (n: string) => (n === 'db' ? db.banco : n === 'sample' ? sample : null) };
    const mod = await import('../src/paginas/agentes');
    const raiz = document.createElement('div'); document.body.appendChild(raiz);
    mod.montar(raiz); await espera();
    expect(raiz.querySelectorAll('.ag-btn').length).toBe(24);
    raiz.querySelector<HTMLButtonElement>('[data-sug]')!.click(); await espera(40);
    expect(raiz.querySelector('.ag-msgs')?.textContent).toContain('Resposta de teste');
    expect(Object.values(db.dados.conversas || {})[0]).toMatchObject({ agente: 'orcamentista' });
  });
});

describe('Casca própria', () => {
  it('rotas, apelidos e nicho de cada tela', async () => {
    const { rotaDe, nichoDe, PAGINA } = await import('../src/casca/casca');
    expect(rotaDe('#b2g')).toBe('b2g'); expect(PAGINA.b2g).toBe('licitacoes');
    expect(rotaDe('#swot')).toBe('estrategia'); expect(rotaDe('#personas')).toBe('agentes');
    expect(rotaDe('#projetos/abc')).toBe('painel'); expect(rotaDe('')).toBe('painel');
    expect(nichoDe('funil')?.id).toBe('comercial'); expect(nichoDe('grafica')?.id).toBe('oficina'); expect(nichoDe('tabela')?.id).toBe('gestao');
  });

  it('busca Ctrl K acha telas, serviços, alvos e licitações', async () => {
    const { buscarTudo } = await import('../src/casca/casca');
    const d = { alvos: [{ id: 'a', nome: 'Agência Outdoor Brasil', status: 'Mapeado' }], b2g: [{ id: 'b', objeto: 'Locação de outdoor', orgao: 'Prefeitura' }], frentes: [], swot: [] };
    expect(buscarTudo('', d).length).toBe(23);
    const r = buscarTudo('outdoor', d);
    expect(r.some((x) => x.tipo === 'Serviço')).toBe(true);
    expect(r.find((x) => x.tipo === 'Alvo')?.href).toBe('#captacao');
    expect(r.find((x) => x.tipo === 'Licitação')?.href).toBe('#b2g');
    expect(buscarTudo('tabela', d)[0]).toMatchObject({ tipo: 'Ir', href: '#tabela' });
  });

  it('monta o menu, troca de tela pelo hash e conta avisos não lidos', async () => {
    try { localStorage.clear(); } catch { /* */ }
    const db = bancoFalso({ notificacoes: { n1: { titulo: 'Aviso novo', em: '2099-01-01T00:00:00Z', tipo: 'rotina' } } });
    vi.resetModules();
    (window as any).claude = { use: async (n: string) => (n === 'db' ? db.banco : null) };
    const { iniciarCasca } = await import('../src/casca/casca');
    const raiz = document.createElement('div'); document.body.appendChild(raiz);
    const montadas: string[] = [];
    const pag = (n: string) => (r: HTMLElement) => { montadas.push(n); r.innerHTML = `<p class="pg">${n}</p>`; return () => {}; };
    location.hash = '#captacao';
    iniciarCasca(raiz, { captacao: pag('captacao'), tabela: pag('tabela'), inicio: pag('inicio') }, () => {});
    await espera();
    expect(raiz.querySelector('#conteudo .page-head h1')?.textContent).toBe('Novos negócios');
    expect(raiz.querySelector('#csNav [aria-current="page"]')?.textContent).toBe('Captação');
    expect(raiz.querySelector('#csAv .badge')?.textContent).toBe('1');
    location.hash = '#tabela'; window.dispatchEvent(new HashChangeEvent('hashchange')); await espera();
    expect(montadas).toEqual(['captacao', 'tabela']);
    expect(raiz.querySelector('[data-nicho].on')?.textContent).toBe('Gestão');
    location.hash = '';
  });
});

describe('Início', () => {
  it('ordena os próximos passos e resume o comercial', async () => {
    const { passos } = await import('../src/paginas/inicio');
    const p = passos([{ id: 'p', titulo: 'Fee', estagio: 'Contato', prazo: '2026-12-02', proximoPasso: 'Proposta' }, { id: 'q', titulo: 'Perdida', estagio: 'Perdida', prazo: '2026-01-01' }],
      [{ id: 'a', nome: 'Agência', status: 'Abordado', prazo: '2026-11-20' }, { id: 'b', nome: 'Fora', status: 'Descartado', prazo: '2026-01-01' }],
      [{ id: 'o', objeto: 'Ata OOH', orgao: 'Câmara', carteira: true, prazo: '2026-11-25' }]);
    expect(p.map((x) => x.href)).toEqual(['#captacao', '#b2g', '#funil']);
    const db = bancoFalso({ pipeline: { p: { estagio: 'Contato', valor: 1000 } }, alvos: { a: { nome: 'A', status: 'Cliente' } } });
    const { raiz } = await montar('inicio', db);
    const k = raiz.querySelectorAll('#inK .k');
    expect(k.length).toBe(5);
    expect(k[1].textContent).toContain('1 viraram cliente');
  });
});

describe('Início · alerta de licitações', () => {
  it('mostra certidões vencidas ou vencendo e propostas da semana', async () => {
    const { alertasHabilitacao } = await import('../src/paginas/licitacoes');
    const hab = [{ id: 'cria', req: { fgts: { status: 'ok' as const, validade: '2026-11-01' }, rfb: { status: 'ok' as const, validade: '2026-11-20' }, cndt: { status: 'ok' as const, validade: '2027-06-01' }, municipal: { status: 'pendente' as const } } }];
    const a = alertasHabilitacao(hab, '2026-11-11');
    expect(a.map((x) => [x.requisito.slice(0, 5), x.situacao])).toEqual([['CRF ·', 'vencida'], ['Certi', 'vence']]);
    const d = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const db = bancoFalso({ habilitacao: { producoes: { req: { fgts: { status: 'ok', validade: d(-2) } } } }, b2g: { o: { objeto: 'Ata de comunicação visual', carteira: true, prazo: d(3) } } });
    const { raiz } = await montar('inicio', db);
    const al = raiz.querySelector<HTMLElement>('#inA')!;
    expect(al.hidden).toBe(false);
    expect(al.textContent).toContain('1 proposta(s) da carteira vencem em 7 dias');
    expect(al.textContent).toContain('1 certidão(ões) vencida(s)');
    expect(al.textContent).toContain('Produções');
  });
});

describe('PCA dos órgãos', () => {
  const pca = (id: string, o: Record<string, unknown> = {}) => ({ id, ano: 2027, cnpj: '11111111000111', orgao: 'Prefeitura Exemplo', unidades: ['Secretaria de Comunicação'], codigoUnidade: '1', idPca: '11111111000111-0-000003/2027', atualizadoNoPncp: '2026-11-01', uf: 'SP', municipio: 'Campinas', esfera: 'Municipal',
    itens: [{ numero: 1, descricao: 'Produção de vídeo institucional', frente: 'Produção audiovisual e filmes', classe: '9614', valor: 50000, quantidade: 1, unidadeFornecimento: 'serviço', dataDesejada: '2027-03-01' }], total: 50000, frentes: ['Produção audiovisual e filmes'], primeiraData: '2027-03-01', ...o });

  it('link do PNCP e filtros', async () => {
    const { linkPca, filtrarPca } = await import('../src/paginas/pca');
    expect(linkPca('04665345000115-0-000001/2027')).toBe('https://pncp.gov.br/app/pca/04665345000115/2027/1');
    const L = [pca('a'), pca('b', { uf: 'RJ', total: 90000, frentes: ['Fotografia e cobertura de imagem'] })] as never[];
    expect(filtrarPca(L, { frente: '', uf: '', q: '', ordem: 'valor' }).map((p: { id: string }) => p.id)).toEqual(['b', 'a']);
    expect(filtrarPca(L, { frente: 'Fotografia e cobertura de imagem', uf: '', q: '', ordem: 'valor' }).length).toBe(1);
    expect(filtrarPca(L, { frente: '', uf: 'SP', q: 'video', ordem: 'valor' }).length).toBe(1);
  });

  it('aba em Licitações lista os órgãos e leva ao funil', async () => {
    const db = bancoFalso({ pca: { a: pca('a') }, b2g: {} });
    const { raiz } = await montar('licitacoes', db);
    raiz.querySelector<HTMLButtonElement>('[data-aba="pca"]')!.click();
    await espera(40);
    expect(raiz.querySelector('#lc-tab-pca')?.getAttribute('aria-selected')).toBe('true');
    expect(raiz.querySelectorAll('.pca-it').length).toBe(1);
    raiz.querySelector<HTMLButtonElement>('[data-pca-abre="a"]')!.click();
    expect(raiz.querySelector('.pca-itens')?.textContent).toContain('Produção de vídeo institucional');
    raiz.querySelector<HTMLButtonElement>('[data-pca-funil="a"]')!.click();
    await espera();
    expect(Object.values(db.dados.pipeline)[0]).toMatchObject({ eixo: 'Público', origem: 'PCA', estagio: 'Identificada', valor: 50000 });
  });
});

describe('Histórico: desfazer, lixeira e voltar', () => {
  it('exclusão vai para a lixeira, Desfazer devolve e Restaurar também', async () => {
    const db = bancoFalso({ casos: { c1: { titulo: 'Black Box', resumo: 'x', servicos: [], perfis: [] } } });
    vi.resetModules();
    (window as any).claude = { use: async (n: string) => (n === 'db' ? db.banco : null) };
    const { banco } = await import('../src/lib/db');
    const h = await import('../src/lib/historico');
    const b = (await banco())!;
    const off = b.collection('casos').onSnapshot(() => {}); await espera();
    await b.collection('casos').doc('c1').delete();
    expect(db.dados.casos.c1).toBeUndefined();
    const lx = Object.values(db.dados.lixeira)[0] as { col: string; docId: string; rotulo: string };
    expect(lx).toMatchObject({ col: 'casos', docId: 'c1', rotulo: 'Casos · Black Box' });
    await h.desfazerUltimo();
    expect(db.dados.casos.c1).toMatchObject({ titulo: 'Black Box' });
    expect(Object.keys(db.dados.lixeira || {}).length).toBe(0);
    await h.refazerUltimo();
    expect(db.dados.casos.c1).toBeUndefined();
    // edição: desfazer volta ao valor anterior
    await b.collection('casos').doc('c2').set({ titulo: 'Novo' });
    await b.collection('casos').doc('c2').update({ titulo: 'Editado' });
    await new Promise((r) => setTimeout(r, 900));
    await b.collection('casos').doc('c2').update({ titulo: 'De novo' });
    await h.desfazerUltimo();
    expect(db.dados.casos.c2.titulo).toBe('Editado');
    off();
  });

  it('Lixeira lista e restaura', async () => {
    const db = bancoFalso({ lixeira: { lx1: { id: 'lx1', col: 'pipeline', docId: 'fn-1', dados: { titulo: 'Fee exemplo', estagio: 'Contato' }, em: '2026-11-11T10:00:00Z', rotulo: 'Funil · Fee exemplo' } } });
    const { raiz } = await montar('lixeira', db);
    expect(raiz.querySelector('.lx-it')?.textContent).toContain('Funil · Fee exemplo');
    raiz.querySelector<HTMLButtonElement>('[data-lxr="lx1"]')!.click(); await espera();
    expect(db.dados.pipeline['fn-1']).toMatchObject({ titulo: 'Fee exemplo' });
    expect(db.dados.lixeira.lx1).toBeUndefined();
  });

  it('Captação mostra os descartados e Reabrir devolve ao quadro', async () => {
    const db = bancoFalso({ alvos: { a: { nome: 'Agência Descartada', status: 'Descartado', triagem: 'Descartar', motivoDescarte: 'Momento errado', perfil: 'independente' } } });
    const { raiz } = await montar('captacao', db);
    raiz.querySelector<HTMLButtonElement>('[data-pf="__descartados"]')!.click();
    expect(raiz.querySelector('.cp-desc')?.textContent).toContain('Momento errado');
    raiz.querySelector<HTMLButtonElement>('[data-reabre="a"]')!.click(); await espera();
    expect(db.dados.alvos.a).toMatchObject({ status: 'Mapeado', triagem: '' });
  });

  it('a aba fica no endereço e o Voltar do navegador volta para a aba anterior', async () => {
    location.hash = '#b2g';
    const { raiz } = await montar('licitacoes', bancoFalso({ b2g: {} }));
    raiz.querySelector<HTMLButtonElement>('[data-aba="carteira"]')!.click();
    expect(location.hash).toBe('#b2g/carteira');
    expect(raiz.querySelector('#lc-tab-carteira')?.getAttribute('aria-selected')).toBe('true');
    location.hash = '#b2g'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(raiz.querySelector('#lc-tab-radar')?.getAttribute('aria-selected')).toBe('true');
    location.hash = '#b2g/habilitacao'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(raiz.querySelector('#lc-tab-habilitacao')?.getAttribute('aria-selected')).toBe('true');
  });
});
