// Dashboard comercial: números do momento e gráficos que filtram. Uma cor de série (o verde da MENTO), barras finas
// com o valor escrito, dica ao passar o mouse, tabela para quem prefere ler e clique que leva ao Big Data ou ao funil.
import { ETAPAS, janelas, contasGanhas, nivelDe, type Registro, type Oportunidade, type Atividade } from './crm';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = (n: number) => n.toLocaleString('pt-BR');
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export interface Ponto { rot: string; v: number; sub?: string; acao?: string }
/** Os números que o dashboard mostra, calculados dos dados (puro, para testar). */
export function dadosDashboard(bd: Registro[], ops: Oportunidade[], ats: Atividade[], hoje: string) {
  const ano = hoje.slice(0, 4), meses: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(Date.parse(hoje.slice(0, 7) + '-15T12:00:00Z')); d.setUTCMonth(d.getUTCMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
  const porMes = meses.map((m) => ({ rot: MES[Number(m.slice(5, 7)) - 1] + (m.endsWith('-01') ? ' ' + m.slice(2, 4) : ''), v: bd.filter((r) => r.sinal && (r.data || '').slice(0, 7) === m).length, sub: m }));
  const tipos: Ponto[] = [['anunciante', 'Anunciantes'], ['agencia', 'Agências'], ['veiculo', 'Veículos'], ['pessoa', 'Pessoas']].map(([t, rot]) => ({ rot, v: bd.filter((r) => r.tipo === t).length, acao: 'tipo:' + t }));
  const setores = new Map<string, number>();
  for (const r of bd) if (r.tipo === 'anunciante' && r.setor) { const s = r.setor.split(/[(,]/)[0].trim(); setores.set(s, (setores.get(s) || 0) + 1); }
  const topSetores: Ponto[] = [...setores].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR')).slice(0, 10).map(([rot, v]) => ({ rot, v, acao: 'busca:' + rot }));
  const agencias: Ponto[] = [...contasGanhas(bd, ano + '-01').values()].sort((a, b) => b.contas.length - a.contas.length || a.agencia.localeCompare(b.agencia, 'pt-BR')).slice(0, 10).map((g) => ({ rot: g.agencia, v: g.contas.length, sub: g.contas.map((c) => c.nome).join(', '), acao: 'busca:' + g.agencia }));
  const funil: Ponto[] = ETAPAS.map(([e, rot]) => { const L = ops.filter((o) => o.etapa === e); return { rot, v: L.length, sub: L.reduce((t, o) => t + (o.valor || 0), 0) ? brl(L.reduce((t, o) => t + (o.valor || 0), 0)) : '', acao: 'ir:funil' }; });
  const semanas: Ponto[] = [];
  for (let i = 7; i >= 0; i--) { const fim = new Date(Date.parse(hoje + 'T12:00:00Z') - i * 7 * 864e5), ini = new Date(fim.getTime() - 6 * 864e5); const a = ini.toISOString().slice(0, 10), b = fim.toISOString().slice(0, 10); semanas.push({ rot: `${b.slice(8, 10)}/${b.slice(5, 7)}`, v: ats.filter((x) => x.quando.slice(0, 10) >= a && x.quando.slice(0, 10) <= b).length, sub: `de ${a.slice(8, 10)}/${a.slice(5, 7)} a ${b.slice(8, 10)}/${b.slice(5, 7)}` }); }
  const novos = bd.filter((r) => { const q = r.atualizadoEm || r.criadoEm || ''; return q && Date.parse(hoje + 'T23:59:59Z') - Date.parse(q) < 48 * 3600e3; }).length;
  return {
    numeros: { registros: bd.length, novos, decidem: bd.filter((r) => nivelDe(r) === 'decide').length, janelas: janelas(bd, hoje).length, negociacao: ops.filter((o) => ['abordado', 'reuniao', 'proposta'].includes(o.etapa)).reduce((t, o) => t + (o.valor || 0), 0) },
    porMes, tipos, topSetores, agencias, funil, semanas,
  };
}

/** Barras horizontais com o valor escrito; cada barra com ação vira botão. */
function barras(id: string, titulo: string, sub: string, L: Ponto[], vazio: string) {
  const max = Math.max(1, ...L.map((p) => p.v)), tem = L.some((p) => p.v);
  const linhas = L.map((p) => { const w = (p.v / max) * 100, dentro = `<span class="br-r">${esc(p.rot)}</span><span class="br-t"><i style="width:${w.toFixed(1)}%"></i></span><b>${fmt(p.v)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}`;
    const dica = `${p.rot}: ${fmt(p.v)}${p.sub ? ' · ' + p.sub : ''}`;
    return p.acao ? `<li><button type="button" class="br" data-dash="${esc(p.acao)}" title="${esc(dica)}">${dentro}</button></li>` : `<li><div class="br" title="${esc(dica)}">${dentro}</div></li>`; }).join('');
  return cartao(id, titulo, sub, tem ? `<ol class="barras">${linhas}</ol>` : `<p class="nota">${esc(vazio)}</p>`, L);
}
/** Colunas no tempo (um mês ou uma semana por coluna). */
function colunas(id: string, titulo: string, sub: string, L: Ponto[], vazio: string) {
  const max = Math.max(1, ...L.map((p) => p.v)), tem = L.some((p) => p.v);
  const cols = L.map((p, i) => `<li title="${esc(`${p.sub || p.rot}: ${fmt(p.v)}`)}"><b>${p.v ? fmt(p.v) : ''}</b><span class="co-t"><i style="height:${((p.v / max) * 100).toFixed(1)}%"${i === L.length - 1 ? ' class="ult"' : ''}></i></span><small>${esc(p.rot)}</small></li>`).join('');
  return cartao(id, titulo, sub, tem ? `<ol class="colunas">${cols}</ol>` : `<p class="nota">${esc(vazio)}</p>`, L);
}
function cartao(id: string, titulo: string, sub: string, corpo: string, L: Ponto[]) {
  return `<section class="gr" aria-labelledby="${id}"><h3 class="st" id="${id}">${esc(titulo)}</h3><p class="nota">${esc(sub)}</p>${corpo}
  <details class="tab"><summary>Ver como tabela</summary><table><thead><tr><th scope="col">Item</th><th scope="col">Quantidade</th><th scope="col">Detalhe</th></tr></thead><tbody>${L.map((p) => `<tr><td>${esc(p.rot)}</td><td>${fmt(p.v)}</td><td>${esc(p.sub || '')}</td></tr>`).join('')}</tbody></table></details></section>`;
}

export function htmlDashboard(d: ReturnType<typeof dadosDashboard>) {
  const N = d.numeros;
  const tiles = [[N.registros, 'no Big Data', 'anunciantes, agências, veículos e pessoas', 'ir:bigdata'], [N.novos, 'novos em 48 h', 'da varredura diária e da equipe', 'ordem:recentes'], [N.decidem, 'decidem', 'pessoas que contratam mídia', 'decide'], [N.janelas, 'janelas abertas', 'conta nova, decisor novo, veículo em movimento', 'ir:painel'], [N.negociacao, 'em negociação', 'abordado, reunião e proposta', 'ir:funil', true]] as [number, string, string, string, boolean?][];
  return `<ul class="kpis dash-k">${tiles.map(([v, t, s, a, m], i) => `<li${i === 1 && v ? ' class="on"' : ''}><button type="button" class="kpi" data-dash="${a}"><b>${m ? brl(v) : fmt(v)}</b><span>${esc(t)}</span><small>${esc(s)}</small></button></li>`).join('')}</ul>
  <div class="dash">
   ${colunas('gMes', 'Sinais do mercado por mês', 'Trocas de conta, decisores novos e movimentos de veículos com data, nos últimos 12 meses.', d.porMes, 'Sem sinais com data ainda.')}
   ${barras('gAg', 'Agências que mais ganharam contas no ano', 'Clique para ver a agência e as contas no Big Data.', d.agencias, 'Sem trocas de conta registradas no ano.')}
   ${barras('gSet', 'Setores com mais anunciantes', 'Onde o Big Data está mais denso. Clique para filtrar.', d.topSetores, 'Sem anunciantes com setor.')}
   ${barras('gTipo', 'O Big Data por tipo', 'Clique para abrir o tipo no Big Data.', d.tipos, 'Big Data vazio.')}
   ${barras('gFunil', 'Funil por etapa', 'Oportunidades e valor estimado em cada etapa.', d.funil, 'Nenhuma oportunidade no funil ainda.')}
   ${colunas('gSem', 'Contatos registrados por semana', 'O ritmo da prospecção nas últimas 8 semanas.', d.semanas, 'Nenhum contato registrado ainda. Registre no Funil.')}
  </div>`;
}
