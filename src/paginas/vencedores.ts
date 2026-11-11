// Vencedores de licitações: quem já ganhou contrato público no escopo da casa (PNCP, 24 meses).
// Quatro visões: quem abordar (empresas), órgãos e recompra, preços e calendário, contratos.
import { esc, int, brl, brk, dt } from '../lib/formato';
import { banco, lerArquivo, type Banco } from '../lib/db';
import { chave } from '../lib/nomes';
import { seletor, comId, abaNoEndereco, type Dialogo } from './dom';
import { kpis, vazio, abrirDialogo, devolverFoco } from '../componentes';

// ---------------------------------------------------------------- dados
export interface Contrato {
  id: string; link?: string; orgao: string; cnpjOrgao?: string; esfera?: string; uf?: string; municipio?: string;
  fornecedor: string; cnpj?: string; objeto: string; frente: string; valor?: number | null;
  inicio?: string; fim?: string; meses?: number; status?: string; modalidade?: string; conferir?: boolean;
  publicado?: string; segmento?: string; tipoEmpresa?: string;
}
export interface Empresa {
  cnpj: string; raiz?: string; filiais?: number; cnpjF: string; nome: string; tipo: string; segmento: string; prioridade: number;
  contratos: number; vigentes: number; valorTotal: number; valorVigente: number; valorCraft?: number; frentePrincipal: string;
  frentes: Record<string, number>; ufs: Record<string, number>; orgaos: string[]; nOrgaos: number; proximoFim: string;
  primeiro?: string; ultimo?: string; maior?: string;
}
export interface Orgao {
  cnpj: string; nome: string; uf: string; esfera: string; poder?: string; contratos: number; valorTotal: number; valorCraft: number;
  frentes: Record<string, number>; fornecedores: number; vencendo: number; valorVencendo: number; proximoVencimento: string;
}
export interface Preco { nome: string; craft: number; nContratos: number; vigentes: number; p25: number | null; mediana: number | null; p75: number | null; p90: number | null; total: number }
export interface Mapa {
  meta: { geradoEm: string; fonte: string; periodo: [string, string]; cobertura: { dias: number; lidos: number; parciais?: number }; noEscopo: number; empresas: number; orgaos: number; valorTotal: number; vigentes: number };
  precos: Record<string, Preco>; calendario: { mes: string; contratos: number; valor: number }[]; modalidades?: { modalidade: string; contratos: number; valor: number }[];
  empresas: Empresa[]; orgaos: Orgao[]; contratos: Contrato[];
}

const FORA_DA_LISTA = ['Microempreendedor (MEI)', 'Entidade ou empresa pública'];
const LEI14133 = 'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14133.htm';

/** Como abordar cada segmento. Comunicação visual, mídia exterior e gráfica são núcleo da casa; eventos não. */
export const SEGMENTOS: Record<string, { porque: string; passos: string[]; base?: { t: string; url: string } }> = {
  'Agência com conta pública': {
    porque: 'A agência ganhou a conta, mas a produção (filme, foto, áudio, finalização, peças de comunicação visual e OOH) é contratada de terceiros. Pela Lei 12.232/2010, art. 14, só fornece quem está cadastrado pelo órgão anunciante, e a agência apresenta 3 orçamentos por produção. Quem não está no cadastro não entra na cotação.',
    passos: ['Descubra no órgão (setor de comunicação ou Secom) como funciona o cadastro de fornecedores de produção da conta e se há chamamento público aberto.', 'Cadastre a Produceria no órgão com os documentos de habilitação (aba Habilitação das Licitações).', 'Escreva para o núcleo de produção ou RTV da agência: diga que a Produceria está (ou estará) cadastrada na conta e peça para entrar nas próximas cotações.', 'Mande a tabela de referência e 3 cases de craft parecidos com o que o órgão compra.', 'Na primeira cotação, responda no mesmo dia: prazo é o que tira fornecedor da lista.'],
    base: { t: 'Lei 12.232/2010, art. 14', url: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12232.htm' },
  },
  'Generalista que entrega craft': {
    porque: 'A empresa ganhou um contrato com vídeo, foto, comunicação visual ou conteúdo, mas o nome e o histórico mostram outro ramo. Em geral ela subcontrata a parte de craft. A Lei 14.133/2021 (art. 122) permite subcontratar partes do serviço até o limite que a Administração autorizar no edital.',
    passos: ['Abra o contrato e o edital no PNCP e confira se há cláusula de subcontratação e qual o limite.', 'Ofereça executar a parte de craft (white label), com prazo e preço por entrega.', 'Use como prova os preços de referência desta tela: mostre que dá para entregar dentro do valor contratado.', 'Combine um piloto pequeno (uma entrega) antes de qualquer exclusividade.'],
    base: { t: 'Lei 14.133/2021, art. 122', url: LEI14133 },
  },
  'Produtora concorrente': {
    porque: 'É uma produtora que já vende para governo. Pode ser parceira em pico de demanda, em disputas grandes (consórcio) ou numa praça onde a Produceria não tem equipe.',
    passos: ['Veja onde ela atua (UFs) e o porte dos contratos: é complementar ou concorrente direta da Produceria?', 'Se for complementar, proponha troca de capacidade: ela capta na praça dela, a Produceria finaliza (arte-final, retoque, motion, pós).', 'Para editais grandes que pedem atestados que nenhuma das duas tem sozinha, avalie consórcio (Lei 14.133, art. 15) quando o edital permitir.', 'Se for concorrente direta, use os contratos dela como referência de preço e de órgão comprador.'],
    base: { t: 'Lei 14.133/2021, art. 15', url: LEI14133 },
  },
  'Gráfica e comunicação visual': {
    porque: 'Comunicação visual, mídia exterior e produção gráfica são núcleo da Produceria. Aqui estão concorrentes diretas e parceiras de execução: quem imprime, instala e mantém o que a Produceria cria, finaliza e produz.',
    passos: ['Separe concorrente de parceira: quem só imprime em volume é parceira de execução; quem cria e produz sinalização, OOH ou PDV é concorrente.', 'Com a parceira, ofereça arte-final, fechamento de arquivo e produção gráfica das peças do contrato; ela fica com impressão e instalação.', 'Com a concorrente, use os contratos dela como referência de preço e de órgão comprador para as próximas disputas.'],
  },
  'Eventos e cenografia': {
    porque: 'Empresa do ramo de eventos que venceu um contrato do escopo (comunicação visual, audiovisual, conteúdo). A Produceria não faz eventos: só interessa a parte de craft do contrato.',
    passos: ['Leia o objeto: se tem comunicação visual, conteúdo de tela ou cobertura de foto e vídeo, há espaço para a Produceria.', 'Ofereça só essas entregas (arte, finalização, produção de peças), sem entrar na organização do evento.'],
  },
  Outros: { porque: 'Objeto do escopo, empresa sem perfil claro pelo nome. Confira o contrato antes de abordar.', passos: ['Abra o contrato no PNCP e veja quem executa de fato.'] },
  'Entidade ou empresa pública': { porque: 'Fundação, instituto, associação ou empresa pública: contratada por dispensa ou inexigibilidade, em geral sem disputa aberta. Fica nos números de mercado, não na lista de abordagem.', passos: [] },
  'Microempreendedor (MEI)': { porque: 'Microempreendedor individual: entra nos números de mercado, mas não é alvo de abordagem.', passos: [] },
};
const PASSOS_ORGAO = ['Veja no PNCP se o órgão publicou o Plano de Contratações Anual (PCA) com essa contratação para o próximo ano.', 'Escreva para o setor de compras pedindo para participar da pesquisa de preços quando abrirem o processo (a Lei 14.133, art. 23, prevê cotação direta com fornecedores).', 'Confira se a Produceria está no cadastro de fornecedores do órgão (e no Sicaf, para órgãos federais).', 'Leve a oportunidade para o funil e acompanhe o radar: o edital novo entra sozinho pela varredura diária.'];

/** Junta ao mapa publicado os contratos novos que a rotina diária grava no banco (coleção contratos_novos). */
export function mesclar(m: Mapa, novos: Contrato[]): Mapa {
  const vistos = new Set(m.contratos.map((c) => c.id));
  const add = novos.filter((c) => c.id && !vistos.has(c.id));
  if (!add.length) return m;
  const empresas = m.empresas.map((e) => ({ ...e, frentes: { ...e.frentes }, ufs: { ...e.ufs }, orgaos: [...e.orgaos] }));
  const porRaiz = new Map(empresas.map((e) => [e.raiz || e.cnpj.slice(0, 8), e]));
  for (const c of add) {
    if (!c.cnpj || FORA_DA_LISTA.includes(c.segmento || '')) continue;
    const raiz = c.cnpj.slice(0, 8), vig = c.status === 'vigente';
    let e = porRaiz.get(raiz);
    if (!e) {
      e = { cnpj: c.cnpj, raiz, filiais: 1, cnpjF: c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'), nome: c.fornecedor, tipo: c.tipoEmpresa || 'Outros / generalista', segmento: c.segmento || 'Outros', prioridade: 50, contratos: 0, vigentes: 0, valorTotal: 0, valorVigente: 0, valorCraft: 0, frentePrincipal: c.frente, frentes: {}, ufs: {}, orgaos: [], nOrgaos: 0, proximoFim: '', primeiro: c.publicado || c.inicio, ultimo: c.publicado || c.inicio, maior: c.id };
      empresas.push(e); porRaiz.set(raiz, e);
    }
    e.contratos += 1; e.valorTotal += c.valor || 0;
    e.frentes[c.frente] = (e.frentes[c.frente] || 0) + 1;
    if (c.uf) e.ufs[c.uf] = (e.ufs[c.uf] || 0) + 1;
    if (vig) { e.vigentes += 1; e.valorVigente += c.valor || 0; if (c.fim && (!e.proximoFim || c.fim < e.proximoFim)) e.proximoFim = c.fim; }
    if (!e.orgaos.includes(c.orgao)) { e.orgaos.push(c.orgao); e.nOrgaos += 1; }
    if ((c.publicado || '') > (e.ultimo || '')) e.ultimo = c.publicado;
  }
  empresas.sort((a, b) => b.prioridade - a.prioridade || b.valorVigente - a.valorVigente);
  const fim = add.reduce((x, c) => ((c.publicado || '') > x ? c.publicado! : x), m.meta.periodo[1]);
  return { ...m, empresas, contratos: [...add, ...m.contratos], meta: { ...m.meta, noEscopo: m.meta.noEscopo + add.length, vigentes: m.meta.vigentes + add.filter((c) => c.status === 'vigente').length, periodo: [m.meta.periodo[0], fim] } };
}

export interface Filtros { segmento: string; frente: string; uf: string; busca: string; soVigentes: boolean }

export function filtrarEmpresas(m: Mapa, f: Filtros): Empresa[] {
  const q = f.busca.trim().toLowerCase(), dig = q.replace(/\D/g, '');
  return m.empresas.filter((e) => e.segmento === f.segmento && (!f.soVigentes || e.vigentes > 0) && (!f.frente || e.frentes[f.frente]) && (!f.uf || e.ufs[f.uf])
    && (!q || e.nome.toLowerCase().includes(q) || (!!dig && e.cnpj.includes(dig)) || e.orgaos.some((o) => o.toLowerCase().includes(q))));
}
export function orgaosVencendo(m: Mapa, f: Filtros): Orgao[] {
  const q = f.busca.trim().toLowerCase();
  return m.orgaos.filter((o) => o.vencendo > 0 && (!f.uf || o.uf === f.uf) && (!f.frente || o.frentes[f.frente]) && (!q || o.nome.toLowerCase().includes(q)))
    .sort((a, b) => a.proximoVencimento.localeCompare(b.proximoVencimento));
}
export function filtrarContratos(m: Mapa, f: Filtros): Contrato[] {
  const q = f.busca.trim().toLowerCase();
  return m.contratos.filter((c) => (!f.soVigentes || c.status === 'vigente') && (!f.frente || c.frente === f.frente) && (!f.uf || c.uf === f.uf)
    && (!q || c.objeto.toLowerCase().includes(q) || c.fornecedor.toLowerCase().includes(q) || c.orgao.toLowerCase().includes(q)))
    .sort((a, b) => (b.valor || 0) - (a.valor || 0));
}

/** CSV para Excel em pt-BR: ponto e vírgula, aspas em tudo, BOM no começo. */
export const csv = (cab: string[], linhas: unknown[][]) => '﻿' + [cab, ...linhas].map((l) => l.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
const dec = (n: number | null | undefined) => String(n ?? '').replace('.', ',');
const reais = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }));

type Visao = 'empresas' | 'orgaos' | 'precos' | 'contratos';
interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }
const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc"><div id="vcK"><p class="note">Carregando o mapa de vencedores…</p></div>
  <div id="vcF"></div><p class="sr" id="vcLive" aria-live="polite" aria-atomic="true"></p><div id="vcO"></div></div>
  <dialog id="vcD" aria-labelledby="vcDT"></dialog>`;
  const $ = seletor(root);
  const D = $<Dialogo>('#vcD');
  let base: Mapa | null = null, m: Mapa | null = null, novos: Contrato[] = [], db: Banco | null = null;
  let alvos: { nome: string }[] = [], funil: { titulo?: string }[] = [];
  let visao: Visao = 'empresas', limite = 60;
  const f: Filtros = { segmento: 'Agência com conta pública', frente: '', uf: '', busca: '', soVigentes: true };
  let porRaiz = new Map<string, Contrato[]>(), porOrgao = new Map<string, Contrato[]>();
  const offs: (() => void)[] = [];
  const abas = abaNoEndereco<Visao>(['empresas', 'orgaos', 'precos', 'contratos'], 'empresas', (a) => { visao = a; limite = 60; if (m) { filtros(); lista(); } });
  visao = abas.inicial;
  const avisar = (t: string) => { $('#vcLive').textContent = t; };
  const fr = (k: string) => m?.precos[k]?.nome || k;
  devolverFoco(D, () => $<HTMLElement>('#vcF [aria-pressed=true]'));

  function recalcular() {
    if (!base) return;
    m = mesclar(base, novos);
    porRaiz = new Map(); porOrgao = new Map();
    for (const c of m.contratos) {
      if (c.cnpj) { const r = c.cnpj.slice(0, 8); (porRaiz.get(r) || porRaiz.set(r, []).get(r)!).push(c); }
      const o = c.cnpjOrgao || ''; (porOrgao.get(o) || porOrgao.set(o, []).get(o)!).push(c);
    }
    topo(); if (!root.querySelector('#vcF')!.childElementCount) filtros(); lista();
  }

  function contagemSegmentos(): Record<string, number> {
    const n: Record<string, number> = {};
    for (const e of m!.empresas) if (!f.soVigentes || e.vigentes) n[e.segmento] = (n[e.segmento] || 0) + 1;
    return n;
  }

  function topo() {
    const x = m!.meta, seg = contagemSegmentos();
    $('#vcK').innerHTML = `<div class="kpis">${kpis([
      { rotulo: 'Contratos no escopo', valor: `<b>${int(x.noEscopo)}</b>`, nota: `${int(x.vigentes)} vigentes` },
      { rotulo: 'Empresas vencedoras', valor: `<b>${int(x.empresas)}</b>`, nota: `${int(seg['Agência com conta pública'] || 0)} agências com conta vigente` },
      { rotulo: 'Órgãos compradores', valor: `<b>${int(x.orgaos)}</b>`, nota: `${int(m!.orgaos.filter((o) => o.vencendo).length)} com contrato vencendo` },
      { rotulo: 'Valor contratado', valor: `<b title="${esc(reais(x.valorTotal))}">${brk(x.valorTotal)}</b>`, nota: 'soma dos contratos no escopo' },
    ])}</div>
    <p class="note">Fonte: ${esc(x.fonte)}. Contratos publicados de ${dt(x.periodo[0])} a ${dt(x.periodo[1])}; ${int(x.cobertura.lidos)} contratos lidos em ${int(x.cobertura.dias)} dias${x.cobertura.parciais ? ` (${x.cobertura.parciais} dia(s) com páginas que falharam)` : ''}. Gerado em ${dt(x.geradoEm)}${novos.length ? `; mais ${int(novos.length)} contrato(s) novo(s) da rotina diária` : ''}.</p>`;
  }

  function filtros() {
    try { localStorage.setItem('vc.visao', visao); } catch { /* sem armazenamento */ }
    const ufs = [...new Set(m!.contratos.map((c) => c.uf).filter(Boolean))].sort() as string[];
    const abas: [Visao, string][] = [['empresas', 'Quem abordar'], ['orgaos', 'Órgãos e recompra'], ['precos', 'Preços e calendário'], ['contratos', 'Contratos']];
    $('#vcF').innerHTML = `<div class="vc-filtros"><div class="pills lc-abas" role="group" aria-label="Visão">${abas.map(([v, t]) => `<button type="button" data-visao="${v}" aria-pressed="${visao === v}">${t}</button>`).join('')}</div>
    ${visao === 'precos' ? '' : `<div class="vc-campos">
      <div class="f vc-q"><label for="vcQ">Buscar</label><input id="vcQ" type="search" value="${esc(f.busca)}" placeholder="${visao === 'orgaos' ? 'Órgão…' : 'Empresa, órgão ou CNPJ…'}"></div>
      <div class="f"><label for="vcFr">Frente</label><select id="vcFr"><option value="">Todas as frentes</option>${Object.entries(m!.precos).map(([k, p]) => `<option value="${esc(k)}"${f.frente === k ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="f"><label for="vcUF">UF</label><select id="vcUF"><option value="">Todo o Brasil</option>${ufs.map((u) => `<option${f.uf === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
      ${visao !== 'orgaos' ? `<label class="vc-chk"><input type="checkbox" id="vcVig" ${f.soVigentes ? 'checked' : ''}> Só vigentes</label>` : ''}
    </div>`}</div>`;
  }

  function maisBtn(total: number, passo: number) {
    return total > limite ? `<button type="button" class="ghost sm" data-mais="${passo}">Mostrar mais ${int(Math.min(passo, total - limite))}</button>` : '';
  }
  const baixarBtn = '<div class="acts"><button type="button" class="ghost sm" id="vcCSV">Baixar esta lista (.csv)</button><span class="note">Baixa o que está filtrado na tela, para abrir no Excel.</span></div>';
  const comoAbordar = (titulo: string, porque: string, passos: string[], b?: { t: string; url: string }) => `<section class="lc-box vc-como" aria-label="${esc(titulo)}"><span class="lab">${esc(titulo)}</span><p>${esc(porque)}</p>${passos.length ? `<ol>${passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}${b ? `<a class="cn-f" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.t)} ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</section>`;

  function lista() {
    const o = $('#vcO');
    if (!m) return;
    if (visao === 'empresas') {
      const seg = contagemSegmentos(), L = filtrarEmpresas(m, f), s = SEGMENTOS[f.segmento];
      o.innerHTML = `${baixarBtn}<div class="acts" role="group" aria-label="Segmento">${Object.keys(SEGMENTOS).filter((k) => seg[k]).map((k) => `<button type="button" class="chip" data-seg="${esc(k)}" aria-pressed="${f.segmento === k}">${esc(k)} · ${int(seg[k])}</button>`).join('')}</div>
      ${s ? comoAbordar('Como abordar · ' + f.segmento, s.porque, s.passos, s.base) : ''}
      <p class="note">${int(L.length)} empresa(s), em ordem de prioridade: valor vigente em frentes de craft, segmento, presença em SP e número de contratos.</p>
      ${L.length ? `<ul class="vc-l">${L.slice(0, limite).map((e) => `<li><button type="button" class="vc-linha" data-emp="${esc(e.cnpj)}">
        <span class="vc-prio num" title="Prioridade (0 a 100)">${e.prioridade}</span>
        <span class="vc-c"><b>${esc(e.nome)}</b><span class="note">${esc(fr(e.frentePrincipal))} · ${esc(Object.keys(e.ufs).join(', '))} · ${esc(e.orgaos.slice(0, 2).join('; '))}${e.nOrgaos > 2 ? ` +${e.nOrgaos - 2}` : ''}</span></span>
        <span class="vc-num"><b class="num" title="${esc(reais(e.valorVigente || e.valorTotal))}">${brk(e.valorVigente || e.valorTotal)}</b><span class="note">${e.vigentes} vigente(s) de ${e.contratos}${e.proximoFim ? ` · até ${dt(e.proximoFim)}` : ''}</span></span>
      </button></li>`).join('')}</ul>` : vazio({ titulo: 'Nenhuma empresa com esses filtros', texto: 'Tire um filtro ou desmarque "Só vigentes".' })}
      ${maisBtn(L.length, 60)}`;
    } else if (visao === 'orgaos') {
      const L = orgaosVencendo(m, f);
      o.innerHTML = `${baixarBtn}${comoAbordar('Como abordar · órgão com contrato vencendo', 'Contrato de craft perto do fim: o órgão vai precisar renovar ou licitar de novo. Quem chega antes do edital ajuda a formar o preço de referência e conhece o termo de referência.', PASSOS_ORGAO, { t: 'Lei 14.133/2021, arts. 12 (PCA) e 23 (pesquisa de preços)', url: LEI14133 })}
      <p class="note">${int(L.length)} órgão(s) com contrato de craft vencendo nos próximos 8 meses, do vencimento mais próximo para o mais distante.</p>
      ${L.length ? `<ul class="vc-l">${L.slice(0, limite).map((g) => {
        const c = (porOrgao.get(g.cnpj) || []).filter((x) => x.status === 'vigente' && x.fim).sort((a, b) => a.fim!.localeCompare(b.fim!))[0];
        return `<li><button type="button" class="vc-linha" data-org="${esc(g.cnpj)}"><span class="vc-prio vc-data num">${dt(g.proximoVencimento)}</span>
        <span class="vc-c"><b>${esc(g.nome)}</b><span class="note">${esc(g.uf)} · ${esc(g.esfera)}${c ? ` · ${esc(fr(c.frente))} com ${esc(c.fornecedor)}` : ''}</span></span>
        <span class="vc-num"><b class="num" title="${esc(reais(g.valorVencendo))}">${brk(g.valorVencendo)}</b><span class="note">${g.vencendo} contrato(s) vencendo</span></span></button></li>`;
      }).join('')}</ul>` : vazio({ titulo: 'Nenhum órgão com esses filtros', texto: 'Tire um filtro para ver mais.' })}
      ${maisBtn(L.length, 60)}`;
    } else if (visao === 'precos') {
      const totalMod = (m.modalidades || []).reduce((s, x) => s + x.contratos, 0);
      const maxCal = Math.max(1, ...m.calendario.map((c) => c.contratos));
      o.innerHTML = `<section aria-labelledby="vc-pr"><div class="ph"><h2 class="d d-sub" id="vc-pr">Preços de referência</h2><span class="note">valor global por contrato, sem empenhos avulsos</span></div>
      <div class="tw"><table class="vc-t"><thead><tr><th scope="col"><span class="th">Frente</span></th>${['Contratos', 'Vigentes', '25%', 'Mediana', '75%', '90%', 'Total'].map((h) => `<th scope="col" class="num"><span class="th">${h}</span></th>`).join('')}</tr></thead><tbody>
      ${Object.entries(m.precos).sort((a, b) => b[1].craft - a[1].craft).map(([, p]) => `<tr><th scope="row">${esc(p.nome)}</th><td class="num">${int(p.nContratos)}</td><td class="num">${int(p.vigentes)}</td><td class="num">${p.p25 == null ? '—' : brl(p.p25)}</td><td class="num"><b>${p.mediana == null ? '—' : brl(p.mediana)}</b></td><td class="num">${p.p75 == null ? '—' : brl(p.p75)}</td><td class="num">${p.p90 == null ? '—' : brl(p.p90)}</td><td class="num" title="${esc(reais(p.total))}">${brk(p.total)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">É o valor do contrato inteiro, não o preço de cada peça: serve para saber o porte típico de cada frente e onde a proposta da Produceria se encaixa. Metade dos contratos fica entre as colunas 25% e 75%.</p></section>
      ${totalMod ? `<section aria-labelledby="vc-mod"><div class="ph"><h2 class="d d-sub" id="vc-mod">Como os órgãos contratam craft</h2><span class="note">${int(totalMod)} contratos com a licitação consultada no PNCP</span></div>
      <ul class="vc-l vc-mods">${m.modalidades!.map((x) => `<li><span>${esc(x.modalidade)}</span><b class="num">${Math.round((x.contratos / totalMod) * 100)}%</b><span class="note num">${int(x.contratos)} · ${brk(x.valor)}</span></li>`).join('')}</ul>
      <p class="note">Dispensa e inexigibilidade são contratação direta, sem disputa aberta: aí pesa estar cadastrado no órgão e ser lembrado na pesquisa de preços. Dispensas eletrônicas aparecem no radar de licitações.</p></section>` : ''}
      <section aria-labelledby="vc-cal"><div class="ph"><h2 class="d d-sub" id="vc-cal">Quando os contratos de craft vencem</h2><span class="note">contratos vigentes por mês de fim · cada vencimento é uma nova disputa possível</span></div>
      <div class="vc-cal" role="list">${m.calendario.map((c) => `<div class="vc-mes" role="listitem" aria-label="${c.mes.slice(5)}/${c.mes.slice(0, 4)}: ${c.contratos} contrato(s), ${esc(brk(c.valor))}" title="${c.contratos} contrato(s), ${esc(reais(c.valor))}"><span class="vc-barra" style="height:${Math.max(4, (c.contratos / maxCal) * 100)}%"></span><span class="note num">${c.contratos}</span><span class="note">${c.mes.slice(5)}/${c.mes.slice(2, 4)}</span></div>`).join('')}</div></section>`;
    } else {
      const L = filtrarContratos(m, f);
      o.innerHTML = `${baixarBtn}<p class="note">${int(L.length)} contrato(s), do maior valor para o menor.</p>
      ${L.length ? `<div class="tw"><table class="vc-t vc-ct"><thead><tr><th scope="col"><span class="th">Objeto</span></th><th scope="col"><span class="th">Vencedor</span></th><th scope="col"><span class="th">Órgão</span></th><th scope="col" class="num"><span class="th">Valor</span></th><th scope="col"><span class="th">Vigência</span></th><th scope="col"><span class="sr">Link</span></th></tr></thead><tbody>
      ${L.slice(0, limite).map((c) => `<tr><td>${esc(c.objeto.slice(0, 160))}${c.objeto.length > 160 ? '…' : ''}<span class="sub">${esc(fr(c.frente))}${c.modalidade ? ' · ' + esc(c.modalidade) : ''}</span></td><td>${esc(c.fornecedor)}</td><td>${esc(c.orgao)}<span class="sub">${c.municipio ? esc(c.municipio) + ' · ' : ''}${esc(c.uf || '')}</span></td>
        <td class="num">${reais(c.valor)}${c.conferir ? '<span class="sub">valor alto para o órgão: confira</span>' : ''}</td><td class="num">${dt(c.inicio)} a ${dt(c.fim)}<span class="sub">${esc(c.status || '')}${c.meses ? ` · ${dec(c.meses)} meses` : ''}</span></td>
        <td>${c.link ? `<a class="cn-f" href="${esc(c.link)}" target="_blank" rel="noopener">PNCP ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : vazio({ titulo: 'Nenhum contrato com esses filtros', texto: 'Tire um filtro ou desmarque "Só vigentes".' })}
      ${maisBtn(L.length, 100)}`;
    }
  }

  // ---------------------------------------------------------------- diálogos
  const linhaContrato = (c: Contrato, topo: string) => `<li><a class="vc-ctr" href="${esc(c.link || '#')}" target="_blank" rel="noopener"><span class="vc-c"><b>${esc(topo)}</b><span class="note">${esc(c.objeto.slice(0, 180))}</span><span class="note">${esc(fr(c.frente))}${c.modalidade ? ' · ' + esc(c.modalidade) : ''} · ${dt(c.inicio)} a ${dt(c.fim)}</span></span>
    <span class="vc-num"><b class="num">${reais(c.valor)}</b>${c.conferir ? '<span class="note">valor atípico: confira</span>' : ''}${c.status === 'vigente' ? '<span class="tag ok">vigente</span>' : `<span class="note">${esc(c.status || '')}</span>`}</span></a></li>`;

  function abrirEmpresa(e: Empresa, quem: HTMLElement) {
    const cs = [...(porRaiz.get(e.cnpj.slice(0, 8)) || [])].sort((a, b) => (b.valor || 0) - (a.valor || 0));
    const s = SEGMENTOS[e.segmento];
    const ja = alvos.some((a) => chave(a.nome) === chave(e.nome));
    abrirDialogo(D, `<div class="dh"><div><span class="lab">${esc(e.segmento)} · prioridade ${e.prioridade}</span><h2 class="d d-sub" id="vcDT">${esc(e.nome)}</h2></div><button type="button" class="x" id="vcX" aria-label="Fechar">×</button></div>
    <div class="lc-box"><p><b>CNPJ:</b> ${esc(e.cnpjF)}${(e.filiais || 1) > 1 ? ` (+${(e.filiais || 1) - 1} filial)` : ''} · <b>Perfil pelo nome:</b> ${esc(e.tipo)}</p>
      <p><b>Contratos:</b> ${e.contratos} (${e.vigentes} vigentes) · <b>Valor:</b> ${reais(e.valorTotal)} · <b>Vigente:</b> ${reais(e.valorVigente)}</p>
      <p><b>Contratos por UF do órgão:</b> ${esc(Object.entries(e.ufs).map(([u, n]) => `${u} (${n})`).join(', '))} · ${e.nOrgaos} órgão(s)</p>
      <p><b>Frentes:</b> ${esc(Object.entries(e.frentes).map(([k, n]) => `${fr(k)} (${n})`).join(', '))}</p>
      ${e.primeiro && e.ultimo ? `<p><b>Primeiro e último contrato no período:</b> ${dt(e.primeiro)} e ${dt(e.ultimo)}</p>` : ''}</div>
    ${s ? comoAbordar('Como abordar', s.porque, s.passos) : ''}
    <div class="acts">${FORA_DA_LISTA.includes(e.segmento) ? '' : ja ? '<span class="tag ok">Já está na Captação</span>' : '<button type="button" class="sm" id="vcAlvo">Virar alvo na Captação</button>'}
      <a class="btn ghost sm" href="https://portaldatransparencia.gov.br/pessoa-juridica/${esc(e.cnpj)}" target="_blank" rel="noopener">Portal da Transparência ↗<span class="sr"> (abre em nova aba)</span></a></div>
    <p class="note">No Portal da Transparência dá para ver sanções (CEIS e CNEP) e contratos federais da empresa antes de fechar parceria.</p>
    <h3 class="d d-sub">Contratos no período (${cs.length})</h3><ul class="vc-l">${cs.slice(0, 40).map((c) => linhaContrato(c, `${c.orgao} · ${c.uf || ''}`)).join('')}</ul>`, quem, '#vcX');
    $('#vcX').onclick = () => D.close();
    const b = D.querySelector<HTMLButtonElement>('#vcAlvo');
    if (b) b.onclick = async () => {
      if (!db) { avisar('A Captação só funciona com o banco do Studio.'); return; }
      const vig = cs.filter((c) => c.status === 'vigente'), maior = cs.find((c) => c.id === e.maior), id = novoId('al');
      b.disabled = true;
      try {
        await db.collection('alvos').doc(id).set({ id, nome: e.nome, perfil: e.segmento === 'Agência com conta pública' ? 'publica' : 'independente', contato: '', status: 'Mapeado', origem: 'Mapa de vencedores',
          gatilho: `${e.vigentes} contrato(s) público(s) vigente(s), ${reais(e.valorVigente)} · ${fr(e.frentePrincipal)} · ${e.orgaos.slice(0, 2).join('; ')}`,
          fonte: maior?.link || '', proximoPasso: s?.passos[0]?.slice(0, 140) || 'Abrir o contrato no PNCP',
          notas: `CNPJ ${e.cnpjF}. ${e.segmento}. Contratos vigentes: ${vig.slice(0, 4).map((c) => `${c.orgao} (${reais(c.valor)}, até ${dt(c.fim)})`).join('; ')}. Fonte: PNCP.`, criadoEm: new Date().toISOString() });
        alvos = [...alvos, { nome: e.nome }];
        b.outerHTML = '<span class="tag ok">Já está na Captação</span>';
        avisar(`${e.nome} entrou na Captação, coluna Mapeado.`);
      } catch { b.disabled = false; avisar('Não foi possível criar o alvo. Tente de novo.'); }
    };
  }

  function abrirOrgao(g: Orgao, quem: HTMLElement) {
    const cs = [...(porOrgao.get(g.cnpj) || [])].sort((a, b) => (a.fim || '9').localeCompare(b.fim || '9'));
    const titulo = `Recompra · ${g.nome}`, ja = funil.some((x) => x.titulo === titulo);
    abrirDialogo(D, `<div class="dh"><div><span class="lab">${esc([g.uf, g.esfera, g.poder].filter(Boolean).join(' · '))}</span><h2 class="d d-sub" id="vcDT">${esc(g.nome)}</h2></div><button type="button" class="x" id="vcX" aria-label="Fechar">×</button></div>
    <div class="lc-box"><p><b>Contratos no período:</b> ${g.contratos} · <b>Valor:</b> ${reais(g.valorTotal)} · <b>Em craft:</b> ${reais(g.valorCraft)}</p>
      <p><b>Vencendo em 8 meses:</b> ${g.vencendo} (${reais(g.valorVencendo)}) · <b>Fornecedores:</b> ${g.fornecedores}</p></div>
    <div class="acts">${ja ? '<span class="tag ok">Já está no funil</span>' : '<button type="button" class="sm" id="vcFunil">Levar ao funil (eixo Público)</button>'}</div>
    <h3 class="d d-sub">Contratos (do vencimento mais próximo)</h3><ul class="vc-l">${cs.map((c) => linhaContrato(c, c.fornecedor)).join('')}</ul>`, quem, '#vcX');
    $('#vcX').onclick = () => D.close();
    const b = D.querySelector<HTMLButtonElement>('#vcFunil');
    if (b) b.onclick = async () => {
      if (!db) { avisar('O funil só funciona com o banco do Studio.'); return; }
      const vig = cs.filter((c) => c.status === 'vigente');
      b.disabled = true;
      try {
        await db.collection('pipeline').doc(novoId('fn')).set({ eixo: 'Público', titulo, alvo: g.nome, valor: g.valorVencendo || null, estagio: 'Identificada',
          proximoPasso: `Contrato atual vence em ${dt(g.proximoVencimento)}: pedir para entrar na pesquisa de preços`, fonte: vig[0]?.link || '', criadoEm: new Date().toISOString(), origem: 'Mapa de vencedores' });
        funil = [...funil, { titulo }];
        b.outerHTML = '<span class="tag ok">Já está no funil</span>';
        avisar('Entrou no funil, eixo Público.');
      } catch { b.disabled = false; avisar('Não foi possível levar ao funil. Tente de novo.'); }
    };
  }

  async function baixar() {
    if (!m) return;
    let nome = '', data = '';
    if (visao === 'empresas') {
      nome = `vencedores-${chave(f.segmento).replace(/\s+/g, '-')}.csv`;
      data = csv(['Prioridade', 'Empresa', 'CNPJ', 'Segmento', 'Frente principal', 'Contratos', 'Vigentes', 'Valor total', 'Valor vigente', 'UFs dos órgãos', 'Órgãos', 'Próximo fim'],
        filtrarEmpresas(m, f).map((e) => [e.prioridade, e.nome, e.cnpjF, e.segmento, fr(e.frentePrincipal), e.contratos, e.vigentes, dec(e.valorTotal), dec(e.valorVigente), Object.keys(e.ufs).join(', '), e.orgaos.join('; '), e.proximoFim]));
    } else if (visao === 'orgaos') {
      nome = 'orgaos-recompra.csv';
      data = csv(['Órgão', 'CNPJ', 'UF', 'Esfera', 'Contratos vencendo', 'Valor vencendo', 'Próximo vencimento'], orgaosVencendo(m, f).map((g) => [g.nome, g.cnpj, g.uf, g.esfera, g.vencendo, dec(g.valorVencendo), g.proximoVencimento]));
    } else {
      nome = 'contratos-vencedores.csv';
      data = csv(['Frente', 'Objeto', 'Vencedor', 'CNPJ', 'Órgão', 'UF', 'Município', 'Valor', 'Início', 'Fim', 'Situação', 'Modalidade', 'Link'],
        filtrarContratos(m, f).map((c) => [fr(c.frente), c.objeto, c.fornecedor, c.cnpj, c.orgao, c.uf, c.municipio, dec(c.valor), c.inicio, c.fim, c.status, c.modalidade, c.link]));
    }
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download indisponível nesta visualização. Abra o Studio no Claude.'); return; }
      const r = await d.save({ filename: nome, data });
      if (r && r.status === 'saved') avisar('Arquivo salvo: ' + nome);
    } catch (e) {
      const c = (e as { code?: string })?.code;
      if (c !== 'declined') avisar(c === 'rate_limited' ? 'Já há um download aguardando confirmação.' : 'Não foi possível gerar o arquivo agora.');
    }
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b) || D.contains(b) || !m) return;
    const d = b.dataset;
    if (d.visao) { abas.ir(d.visao as Visao); root.querySelector<HTMLElement>(`[data-visao="${visao}"]`)?.focus(); return; }
    if (d.seg) { f.segmento = d.seg; limite = 60; lista(); root.querySelector<HTMLElement>(`[data-seg="${CSS.escape(d.seg)}"]`)?.focus(); return; }
    if (d.mais) { limite += Number(d.mais); lista(); return; }
    if (d.emp) { const e = m.empresas.find((x) => x.cnpj === d.emp); if (e) abrirEmpresa(e, b); return; }
    if (d.org) { const g = m.orgaos.find((x) => x.cnpj === d.org); if (g) abrirOrgao(g, b); return; }
    if (b.id === 'vcCSV') baixar();
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'vcQ') { f.busca = t.value; limite = 60; lista(); }
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'vcFr') f.frente = t.value;
    else if (t.id === 'vcUF') f.uf = t.value;
    else if (t.id === 'vcVig') { f.soVigentes = t.checked; if (m) topo(); }
    else return;
    limite = 60; lista();
  });

  (async () => {
    try { base = await lerArquivo<Mapa>('vencedores.bin.wasm', 'vencedores.json'); recalcular(); }
    catch (e) { $('#vcK').innerHTML = `<div class="lc-box"><p>Não consegui abrir o mapa de vencedores (${esc(e instanceof Error ? e.message : String(e))}).</p></div>`; }
    db = await banco();
    if (!db) return;
    offs.push(db.collection<Contrato>('contratos_novos').onSnapshot((s) => { novos = s.docs.map(comId); recalcular(); }, () => {}));
    offs.push(db.collection<{ nome: string }>('alvos').onSnapshot((s) => { alvos = s.docs.map(comId); }, () => {}));
    offs.push(db.collection<{ titulo?: string }>('pipeline').onSnapshot((s) => { funil = s.docs.map(comId); }, () => {}));
  })();
  return () => { abas.parar(); offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
