// Início: o que fazer agora. Resumo do Comercial (funil, alvos, carteira de licitações, passos atrasados),
// quem contatar hoje, próximos passos com data e atalhos da Oficina para a venda.
import { esc, int, brl, dt } from '../lib/formato';
import { hoje as hojeISO, addDias } from '../lib/datas';
import { ativo, devido } from '../lib/prioridade';
import { banco } from '../lib/db';
import type { Alvo } from '../lib/tipos';
import { seletor, comId } from './dom';
import { kpis, vazio } from '../componentes';
import { alertasHabilitacao } from './licitacoes';
import type { Habilitacao } from '../lib/tipos';

type Doc = Record<string, unknown> & { id: string };
export interface Passo { d: string; txt: string; onde: string; href: string }

/** Próximos passos com data, de oportunidades do funil, alvos da Captação e licitações da carteira. */
export function passos(pipeline: Doc[], alvos: Doc[], b2g: Doc[]): Passo[] {
  const s = (v: unknown) => String(v ?? '');
  const abertas = pipeline.filter((o) => !['Ganha', 'Perdida'].includes(s(o.estagio)));
  return [
    ...abertas.filter((o) => o.prazo).map((o) => ({ d: s(o.prazo).slice(0, 10), txt: s(o.proximoPasso || o.titulo), onde: 'Funil · ' + s(o.titulo) + (o.estagio ? ' · ' + s(o.estagio) : ''), href: '#funil' })),
    ...alvos.filter((a) => a.status !== 'Cliente' && a.status !== 'Descartado' && a.prazo).map((a) => ({ d: s(a.prazo).slice(0, 10), txt: s(a.proximoPasso || 'Próximo passo a definir'), onde: 'Alvo · ' + s(a.nome) + ' · ' + s(a.status), href: '#captacao' })),
    ...b2g.filter((o) => o.carteira && o.prazo).map((o) => ({ d: s(o.prazo).slice(0, 10), txt: s(o.objeto), onde: 'Licitação · ' + s(o.orgao) + (o.etapa ? ' · ' + s(o.etapa) : ''), href: '#b2g' })),
  ].sort((a, b) => a.d.localeCompare(b.d));
}

const OFICINA: [string, string, string][] = [['ferramentas', 'Bancada', 'Desdobramento pela tabela, revisão de texto, checagem de peça e cotações.'], ['grafica', 'Gráfica', 'Ficha técnica, fechamento de arquivo e pacote do job.'], ['plugins', 'Plugins', 'Photoshop, Magnific, Firefly.'], ['agentes', 'Agentes', 'Especialistas da casa para pensar junto.'], ['biblioteca', 'Biblioteca', 'Guias de marca, regras de cliente e referências.']];
const VENDA: [string, string, string][] = [['#captacao', 'Abordar um alvo', 'A Oficina vira argumento: casos e provas entram na mensagem.'], ['#estrategia', 'Proposta-base de oferta', 'Transforma uma capacidade da Oficina em oferta vendável.'], ['#b2g', 'Avaliar licitação', 'GO / NO-GO cruzando o edital com o que a Oficina entrega.'], ['#tabela', 'Tabela de serviços', 'Preços que sustentam qualquer orçamento.']];

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc ini">
  <header class="page-head"><span class="eyebrow">Início · ${dt(hojeISO())}</span><div class="row"><h1 class="d d-title">Oficina e Comercial</h1><a class="btn" href="#central">Notícias e leads →</a></div>
    <p class="lead measure muted">A Oficina é onde o craft acontece; o Comercial é onde ele vira negócio. Tudo que a IA propõe chega aqui como rascunho para a equipe decidir.</p></header>
  <div id="inK"></div>
  <div class="ini-grid"><div class="ini-col">
    <section aria-labelledby="in-h"><div class="ph"><h2 class="d d-sub" id="in-h">Quem contatar hoje</h2><a class="cn-f" href="#agenda">Agenda →</a></div><div id="inH"></div></section>
    <section aria-labelledby="in-p"><div class="ph"><h2 class="d d-sub" id="in-p">Próximos passos comerciais</h2><a class="cn-f" href="#funil">Funil →</a></div><div id="inP"></div></section>
    <section aria-labelledby="in-v"><div class="ph"><h2 class="d d-sub" id="in-v">Da Oficina para a venda</h2></div>
      <ul class="vc-l">${VENDA.map(([h, t, d]) => `<li><a class="ini-link" href="${h}"><span class="vc-c"><b>${t}</b><span class="note">${d}</span></span><span aria-hidden="true">→</span></a></li>`).join('')}</ul></section></div>
  <div class="ini-lado"><section class="lc-box ini-alerta" id="inA" aria-labelledby="in-a" hidden></section>
  <section class="lc-box ini-of" aria-labelledby="in-o"><span class="lab">Oficina</span><h2 class="d d-sub" id="in-o">Onde o craft acontece</h2>
    <ul>${OFICINA.map(([h, t, d]) => `<li><a href="#${h}"><b>${t} →</b><span class="note">${d}</span></a></li>`).join('')}</ul></section></div></div></div>`;
  const $ = seletor(root);
  const D: Record<string, Doc[]> = { pipeline: [], alvos: [], b2g: [], biblioteca: [], fichas: [], habilitacao: [] };
  const offs: (() => void)[] = [];

  function render() {
    const h = hojeISO(), sem = addDias(h, 7);
    const abertas = D.pipeline.filter((o) => !['Ganha', 'Perdida'].includes(String(o.estagio)));
    const emJogo = abertas.reduce((s, o) => s + (Number(o.valor) || 0), 0);
    const andamento = D.alvos.filter((a) => a.status !== 'Cliente' && a.status !== 'Descartado');
    const carteira = D.b2g.filter((o) => o.carteira), vCart = carteira.reduce((s, o) => s + (Number(o.valor) || 0), 0);
    const P = passos(D.pipeline, D.alvos, D.b2g), atras = P.filter((p) => p.d < h).length, prox = P.filter((p) => p.d >= h && p.d <= sem).length;
    $('#inK').innerHTML = `<div class="kpis ini-k">${kpis([
      { rotulo: 'Funil aberto', valor: `<b>${int(abertas.length)}</b>`, nota: emJogo ? brl(emJogo) + ' em jogo' : 'sem valor registrado' },
      { rotulo: 'Alvos em andamento', valor: `<b>${int(andamento.length)}</b>`, nota: `${D.alvos.filter((a) => a.status === 'Cliente').length} viraram cliente` },
      { rotulo: 'Carteira de licitações', valor: `<b>${int(carteira.length)}</b>`, nota: vCart ? brl(vCart) + ' estimados' : 'sem valor estimado' },
      { rotulo: 'Passos atrasados', valor: `<b${atras ? ' class="quente"' : ''}>${int(atras)}</b>`, nota: `${prox} vencem nos próximos 7 dias` },
      { rotulo: 'Biblioteca', valor: `<b>${int(D.biblioteca.length)}</b>`, nota: `${D.fichas.length} ficha(s) técnica(s) na Gráfica` },
    ])}</div>`;
    const hojeL = (D.alvos as unknown as Alvo[]).filter((a) => ativo(a) && a.status !== 'Descartado').map((a) => ({ a, d: devido(a) })).filter((x) => x.d && x.d <= h).sort((x, y) => x.d.localeCompare(y.d));
    $('#inH').innerHTML = hojeL.length ? `<ul class="vc-l">${hojeL.slice(0, 5).map(({ a, d }) => `<li><a class="ini-passo" href="#agenda"><span class="num${d < h ? ' cp-venc' : ' note'}">${d < h ? 'atrasado' : 'hoje'}</span><span class="vc-c"><b>${esc(a.nome)}</b><span class="note">${esc(a.proximoToque?.texto || a.proximoPasso || 'Definir próximo passo')}</span></span></a></li>`).join('')}</ul>` : '<p class="note">Nenhum contato vencendo hoje.</p>';
    const hab = alertasHabilitacao(D.habilitacao as unknown as Habilitacao[], h);
    const prazos = D.b2g.filter((o) => o.carteira && o.prazo && String(o.prazo).slice(0, 10) >= h && String(o.prazo).slice(0, 10) <= sem).sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
    const al = $('#inA');
    al.hidden = !hab.length && !prazos.length;
    al.innerHTML = `<span class="lab" id="in-a">Licitações · atenção</span>
      ${prazos.length ? `<p><b>${prazos.length} proposta(s) da carteira vencem em 7 dias</b></p><ul class="ini-al">${prazos.slice(0, 4).map((o) => `<li><a href="#b2g"><span class="num">${dt(String(o.prazo))}</span> ${esc(String(o.objeto || '').slice(0, 90))}</a></li>`).join('')}</ul>` : ''}
      ${hab.length ? `<p><b>${hab.filter((x) => x.situacao === 'vencida').length} certidão(ões) vencida(s) · ${hab.filter((x) => x.situacao === 'vence').length} vencem em 30 dias</b></p><ul class="ini-al">${hab.slice(0, 6).map((x) => `<li><a href="#b2g"><span class="num${x.situacao === 'vencida' ? ' cp-venc' : ''}">${x.situacao === 'vencida' ? 'vencida' : dt(x.validade)}</span> ${esc(x.requisito)} · ${esc(x.empresa.replace('Produceria ', ''))}</a></li>`).join('')}</ul><p class="note">Certidão vencida inabilita na sessão. Atualize em Licitações › Habilitação do hub.</p>` : ''}`;
    $('#inP').innerHTML = P.length ? `<ul class="vc-l">${P.slice(0, 8).map((p) => `<li><a class="ini-passo" href="${p.href}"><span class="num${p.d < h ? ' cp-venc' : ' note'}">${dt(p.d)}</span><span class="vc-c"><span>${esc(p.txt)}</span><span class="note">${esc(p.onde)}</span></span></a></li>`).join('')}</ul>`
      : vazio({ titulo: 'Nenhum próximo passo com data', texto: 'Dê prazo aos próximos passos de alvos, oportunidades do funil e licitações da carteira para que apareçam aqui.', acao: '<a class="btn sm" href="#captacao">Mapear alvos →</a>' });
  }

  render();
  (async () => {
    const db = await banco();
    if (!db) return;
    for (const c of Object.keys(D)) offs.push(db.collection<Doc>(c).onSnapshot((s) => { D[c] = s.docs.map(comId); render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
