import { addDias, hoje } from './datas';
import type { Alvo } from './tipos';

export const ETAPAS = ['Mapeado', 'Pesquisado', 'Abordado', 'Conversa', 'Proposta', 'Cliente'] as const;

/** Peso base por perfil de alvo. */
export const PESO_PERFIL: Record<string, number> = { independente: 30, inhouse: 25, publica: 20, eua: 20, rede: 10 };

export interface Sinal {
  perfil?: string;
  /** sinais recentes (conta nova, contrato, notícia) */
  sinais?: number;
  valor?: number;
  /** data AAAA-MM-DD do sinal mais recente */
  ultimo?: string;
  contato?: string;
  status?: string;
  /** nota 0-100 calculada pela Captação (jobs/captacao/nota.py) */
  notaCaptacao?: number;
}

export type Calibragem = Record<string, number>;

/**
 * Fator por perfil a partir dos descartes da equipe nos últimos 90 dias.
 * Perfis com 3+ triagens perdem peso na proporção dos descartes (mínimo 0,4).
 */
export function calibrar(alvos: Alvo[], referencia = hoje()): Calibragem {
  const desde = addDias(referencia, -90);
  const triados: Record<string, number> = {}, descartados: Record<string, number> = {};
  for (const a of alvos) {
    if (!a.triadoEm || String(a.triadoEm).slice(0, 10) < desde) continue;
    const p = a.perfil || 'outro';
    triados[p] = (triados[p] || 0) + 1;
    if (/descart/i.test(a.triagem || '')) descartados[p] = (descartados[p] || 0) + 1;
  }
  const f: Calibragem = {};
  for (const p in triados) f[p] = triados[p] >= 3 ? Math.max(0.4, 1 - (descartados[p] || 0) / triados[p]) : 1;
  return f;
}

/** Nota única de prioridade (0-100) e o motivo legível. */
export function prioridade(o: Sinal, cal: Calibragem = {}, referencia = hoje()): { nota: number; motivo: string } {
  const r: string[] = [];
  let s = 0;
  const pf = o.perfil || '';
  const base = (PESO_PERFIL[pf] ?? 15) * (cal[pf] ?? 1);
  s += base;
  r.push(`perfil ${pf || '?'} +${Math.round(base)}`);
  const n = Math.min(3, o.sinais || 0);
  if (n) { s += n * 8; r.push(`${n} sina${n > 1 ? 'is' : 'l'} recente${n > 1 ? 's' : ''} +${n * 8}`); }
  const v = o.valor || 0;
  if (v >= 1e6) { s += 15; r.push('valor ≥ R$ 1 mi +15'); } else if (v >= 1e5) { s += 8; r.push('valor ≥ R$ 100 mil +8'); }
  const u = o.ultimo || '';
  if (u && u >= addDias(referencia, -14)) { s += 15; r.push('sinal nos últimos 14 dias +15'); }
  else if (u && u >= addDias(referencia, -45)) { s += 8; r.push('sinal nos últimos 45 dias +8'); }
  if (o.contato) { s += 8; r.push('contato conhecido +8'); }
  const e = (ETAPAS as readonly string[]).indexOf(o.status || '');
  if (e >= 3) { const b = e === 3 ? 10 : 15; s += b; r.push(`em ${o.status} +${b}`); }
  if (o.notaCaptacao) { const x = Math.round(o.notaCaptacao * 0.2); s += x; r.push(`nota da Captação +${x}`); }
  return { nota: Math.max(0, Math.min(100, Math.round(s))), motivo: r.join(' · ') };
}

export function prioridadeDoAlvo(a: Alvo, cal: Calibragem = {}, referencia = hoje()) {
  return prioridade({
    perfil: a.perfil, contato: a.contato, status: a.status, notaCaptacao: a.nota,
    ultimo: String(a.ultimoToque || a.criadoEm || '').slice(0, 10),
    sinais: (a.toques || []).length ? 0 : 1,
  }, cal, referencia);
}

export const ativo = (a: Alvo): boolean => !!a && a.status !== 'Cliente' && !/descart/i.test(a.triagem || '');
export const devido = (a: Alvo): string => (a.proximoToque && a.proximoToque.data) || a.prazo || '';
