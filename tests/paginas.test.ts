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
