/**
 * Arquivos que moram no banco do Studio (coleção `kit_plugins`) em vez de na página publicada: os dos plugins da casa
 * e as peças que só entram em arquivos baixados. Ver scripts/kit-fora.mjs.
 */
import { banco } from './db';

/**
 * No Studio publicado no claude.ai, o texto dos arquivos dos plugins (e das peças que só vão para arquivos baixados: o visor do
 * multiverso e a fonte da MENTO) não vai na página (scripts/kit-fora.mjs): no
 * lugar vai `MARCA + caminho + ':' + hash`, e o texto fica no banco, coleção `kit_plugins` (id = caminho com / → ~).
 * Aqui a marca vira o texto do banco, conferindo o hash para nunca empacotar uma versão diferente da página.
 * Nos testes e na cópia de consulta o texto já vem na página e nada muda.
 */
export const MARCA = '\u0000kit:';
export async function completar(arquivos: [string, string][]): Promise<[string, string][]> {
  if (!arquivos.some(([, t]) => t.startsWith(MARCA))) return arquivos;
  const db = await banco();
  if (!db) throw new Error('Os arquivos dos plugins ficam no banco do Studio, que não respondeu. Tente de novo em instantes.');
  const col = db.collection<{ hash?: string; texto?: string }>('kit_plugins');
  return Promise.all(arquivos.map(async ([n, t]): Promise<[string, string]> => {
    if (!t.startsWith(MARCA)) return [n, t];
    const [caminho, h] = t.slice(MARCA.length).split(':');
    const s = await col.doc(caminho.replace(/\//g, '~')).get!();
    const d = s.exists ? s.data() : undefined;
    if (!d || d.hash !== h || typeof d.texto !== 'string') throw new Error(`O arquivo ${caminho} no banco não é o desta versão do Studio. Peça ao Claude para regravar a coleção kit_plugins (npm run kit).`);
    return [n, d.texto];
  }));
}
