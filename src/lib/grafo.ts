/**
 * Big Data do mercado: junta numa rede só quem anuncia, quem atende e quem decide.
 * Fontes: a base de mercado publicada (agências, contas, maiores anunciantes), as movimentações do banco
 * e o que a rotina diária grava em mapa_empresas, mapa_agencias e mapa_pessoas. Toda ligação guarda a fonte.
 */
import { chave, mesmaEmpresa } from './nomes';

export interface Fonte { url: string; data?: string }
export interface Ligacao { empresa: string; agencia: string; disciplina: string; data: string; tipo: string; fonte: string }
export type Nivel = 'contrata' | 'aprova' | 'lidera';
export interface PessoaMapa {
  id: string; nome: string; cargo: string; organizacao: string; area?: string; nivel?: Nivel; campanha?: string;
  linkedin?: string; instagram?: string; fonte: string; data?: string;
}
/** Os três níveis, na ordem em que a Produceria deve procurar as pessoas. */
export const NIVEIS: [Nivel, string, string][] = [
  ['contrata', 'Contrata produção', 'Produção gráfica, RTV, art buyer, finalização, produção e conteúdo: quem pede orçamento e manda o job.'],
  ['aprova', 'Aprova e gerencia', 'Gerentes de marca e marketing, direção de atendimento, de produção e de criação: quem aprova fornecedor e campanha.'],
  ['lidera', 'Alta liderança', 'CEO, CMO, VP e sócios: decidem a estratégia, raramente o fornecedor de produção.'],
];
/** Nível de uma pessoa pelo cargo, quando a fonte não diz. */
export function nivelDe(p: { cargo?: string; nivel?: Nivel }): Nivel {
  if (p.nivel) return p.nivel;
  const c = String(p.cargo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(ceo|cmo|cco|coo|cfo|cgo|chief|presidente|vice|vp|socio|socia|fundador|fundadora|founder|partner|global)\b/.test(c)) return 'lidera';
  if (/(produtor|produtora|producao|producer|rtv|art ?buyer|finaliza|tratamento|arte[- ]final|designer|analista|assistente|coordenador|coordenadora|traffic|trafego|conteudo|social media|especialista)/.test(c) && !/^dire/.test(c)) return 'contrata';
  return 'aprova';
}
export interface EmpresaMapa {
  id?: string; nome: string; setor?: string; grupo?: string; site?: string; instagram?: string; linkedin?: string;
  investimento?: { valor: number; ano: number; fonte: string; escala?: string } | null;
  agencias?: { agencia: string; disciplina?: string; desde?: string; fonte: string }[];
  fontes?: string[]; nota?: string;
}
export interface AgenciaMapa {
  id?: string; nome: string; grupo?: string; perfil?: string; cidade?: string; site?: string; instagram?: string; linkedin?: string;
  fontes?: string[]; nota?: string;
}
export interface MovimentoBase { data: string; anunciante: string; agencia: string; escopo?: string; fonte?: string; tipo?: string }
export interface MercadoBase {
  agencias?: { nome: string; rede?: boolean; tipo?: string; uf?: string; cenp?: number | null; contas?: { anunciante: string; data: string; tipo?: string; escopo?: string; fonte: string }[] }[];
  anunciantes?: { pos: number; nome: string; valor2025: number; valor2024: number | null; fonte: string }[];
  movimentos?: MovimentoBase[];
}

export interface NoEmpresa {
  k: string; nome: string; setor: string; grupo: string; ranking: number | null; investimento: EmpresaMapa['investimento'];
  ligacoes: Ligacao[]; pessoas: PessoaMapa[]; site: string; instagram: string; linkedin: string; fontes: string[]; ultima: string; nota: string;
}
export interface NoAgencia {
  k: string; nome: string; grupo: string; perfil: string; uf: string; cenp: number | null;
  ligacoes: Ligacao[]; pessoas: PessoaMapa[]; site: string; instagram: string; linkedin: string; fontes: string[]; ultima: string; nota: string;
}
export interface Grafo { empresas: NoEmpresa[]; agencias: NoAgencia[]; pessoas: PessoaMapa[]; ligacoes: Ligacao[] }

/** Chave que junta grafias da mesma organização ("Petrobras" e "Petróleo Brasileiro", não; "Artplan" e "Artplan Comunicação", sim). */
function achar<T extends { k: string; nome: string }>(lista: T[], nome: string): T | undefined {
  const k = chave(nome);
  return lista.find((x) => x.k === k) || lista.find((x) => mesmaEmpresa(x.nome, nome));
}

export function montarGrafo(o: {
  mercado?: MercadoBase | null; movimentos?: MovimentoBase[]; empresas?: EmpresaMapa[]; agencias?: AgenciaMapa[]; pessoas?: PessoaMapa[];
}): Grafo {
  const E: NoEmpresa[] = [], A: NoAgencia[] = [], L: Ligacao[] = [], vistos = new Set<string>();
  const empresa = (nome: string): NoEmpresa => {
    let e = achar(E, nome);
    if (!e) { e = { k: chave(nome), nome, setor: '', grupo: '', ranking: null, investimento: null, ligacoes: [], pessoas: [], site: '', instagram: '', linkedin: '', fontes: [], ultima: '', nota: '' }; E.push(e); }
    return e;
  };
  const agencia = (nome: string): NoAgencia => {
    let a = achar(A, nome);
    if (!a) { a = { k: chave(nome), nome, grupo: '', perfil: '', uf: '', cenp: null, ligacoes: [], pessoas: [], site: '', instagram: '', linkedin: '', fontes: [], ultima: '', nota: '' }; A.push(a); }
    return a;
  };
  const ligar = (l: Ligacao) => {
    if (!chave(l.empresa) || !chave(l.agencia)) return;
    const e = empresa(l.empresa), a = agencia(l.agencia);
    const id = e.k + '|' + a.k + '|' + (l.data || '').slice(0, 7);
    if (vistos.has(id)) return;
    vistos.add(id);
    const x = { ...l, empresa: e.nome, agencia: a.nome };
    L.push(x); e.ligacoes.push(x); a.ligacoes.push(x);
    if ((l.data || '') > e.ultima) e.ultima = l.data;
    if ((l.data || '') > a.ultima) a.ultima = l.data;
  };
  const m = o.mercado || {};
  for (const g of m.agencias || []) {
    const a = agencia(g.nome);
    a.perfil = a.perfil || (g.rede ? 'rede' : 'independente'); a.uf = a.uf || g.uf || ''; a.cenp = g.cenp ?? a.cenp;
    for (const c of g.contas || []) ligar({ empresa: c.anunciante, agencia: g.nome, disciplina: c.escopo || '', data: String(c.data || ''), tipo: c.tipo || '', fonte: c.fonte });
  }
  for (const r of m.anunciantes || []) {
    const e = empresa(r.nome);
    e.ranking = r.pos;
    e.investimento = e.investimento || { valor: r.valor2025, ano: 2025, fonte: r.fonte, escala: 'como publicado (Ibope Advertising Intelligence)' };
  }
  for (const mv of [...(m.movimentos || []), ...(o.movimentos || [])]) {
    ligar({ empresa: mv.anunciante, agencia: mv.agencia, disciplina: mv.escopo || '', data: String(mv.data || ''), tipo: mv.tipo || '', fonte: mv.fonte || '' });
  }
  for (const d of o.empresas || []) {
    const e = empresa(d.nome);
    Object.assign(e, { setor: d.setor || e.setor, grupo: d.grupo || e.grupo, site: d.site || e.site, instagram: d.instagram || e.instagram, linkedin: d.linkedin || e.linkedin, nota: d.nota || e.nota });
    if (d.investimento) e.investimento = d.investimento;
    e.fontes.push(...(d.fontes || []));
    for (const g of d.agencias || []) ligar({ empresa: d.nome, agencia: g.agencia, disciplina: g.disciplina || '', data: g.desde || '', tipo: 'atende', fonte: g.fonte });
  }
  for (const d of o.agencias || []) {
    const a = agencia(d.nome);
    Object.assign(a, { grupo: d.grupo || a.grupo, perfil: d.perfil || a.perfil, uf: d.cidade || a.uf, site: d.site || a.site, instagram: d.instagram || a.instagram, linkedin: d.linkedin || a.linkedin, nota: d.nota || a.nota });
    a.fontes.push(...(d.fontes || []));
  }
  const P = (o.pessoas || []).filter((p) => p.nome && p.organizacao);
  for (const p of P) {
    const a = achar(A, p.organizacao), e = achar(E, p.organizacao);
    if (a) a.pessoas.push(p); else (e || empresa(p.organizacao)).pessoas.push(p);
  }
  const porData = (x: { ultima: string }, y: { ultima: string }) => y.ultima.localeCompare(x.ultima);
  E.sort((x, y) => (x.ranking ?? 999) - (y.ranking ?? 999) || porData(x, y));
  A.sort((x, y) => y.ligacoes.length - x.ligacoes.length || porData(x, y));
  return { empresas: E, agencias: A, pessoas: P, ligacoes: L.sort((x, y) => (y.data || '').localeCompare(x.data || '')) };
}
