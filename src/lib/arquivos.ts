/**
 * Arquivos guardados no Studio (capability `assets` do claude.ai) e quem enviou (capability `user`).
 * Sem a capability (visualização sem edição, testes), `armazem()` devolve null e as telas explicam.
 */
export interface Enviado { id: string; url: string; contentType?: string; sizeBytes?: number }
export interface Armazem { upload(f: File): Promise<Enviado>; delete(id: string): Promise<void> }
interface Usuario { id(): Promise<string | null>; profiles?(ids: string[]): Promise<Record<string, { name?: string } | undefined>> }

let pA: Promise<Armazem | null> | null = null, pU: Promise<Usuario | null> | null = null;
export const armazem = () => (pA ??= (async () => { try { return ((await window.claude?.use('assets')) as Armazem) || null; } catch { return null; } })());
const usuario = () => (pU ??= (async () => { try { return ((await window.claude?.use('user')) as Usuario) || null; } catch { return null; } })());
export async function quemSou(): Promise<string | null> { try { return (await (await usuario())?.id()) ?? null; } catch { return null; } }
/** Nomes de quem enviou, pelos ids. Quem não tem nome aparece como "Alguém da equipe". */
export async function nomes(ids: string[]): Promise<Record<string, string>> {
  const u = await usuario(), lista = [...new Set(ids.filter(Boolean))];
  if (!u?.profiles || !lista.length) return {};
  try { const r = await u.profiles(lista); return Object.fromEntries(Object.keys(r || {}).map((k) => [k, r[k]?.name || 'Alguém da equipe'])); } catch { return {}; }
}

export const LIMITE = 20 * 1024 * 1024;
export const ERROS_ENVIO: Record<string, string> = {
  unsupported_type: 'tipo de arquivo não aceito (use imagem, vídeo, PDF, fonte ou texto/CSV/Markdown/JSON)',
  too_large: 'arquivo acima de 20 MB', quota_exceeded: 'o espaço de arquivos do Studio está cheio', not_granted: 'você não tem permissão para enviar arquivos aqui',
};
export const tamanho = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
/** Nome de quem está usando (para "Para fulano" nos avisos). Vazio fora do claude.ai. */
export async function nomeProprio(): Promise<string> {
  try { const u = (await usuario()) as (Usuario & { me?: () => Promise<{ name?: string } | null> }) | null; return (await u?.me?.())?.name || ''; } catch { return ''; }
}
