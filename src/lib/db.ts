/**
 * Acesso ao banco compartilhado do artifact (capability `db` do claude.ai).
 * Fora do claude.ai (testes, preview local) devolve null e as páginas trabalham só na sessão.
 */

export interface Doc<T = Record<string, unknown>> { id: string; data(): T }
export interface Snap<T = Record<string, unknown>> { docs: Doc<T>[] }
export interface Consulta<T = Record<string, unknown>> {
  where(campo: string, op: string, valor: unknown): Consulta<T>;
  orderBy(campo: string, dir?: 'asc' | 'desc'): Consulta<T>;
  limit(n: number): Consulta<T>;
  onSnapshot(ok: (s: Snap<T>) => void, erro?: (e: unknown) => void): () => void;
}
export interface Colecao<T = Record<string, unknown>> extends Consulta<T> {
  doc(id: string): {
    set(d: object): Promise<void>;
    update(d: object): Promise<void>;
    delete(): Promise<void>;
  };
}
export interface Banco { collection<T = Record<string, unknown>>(caminho: string): Colecao<T> }

import { instrumentar } from './historico';

declare global {
  interface Window { claude?: { use(nome: string): Promise<unknown> } }
}

let promessa: Promise<Banco | null> | null = null;

export function banco(): Promise<Banco | null> {
  if (!promessa) {
    promessa = (async () => {
      try {
        const bruto = (await window.claude?.use('db')) as Banco | undefined;
        return bruto ? instrumentar(bruto) : null; // histórico: Desfazer, Refazer e lixeira (ver historico.ts)
      } catch { return null; }
    })();
  }
  return promessa;
}

/**
 * Assina uma coleção (ou consulta) e entrega os documentos já com o id.
 * Desiste em 10 s sem resposta (chama `semBanco`). Devolve a função de cancelar.
 */
export function assinar<T>(
  db: Banco,
  fonte: string | ((db: Banco) => Consulta<T>),
  ok: (docs: (T & { id: string })[]) => void,
  semBanco?: () => void,
): () => void {
  const q = typeof fonte === 'string' ? db.collection<T>(fonte) : fonte(db);
  const t = setTimeout(() => semBanco?.(), 10000);
  return q.onSnapshot(
    (s) => { clearTimeout(t); ok(s.docs.map((d) => ({ id: d.id, ...(d.data() as T) }))); },
    () => { clearTimeout(t); semBanco?.(); },
  );
}

/** Lê um JSON publicado junto do Studio, comprimido (gzip) ou não. */
export async function lerArquivo<T>(...caminhos: string[]): Promise<T> {
  let ultimoErro: unknown;
  for (const c of caminhos) {
    try {
      const r = await fetch(c);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const a = new Uint8Array(await r.arrayBuffer());
      if (a[0] === 31 && a[1] === 139) {
        const txt = await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
        return JSON.parse(txt) as T;
      }
      return JSON.parse(new TextDecoder().decode(a)) as T;
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro;
}

/** Base grande: primeiro o arquivo `<nome>.json` publicado junto do Studio (o caminho que sempre funcionou); se ele
 * não existir, a cópia no banco em blocos, na coleção `base_<nome>` (documento `cabeca` com os campos pequenos em `dados`
 * e a contagem de cada lista em `partes`; documentos `<lista>-NN` com os pedaços em `itens`). */
export async function lerBase<T>(nome: string): Promise<T> {
  try { return await lerArquivo<T>(`${nome}.json`); } catch (e) { if (!(await banco())) throw e; }
  const db = await banco();
  if (db) {
    type D = { id: string; dados?: Record<string, unknown>; partes?: Record<string, number>; itens?: unknown[] };
    const docs = await new Promise<D[]>((ok) => {
      let fim = false, off: () => void = () => {};
      const sair = (v: D[]) => { if (fim) return; fim = true; ok(v); setTimeout(() => { try { off(); } catch { /* já cancelado */ } }); };
      const t = setTimeout(() => sair([]), 20000);
      off = db.collection<D>(`base_${nome}`).onSnapshot((s) => { clearTimeout(t); sair(s.docs.map((d) => ({ ...(d.data() as D), id: d.id }))); }, () => { clearTimeout(t); sair([]); });
    });
    const cab = docs.find((d) => d.id === 'cabeca');
    if (cab?.partes) {
      const obj: Record<string, unknown> = { ...(cab.dados || {}) };
      let ok = true;
      for (const [lista, total] of Object.entries(cab.partes)) {
        const itens = docs.filter((d) => d.id.startsWith(lista + '-')).sort((a, b) => a.id.localeCompare(b.id)).flatMap((d) => d.itens || []);
        if (itens.length !== total) { ok = false; break; }
        obj[lista] = itens;
      }
      if (ok) return obj as T;
    }
  }
  throw new Error(`Base ${nome} indisponível no arquivo e no banco.`);
}
