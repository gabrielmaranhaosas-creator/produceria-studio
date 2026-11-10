/** Normalização de nomes de empresas e órgãos (o PNCP publica em CAIXA ALTA). */

const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'para', 'por', 'a', 'o', 'com']);

/** Siglas que ficam em maiúsculas. Palavras sem vogal (CNPJ, TRT) também ficam. */
const SIGLAS = new Set([
  'LTDA', 'EIRELI', 'EPP', 'ME', 'SA', 'SS', 'BNDES', 'INSS', 'MEC', 'SESC', 'SENAC', 'SENAI', 'SEBRAE', 'IBGE', 'FGV', 'USP',
  'UFRJ', 'UFMG', 'DETRAN', 'CREA', 'CRM', 'OAB', 'ANS', 'ANP', 'ANAC', 'ANEEL', 'ANVISA', 'TV', 'FM', 'EBC', 'SECOM', 'PNCP',
  'CEF', 'BB', 'CNI', 'SUS', 'TCU', 'TJ', 'MP', 'PM', 'GO', 'BA', 'PE', 'AL', 'AM', 'PA', 'PR', 'RS', 'SC', 'MG', 'ES', 'RJ', 'SP', 'DF',
]);

/**
 * "ARTPLAN COMUNICACAO S/A" → "Artplan Comunicacao S/A".
 * Mantém siglas curtas (BNDES, LTDA, MEC), UF entre parênteses e nomes já escritos em caixa mista.
 */
export function nomeLegivel(entrada: unknown): string {
  const s = String(entrada ?? '').trim();
  const minusculas = (s.match(/[a-zà-ú]/g) || []).length;
  const maiusculas = (s.match(/[A-ZÀ-Ú]/g) || []).length;
  if (!s || maiusculas < 4 || minusculas > maiusculas * 0.15) return s;
  const partes = s.toLowerCase().split(/(\s+|[-/()])/);
  return partes
    .map((w, i) => {
      if (!w.trim() || /^[-/()]$/.test(w)) return w;
      const W = w.toUpperCase();
      if (partes[i - 1] === '(' && partes[i + 1] === ')' && /^[A-Z]{2}$/.test(W)) return W;
      if (w.length === 1 && (partes[i - 1] === '/' || partes[i + 1] === '/')) return W;
      if (i > 0 && PEQUENAS.has(w)) return w;
      if (SIGLAS.has(W.replace(/\./g, '')) || (/^[A-Z&]{2,6}$/.test(W) && !/[AEIOU]/.test(W))) return W;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join('');
}

/** Chave de comparação: sem acento, sem sufixo societário, só letras e números. */
export function chave(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|s\/?a|eireli|me|epp|ss)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const slug = (s: unknown, max = 60): string => chave(s).replace(/\s+/g, '-').slice(0, max);

/** Mesma empresa? Igualdade da chave ou um nome é o começo do outro ("Artplan" × "Artplan Comunicacao S/A"). */
export function mesmaEmpresa(a: unknown, b: unknown): boolean {
  const x = chave(a), y = chave(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curta, longa] = x.length <= y.length ? [x, y] : [y, x];
  return curta.length >= 4 && longa.startsWith(curta + ' ');
}
