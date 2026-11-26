/**
 * A reação em cadeia e o multiverso de uma casa a partir dos perfis do LinkedIn da equipe dela: o ponto zero é a
 * casa, a 1ª ramificação é a equipe (os perfis colados), a 2ª são as casas por onde cada pessoa passou e daí em diante
 * vale o que o Big Data já sabe (quem atende quem, quem trabalha onde, extinta e herdeira). Feito para o teste da MENTO
 * com dois perfis, mas serve a qualquer casa e a quantos perfis houver.
 */
import type { Casa } from './casa';
import type { PerfilLinkedIn } from './linkedin';
import { chave } from './nomes';
import { montarUniverso, reacao, multiverso, ordenarReacao, leads, caminho, ORIGEM, type OrgGrafo, type OrgInv, type PessoaInv, type LigacaoInv, type Universo, type Reacao, type Multiverso, type Ramo, type NoU } from './investigacao';

export interface PerfilEquipe extends PerfilLinkedIn { id: string }
export interface BaseMercado { empresas: OrgGrafo[]; agencias: OrgGrafo[]; pessoas: PessoaInv[]; orgsInv: OrgInv[]; alvos?: { nome: string }[]; ligacoes?: LigacaoInv[]; hoje?: string }
export interface CasaNaTrajetoria { id: string; nome: string; rotulo: string; atual: boolean; /** o Big Data já liga esta casa a outros pontos */ conhecida: boolean; abre: number }
export interface Ponte { id: string; nome: string; tipo: NoU['tipo']; /** passos até cada pessoa da equipe, na ordem da equipe */ passos: number[] }
export interface PorPessoa { id: string; nome: string; casas: CasaNaTrajetoria[]; alcance: number }
export interface ReacaoCasa {
  U: Universo; R: Reacao; M: Multiverso; G: Ramo[][];
  equipe: PessoaInv[]; porPessoa: PorPessoa[]; comuns: Ponte[];
  radar: (Ramo & { no: NoU; caminho: { id: string; rotulo: string }[] })[];
}
export const LIMITES_CASA = [10, 14, 18, 14];

/** Os perfis viram a equipe da casa (pessoas com trajetória e passagens), prontos para o universo. */
export function equipeDosPerfis(casa: Casa, perfis: PerfilEquipe[]): PessoaInv[] {
  return perfis.filter((p) => p.nome.trim()).map((p) => ({
    id: p.id, nome: p.nome.trim(), cargo: p.cargo, organizacao: casa.nomeLongo, linkedin: p.linkedin || undefined, fonte: p.linkedin || undefined,
    trajetoria: p.trajetoria, experiencias: p.experiencias.filter((e) => e.org.trim() || e.cargo.trim()),
  }));
}

/** Distância (em passos, sem passar pelo ponto zero) de um ponto a todos os outros, até `max`. */
function distancias(U: Universo, de: string, max: number): Map<string, number> {
  const d = new Map([[de, 0]]); let fila = [de];
  for (let k = 1; k <= max && fila.length; k++) {
    const prox: string[] = [];
    for (const id of fila) for (const a of U.adj.get(id) || []) if (a.b !== ORIGEM && !d.has(a.b)) { d.set(a.b, k); prox.push(a.b); }
    fila = prox;
  }
  return d;
}

export function reacaoDaCasa(casa: Casa, base: BaseMercado, perfis: PerfilEquipe[], limites = LIMITES_CASA): ReacaoCasa {
  const equipe = equipeDosPerfis(casa, perfis);
  // a pessoa pode já estar no Big Data: o perfil colado vale no lugar do registro antigo
  const mesmos = new Set(equipe.map((e) => chave(e.nome)));
  const pessoas = [...base.pessoas.filter((x) => !mesmos.has(chave(x.nome))), ...equipe];
  const U = montarUniverso({ ...base, pessoas, casa, equipeIds: equipe.map((e) => e.id), equipeNoMapa: true });
  const R = reacao(U, ORIGEM, limites), M = multiverso(U, ORIGEM, R), G = ordenarReacao(R);
  const ids = equipe.map((e) => 'p:' + e.id);
  const porPessoa: PorPessoa[] = equipe.map((e) => {
    const id = 'p:' + e.id, viz = (U.adj.get(id) || []).filter((a) => a.b !== ORIGEM && !ids.includes(a.b));
    const casas = viz.map((a) => {
      const fora = (U.adj.get(a.b) || []).filter((x) => x.b !== id && x.b !== ORIGEM && !ids.includes(x.b));
      return { id: a.b, nome: U.nos.get(a.b)!.nome, rotulo: a.rotulo, atual: !/^passou por/.test(a.rotulo), conhecida: fora.length > 0, abre: fora.length };
    }).sort((x, y) => Number(y.atual) - Number(x.atual) || y.abre - x.abre || x.nome.localeCompare(y.nome, 'pt-BR'));
    return { id, nome: e.nome, casas, alcance: multiverso(U, id).alcance };
  });
  // pontes em comum: o que duas ou mais pessoas da equipe alcançam em até 2 passos cada (a conversa pode vir de qualquer uma)
  const D = ids.map((id) => distancias(U, id, 2));
  const comuns: Ponte[] = ids.length < 2 ? [] : [...U.nos.values()]
    .filter((n) => n.id !== ORIGEM && !ids.includes(n.id) && D.filter((d) => d.has(n.id)).length >= 2)
    .map((n) => ({ id: n.id, nome: n.nome, tipo: n.tipo, passos: D.map((d) => d.get(n.id) ?? -1) }))
    .sort((a, b) => Math.max(...a.passos) - Math.max(...b.passos) || (U.nos.get(b.id)!.nota - U.nos.get(a.id)!.nota) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const radar = leads(U, R).map((x) => ({ ...x, caminho: caminho(R, x.id) }));
  return { U, R, M, G, equipe, porPessoa, comuns, radar };
}

const celula = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** A planilha do radar (CSV com ponto e vírgula, para o Excel em português): força, ponto, caminho e fatos. */
export function csvDoRadar(r: ReacaoCasa): string {
  const nome = (id: string) => r.U.nos.get(id)?.nome || '';
  const linhas = [['Força', 'Ramificação', 'Tipo', 'Nome', 'Cargo ou setor', 'Organização', 'Caminho', 'Por que', 'Fontes']];
  for (const x of r.radar) linhas.push([String(x.forca), `${x.ger}ª`, x.no.tipo, x.no.nome, x.no.sub, x.no.org || '', x.caminho.map((c, i) => (i ? `→ (${c.rotulo}) ` : '') + nome(c.id)).join(' '), x.no.fatos.join(' · '), [...new Set(x.no.fontes)].join(' ')]);
  return '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n');
}
