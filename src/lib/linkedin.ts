/**
 * Leitura de um perfil do LinkedIn colado no Studio: o texto da página (selecionar tudo e copiar) ou o texto do
 * "Salvar em PDF". O LinkedIn não deixa o Studio buscar o perfil, então tudo parte do que a pessoa cola; a leitura é
 * a melhor possível e a tela mostra o resultado para conferir e corrigir antes de rodar a reação.
 */
export interface Experiencia { org: string; cargo: string; periodo: string; atual: boolean }
export interface PerfilLinkedIn {
  nome: string; titulo: string; local: string; linkedin: string;
  experiencias: Experiencia[];
  /** Organização de hoje (a primeira experiência em aberto, ou a primeira da lista). */
  organizacao: string; cargo: string;
  /** Texto corrido com cargo e casa de cada passagem, no formato que a Investigação lê. */
  trajetoria: string;
}

const MES = '(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan\\.?|feb|apr|may|aug|sep|oct|dec|january|february|march|april|june|july|august|september|october|november|december)';
const ATUAL = /(o momento|momento|presente|present|atual|até hoje|ate hoje|hoje)\b/i;
/** "jan de 2022 - o momento · 2 anos", "março de 2018 - dezembro de 2021 (3 anos)", "2015 - 2018". */
const DATAS = new RegExp(`^(${MES}\\.?\\s*(de\\s*)?)?\\d{4}\\s*[-–—]\\s*((${MES}\\.?\\s*(de\\s*)?)?\\d{4}|o momento|momento|presente|present|atual|até hoje|ate hoje)`, 'i');
const DURACAO = /^(\d+\s*(anos?|years?|yrs?|meses|mês|mes|months?|mos?)\s*(e\s*)?)+$/i;
const VINCULO = /\b(tempo integral|meio período|meio periodo|autônomo|autonomo|freelance|freelancer|estágio|estagio|trainee|temporário|temporario|terceirizado|contrato|aprendiz|full-time|part-time|self-employed|contract|internship|seasonal)\b/i;
const SECOES_FIM = /^(formação acadêmica|formacao academica|educação|educacao|education|licenças e certificados|licencas e certificados|certificações|licenses & certifications|competências|competencias|skills|recomendações|recomendacoes|recommendations|idiomas|languages|interesses|interests|projetos|projects|trabalho voluntário|volunteering|publicações|publications|cursos|courses|prêmios|honors & awards|organizações|causas)$/i;
const LOCAL = /(,\s*(brasil|brazil|portugal|estados unidos|united states)\b)|^(remoto|remote|híbrido|hibrido|presencial|on-site|hybrid)\b|\be região\b|área metropolitana|^(são paulo|sao paulo|rio de janeiro|belo horizonte|curitiba|porto alegre|recife|brasília|brasilia|salvador|fortaleza|campinas|florianópolis|lisboa)\b/i;
const SECAO_EXP = /^(experiência|experiencia|experience)$/i;
const RUIDO = /^(perfil|linkedin|mensagem|seguir|conectar|mais|more|message|follow|connect|enviar mensagem|ver perfil|informações de contato|contact info|\d+\+? (conexões|connections|seguidores|followers)|·|–|-|\(.*\)|ele\/dele|ela\/dela|he\/him|she\/her|they\/them|mostrar todas?.*|show all.*|exibir.*|ver todas?.*|página \d+ de \d+|page \d+ of \d+|contato|contact|principais competências|top skills|resumo|summary|sobre|about|atividade|activity|destaque|featured|logotipo.*|logo.*)$/i;

const limpa = (s: string) => s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').trim();
const titulo = (s: string) => s.split(/\s+/).map((w) => (/^(de|da|do|das|dos|e)$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

/** Nome tirado do endereço do perfil (linkedin.com/in/fulana-de-tal-1a2b3c → Fulana de Tal). */
export function nomeDoLink(url: string): string {
  const m = String(url || '').match(/linkedin\.com\/in\/([^/?#]+)/i); if (!m) return '';
  let s = ''; try { s = decodeURIComponent(m[1]); } catch { s = m[1]; }
  const partes = s.split('-').filter((p) => p && !/\d/.test(p) && !/^[a-f0-9]{6,}$/i.test(p));
  return titulo(partes.join(' ').toLowerCase());
}

/** O endereço do perfil, limpo (sem parâmetros), quando o texto traz um. */
export function linkDoTexto(texto: string): string {
  const m = String(texto || '').match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s)/?#]+/i);
  return m ? 'https://www.' + m[0].replace(/^https?:\/\//i, '').replace(/^[a-z]{2,3}\.linkedin/i, 'linkedin').replace(/^www\./i, '') : '';
}

/** Lê o perfil colado. `url` completa o link e, sem texto, dá o nome. */
export function lerPerfil(texto: string, url = ''): PerfilLinkedIn {
  const bruto = String(texto || '').split(/\r?\n/).map(limpa).filter(Boolean);
  // o LinkedIn repete cada linha para leitores de tela: some com as repetições seguidas
  const L: string[] = [];
  for (const l of bruto) if (L[L.length - 1] !== l) L.push(l);
  const linkedin = linkDoTexto(url) || linkDoTexto(texto);
  const util = (l: string) => !RUIDO.test(l) && !/linkedin\.com/i.test(l) && !/^\d+$/.test(l) && !/@/.test(l);

  // cabeçalho: nome, título e local (antes de qualquer seção)
  const iExp = L.findIndex((l) => SECAO_EXP.test(l));
  const iSec = L.findIndex((l, i) => i > 0 && /^(sobre|about|resumo|summary|atividade|activity|destaque|featured|experiência|experiencia|experience)$/i.test(l) && L.slice(0, i).some((x) => /^[\p{L}'’.\- ]+$/u.test(x) && x.split(/\s+/).length >= 2 && !RUIDO.test(x)));
  const topo = L.slice(0, iSec >= 0 ? iSec : iExp >= 0 ? iExp : 12).filter(util);
  const ehNome = (l: string) => l.length <= 60 && /^[\p{L}'’.\- ]+$/u.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 6;
  const iNome = topo.findIndex(ehNome);
  const nome = (iNome >= 0 ? topo[iNome] : '') || nomeDoLink(linkedin);
  const resto = iNome >= 0 ? topo.slice(iNome + 1) : topo;
  const tit = resto.find((l) => l.length > 3 && !LOCAL.test(l)) || '';
  const local = (resto.find((l) => LOCAL.test(l)) || '').replace(/\s*·.*$/, '');

  // experiências: cada linha de datas fecha uma passagem; o que vem antes diz o cargo e a casa
  const exps: Experiencia[] = [];
  if (iExp >= 0) {
    let fim = L.findIndex((l, i) => i > iExp && SECOES_FIM.test(l)); if (fim < 0) fim = L.length;
    const S = L.slice(iExp + 1, fim).filter((l) => !RUIDO.test(l));
    // PDF do LinkedIn: datas com a duração entre parênteses; página: duração depois de " · "
    const pdf = S.some((l) => DATAS.test(l) && /\(/.test(l));
    const ehLocal = (l: string) => LOCAL.test(l) && l.length <= 80;
    const curta = (l: string) => !!l && l.length <= 70 && l.split(/\s+/).length <= 8 && !/[.!?;:]$/.test(l) && !DATAS.test(l) && !DURACAO.test(l);
    let grupo = '', usado = -1;
    for (let i = 0; i < S.length; i++) {
      const l = S[i];
      // cabeçalho de grupo (várias funções na mesma casa): a casa seguida só da duração total ("5 anos 2 meses")
      const prox = S[i + 1] || '';
      if (!DATAS.test(l) && curta(l) && (DURACAO.test(prox) || (VINCULO.test(prox) && / · /.test(prox) && DURACAO.test(prox.split(' · ').pop() || '')))) { grupo = l.split(' · ')[0]; usado = i + 1; i++; continue; }
      if (!DATAS.test(l)) continue;
      const periodo = l.replace(/\s*[·(].*$/, '').trim();
      const ant = (k: number) => (i - k > usado ? S[i - k] : '');
      const a1 = ant(1), a2 = ant(2);
      let org = '', cargo = '';
      if (a1 && / · /.test(a1) && VINCULO.test(a1)) { org = a1.split(' · ')[0]; cargo = a2 && curta(a2) && !ehLocal(a2) ? a2 : ''; grupo = ''; }
      else if (a1 && VINCULO.test(a1) && !/ · /.test(a1)) { cargo = curta(a2) ? a2 : ''; org = grupo; }
      else if (pdf && a1 && curta(a2) && !ehLocal(a2)) { org = a2; cargo = a1; grupo = ''; }
      else if (grupo) { cargo = a1; org = grupo; }
      else if (pdf && a1) { cargo = a1; }
      else if (a1 && curta(a2) && !ehLocal(a2)) { org = a2; cargo = a1; }
      else cargo = a1;
      org = org.replace(/\s*·.*$/, '').trim();
      if (org || cargo) exps.push({ org, cargo, periodo, atual: ATUAL.test(l) });
      usado = i;
    }
  }
  const hoje = exps.find((e) => e.atual) || exps[0];
  // sem experiências lidas, o título costuma ser "Cargo na Casa" ou "Cargo | Casa"
  let organizacao = hoje?.org || '', cargo = hoje?.cargo || '';
  if (!organizacao && tit) { const m = tit.match(/^(.*?)\s+(?:na|no|em|at|@|\|)\s+(.+)$/i); if (m) { cargo = cargo || m[1].trim(); organizacao = m[2].split(/\s+[|·]\s+/)[0].trim(); } }
  if (!cargo) cargo = tit;
  const trajetoria = exps.map((e) => `${e.cargo || 'Passagem'} na ${e.org || '?'}${e.periodo ? ` (${e.periodo})` : ''}`).join('; ');
  return { nome, titulo: tit, local, linkedin, experiencias: exps, organizacao, cargo, trajetoria };
}
