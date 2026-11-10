/** Formatação pt-BR usada em todas as páginas. */

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const int = (n: number): string => Number(n).toLocaleString('pt-BR');

export const brl = (n: number | null | undefined): string =>
  n == null ? '' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/** Valor compacto: R$ 1,2 mi · R$ 350 mil. */
export const brk = (n: number): string =>
  n >= 1e9 ? 'R$ ' + (n / 1e9).toFixed(1).replace('.', ',') + ' bi'
  : n >= 1e6 ? 'R$ ' + (n / 1e6).toFixed(1).replace('.', ',') + ' mi'
  : n >= 1e3 ? 'R$ ' + Math.round(n / 1e3) + ' mil'
  : brl(n);

/** AAAA-MM-DD → DD/MM/AAAA */
export const dt = (s?: string | null): string => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
