/** Datas como texto AAAA-MM-DD, sem fuso (meio-dia local evita virar o dia). */

export const hoje = (): string => new Date().toISOString().slice(0, 10);

export function addDias(base: string | null | undefined, n: number): string {
  const x = new Date((base || hoje()) + 'T12:00');
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Soma dias úteis (seg–sex). */
export function addUteis(base: string | null | undefined, n: number): string {
  const x = new Date((base || hoje()) + 'T12:00');
  let k = 0;
  while (k < n) {
    x.setDate(x.getDate() + 1);
    const w = x.getDay();
    if (w && w < 6) k++;
  }
  return x.toISOString().slice(0, 10);
}
