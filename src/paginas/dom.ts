/** Utilitários de DOM tipados, comuns às páginas migradas. */

/** Busca dentro da raiz da página. As páginas montam o próprio HTML, então os seletores existem. */
export type Busca = <T extends Element = HTMLElement>(seletor: string) => T;

export const seletor = (raiz: ParentNode): Busca =>
  <T extends Element = HTMLElement>(s: string) => raiz.querySelector<T>(s) as T;

/** Diálogo que lembra o elemento que o abriu, para devolver o foco ao fechar. */
export type Dialogo = HTMLDialogElement & { _ret?: HTMLElement | null; _id?: string };

/** Alvo do evento como elemento (cliques e teclas sempre vêm de elementos). */
export const elDe = (e: Event): HTMLElement => e.target as HTMLElement;

/** Mensagem de um erro desconhecido, para avisos ao usuário. */
export const mensagem = (e: unknown, padrao = 'erro'): string =>
  (e instanceof Error && e.message) || (typeof e === 'object' && e && 'message' in e && String((e as { message: unknown }).message)) || padrao;

/** Função de montagem de uma página: recebe a raiz e devolve a limpeza. */
export type Montar = (raiz: HTMLElement) => (() => void) | void;

/** Documento do banco com o id. Como no legado, um campo `id` gravado no documento prevalece. */
export const comId = <T>(d: { id: string; data(): T }): T & { id: string } => Object.assign({ id: d.id }, d.data());

/**
 * Aba guardada no endereço (#rota/aba). Trocar de aba vira um passo do histórico do navegador: o Voltar volta para
 * a aba anterior (e não para outra tela), e o endereço com a aba pode ser copiado e aberto direto nela.
 * O endereço manda: sem aba no endereço, vale `padrao` (a primeira aba da tela).
 */
export function abaNoEndereco<T extends string>(validas: readonly T[], padrao: T, aoMudar: (a: T) => void): { inicial: T; ir(a: T): void; parar(): void } {
  const partes = () => location.hash.replace(/^#/, '').split('/');
  const daUrl = (): T | null => { const a = partes()[1] as T; return validas.includes(a) ? a : null; };
  const inicial = daUrl() || padrao;
  let atual = inicial;
  const ouvir = () => { const a = daUrl() || (partes().length === 1 ? padrao : null); if (a && a !== atual) { atual = a; aoMudar(a); } };
  window.addEventListener('hashchange', ouvir);
  return {
    inicial,
    ir(a: T) {
      if (a === atual) { aoMudar(a); return; }
      atual = a;
      location.hash = `${partes()[0]}/${a}`; // o hashchange da casca mantém a tela; aqui só registra o passo
      aoMudar(a);
    },
    parar: () => window.removeEventListener('hashchange', ouvir),
  };
}
