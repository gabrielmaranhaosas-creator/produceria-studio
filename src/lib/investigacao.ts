/**
 * Investigação: o quadro de conexões entre a equipe da Produceria, as agências e empresas por onde ela passou e as
 * pessoas de produção e marketing que trabalham hoje nessas casas (ou nas que herdaram as extintas).
 * Lê o que já está no Big Data (mapa_pessoas, mapa_agencias, mapa_empresas): cada fio sai de um texto com fonte
 * (a "Ponte PRODUCERIA" de uma pessoa, a nota de uma agência, a trajetória de alguém da equipe).
 */
import { chave, mesmaEmpresa } from './nomes';
import { nivelDe, type Nivel } from './grafo';
import { PRODUCERIA, type Casa } from './casa';
import type { Experiencia } from './linkedin';

export interface PessoaInv {
  id: string; nome: string; cargo?: string; organizacao?: string; nivel?: Nivel; area?: string;
  conexao?: string; trajetoria?: string; linkedin?: string; fonte?: string; data?: string; atualizadoEm?: string;
  /** "Marca · campanha" em que a pessoa trabalhou (a ligação com a marca é comprovada pela fonte da pessoa). */
  campanha?: string;
  /** Passagens lidas do LinkedIn (cargo, casa e período), quando a pessoa entrou por um perfil colado. */
  experiencias?: Experiencia[];
}
/** Ligação registrada à mão no Studio (coleção mapa_ligacoes), sempre com fonte. Ponte: de = ORIGEM, quem = id da equipe. */
export type TipoLigacao = 'trabalha' | 'passou' | 'atende' | 'campanha' | 'grupo' | 'ponte';
export interface LigacaoInv { id: string; de: string; para: string; tipo: TipoLigacao; deNome?: string; paraNome?: string; quem?: string; fonte?: string; nota?: string; criadoEm?: string }
export const TIPOS_LIGACAO: [TipoLigacao, string][] = [['trabalha', 'trabalha em'], ['passou', 'passou por'], ['atende', 'atende a conta'], ['campanha', 'fez campanha para'], ['grupo', 'mesmo grupo'], ['ponte', 'ponte com a equipe']];
export interface OrgInv {
  id: string; nome: string; perfil?: string; grupo?: string; nota?: string; fontes?: string[]; sucessora?: string;
  linkedin?: string; site?: string; setor?: string;
}
export type TipoFio = 'equipe-org' | 'equipe-pessoa' | 'org-pessoa' | 'sucessao';
export interface Fio { de: string; para: string; tipo: TipoFio }
export interface NoOrg extends OrgInv { tipo: 'agencia' | 'empresa'; extinta: boolean }
export interface Caso { equipe: PessoaInv[]; orgs: NoOrg[]; contatos: PessoaInv[]; fios: Fio[] }

const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Nome da organização sem o "(ex-...)" e sem barras, para comparar com o que a pessoa diz. */
const base = (s: unknown) => String(s ?? '').replace(/\(.*?\)/g, ' ').replace(/\\+/g, ' ').trim();
export const ehEquipe = (p: PessoaInv) => /produceria/i.test(String(p.organizacao || ''));
const PONTE = /ponte produceria/;

/**
 * Quem da equipe um texto cita. Nome completo ou nome e sobrenome valem em qualquer texto; só o primeiro nome vale
 * depois de "Ponte PRODUCERIA" e quando nenhum outro da equipe tem o mesmo primeiro nome.
 */
export function citados(texto: unknown, equipe: PessoaInv[], ponte: RegExp = PONTE): string[] {
  const t = norm(texto); if (!t) return [];
  const iPonte = t.search(ponte), resto = iPonte >= 0 ? t.slice(iPonte) : '';
  const primeiro = (p: PessoaInv) => norm(p.nome).split(/\s+/)[0];
  const r: string[] = [];
  for (const p of equipe) {
    const partes = norm(p.nome).split(/\s+/).filter(Boolean); if (!partes.length) continue;
    const ultimo = partes[partes.length - 1], prim = partes[0];
    const re = (w: string) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    const completo = t.includes(partes.join(' ')) || (partes.length > 1 && re(prim).test(t) && re(ultimo).test(t) && t.includes(`${prim} ${ultimo}`));
    const unico = equipe.filter((o) => primeiro(o) === prim).length === 1;
    if (completo || (resto && unico && re(prim).test(resto))) r.push(p.id);
  }
  return r;
}

/** A organização (do caso) onde a pessoa trabalha hoje. */
export function orgDaPessoa(p: PessoaInv, orgs: OrgInv[]): OrgInv | undefined {
  const o = base(p.organizacao); if (!o) return undefined;
  return orgs.find((x) => chave(base(x.nome)) === chave(o)) || orgs.find((x) => mesmaEmpresa(base(x.nome), o));
}

/** Monta o caso: só entra quem tem fio com a equipe, direto ou por uma organização. */
export function montarCaso(d: { pessoas: PessoaInv[]; agencias: OrgInv[]; empresas: OrgInv[] }): Caso {
  const equipe = d.pessoas.filter(ehEquipe).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const todas: NoOrg[] = [
    ...d.agencias.map((o) => ({ ...o, tipo: 'agencia' as const, extinta: o.perfil === 'extinta' })),
    ...d.empresas.map((o) => ({ ...o, tipo: 'empresa' as const, extinta: o.perfil === 'extinta' })),
  ].filter((o) => o.nome && !/produceria/i.test(o.nome));
  const fios: Fio[] = [], visto = new Set<string>();
  const ligar = (de: string, para: string, tipo: TipoFio) => { const k = `${de}>${para}`; if (de !== para && !visto.has(k)) { visto.add(k); fios.push({ de, para, tipo }); } };
  const naOrg = new Set<string>();
  // equipe → organização: a nota da organização cita a pessoa, ou a trajetória da pessoa cita a organização
  for (const o of todas) {
    for (const id of citados(o.nota, equipe)) { ligar(id, o.id, 'equipe-org'); naOrg.add(o.id); }
    const nome = norm(base(o.nome));
    if (nome.length >= 3) for (const m of equipe) if (m.trajetoria && new RegExp(`(^|[^a-z])${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(norm(m.trajetoria))) { ligar(m.id, o.id, 'equipe-org'); naOrg.add(o.id); }
  }
  // contatos: quem tem "Ponte PRODUCERIA" e não é da equipe
  const contatos = d.pessoas.filter((p) => !ehEquipe(p) && PONTE.test(norm(p.conexao))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  for (const p of contatos) {
    for (const id of citados(p.conexao, equipe)) ligar(id, p.id, 'equipe-pessoa');
    const o = orgDaPessoa(p, todas); if (o) { ligar(o.id, p.id, 'org-pessoa'); naOrg.add(o.id); }
  }
  // sucessão: a extinta aponta para quem herdou (e a herdeira entra no caso)
  for (let mudou = true; mudou;) {
    mudou = false;
    for (const o of todas) if (naOrg.has(o.id) && o.sucessora && todas.some((x) => x.id === o.sucessora)) {
      ligar(o.id, o.sucessora, 'sucessao');
      if (!naOrg.has(o.sucessora)) { naOrg.add(o.sucessora); mudou = true; }
    }
  }
  const grau = (id: string) => fios.filter((f) => f.de === id || f.para === id).length;
  const orgs = todas.filter((o) => naOrg.has(o.id)).sort((a, b) => grau(b.id) - grau(a.id) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { equipe, orgs, contatos, fios };
}

/** Linha do tempo de uma extinta: ela e as herdeiras, na ordem, até a que existe hoje. */
export function linhagem(o: OrgInv, orgs: OrgInv[]): OrgInv[] {
  const r: OrgInv[] = [o];
  let x: OrgInv | undefined = o;
  while (x?.sucessora && r.length < 8) { const prox = orgs.find((y) => y.id === x!.sucessora); if (!prox || r.includes(prox)) break; r.push(prox); x = prox; }
  return r;
}

/** Ids ligados a um nó (um passo), para acender os fios ao selecionar. */
export function vizinhos(id: string, fios: Fio[]): Set<string> {
  const s = new Set<string>([id]);
  for (const f of fios) { if (f.de === id) s.add(f.para); if (f.para === id) s.add(f.de); }
  return s;
}
export const nivelContato = (p: PessoaInv): Nivel => nivelDe({ cargo: p.cargo, nivel: p.nivel });

/* ───────────────────────── Reação em cadeia ─────────────────────────
 * O universo junta numa rede só tudo o que o Big Data sabe: contas e movimentações (anunciante ↔ agência), quem
 * trabalha onde, por onde cada pessoa passou, a extinta e quem a herdou, e as pontes da PRODUCERIA. A partir de um
 * ponto de partida, a reação abre ramificação por ramificação e ranqueia cada ponto como possibilidade de negócio.
 */
export type TipoNo = 'origem' | 'empresa' | 'agencia' | 'pessoa';
export interface NoU {
  id: string; tipo: TipoNo; nome: string; sub: string; nota: number; fatos: string[];
  extinta?: boolean; nivel?: Nivel; org?: string; fontes: string[]; recente?: string; alvo?: boolean;
  /** Pessoa da casa (só aparece no mapa quando a casa pede a equipe à mostra): é ponte, não possibilidade de negócio. */
  equipe?: boolean;
  /** Dia (AAAA-MM-DD) em que a coleta diária gravou ou atualizou a pessoa. */
  chegou?: string;
}
export interface Aresta { a: string; b: string; rotulo: string; data?: string; fonte?: string }
export interface Universo { nos: Map<string, NoU>; adj: Map<string, Aresta[]>; /** nome da casa do ponto zero */ casa?: string }
export interface OrgGrafo { k: string; nome: string; ligacoes: { empresa: string; agencia: string; disciplina?: string; tipo?: string; data?: string; fonte?: string }[]; fontes?: string[]; site?: string; linkedin?: string; grupo?: string; perfil?: string; setor?: string; ranking?: number | null; radar?: { criterios?: string[]; sinais?: { texto: string; data?: string; fonte?: string }[]; acao?: string } | null; nota?: string }
export const ORIGEM = 'origem';
const PESOS: Record<string, number> = { imagem: 20, lancamentos: 20, varejo: 20, multicanal: 15, porta: 15, verba: 10 };

/** Data de N dias atrás (AAAA-MM-DD). */
const antes = (hoje: string, dias: number) => new Date(Date.parse(hoje) - dias * 864e5).toISOString().slice(0, 10);
const dm = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d && /^\d{4}-\d{2}$/.test(d) ? `${d.slice(5, 7)}/${d.slice(0, 4)}` : d || '');

export function montarUniverso(d: {
  empresas: OrgGrafo[]; agencias: OrgGrafo[]; pessoas: PessoaInv[]; orgsInv: OrgInv[]; alvos?: { nome: string }[]; hoje?: string; ligacoes?: LigacaoInv[];
  /** A casa do ponto zero (padrão: PRODUCERIA). */
  casa?: Casa;
  /** Quem conta como equipe da casa além de quem declara trabalhar nela (ex.: os perfis colados no teste da Mento). */
  equipeIds?: string[];
  /** A equipe aparece no mapa (1ª ramificação), e as casas por onde cada um passou saem dela, não do ponto zero. */
  equipeNoMapa?: boolean;
}): Universo {
  const casa = d.casa || PRODUCERIA, CASA = casa.nome, ponteRe = casa.ponte, CONTRATA = casa.contrata.charAt(0).toUpperCase() + casa.contrata.slice(1);
  const ehDaCasa = (p: PessoaInv) => (d.equipeIds || []).includes(p.id) || casa.equipe.test(String(p.organizacao || ''));
  const hoje = d.hoje || new Date().toISOString().slice(0, 10), d120 = antes(hoje, 120);
  const nos = new Map<string, NoU>(), adj = new Map<string, Aresta[]>();
  const add = (n: NoU) => { if (!nos.has(n.id)) { nos.set(n.id, n); adj.set(n.id, []); } return nos.get(n.id)!; };
  const ligar = (a: string, b: string, rotulo: string, data?: string, fonte?: string) => {
    if (a === b || !nos.has(a) || !nos.has(b)) return;
    if (adj.get(a)!.some((x) => x.b === b)) return;
    adj.get(a)!.push({ a, b, rotulo, data, fonte }); adj.get(b)!.push({ a: b, b: a, rotulo, data, fonte });
  };
  const ehAlvo = (nome: string) => (d.alvos || []).some((x) => mesmaEmpresa(x.nome, nome));
  const inv = (nome: string) => d.orgsInv.find((o) => chave(base(o.nome)) === chave(base(nome))) || d.orgsInv.find((o) => mesmaEmpresa(base(o.nome), base(nome)));
  const idOrg = (nome: string) => 'o:' + chave(base(nome));
  add({ id: ORIGEM, tipo: 'origem', nome: CASA, sub: 'ponto zero', nota: 0, fatos: [], fontes: [] });
  // organizações: agências primeiro (quem aparece nas duas listas fica como agência)
  for (const [lista, tipo] of [[d.agencias, 'agencia'], [d.empresas, 'empresa']] as const) for (const o of lista) {
    if (!chave(o.nome) || casa.equipe.test(o.nome)) continue;
    const x = inv(o.nome), id = idOrg(o.nome); if (nos.has(id)) continue;
    add({ id, tipo, nome: o.nome, sub: [tipo === 'agencia' ? 'Agência' : (o.setor || 'Anunciante'), o.grupo].filter(Boolean).join(' · '), nota: 0, fatos: [], extinta: x?.perfil === 'extinta' || o.perfil === 'extinta', fontes: [...(o.fontes || []), ...(x?.fontes || [])].filter(Boolean), alvo: ehAlvo(o.nome) });
  }
  // contas e movimentações
  for (const o of d.agencias) for (const l of o.ligacoes) ligar(idOrg(l.agencia), idOrg(l.empresa), l.disciplina || (l.tipo && l.tipo !== 'atende' ? l.tipo : 'atende a conta'), l.data, l.fonte);
  for (const o of d.empresas) for (const l of o.ligacoes) ligar(idOrg(l.empresa), idOrg(l.agencia), l.disciplina || (l.tipo && l.tipo !== 'atende' ? l.tipo : 'atende a conta'), l.data, l.fonte);
  // extinta → herdeira
  for (const o of d.orgsInv) if (o.sucessora) { const h = d.orgsInv.find((y) => y.id === o.sucessora); if (h) ligar(idOrg(o.nome), idOrg(h.nome), 'virou'); }
  // pessoas (a equipe fica dentro do ponto zero)
  const equipe = d.pessoas.filter(ehDaCasa), outros = d.pessoas.filter((p) => !ehDaCasa(p) && p.nome);
  const orgs = [...nos.values()].filter((n) => n.tipo === 'agencia' || n.tipo === 'empresa');
  const achaOrg = (nome?: string) => { const b = base(nome); if (!chave(b)) return undefined; return nos.get(idOrg(b)) || orgs.find((n) => mesmaEmpresa(base(n.nome), b)); };
  for (const p of outros) {
    const nivel = nivelContato(p), o = achaOrg(p.organizacao);
    add({ id: 'p:' + p.id, tipo: 'pessoa', nome: p.nome, sub: p.cargo || '', nota: 0, fatos: [], nivel, org: o?.nome || p.organizacao, fontes: [p.linkedin, p.fonte].filter(Boolean) as string[], chegou: dia(p.atualizadoEm) || undefined });
    if (o) ligar('p:' + p.id, o.id, p.cargo || 'trabalha em', p.data, p.fonte);
    else if (chave(base(p.organizacao))) { const id = idOrg(p.organizacao!); add({ id, tipo: 'empresa', nome: base(p.organizacao), sub: 'Organização', nota: 0, fatos: [], fontes: [], alvo: ehAlvo(p.organizacao!) }); orgs.push(nos.get(id)!); ligar('p:' + p.id, id, p.cargo || 'trabalha em', p.data, p.fonte); }
  }
  // a equipe à mostra: cada pessoa da casa vira ponto da 1ª ramificação, e as casas por onde passou (lidas do LinkedIn)
  // entram no mapa ligadas a ela, mesmo as que o Big Data ainda não conhece
  const naMesa = !!d.equipeNoMapa, daEquipe = (id: string) => (naMesa ? 'p:' + id : ORIGEM);
  if (naMesa) for (const m of equipe) {
    add({ id: 'p:' + m.id, tipo: 'pessoa', nome: m.nome, sub: m.cargo || '', nota: 0, fatos: [`Equipe da ${CASA}`], org: CASA, fontes: [m.linkedin, m.fonte].filter(Boolean) as string[], equipe: true });
    ligar(ORIGEM, 'p:' + m.id, 'equipe da ' + CASA);
    for (const e of m.experiencias || []) {
      if (!chave(base(e.org)) || casa.equipe.test(e.org)) continue;
      let o = achaOrg(e.org);
      if (!o) { const id = idOrg(e.org), ag = AGENCIA.test(e.org); o = add({ id, tipo: ag ? 'agencia' : 'empresa', nome: base(e.org), sub: ag ? 'Agência' : 'Organização', nota: 0, fatos: [], fontes: [], alvo: ehAlvo(e.org) }); orgs.push(o); }
      ligar('p:' + m.id, o.id, (e.atual ? '' : 'passou por: ') + (e.cargo || (e.atual ? 'trabalha em' : 'passagem')) + (e.periodo ? ` (${e.periodo})` : ''), undefined, m.linkedin);
    }
  }
  // por onde a pessoa passou (trajetória) e pontes da casa
  const reNome = (n: string) => new RegExp(`(^|[^a-z])${norm(base(n)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
  // a conta que a pessoa atende, quando o cargo diz (ex.: "Gerente de Projetos - Natura & Avon")
  for (const p of outros) if (p.cargo) {
    const t = norm(p.cargo.replace(/&/g, ' e ')), dono = achaOrg(p.organizacao)?.id;
    for (const o of orgs) if (o.id !== dono && norm(base(o.nome)).length >= 5 && reNome(o.nome).test(t)) ligar('p:' + p.id, o.id, 'atende a conta');
  }
  for (const p of outros) if (p.trajetoria) { const t = norm(p.trajetoria); for (const o of orgs) if (norm(base(o.nome)).length >= 3 && reNome(o.nome).test(t)) ligar('p:' + p.id, o.id, 'passou por'); }
  // a campanha que a pessoa fez liga a pessoa (e a casa dela) à marca
  for (const p of outros) if (p.campanha) {
    const marca = achaOrg(String(p.campanha).split('·')[0]), dono = achaOrg(p.organizacao);
    if (marca && marca.tipo !== 'pessoa') { ligar('p:' + p.id, marca.id, 'campanha: ' + curto2(String(p.campanha), 60), p.data, p.fonte); if (dono && dono.tipo === 'agencia' && marca.tipo === 'empresa') ligar(dono.id, marca.id, 'fez campanha', p.data, p.fonte); }
  }
  // o mesmo grupo (holding) liga as casas entre si, pela casa-mãe quando ela está no mapa
  const grupos = new Map<string, { nome: string; ids: string[] }>();
  for (const o of [...d.agencias, ...d.empresas, ...d.orgsInv] as { nome: string; grupo?: string }[]) {
    const g = base(o.grupo), n = achaOrg(o.nome); if (!n || !chave(g) || chave(g) === chave(base(o.nome)) || mesmaEmpresa(g, base(o.nome))) continue;
    const x = grupos.get(chave(g)) || { nome: g, ids: [] }; if (!x.ids.includes(n.id)) x.ids.push(n.id); grupos.set(chave(g), x);
  }
  for (const { nome, ids } of grupos.values()) { const mae = achaOrg(nome), rot = 'mesmo grupo: ' + (mae?.nome || nome); if (mae) for (const id of ids) ligar(id, mae.id, rot); else for (let i = 1; i < ids.length; i++) ligar(ids[0], ids[i], rot); }
  // ligações registradas no Studio, sempre com fonte
  const ROT_LIG = Object.fromEntries(TIPOS_LIGACAO) as Record<TipoLigacao, string>;
  for (const l of d.ligacoes || []) {
    if (l.tipo === 'ponte') { const m = equipe.find((x) => x.id === l.quem); ligar(m ? daEquipe(m.id) : ORIGEM, l.para, 'ponte: ' + (m?.nome.split(' ')[0] || CASA) + ' (registrada)', l.criadoEm?.slice(0, 10), l.fonte); }
    else ligar(l.de, l.para, ROT_LIG[l.tipo] || 'ligação registrada', l.criadoEm?.slice(0, 10), l.fonte);
  }
  const primeiro = (ids: string[]) => ids.map((i) => equipe.find((m) => m.id === i)?.nome.split(' ')[0]).filter(Boolean).join(', ');
  for (const o of orgs) {
    const x = inv(o.nome), ids = new Set(citados(x?.nota, equipe, ponteRe));
    for (const m of equipe) if (m.trajetoria && norm(base(o.nome)).length >= 3 && reNome(o.nome).test(norm(m.trajetoria))) ids.add(m.id);
    if (ids.size) { if (naMesa) for (const id of ids) ligar('p:' + id, o.id, 'passou por'); else ligar(ORIGEM, o.id, 'ponte: ' + primeiro([...ids])); }
  }
  // a ponte de um contato abre a casa onde ele trabalha (a pessoa vem na ramificação seguinte, com a casa)
  const pontePessoa = new Set<string>();
  for (const p of outros) if (ponteRe.test(norm(p.conexao))) {
    pontePessoa.add('p:' + p.id);
    const ids = citados(p.conexao, equipe, ponteRe), quem = ids.length ? primeiro(ids) : CASA;
    const de = naMesa && ids.length ? 'p:' + ids[0] : ORIGEM;
    const o = (adj.get('p:' + p.id) || []).find((a) => a.rotulo !== 'passou por' && nos.get(a.b)?.tipo !== 'pessoa');
    if (o) { if (!adj.get(de)!.some((a) => a.b === o.b)) ligar(de, o.b, `ponte: ${quem} (via ${p.nome.split(' ')[0]})`); }
    else ligar(de, 'p:' + p.id, 'ponte: ' + quem);
  }
  // nota de cada ponto como possibilidade de negócio, com os fatos que a explicam
  const porNome = new Map([...d.agencias, ...d.empresas].map((o) => [idOrg(o.nome), o]));
  for (const n of nos.values()) {
    if (n.tipo === 'origem' || n.equipe) continue;
    const viz = adj.get(n.id)!, F: string[] = []; let s = 10;
    if (n.tipo === 'pessoa') {
      s = n.nivel === 'contrata' ? 50 : n.nivel === 'aprova' ? 35 : 20;
      F.push(n.nivel === 'contrata' ? CONTRATA : n.nivel === 'aprova' ? 'Aprova fornecedor' : 'Alta liderança');
      if (pontePessoa.has(n.id)) { s += 20; F.push(`Tem ponte com a ${CASA}`); }
      const org = viz.find((a) => a.rotulo !== 'passou por' && nos.get(a.b)?.tipo !== 'pessoa' && a.b !== ORIGEM);
      const on = org && nos.get(org.b); if (on?.extinta) { s -= 25; F.push('Organização extinta: procurar onde está hoje'); }
    } else if (n.extinta) {
      s = 0; const h = viz.find((a) => a.rotulo === 'virou' && !nos.get(a.b)?.extinta); F.push(h ? `Extinta: virou ${nos.get(h.b)!.nome}` : 'Extinta');
    } else {
      const o = porNome.get(n.id);
      const rec = viz.filter((a) => (a.data || '') >= d120 && nos.get(a.b)?.tipo !== 'pessoa').sort((x, y) => (y.data || '').localeCompare(x.data || ''));
      if (rec.length) { s += 25; n.recente = rec[0].data; F.push(n.tipo === 'agencia' ? `Conta nova: ${nos.get(rec[0].b)!.nome} (${dm(rec[0].data)})` : `Mudou de agência: ${nos.get(rec[0].b)!.nome} (${dm(rec[0].data)})`); }
      const enc = (o?.radar?.criterios || []).reduce((t, c) => t + (PESOS[c] || 0), 0);
      if (enc) { s += Math.round(enc * 0.35); F.push(`Encaixe do craft ${enc}/100`); }
      if (o?.ranking && o.ranking <= 20) { s += 15; F.push(`${o.ranking}º maior anunciante em mídia`); }
      const sinal = o?.radar?.sinais?.slice().sort((x, y) => (y.data || '').localeCompare(x.data || ''))[0];
      if (sinal && (sinal.data || '') >= d120) { s += 10; F.push(curto2(sinal.texto)); if (!n.recente || (sinal.data || '') > n.recente) n.recente = sinal.data; }
      if (n.tipo === 'agencia') {
        const cl = viz.filter((a) => nos.get(a.b)?.tipo === 'empresa').length; if (cl) { s += Math.min(15, cl * 2); F.push(`${cl} cliente(s) mapeado(s)`); }
        if (o?.perfil && /independente/i.test(o.perfil)) { s += 10; F.push('Independente: escolhe o fornecedor'); }
      }
      const portas = viz.filter((a) => nos.get(a.b)?.nivel === 'contrata').length;
      if (portas) { s += Math.min(15, portas * 5); F.push(`${portas} pessoa(s) que ${casa.contrata.replace(/^contrata/, 'contratam')}`); }
      if (viz.some((a) => a.b === ORIGEM || nos.get(a.b)?.equipe)) { s += 10; F.push(`Já tem ponte com a ${CASA}`); }
    }
    n.nota = Math.max(0, Math.min(100, s)); n.fatos = F;
  }
  return { nos, adj, casa: CASA };
}
/** Nome que denuncia agência (para casas que só aparecem na trajetória de alguém da equipe). */
const AGENCIA = /\b(ag[eê]ncia|publicidade|propaganda|comunica[cç][aã]o|creative|criativ[ao]|ddb|ogilvy|publicis|mccann|wpp|havas|leo burnett|fcb|vml|wunderman|dentsu|grey|bbdo|tbwa|lew.?lara|almap|africa|talent|nbs|artplan|propeg|binder|gut|jwt|y&r|isobar|r\/ga|wieden|soko|mutato|cappuccino|david)\b/i;
const dia = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '');
const curto2 = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export interface Ramo { id: string; pais: { id: string; rotulo: string }[]; forca: number; ger: number }
export interface Reacao { semente: string; geracoes: Ramo[][]; ocultos: number[] }

/**
 * A reação em cadeia a partir de um ponto: cada ramificação traz os vizinhos ainda não vistos dos pontos da anterior,
 * ranqueados pela força (nota do ponto, quantos caminhos chegam nele e a distância). Só os mais fortes seguem abrindo.
 */
export function reacao(U: Universo, semente: string, limites = [10, 14, 18]): Reacao {
  const visto = new Set([semente]), ger: Ramo[][] = [[{ id: semente, pais: [], forca: 100, ger: 0 }]], ocultos: number[] = [0];
  for (let g = 1; g <= limites.length; g++) {
    const cand = new Map<string, Ramo>();
    for (const r of ger[g - 1]) {
      for (const a of U.adj.get(r.id) || []) {
        if (visto.has(a.b) || a.b === ORIGEM) continue;
        if (U.nos.get(r.id)?.extinta && r.id !== semente && a.rotulo !== 'virou') continue;
        const c = cand.get(a.b) || { id: a.b, pais: [], forca: 0, ger: g };
        c.pais.push({ id: r.id, rotulo: a.rotulo }); cand.set(a.b, c);
      }
    }
    const lista = [...cand.values()].map((c) => { const n = U.nos.get(c.id)!; const ext = n.extinta ? 30 : 0; c.forca = Math.round(n.nota * (1 - 0.08 * (g - 1)) + Math.min(18, (c.pais.length - 1) * 6) + ext); return c; })
      .sort((x, y) => y.forca - x.forca || U.nos.get(x.id)!.nome.localeCompare(U.nos.get(y.id)!.nome, 'pt-BR'));
    // equilíbrio: no máximo 60% de pessoas por ramificação, para a reação seguir abrindo casas
    const lim = limites[g - 1], maxP = Math.ceil(lim * 0.6), fica: Ramo[] = []; let np = 0;
    for (const c of lista) { if (fica.length >= lim) break; const p = U.nos.get(c.id)!.tipo === 'pessoa'; if (p && np >= maxP) continue; if (p) np++; fica.push(c); }
    for (const c of lista) { if (fica.length >= lim) break; if (!fica.includes(c)) fica.push(c); }
    if (!fica.length) break;
    for (const c of fica) visto.add(c.id);
    ger.push(fica); ocultos.push(lista.length - fica.length);
  }
  return { semente, geracoes: ger, ocultos };
}

/** O caminho da semente até um ponto da reação (pelo pai mais forte). */
export function caminho(R: Reacao, id: string): { id: string; rotulo: string }[] {
  const ramo = new Map(R.geracoes.flat().map((r) => [r.id, r]));
  const out: { id: string; rotulo: string }[] = []; let r = ramo.get(id), rot = '';
  for (let i = 0; r && i < 8; i++) { out.unshift({ id: r.id, rotulo: rot }); const p = r.pais[0]; if (!p) break; rot = p.rotulo; r = ramo.get(p.id); }
  return out;
}

/** Possibilidades de negócio da reação, da mais forte para a mais fraca (sem a semente e sem as extintas). */
export function leads(U: Universo, R: Reacao): (Ramo & { no: NoU })[] {
  return R.geracoes.slice(1).flat().map((r) => ({ ...r, no: U.nos.get(r.id)! })).filter((x) => !x.no.extinta && !x.no.equipe).sort((a, b) => b.forca - a.forca);
}

/** Busca de pontos do universo pelo nome (para escolher o ponto de partida). */
export function buscarNo(U: Universo, q: string, max = 8): NoU[] {
  const t = norm(q).trim(); if (t.length < 2) return [];
  return [...U.nos.values()].filter((n) => norm(n.nome).includes(t)).sort((a, b) => (norm(a.nome).startsWith(t) ? 0 : 1) - (norm(b.nome).startsWith(t) ? 0 : 1) || b.nota - a.nota).slice(0, max);
}

/* ───────────────────────── O que chegou ─────────────────────────
 * O mapa se alimenta sozinho: a coleta diária da Central grava pessoas (com a data em que gravou) e trocas de conta
 * (com a data da notícia). Daqui saem a faixa "Hoje no mapa", a etiqueta "novo", a linha do tempo e o ponto de partida
 * do dia.
 */
export interface MovDia { data: string; anunciante: string; agencia: string; tipo?: string; fonte?: string }
export interface Chegada { dia: string; pessoas: number; contas: number }
export interface Novidades { diaP: string; diaM: string; pessoas: string[]; orgs: string[]; trocas: (MovDia & { a?: string; b?: string })[]; semente?: string }

/** O ponto de uma organização pelo nome, com a mesma regra de junção do universo. */
export function idDeOrg(U: Universo, nome: string): string | undefined {
  const b = base(nome); if (!chave(b)) return undefined;
  const id = 'o:' + chave(b); if (U.nos.has(id)) return id;
  for (const n of U.nos.values()) if ((n.tipo === 'empresa' || n.tipo === 'agencia') && mesmaEmpresa(base(n.nome), b)) return n.id;
  return undefined;
}

/** Pessoas e trocas de conta que chegaram por dia, nos últimos `dias` dias até `hoje` (inclusive). */
export function chegadas(U: Universo, movs: MovDia[], dias: number, hoje: string): Chegada[] {
  const out: Chegada[] = [];
  for (let i = dias - 1; i >= 0; i--) out.push({ dia: antes(hoje, i), pessoas: 0, contas: 0 });
  const ix = new Map(out.map((c) => [c.dia, c]));
  for (const n of U.nos.values()) if (n.tipo === 'pessoa') { const c = ix.get(n.chegou || ''); if (c) c.pessoas++; }
  for (const m of movs) { const c = ix.get(dia(m.data)); if (c) c.contas++; }
  return out;
}

/**
 * O que é novo: as pessoas da coleta mais recente e as casas das trocas de conta mais recentes (ou as de um dia
 * escolhido). A semente é a casa mais forte dessas trocas, de onde a reação do dia abre.
 */
export function novidades(U: Universo, movs: MovDia[], foco = ''): Novidades {
  const pes = [...U.nos.values()].filter((n) => n.tipo === 'pessoa' && n.chegou);
  const diaP = foco || pes.reduce((m, n) => (n.chegou! > m ? n.chegou! : m), '');
  const diaM = foco || movs.reduce((m, x) => (dia(x.data) > m ? dia(x.data) : m), '');
  const pessoas = diaP ? pes.filter((n) => n.chegou === diaP).sort((a, b) => b.nota - a.nota).map((n) => n.id) : [];
  const trocas = diaM ? movs.filter((m) => dia(m.data) === diaM).map((m) => ({ ...m, a: idDeOrg(U, m.anunciante), b: idDeOrg(U, m.agencia) })) : [];
  const orgs = [...new Set(trocas.flatMap((t) => [t.a, t.b]).filter((x): x is string => !!x))];
  // a semente pesa a nota e o tamanho da reação que ela abre: a reação do dia precisa ter para onde ir
  const peso = (id: string) => U.nos.get(id)!.nota + Math.min(40, reacao(U, id).geracoes.flat().length);
  const semente = orgs.filter((id) => !U.nos.get(id)?.extinta).sort((x, y) => peso(y) - peso(x))[0];
  return { diaP, diaM, pessoas, orgs, trocas, semente };
}

/* ───────────────────────── O multiverso ─────────────────────────
 * O tamanho real da investigação: a partir do ponto de partida, todas as ramificações até onde as ligações alcançam,
 * sem o corte por força da reação. Cada ponto alcançado fica numa ramificação só (a primeira em que aparece), com um pai
 * (o vizinho mais forte da ramificação anterior), e daí sai a árvore ordenada que o quadro e o arquivo desenham.
 */
export interface Camada { ger: number; ids: string[]; empresas: number; agencias: number; pessoas: number; extintas: number; abertos: number }
export interface Multiverso { semente: string; camadas: Camada[]; pai: Map<string, { id: string; rotulo: string }>; alcance: number; fora: number; total: number; /** os pontos sem ligação com a semente, do mais forte ao mais fraco */ foraIds: string[] }

export function multiverso(U: Universo, semente: string, R?: Reacao): Multiverso {
  const abertos = new Set((R?.geracoes || []).flat().map((r) => r.id));
  const visto = new Set([semente]), pai = new Map<string, { id: string; rotulo: string }>();
  const camadas: Camada[] = [], conta = (g: number, ids: string[]): Camada => {
    const c: Camada = { ger: g, ids, empresas: 0, agencias: 0, pessoas: 0, extintas: 0, abertos: 0 };
    for (const id of ids) { const n = U.nos.get(id)!; if (n.extinta) c.extintas++; if (n.tipo === 'pessoa') c.pessoas++; else if (n.tipo === 'agencia') c.agencias++; else if (n.tipo === 'empresa') c.empresas++; if (abertos.has(id)) c.abertos++; }
    return c;
  };
  camadas.push(conta(0, [semente]));
  for (let g = 1, fila = [semente]; fila.length && g < 40; g++) {
    const prox: string[] = [];
    for (const id of fila) {
      const ext = U.nos.get(id)?.extinta && id !== semente;
      for (const a of U.adj.get(id) || []) {
        if (visto.has(a.b) || a.b === ORIGEM || (ext && a.rotulo !== 'virou')) continue;
        visto.add(a.b); prox.push(a.b); pai.set(a.b, { id, rotulo: a.rotulo });
      }
    }
    if (!prox.length) break;
    // dentro da ramificação: na ordem dos pais (assim os fios não se cruzam) e, sob o mesmo pai, do mais forte ao mais fraco
    const ordem = new Map(fila.map((id, i) => [id, i]));
    prox.sort((x, y) => (ordem.get(pai.get(x)!.id)! - ordem.get(pai.get(y)!.id)!) || (U.nos.get(y)!.nota - U.nos.get(x)!.nota) || U.nos.get(x)!.nome.localeCompare(U.nos.get(y)!.nome, 'pt-BR'));
    camadas.push(conta(g, prox)); fila = prox;
  }
  // total: os pontos do mapa sem o ponto zero; fora: os que nenhuma ligação alcança a partir daqui
  const total = U.nos.size - 1, alcance = visto.size - 1;
  const foraIds = [...U.nos.values()].filter((n) => !visto.has(n.id) && n.id !== ORIGEM).sort((x, y) => y.nota - x.nota || x.nome.localeCompare(y.nome, 'pt-BR')).map((n) => n.id);
  return { semente, camadas, pai, alcance, fora: foraIds.length, total, foraIds };
}

/* ───────────────────────── Pontes ─────────────────────────
 * Como ligar o que está longe. Os fora de alcance formam ilhas (pontos ligados entre si, sem fio até a semente); para
 * cada ilha, as pistas que já existem no mapa e as missões que trazem a informação que falta. Nada vira ligação sem fonte:
 * a missão aponta o que pesquisar, e a ligação achada é registrada com o link.
 */
export type TipoMissao = 'juntar' | 'trajetoria' | 'equipe' | 'agencia' | 'setor';
export interface Missao { tipo: TipoMissao; alvo: string; texto: string; link?: string; com?: string }
export interface Ilha { ids: string[]; chefe: string; valor: number; agencias: number; empresas: number; pessoas: number; missoes: Missao[] }
export interface Atalho { id: string; ger: number; forca: number; missoes: Missao[] }
const ORDEM_MISSAO: Record<TipoMissao, number> = { juntar: 0, trajetoria: 1, equipe: 2, agencia: 3, setor: 4 };
const linkedinDe = (n: NoU) => n.fontes.find((u) => /linkedin\.com\/in\//i.test(u));
const setorDe = (n: NoU) => (n.tipo === 'empresa' ? n.sub.split(' · ')[0] : '');
const SEM_SETOR = /^(Anunciante|Organização)$/;

/** As missões que ligam um ponto: por onde a pessoa passou, quem da equipe conhece a casa, qual é a agência da marca. */
function missoesDe(U: Universo, n: NoU, perto: string): Missao[] {
  const viz = U.adj.get(n.id) || [], out: Missao[] = [];
  if (n.tipo === 'pessoa') {
    if (!viz.some((a) => a.rotulo === 'passou por')) out.push({ tipo: 'trajetoria', alvo: n.id, texto: `Ler por onde ${n.nome} passou: uma casa antiga que já está ${perto} liga tudo`, link: linkedinDe(n) });
  } else if (!n.extinta) {
    out.push({ tipo: 'equipe', alvo: n.id, texto: `Perguntar à equipe quem conhece alguém em ${n.nome}: vira ponte direta com a ${U.casa || 'PRODUCERIA'}` });
    if (n.tipo === 'empresa' && !viz.some((a) => U.nos.get(a.b)?.tipo === 'agencia')) out.push({ tipo: 'agencia', alvo: n.id, texto: `Descobrir a agência de ${n.nome} (notícia, Cenp ou ficha técnica de campanha)` });
  }
  return out;
}

/** As ilhas dos fora de alcance, da mais valiosa para a menos, com pistas e missões. */
export function ilhas(U: Universo, M: Multiverso): Ilha[] {
  const fora = new Set(M.foraIds), feito = new Set<string>(), out: Ilha[] = [];
  const alcancadas = [...U.nos.values()].filter((n) => !fora.has(n.id) && (n.tipo === 'empresa' || n.tipo === 'agencia'));
  for (const id0 of M.foraIds) {
    if (feito.has(id0)) continue;
    const ids: string[] = [], fila = [id0]; feito.add(id0);
    while (fila.length) { const x = fila.pop()!; ids.push(x); for (const a of U.adj.get(x) || []) if (fora.has(a.b) && !feito.has(a.b)) { feito.add(a.b); fila.push(a.b); } }
    const nos = ids.map((i) => U.nos.get(i)!).sort((a, b) => b.nota - a.nota), conta = (t: TipoNo) => nos.filter((n) => n.tipo === t).length;
    const ms: Missao[] = [];
    for (const n of nos.filter((y) => y.tipo !== 'pessoa')) {
      // o mesmo nome escrito de outro jeito: juntar no Big Data já liga a ilha
      const k = chave(base(n.nome)), igual = k.length >= 4 && alcancadas.find((y) => { const ky = chave(base(y.nome)); return ky.length >= 4 && (ky.includes(k) || k.includes(ky)); });
      if (igual) ms.push({ tipo: 'juntar', alvo: n.id, com: igual.id, texto: `${n.nome} parece ser ${igual.nome}, que já está no mapa: juntar os dois no Big Data liga a ilha` });
      const st = setorDe(n), par = st && !SEM_SETOR.test(st) && alcancadas.filter((y) => setorDe(y) === st).sort((a, b) => b.nota - a.nota)[0];
      if (par) ms.push({ tipo: 'setor', alvo: n.id, com: par.id, texto: `Mesmo setor de ${par.nome} (${st}), que já está no mapa: um contato ou caso de lá serve de argumento` });
    }
    const perto = M.semente === ORIGEM ? 'no mapa' : 'na reação';
    for (const n of nos.filter((y) => y.tipo !== 'pessoa').slice(0, 2)) ms.push(...missoesDe(U, n, perto));
    for (const n of nos.filter((y) => y.tipo === 'pessoa').slice(0, 3)) ms.push(...missoesDe(U, n, perto));
    ms.sort((a, b) => ORDEM_MISSAO[a.tipo] - ORDEM_MISSAO[b.tipo] || Number(!!b.link) - Number(!!a.link));
    out.push({ ids: nos.map((n) => n.id), chefe: nos[0].id, valor: Math.min(100, nos[0].nota + Math.min(20, (nos.length - 1) * 4)), agencias: conta('agencia'), empresas: conta('empresa'), pessoas: conta('pessoa'), missoes: ms.slice(0, 6) });
  }
  return out.sort((a, b) => b.valor - a.valor || b.ids.length - a.ids.length);
}

/** Os abertos que estão longe (3ª ramificação em diante): uma ponte direta os traz para perto. */
export function atalhos(U: Universo, R: Reacao, max = 30): Atalho[] {
  return R.geracoes.slice(3).flat().filter((r) => !U.nos.get(r.id)?.extinta).sort((a, b) => b.forca - a.forca).slice(0, max)
    .map((r) => ({ id: r.id, ger: r.ger, forca: r.forca, missoes: missoesDe(U, U.nos.get(r.id)!, 'perto da semente').map((m) => (m.tipo === 'equipe' ? { ...m, texto: m.texto + `, e o ponto sai da ${r.ger}ª para a 1ª ramificação` } : m)) }));
}

/**
 * As ramificações da reação na ordem do desenho: cada ponto logo depois dos irmãos que vêm do mesmo pai, e os grupos na
 * ordem dos pais na ramificação anterior. Dentro do grupo, do mais forte ao mais fraco.
 */
export function ordenarReacao(R: Reacao): Ramo[][] {
  const out: Ramo[][] = [R.geracoes[0] || []];
  for (let g = 1; g < R.geracoes.length; g++) {
    const ordem = new Map(out[g - 1].map((r, i) => [r.id, i]));
    const chefe = (r: Ramo) => Math.min(...r.pais.map((p) => ordem.get(p.id) ?? 1e9));
    out.push(R.geracoes[g].map((r) => ({ ...r, pais: [...r.pais].sort((a, b) => (ordem.get(a.id) ?? 1e9) - (ordem.get(b.id) ?? 1e9)) }))
      .sort((x, y) => chefe(x) - chefe(y) || y.forca - x.forca));
  }
  return out;
}

/** Os dados do arquivo do mapa: o multiverso inteiro a partir do ponto de partida, com a reação aberta marcada, e os
 * pontos fora de alcance (g = -1, sem pai), para o arquivo poder mostrá-los numa volta própria. */
export interface MapaArquivo {
  geradoEm: string; semente: string; sementeNome: string; total: number; alcance: number; fora: number;
  camadas: { ger: number; n: number; empresas: number; agencias: number; pessoas: number; abertos: number }[];
  nos: { id: string; t: TipoNo; n: string; s: string; o?: string; nv?: Nivel; x?: 1; nota: number; g: number; p?: string; r?: string; f?: number; fa: string[]; fo: string[]; novo?: 1; alvo?: 1; eq?: 1 }[];
  extras: [string, string, string][];
}
export function dadosDoArquivo(U: Universo, R: Reacao, M: Multiverso, o: { geradoEm: string; novos?: Set<string> }): MapaArquivo {
  const forca = new Map(R.geracoes.flat().map((r) => [r.id, r.forca]));
  const ger = new Map<string, number>(); M.camadas.forEach((c) => c.ids.forEach((id) => ger.set(id, c.ger)));
  const nos: MapaArquivo['nos'] = [];
  for (const c of M.camadas) for (const id of c.ids) {
    const n = U.nos.get(id)!, p = M.pai.get(id);
    nos.push({ id, t: n.tipo, n: n.nome, s: n.sub, ...(n.org && n.tipo === 'pessoa' ? { o: n.org } : {}), ...(n.nivel && n.tipo === 'pessoa' ? { nv: n.nivel } : {}), ...(n.extinta ? { x: 1 as const } : {}),
      nota: n.nota, g: c.ger, ...(p ? { p: p.id, r: p.rotulo } : {}), ...(forca.has(id) ? { f: forca.get(id) } : {}), fa: n.fatos.slice(0, 4), fo: [...new Set(n.fontes)].filter((u) => /^https?:/.test(u)).slice(0, 3),
      ...(o.novos?.has(id) ? { novo: 1 as const } : {}), ...(n.alvo ? { alvo: 1 as const } : {}), ...(n.equipe ? { eq: 1 as const } : {}) });
  }
  for (const id of M.foraIds) {
    const n = U.nos.get(id)!; ger.set(id, -1);
    nos.push({ id, t: n.tipo, n: n.nome, s: n.sub, ...(n.org && n.tipo === 'pessoa' ? { o: n.org } : {}), ...(n.nivel && n.tipo === 'pessoa' ? { nv: n.nivel } : {}), ...(n.extinta ? { x: 1 as const } : {}),
      nota: n.nota, g: -1, fa: n.fatos.slice(0, 4), fo: [...new Set(n.fontes)].filter((u) => /^https?:/.test(u)).slice(0, 3), ...(o.novos?.has(id) ? { novo: 1 as const } : {}), ...(n.alvo ? { alvo: 1 as const } : {}) });
  }
  // as outras ligações entre os pontos do arquivo (além da árvore), para acender ao escolher um ponto
  const extras: [string, string, string][] = [], visto = new Set<string>();
  for (const id of ger.keys()) for (const a of U.adj.get(id) || []) {
    if (!ger.has(a.b) || M.pai.get(a.b)?.id === id || M.pai.get(id)?.id === a.b) continue;
    const k = id < a.b ? id + '|' + a.b : a.b + '|' + id; if (visto.has(k)) continue; visto.add(k); extras.push([id, a.b, a.rotulo]);
  }
  return { geradoEm: o.geradoEm, semente: M.semente, sementeNome: U.nos.get(M.semente)?.nome || '', total: M.total, alcance: M.alcance, fora: M.fora,
    camadas: M.camadas.map((c) => ({ ger: c.ger, n: c.ids.length, empresas: c.empresas, agencias: c.agencias, pessoas: c.pessoas, abertos: c.abertos })), nos, extras };
}
