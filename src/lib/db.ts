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
