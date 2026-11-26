/**
 * A rede da MENTO a partir dos dados de LinkedIn da equipe. Ponto zero: a MENTO. 1ª volta: as pessoas da equipe.
 * 2ª: quem cada uma conhece (conexões de 1º grau) e as empresas por onde passou. 3ª: as empresas onde essas conexões
 * trabalham hoje. Cada ponto ganha uma nota de possibilidade de negócio, com os fatos que a explicam, e a reação em
 * cadeia abre, volta por volta, os pontos mais fortes. Nada vem de fora: só o que as duas pessoas exportaram.
 */
import type { Pessoa } from './exportacao';
import type { Pista, LigacaoPublica } from './publico';

export type Tipo = 'zero' | 'equipe' | 'contato' | 'empresa';
export type Nivel = 'decide' | 'influencia' | 'outro';
export interface No {
  id: string; tipo: Tipo; nome: string; sub: string; nota: number; fatos: string[];
  empresa?: string; nivel?: Nivel; url?: string; email?: string; agencia?: boolean; veiculo?: boolean; anunciante?: boolean;
  /** link da fonte pública (pesquisa na web aberta), quando o ponto veio dela */
  fonte?: string;
  /** ids da equipe que conhecem (contato) ou que têm ligação (empresa) */
  quem: string[];
}
export interface Aresta { b: string; rotulo: string; data?: string }
export interface Rede { nos: Map<string, No>; adj: Map<string, Aresta[]>; equipe: Pessoa[] }
export const ZERO = 'zero';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Nome de empresa para juntar grafias: sem acento, pontuação nem sufixo societário. */
export const chaveEmpresa = (s: string) => norm(s).replace(/&/g, ' e ').replace(/\b(s\.?\/?a\.?|ltda\.?|me|eireli|inc\.?|llc|ltd\.?|group|grupo|brasil|brazil|do brasil)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const CASA = /\bmento\b/i;
/** Nome que denuncia agência ou casa de comunicação (para separar parceiro/concorrente de anunciante). */
const AGENCIA = /\b(ag[eê]ncia|publicidade|propaganda|comunica[cç][aã]o|creative|criativ[ao]|ddb|ogilvy|publicis|mccann|wpp|havas|leo burnett|fcb|vml|wunderman|dentsu|grey|bbdo|tbwa|almap|africa|talent|artplan|propeg|isobar|r\/ga|soko|gut|jwt|y&r|media|m[ií]dia|digital|marketing|ad ?tech|produtora)\b/i;

const DECIDE = /\b(cmo|ceo|coo|cfo|founder|fundador|co-?fundador|s[oó]ci[oa]|owner|propriet[aá]ri[oa]|presidente|president|vp|vice[- ]presidente|diretor[a]?|director|head|gerente|manager|superintendente|chief)\b/i;
const AREA = /\b(marketing|mkt|marca|brand|m[ií]dia|media|comunica[cç][aã]o|communications?|growth|trade|publicidade|advertising|e-?commerce|digital|conte[uú]do|content|patroc[ií]nio|sponsorship|compras|procurement|comercial|neg[oó]cios|business)\b/i;
const TOPO = /\b(evp|svp|cmo|ceo|founder|fundador|co-?fundador|s[oó]ci[oa]|owner|propriet[aá]ri[oa]|presidente|president|chief)\b/i;
const INFLUENCIA = /\b(coordenador[a]?|coordinator|supervisor[a]?|especialista|specialist|analista s[eê]nior|senior|s[eê]nior|planejamento|planner|planning|brand manager|product marketing|key account|executiv[oa] de contas?|account)\b/i;

/** Quem decide a contratação de agência/mídia, pelo cargo. */
export function nivelDoCargo(cargo: string): Nivel {
  const c = cargo || '';
  if (TOPO.test(c) || (DECIDE.test(c) && AREA.test(c))) return 'decide';
  if (DECIDE.test(c) || (INFLUENCIA.test(c) && AREA.test(c))) return 'influencia';
  return 'outro';
}

const antes = (hoje: string, dias: number) => new Date(Date.parse(hoje) - dias * 864e5).toISOString().slice(0, 10);
const primeiro = (n: string) => n.split(' ')[0] || n;

/** Veículo de mídia (TV, rádio, jornal, canais): parceiro de venda da MENTO, não concorrente. */
const VEICULO = /\b(networks?|band|bandeirantes|tv|r[aá]dio|fm|globo|sbt|record|destak|jornal|revista|canal|channel|history|lifetime|cnn|bandnews|omega m[ií]dia|uber advertising)\b/i;

export function montarRede(equipe: Pessoa[], o: { hoje?: string; casa?: string; pistas?: Pista[]; ligacoes?: LigacaoPublica[] } = {}): Rede {
  const hoje = o.hoje || new Date().toISOString().slice(0, 10), umAno = antes(hoje, 365);
  const nos = new Map<string, No>(), adj = new Map<string, Aresta[]>();
  const add = (n: No) => { if (!nos.has(n.id)) { nos.set(n.id, n); adj.set(n.id, []); } return nos.get(n.id)!; };
  const ligar = (a: string, b: string, rotulo: string, data?: string) => {
    if (a === b || adj.get(a)!.some((x) => x.b === b)) return;
    adj.get(a)!.push({ b, rotulo, data }); adj.get(b)!.push({ b: a, rotulo, data });
  };
  const empresa = (nome: string) => {
    const k = chaveEmpresa(nome); if (!k || CASA.test(nome)) return undefined;
    const vei = VEICULO.test(nome), ag = !vei && AGENCIA.test(nome);
    return add({ id: 'e:' + k, tipo: 'empresa', nome: nome.trim(), sub: vei ? 'Veículo de mídia' : ag ? 'Agência ou casa de comunicação' : 'Empresa', nota: 0, fatos: [], agencia: ag, veiculo: vei, quem: [] });
  };
  add({ id: ZERO, tipo: 'zero', nome: o.casa || 'MENTO', sub: 'ponto zero', nota: 0, fatos: [], quem: [] });
  for (const p of equipe) {
    const id = 'm:' + p.id, atual = p.posicoes.find((x) => x.atual);
    add({ id, tipo: 'equipe', nome: p.nome || `Pessoa ${p.id}`, sub: p.titulo || atual?.cargo || '', nota: 0, fatos: [`${p.conexoes.length.toLocaleString('pt-BR')} conexões`], quem: [id] });
    ligar(ZERO, id, 'equipe');
    for (const x of p.posicoes) {
      const e = empresa(x.empresa); if (!e) continue;
      ligar(id, e.id, `${x.atual ? 'trabalha em' : 'passou por'}${x.cargo ? ': ' + x.cargo : ''}${x.inicio ? ` (${x.inicio}${x.fim ? ' a ' + x.fim : ''})` : ''}`, x.inicio);
      if (!e.quem.includes(id)) e.quem.push(id);
    }
  }
  for (const p of equipe) {
    const mid = 'm:' + p.id;
    for (const c of p.conexoes) {
      if (CASA.test(c.empresa)) continue; // colegas de casa não são prospecção
      const cid = 'c:' + (c.url ? c.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '') : norm(c.nome));
      const n = add({ id: cid, tipo: 'contato', nome: c.nome, sub: c.cargo, nota: 0, fatos: [], empresa: c.empresa, nivel: nivelDoCargo(c.cargo), url: c.url || undefined, email: c.email || undefined, quem: [] });
      if (!n.quem.includes(mid)) n.quem.push(mid);
      ligar(mid, cid, `conexão de ${primeiro(p.nome)}${c.desde ? ' desde ' + c.desde : ''}`, c.desde);
      const e = empresa(c.empresa); if (e) { ligar(cid, e.id, c.cargo || 'trabalha em'); }
    }
  }
  // pesquisa pública: quem decide ou vende nas casas (sem ligação direta com a equipe) e quem anuncia onde
  for (const p of o.pistas || []) {
    const e = empresa(p.empresa); if (!e) continue;
    const cid = 'c:' + (p.url ? p.url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '') : 'pub-' + norm(p.nome));
    if (nos.has(cid)) { nos.get(cid)!.fonte ||= p.fonte; continue; }
    add({ id: cid, tipo: 'contato', nome: p.nome, sub: p.cargo, nota: 0, fatos: [], empresa: p.empresa, nivel: nivelDoCargo(p.cargo), url: p.url, fonte: p.fonte, quem: [] });
    ligar(cid, e.id, p.cargo + (p.data ? ` (fonte de ${p.data})` : ''), p.data);
  }
  for (const l of o.ligacoes || []) {
    const a = empresa(l.a), b = empresa(l.b); if (!a || !b) continue;
    if (l.tipoB === 'anunciante') { b.anunciante = true; b.veiculo = false; b.agencia = false; b.sub = 'Anunciante'; }
    b.fonte ||= l.fonte; ligar(a.id, b.id, l.rotulo, l.data);
  }
  // notas
  const nomeDe = (id: string) => primeiro(nos.get(id)?.nome || '');
  for (const n of nos.values()) {
    const viz = adj.get(n.id)!, F: string[] = []; let s = 0;
    if (n.tipo === 'contato') {
      s = n.nivel === 'decide' ? 45 : n.nivel === 'influencia' ? 25 : 8;
      F.push(n.nivel === 'decide' ? 'Decide a contratação' : n.nivel === 'influencia' ? 'Influencia a decisão' : 'Contato');
      if (n.quem.length > 1) { s += 20; F.push(`Conhecido por ${n.quem.map(nomeDe).join(' e ')}`); }
      const desde = viz.filter((a) => a.b.startsWith('m:') && a.data).map((a) => a.data!).sort().pop();
      if (desde && desde >= umAno) { s += 5; F.push('Conexão recente'); }
      const e = viz.find((a) => a.b.startsWith('e:')), en = e && nos.get(e.b);
      if (en) {
        const colegas = adj.get(en.id)!.filter((a) => a.b.startsWith('c:')).length - 1;
        if (colegas > 0) { s += Math.min(15, colegas * 3); F.push(`Mais ${colegas} ${n.fonte && !n.quem.length ? 'mapeado(s)' : 'conhecido(s)'} na ${en.nome}`); }
        if (en.quem.length) { s += n.fonte && !n.quem.length ? 15 : 10; F.push(n.fonte && !n.quem.length ? `Porta pelo ${en.quem.map(nomeDe).join(' e ')}: ex-colega na ${en.nome}` : `${en.quem.map(nomeDe).join(' e ')} já trabalhou na ${en.nome}`); }
        if (en.agencia) { s -= 10; F.push('Agência: parceira ou concorrente'); }
        if (en.veiculo) F.push('Veículo de mídia: parceiro de venda da MENTO');
      }
    } else if (n.tipo === 'empresa') {
      const cs = viz.filter((a) => a.b.startsWith('c:')).map((a) => nos.get(a.b)!);
      const dec = cs.filter((c) => c.nivel === 'decide').length, inf = cs.filter((c) => c.nivel === 'influencia').length;
      const por = new Set(cs.flatMap((c) => c.quem));
      s = 10 + Math.min(30, cs.length * 3) + Math.min(30, dec * 10) + Math.min(10, inf * 3);
      if (cs.length) { const pub = cs.filter((c) => c.fonte && !c.quem.length).length; F.push(pub === cs.length ? `${cs.length} pessoa(s) mapeada(s) lá dentro` : `${cs.length} conhecido(s) lá dentro`); }
      if (dec) F.push(`${dec} decide(m) a contratação`);
      if (por.size > 1) { s += 15; F.push(`As duas pessoas conhecem gente lá (${[...por].map(nomeDe).join(' e ')})`); }
      if (n.quem.length) { s += 10; F.push(`${n.quem.map(nomeDe).join(' e ')} já trabalhou lá`); }
      if (n.agencia) { s -= 15; F.push('Agência: parceira ou concorrente'); }
      if (n.veiculo) F.push('Veículo de mídia: parceiro de venda da MENTO');
      if (n.anunciante) {
        const onde = viz.filter((a) => nos.get(a.b)?.veiculo).map((a) => nos.get(a.b)!);
        s += 20 + onde.filter((v) => v.quem.length).length * 15;
        F.push('Anunciante: contrata mídia');
        for (const v of onde) F.push(`Anuncia na ${v.nome}${v.quem.length ? ` (onde ${v.quem.map(nomeDe).join(' e ')} já trabalhou)` : ''}`);
      }
      n.quem = [...new Set([...n.quem, ...por])];
    }
    if (n.fonte) F.push('Fonte pública');
    if (n.tipo === 'contato' || n.tipo === 'empresa') { n.nota = Math.max(0, Math.min(100, s)); n.fatos = F; }
  }
  return { nos, adj, equipe };
}

/* ───────────── Reação em cadeia: volta por volta, os mais fortes seguem abrindo ───────────── */
export interface Ramo { id: string; pais: { id: string; rotulo: string }[]; forca: number; ger: number }
export interface Reacao { geracoes: Ramo[][]; ocultos: number[] }
export function reacao(R: Rede, limites = [10, 30, 24, 30]): Reacao {
  const visto = new Set([ZERO]), ger: Ramo[][] = [[{ id: ZERO, pais: [], forca: 100, ger: 0 }]], ocultos = [0];
  for (let g = 1; g <= limites.length; g++) {
    const cand = new Map<string, Ramo>();
    for (const r of ger[g - 1]) for (const a of R.adj.get(r.id) || []) {
      if (visto.has(a.b)) continue;
      const c = cand.get(a.b) || { id: a.b, pais: [], forca: 0, ger: g }; c.pais.push({ id: r.id, rotulo: a.rotulo }); cand.set(a.b, c);
    }
    const lista = [...cand.values()].map((c) => { c.forca = Math.min(100, Math.round(R.nos.get(c.id)!.nota * (1 - 0.06 * Math.max(0, g - 2)) + Math.min(15, (c.pais.length - 1) * 5))); return c; })
      .sort((x, y) => y.forca - x.forca || R.nos.get(x.id)!.nome.localeCompare(R.nos.get(y.id)!.nome, 'pt-BR'));
    const fica = g === 1 ? lista : lista.slice(0, limites[g - 1]);
    if (!fica.length) break;
    for (const c of fica) visto.add(c.id);
    ger.push(fica); ocultos.push(lista.length - fica.length);
  }
  return { geracoes: ger, ocultos };
}

/* ───────────── Multiverso: tudo o que as ligações alcançam, sem corte ───────────── */
export interface Multiverso { voltas: string[][]; pai: Map<string, { id: string; rotulo: string }>; total: number }
export function multiverso(R: Rede): Multiverso {
  const visto = new Set([ZERO]), pai = new Map<string, { id: string; rotulo: string }>(), voltas: string[][] = [[ZERO]];
  for (let fila = [ZERO]; fila.length;) {
    const prox: string[] = [];
    for (const id of fila) for (const a of R.adj.get(id) || []) {
      if (visto.has(a.b)) continue;
      // o pai é o vizinho mais forte da volta anterior
      visto.add(a.b); prox.push(a.b); pai.set(a.b, { id, rotulo: a.rotulo });
    }
    const naFila = new Set(fila);
    for (const id of prox) {
      // pai: o vizinho mais forte da volta anterior; entre pessoas da equipe, quem conhece há mais tempo
      const melhor = (R.adj.get(id) || []).filter((a) => naFila.has(a.b)).sort((x, y) => (R.nos.get(y.b)!.nota - R.nos.get(x.b)!.nota) || (x.data || '9').localeCompare(y.data || '9'))[0];
      if (melhor) pai.set(id, { id: melhor.b, rotulo: (R.adj.get(melhor.b) || []).find((a) => a.b === id)?.rotulo || melhor.rotulo });
    }
    const ordem = new Map(fila.map((id, i) => [id, i]));
    prox.sort((x, y) => ordem.get(pai.get(x)!.id)! - ordem.get(pai.get(y)!.id)! || R.nos.get(y)!.nota - R.nos.get(x)!.nota);
    if (!prox.length) break;
    voltas.push(prox); fila = prox;
  }
  return { voltas, pai, total: R.nos.size - 1 };
}

/** O caminho da MENTO até um ponto (pelo pai do multiverso). */
export function caminho(M: Multiverso, id: string): string[] {
  const c = [id]; let x = M.pai.get(id);
  while (x && c.length < 8) { c.unshift(x.id); x = M.pai.get(x.id); }
  return c;
}

/** As possibilidades de negócio, da mais forte para a mais fraca. */
export function radar(R: Rede, tipo: 'tudo' | 'contato' | 'empresa' = 'tudo'): No[] {
  return [...R.nos.values()].filter((n) => (n.tipo === 'contato' || n.tipo === 'empresa') && (tipo === 'tudo' || n.tipo === tipo))
    .sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Contatos que as duas (ou mais) pessoas conhecem. */
export const emComum = (R: Rede) => [...R.nos.values()].filter((n) => n.tipo === 'contato' && n.quem.length > 1).sort((a, b) => b.nota - a.nota);

const celula = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
/** A planilha do radar (ponto e vírgula, para o Excel em português). */
export function csvRadar(R: Rede, M: Multiverso, lista = radar(R)): string {
  const nome = (id: string) => R.nos.get(id)?.nome || '';
  const L = [['Nota', 'Tipo', 'Nome', 'Cargo', 'Empresa', 'Quem conhece', 'Caminho', 'Por que', 'LinkedIn', 'E-mail', 'Fonte pública']];
  for (const n of lista) L.push([String(n.nota), n.tipo === 'contato' ? 'Pessoa' : 'Empresa', n.nome, n.tipo === 'contato' ? n.sub : '', n.tipo === 'contato' ? n.empresa || '' : n.nome,
    n.quem.map(nome).join(', '), caminho(M, n.id).map(nome).join(' → '), n.fatos.join(' · '), n.url || '', n.email || '', n.fonte || '']);
  return '﻿' + L.map((l) => l.map(celula).join(';')).join('\r\n');
}
