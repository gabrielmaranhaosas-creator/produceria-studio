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
