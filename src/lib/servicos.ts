/**
 * Tabela de serviços da casa (planilha Luciano, valores SINAPRO) e o cálculo da proposta.
 * Valores das propostas em centavos, como no legado, para não acumular erro de arredondamento.
 */
import TABELA from './servicos.json';

export interface Servico { id: number; cat: string; sub: string; esp: string; etapa: string; ref: number; desc: number; sinapro: number | null; sinaproNome: string | null; status: string }
export const SERVICOS = TABELA as Servico[];
export const FONTE_TABELA = 'Tabela Produceria (planilha Luciano, SINAPRO)';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const detalhe = (s: Servico) => [s.sub, s.esp].filter(Boolean).join(' · ') || s.cat;
export const rotulo = (s: Servico) => `${s.cat} · ${detalhe(s)}${s.etapa ? ' · ' + s.etapa.toLowerCase() : ''}`;
const indice = SERVICOS.map((s) => sem(`${s.id} ${s.cat} ${s.sub} ${s.esp} ${s.etapa} ${s.sinaproNome || ''}`));

/** Busca por palavras (todas precisam aparecer), sem acento. */
export function buscar(texto: string, max = 8): Servico[] {
  const termos = sem(texto).split(/\s+/).filter(Boolean);
  const r: Servico[] = [];
  for (let i = 0; i < SERVICOS.length && r.length < max; i++) if (termos.every((t) => indice[i].includes(t))) r.push(SERVICOS[i]);
  return r;
}

/** Item da proposta: `unit` em centavos, `desconto` em %. */
export interface ItemProposta { id: string; descricao: string; qtd: number; unit: number; desconto: number; fonte: string; servico: number; etapa: string; opcional?: boolean }

/** Percentual sobre centavos, arredondado como no legado. */
export function pct(valor: number, p: number): number {
  const t = (valor * Math.round(1000 * p)) / 1e5;
  return Math.sign(t) * Math.floor(Math.abs(t) + 0.5);
}

/** Totais da proposta em centavos: bruto, desconto dos itens e total líquido. */
export function calcular(itens: ItemProposta[]): { bruto: number; desconto: number; total: number; linhas: { liquido: number }[] } {
  const linhas = itens.map((i) => {
    const t = (Math.round(1000 * i.qtd) * i.unit) / 1000;
    const totalC = Math.sign(t) * Math.floor(Math.abs(t) + 0.5);
    const descC = pct(totalC, i.desconto || 0);
    return { totalC, descC, liquido: totalC - descC };
  });
  const bruto = linhas.reduce((s, l) => s + l.totalC, 0);
  const desconto = linhas.reduce((s, l) => s + l.descC, 0);
  return { bruto, desconto, total: bruto - desconto, linhas };
}

/** Item novo a partir de um serviço da tabela, com o desconto negociado dele (coleção config/descontos). */
export function itemDe(s: Servico, descontos: Record<string, number>, id: string): ItemProposta {
  return { id, descricao: rotulo(s), qtd: 1, unit: Math.round(100 * s.ref), desconto: descontos[String(s.id)] || 0, fonte: `${FONTE_TABELA} · ID ${s.id}`, servico: s.id, etapa: s.etapa };
}
