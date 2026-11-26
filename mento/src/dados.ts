// Onde os dados do comercial moram. No artefato do claude.ai: o banco compartilhado (a equipe toda vê e edita, ao
// vivo). No arquivo aberto direto: o navegador de quem usa, começando pela base inicial. Mesma interface nos dois.
import type { Registro, Oportunidade, Atividade } from './crm';
import { SEMENTE } from './semente';

export type Colecao = 'bd' | 'funil' | 'atividades';
export interface Loja {
  compartilhada: boolean;
  ouvir<T extends { id: string }>(col: Colecao, cb: (lista: T[]) => void, erro?: (msg: string) => void): () => void;
  salvar(col: Colecao, doc: { id: string }): Promise<void>;
  apagar(col: Colecao, id: string): Promise<void>;
}
export type Doc = Registro | Oportunidade | Atividade;

type Snap = { docs: { id: string; data(): Record<string, unknown> | undefined }[]; metadata?: { fromCache?: boolean } };
type Db = { collection(p: string): { onSnapshot(n: (s: Snap) => void, e?: (x: { code: string; message: string }) => void): () => void; doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> } } };

const limpo = (d: { id: string }) => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(d)) if (k !== 'id' && v !== undefined && v !== '') o[k] = v; return o; };
const ERRO: Record<string, string> = { quota_exceeded: 'O banco está cheio. Apague registros que não usa mais.', resource_exhausted: 'Muitas gravações seguidas. Espere alguns segundos.', invalid_argument: 'Você pode ver, mas não editar estes dados. Peça acesso de edição a quem compartilhou.' };
export const mensagemErro = (e: unknown) => ERRO[(e as { code?: string })?.code || ''] || 'Não deu para gravar agora. Tente de novo.';

export function lojaDoBanco(db: Db): Loja {
  return {
    compartilhada: true,
    ouvir(col, cb, erro) {
      return db.collection(col).onSnapshot((s) => cb(s.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })) as never), (e) => erro?.(ERRO[e.code] || 'O banco parou de responder. Recarregue a página.'));
    },
    salvar: (col, d) => db.collection(col).doc(d.id).set(limpo(d)),
    apagar: (col, id) => db.collection(col).doc(id).delete(),
  };
}

export function lojaLocal(): Loja {
  const CH = 'mento.crm.v1', ouvintes = new Map<Colecao, Set<(l: never[]) => void>>();
  let mem: Record<Colecao, Record<string, { id: string }>> = { bd: {}, funil: {}, atividades: {} };
  try { const g = JSON.parse(localStorage.getItem(CH) || 'null'); if (g?.bd) mem = g; else mem.bd = Object.fromEntries(SEMENTE.map((r) => [r.id, r])); } catch { mem.bd = Object.fromEntries(SEMENTE.map((r) => [r.id, r])); }
  const gravar = () => { try { localStorage.setItem(CH, JSON.stringify(mem)); } catch { /* sem armazenamento: vale nesta visita */ } };
  const avisar = (col: Colecao) => { const l = Object.values(mem[col]) as never[]; ouvintes.get(col)?.forEach((f) => f(l)); };
  return {
    compartilhada: false,
    ouvir(col, cb) { const s = ouvintes.get(col) || new Set(); s.add(cb as never); ouvintes.set(col, s); queueMicrotask(() => cb(Object.values(mem[col]) as never)); return () => s.delete(cb as never); },
    async salvar(col, d) { mem[col][d.id] = JSON.parse(JSON.stringify(d)); gravar(); avisar(col); },
    async apagar(col, id) { delete mem[col][id]; gravar(); avisar(col); },
  };
}

/** A loja desta visualização: o banco do artefato quando ele existe, senão o navegador. */
export async function abrirLoja(): Promise<Loja> {
  const cl = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  if (cl) { try { const db = (await cl.use('db')) as Db | null; if (db) return lojaDoBanco(db); } catch { /* sem banco */ } }
  return lojaLocal();
}
