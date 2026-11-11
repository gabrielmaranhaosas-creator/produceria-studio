/**
 * Histórico de gravações do Studio: Desfazer / Refazer e lixeira.
 *
 * Envolve o banco do artifact (ver `banco()` em db.ts): toda escrita feita pelas telas (set, update, delete) guarda
 * o estado anterior do documento, lido das assinaturas (onSnapshot) que as próprias telas já fazem. Com isso:
 * - qualquer gravação pode ser desfeita (barra "Desfazer" e Ctrl+Z) e refeita (Ctrl+Shift+Z) nesta sessão;
 * - toda exclusão deixa uma cópia na coleção `lixeira`, que sobrevive a recarregar a página e pode ser restaurada
 *   por qualquer pessoa da equipe em Gestão › Lixeira.
 * Gravações em coleções de sistema (avisos, conversas, a própria lixeira) não entram no histórico.
 */
import type { Banco, Colecao, Consulta, Snap } from './db';

export type Dados = Record<string, unknown>;
export interface Escrita { col: string; id: string; antes: Dados | null; depois: Dados | null; lixeira?: string }
export interface Passo { escritas: Escrita[]; em: number; rotulo: string }
export interface ItemLixeira { id: string; col: string; docId: string; dados: Dados; em: string; rotulo: string }

const FORA = new Set(['notificacoes', 'conversas', 'lixeira', 'cerebro']);
const NOMES: Record<string, string> = {
  alvos: 'Captação', b2g: 'Licitações', habilitacao: 'Habilitação', pca: 'PCA', pipeline: 'Funil', linhas: 'Mapa de receitas',
  swot: 'SWOT', tows: 'Estratégias', frentes: 'Frentes', ofertas: 'Ofertas', casos: 'Casos', contas: 'Mapa de contas',
  central: 'Central', biblioteca: 'Biblioteca', fichas: 'Gráfica', cotacoes: 'Cotações', config: 'Tabela de serviços', testes_plugins: 'Teste de plugins',
};
export const nomeColecao = (c: string) => NOMES[c] || c;
const JANELA = 800; // escritas mais próximas que isso viram um passo só (ex.: desconto em lote)

let bruto: Banco | null = null;
const cache = new Map<string, Map<string, Dados>>();
const desfazer: Passo[] = [];
const refazer: Passo[] = [];
const ouvintes = new Set<(p: Passo | null, tipo: 'novo' | 'desfeito' | 'refeito') => void>();
let aplicando = false;

/** Avisa a casca a cada passo novo, desfeito ou refeito. Devolve a função de parar de ouvir. */
export function ouvirHistorico(f: (p: Passo | null, tipo: 'novo' | 'desfeito' | 'refeito') => void): () => void { ouvintes.add(f); return () => ouvintes.delete(f); }
export const podeDesfazer = () => desfazer.length > 0;
export const podeRefazer = () => refazer.length > 0;
const avisar = (p: Passo | null, t: 'novo' | 'desfeito' | 'refeito') => ouvintes.forEach((f) => { try { f(p, t); } catch { /* ouvinte com erro não para o resto */ } });

function lembrar(col: string, s: Snap<Dados>) {
  let m = cache.get(col);
  if (!m) { m = new Map(); cache.set(col, m); }
  for (const d of s.docs) m.set(d.id, { ...d.data() });
}
const conhecido = (col: string, id: string): Dados | null | undefined => {
  const m = cache.get(col);
  if (!m) return undefined; // nunca assinada: não sabemos o estado anterior
  return m.has(id) ? m.get(id)! : null;
};

function registrar(e: Escrita) {
  if (aplicando || FORA.has(e.col)) return;
  const ult = desfazer[desfazer.length - 1];
  const agora = Date.now();
  if (ult && agora - ult.em < JANELA) { ult.escritas.push(e); ult.em = agora; ult.rotulo = rotular(ult.escritas); }
  else desfazer.push({ escritas: [e], em: agora, rotulo: rotular([e]) });
  if (desfazer.length > 50) desfazer.shift();
  refazer.length = 0;
  avisar(desfazer[desfazer.length - 1], 'novo');
}

export function rotular(es: Escrita[]): string {
  const cols = [...new Set(es.map((e) => nomeColecao(e.col)))].join(', ');
  if (es.length > 1) return `${es.length} alterações salvas · ${cols}`;
  const e = es[0];
  return `${!e.antes ? 'Criado' : !e.depois ? 'Apagado' : 'Salvo'} · ${cols}`;
}

function consulta<T>(col: string, q: Consulta<T>): Consulta<T> {
  return {
    where: (c, op, v) => consulta(col, q.where(c, op, v)),
    orderBy: (c, d) => consulta(col, q.orderBy(c, d)),
    limit: (n) => consulta(col, q.limit(n)),
    onSnapshot: (ok, erro) => q.onSnapshot((s) => { lembrar(col, s as unknown as Snap<Dados>); ok(s); }, erro),
  };
}

function colecao<T>(db: Banco, col: string): Colecao<T> {
  const c = db.collection<T>(col);
  return {
    ...consulta(col, c),
    doc(id: string) {
      const d = c.doc(id);
      return {
        async set(dados: object) {
          const antes = conhecido(col, id);
          await d.set(dados);
          cache.get(col)?.set(id, { ...(dados as Dados) });
          if (antes !== undefined) registrar({ col, id, antes, depois: { ...(dados as Dados) } });
        },
        async update(dados: object) {
          const antes = conhecido(col, id);
          await d.update(dados);
          const depois = { ...(antes || {}), ...(dados as Dados) };
          cache.get(col)?.set(id, depois);
          if (antes) registrar({ col, id, antes, depois });
        },
        async delete() {
          const antes = conhecido(col, id);
          let lixeira: string | undefined;
          if (antes && !FORA.has(col) && !aplicando) {
            // primeiro a cópia na lixeira; se ela falhar, a exclusão não acontece
            lixeira = `lx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
            const item: ItemLixeira = { id: lixeira, col, docId: id, dados: antes, em: new Date().toISOString(), rotulo: rotuloDoc(col, antes) };
            await db.collection('lixeira').doc(lixeira).set(item);
          }
          await d.delete();
          cache.get(col)?.delete(id);
          if (antes) registrar({ col, id, antes, depois: null, lixeira });
        },
      };
    },
  };
}

/** Nome legível de um documento para a lixeira (título, nome, texto ou objeto). */
export function rotuloDoc(col: string, d: Dados): string {
  const v = d.titulo || d.nome || d.peca || d.item || d.texto || d.objeto || d.empresa || d.anunciante || '';
  return `${nomeColecao(col)} · ${String(v).slice(0, 120) || '(sem título)'}`;
}

/** Banco com histórico. As telas usam este no lugar do banco bruto (feito em `banco()`). */
export function instrumentar(db: Banco): Banco {
  bruto = db;
  return { collection: <T>(c: string) => colecao<T>(db, c) };
}

async function aplicar(p: Passo, sentido: 'desfazer' | 'refazer') {
  if (!bruto) return;
  aplicando = true;
  try {
    const es = sentido === 'desfazer' ? [...p.escritas].reverse() : p.escritas;
    for (const e of es) {
      const alvo = sentido === 'desfazer' ? e.antes : e.depois;
      const ref = bruto.collection(e.col).doc(e.id);
      if (alvo) await ref.set(alvo); else await ref.delete();
      if (alvo) cache.get(e.col)?.set(e.id, alvo); else cache.get(e.col)?.delete(e.id);
      // desfazer uma exclusão tira o item da lixeira; refazer a exclusão não o recoloca (a cópia já foi usada)
      if (sentido === 'desfazer' && e.lixeira) await bruto.collection('lixeira').doc(e.lixeira).delete().catch(() => {});
    }
  } finally { aplicando = false; }
}

export async function desfazerUltimo(): Promise<Passo | null> {
  const p = desfazer.pop();
  if (!p) return null;
  try { await aplicar(p, 'desfazer'); } catch (e) { desfazer.push(p); throw e; }
  refazer.push(p);
  avisar(p, 'desfeito');
  return p;
}
export async function refazerUltimo(): Promise<Passo | null> {
  const p = refazer.pop();
  if (!p) return null;
  try { await aplicar(p, 'refazer'); } catch (e) { refazer.push(p); throw e; }
  desfazer.push(p);
  avisar(p, 'refeito');
  return p;
}

/** Restaura um item da lixeira para a coleção de origem e o tira da lixeira. */
export async function restaurar(item: ItemLixeira): Promise<void> {
  if (!bruto) throw new Error('sem banco');
  await bruto.collection(item.col).doc(item.docId).set(item.dados);
  cache.get(item.col)?.set(item.docId, item.dados);
  await bruto.collection('lixeira').doc(item.id).delete();
}

/** Só para os testes: zera o estado do módulo. */
export function _zerar() { bruto = null; cache.clear(); desfazer.length = 0; refazer.length = 0; ouvintes.clear(); aplicando = false; }
