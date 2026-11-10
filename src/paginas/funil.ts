// Funil e receita: receita orçada por canal, funil de oportunidades, estratégias anticíclicas e mapa de receitas (HHI).
import { esc, int, brl, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { perguntar, ErroIA, CONTEXTO } from '../lib/ia';
import { totalOrcamento, orcamentoVigente, type Orcamento } from '../lib/servicos';
import { seletor, comId } from './dom';
import { kpis, vazio, confirmarNoBotao } from '../componentes';

export const EIXOS = ['Privado', 'Público', 'Internacional'] as const;
export const ESTAGIOS = ['Identificada', 'Contato', 'Proposta', 'Negociação', 'Ganha', 'Perdida'] as const;
const ATIVOS = ESTAGIOS.filter((e) => e !== 'Perdida');

export interface Oportunidade { id: string; eixo: string; titulo: string; alvo?: string; valor?: number | null; estagio: string; proximoPasso?: string; prazo?: string; fonte?: string; criadoEm?: string; origem?: string }
export interface Linha { id: string; nome: string; grupo: 'Atual' | 'Nova' | string; receita12m: number | null; meta12m: number | null; ordem: number }
interface Projeto { id: string; cliente?: string; canal?: string; orcamentos?: Orcamento[] }

export const ANTICICLICAS = [
  { titulo: 'Pacote Reuse/Remaster', eixo: 'Privado', texto: 'Quando a verba cai, cresce a adaptação de peças existentes. Oferta de preço por derivada, a partir da etapa ADAPTAÇÃO da tabela, com biblioteca do cliente para reaproveitar.', passo: 'Montar a oferta com 3 faixas de volume e apresentar às contas recorrentes' },
  { titulo: 'Fee mensal de produção', eixo: 'Privado', texto: 'Contrato de volume para contas recorrentes (como Vivo e Sicredi): previsibilidade para o hub, custo por peça menor para o cliente.', passo: 'Levantar o volume dos últimos 6 meses por conta e propor fee' },
  { titulo: 'Fornecedor cadastrado nas contas públicas', eixo: 'Público', texto: 'Pela Lei 12.232/2010 (art. 14), agências de contas públicas só cotam produção com fornecedores cadastrados no órgão anunciante, com 3 orçamentos.', passo: 'Cadastrar o hub como fornecedor nos órgãos com contas relevantes em SP', fonte: 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12232.htm' },
  { titulo: 'Atas de registro de preços de comunicação visual', eixo: 'Público', texto: 'Comunicação visual, sinalização e mídia exterior são núcleo da casa e aparecem com frequência em atas de registro de preços: uma ata ganha vira demanda recorrente de vários órgãos.', passo: 'Filtrar o radar de licitações pelas frentes de comunicação visual e OOH e disputar a primeira ata' },
  { titulo: 'Agências independentes sem produção própria', eixo: 'Privado', texto: 'Agências preferem terceirizar produção (pesquisa KPMG 2024: só 12% veem produtoras de conteúdo como foco de investimento). O meio especializado é o espaço da Produceria.', passo: 'Mapear 15 agências independentes do ranking Cenp e abrir conversa' },
  { titulo: 'FilmBrazil · Roadshow EUA (Apex/Apro)', eixo: 'Internacional', texto: 'Apex-Brasil e Apro renovaram o FilmBrazil (biênio 2025/2026), com roadshow nos EUA. A Produceria já tem base em Miami.', passo: 'Verificar adesão da Produceria Produções à Apro e ao FilmBrazil', fonte: 'https://www.meioemensagem.com.br/comunicacao/apexbrasil-e-apro-r-10-milhoes-para-promover-exportacao-do-audiovisual' },
  { titulo: 'Finalização com craft para os EUA em dólar', eixo: 'Internacional', texto: 'Fuso compatível, custo em real e escassez de finalização com craft no mercado americano (tese de 2020). Vender capacidade em USD protege quando o real cai.', passo: 'Definir oferta em USD e reativar clientes americanos históricos' },
  { titulo: 'Fomento audiovisual (FSA, ProAC, Spcine)', eixo: 'Público', texto: 'Rotas para a Produceria Produções: registro na ANCINE como produtora independente destrava as chamadas do FSA.', passo: 'Conferir registro ANCINE e calendário de editais 2027' },
];

/** Índice Herfindahl-Hirschman (0 a 10.000) das participações; null sem valores. */
export function hhi(valores: number[]): number | null {
  const t = valores.reduce((s, v) => s + v, 0);
  return t ? Math.round(valores.reduce((s, v) => s + Math.pow((v / t) * 100, 2), 0)) : null;
}
export const leituraHHI = (h: number | null) => (h == null ? '—' : h < 1500 ? 'diversificada' : h < 2500 ? 'concentração moderada' : 'concentrada');
/** "1.234.567,89" ou "1234567" → número; vazio ou inválido → null. */
export function numeroBR(s: string): number | null {
  const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return s.trim() !== '' && Number.isFinite(n) ? n : null;
}

/** Receita orçada (R$) por canal e o peso do maior cliente, a partir dos orçamentos dos projetos. */
export function receitaOrcada(projetos: Projeto[]) {
  const porCanal: Record<string, number> = { Privado: 0, Público: 0, Internacional: 0 };
  const porCliente = new Map<string, number>();
  for (const p of projetos) {
    const o = orcamentoVigente(p.orcamentos);
    if (!o) continue;
    const v = totalOrcamento(o) / 100, canal = p.canal || 'Privado', cli = p.cliente || 'Sem cliente';
    porCanal[canal] = (porCanal[canal] || 0) + v;
    porCliente.set(cli, (porCliente.get(cli) || 0) + v);
  }
  const total = Object.values(porCanal).reduce((s, v) => s + v, 0);
  const top = [...porCliente.entries()].sort((a, b) => b[1] - a[1])[0];
  return { porCanal, total, top, conc: total && top ? top[1] / total : 0 };
}

const novoId = (p: string) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fonteLink = (u?: string) => (u ? `<a class="cn-f" href="${esc(u)}" target="_blank" rel="noopener">fonte ↗<span class="sr"> (abre em nova aba)</span></a>` : '');

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc fn">
  <div id="fnK"></div>
  <p class="note">Receita = última versão aprovada (ou a última salva) do orçamento de cada projeto, pelo canal marcado no projeto.</p>
  <p class="sr" id="fnLive" aria-live="polite" aria-atomic="true"></p>
  <section aria-labelledby="fn-h"><div class="ph"><h2 class="d d-sub" id="fn-h">Funil de oportunidades</h2><div class="acts" id="fnE"></div></div><div id="fnN"></div><div id="fnQ"></div></section>
  <section aria-labelledby="fn-ac"><div class="ph"><h2 class="d d-sub" id="fn-ac">Estratégias anticíclicas</h2></div>
    <p class="note">Quando a verba cai, ela muda de lugar: corta-se produção nova, cresce adaptação e reaproveitamento.</p><div class="mk-guias" id="fnA"></div></section>
  <section class="lc-box fn-tese" aria-labelledby="fn-tese"><span class="lab" id="fn-tese">Tese: craft em escala, contra o modelo fordista</span>
    <p>A Produceria opera como especialização flexível (Piore e Sabel): profissionais qualificados, ferramentas multiuso e uma rede de núcleos especializados, em vez de linha rígida e produto padronizado. A IA faz o mecânico (formatos, variações, checagens); a equipe faz o que dá valor: julgamento, autoria e acabamento.</p>
    <p>O desafio que Richard Sennett aponta em “O Artífice” é que o bom artesão costuma vender mal o próprio trabalho. Por isso o Studio registra rodadas, horas e correções feitas antes de o cliente ver: é isso que torna o valor do craft visível na negociação.</p>
    <p class="note">Credencial pública: Ouro em Industry Craft em Cannes Lions 2019 (“Black Box”, com a JWT), crédito de print production.</p></section>
  <section aria-labelledby="fn-mr"><div class="ph"><h2 class="d d-sub" id="fn-mr">Mapa de receitas</h2><span class="note">últimos 12 meses e meta, por linha</span></div>
    <div id="fnMK"></div>
    <div class="ph"><h3 class="d d-sub">Linhas de receita</h3><span class="note">valores em R$ · digite e saia do campo para salvar</span></div>
    <div id="fnL"></div>
    <div class="fn-leg note"><span><i class="fn-b atual"></i> últimos 12 meses</span><span><i class="fn-b meta"></i> meta</span></div>
    <form class="lc-box fn-nova" id="fnLN" novalidate><div class="f"><label for="fnLNn">Nova linha</label><input id="fnLNn" placeholder="Ex.: Atas de registro de preços (comunicação visual)"></div>
      <div class="acts" role="group" aria-label="Grupo da linha"><button type="button" class="chip" data-grupo="Atual" aria-pressed="false">Atual</button><button type="button" class="chip" data-grupo="Nova" aria-pressed="true">Nova</button></div>
      <button type="submit" class="sm">Adicionar</button><p class="erro" id="fnLNe" role="alert"></p></form>
    <div class="fn-hhi"><div class="lc-box"><span class="lab">Como ler o HHI</span><p>O índice soma o quadrado da participação de cada linha (0 a 10.000). Abaixo de 1.500 a receita está diversificada; acima de 2.500, concentrada. Com uma linha só, o índice é 10.000.</p></div>
      <div><button type="button" id="fnIA">Diagnóstico de diversificação</button><p class="erro" id="fnIAe" role="alert"></p><div class="lc-pre fn-diag" id="fnIAo" aria-live="polite"><span class="note">O Claude lê só os números informados acima e aponta riscos e movimentos para 90 dias.</span></div></div></div>
  </section></div>`;
  const $ = seletor(root);
  let P: Oportunidade[] = [], L: Linha[] = [], projetos: Projeto[] = [], db: Banco | null = null;
  let carregado = false, eixo = '', nova = false, grupo = 'Nova';
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#fnLive').textContent = t; };

  async function salvar(col: string, id: string, d: object, aviso = '') {
    if (!db) { avisar('Sem o banco do Studio: nada foi salvo.'); return false; }
    try { await db.collection(col).doc(id).update(d); if (aviso) avisar(aviso); return true; } catch { avisar('Não foi possível salvar.'); return false; }
  }
  async function criar(col: string, id: string, d: object, aviso: string) {
    if (!db) { avisar('Sem o banco do Studio: nada foi salvo.'); return false; }
    try { await db.collection(col).doc(id).set(d); avisar(aviso); return true; } catch { avisar('Não foi possível salvar.'); return false; }
  }

  function topo() {
    const r = receitaOrcada(projetos), aberto = P.filter((o) => o.estagio !== 'Ganha' && o.estagio !== 'Perdida');
    $('#fnK').innerHTML = `<div class="kpis">${kpis([
      ...EIXOS.map((e) => ({ rotulo: `Receita orçada · ${e}`, valor: `<b>${r.total ? Math.round((r.porCanal[e] / r.total) * 100) + '%' : '—'}</b>`, nota: brl(r.porCanal[e]) || 'R$ 0' })),
      { rotulo: 'Maior cliente', valor: `<b${r.conc > 0.3 ? ' class="quente"' : ''}>${r.top ? Math.round(100 * r.conc) + '%' : '—'}</b>`, nota: r.top ? esc(r.top[0]) + (r.conc > 0.3 ? ' · acima de 30%: risco de dependência' : '') : 'sem orçamentos salvos' },
      { rotulo: 'Funil aberto', valor: `<b>${int(aberto.length)}</b>`, nota: `${brl(aberto.reduce((s, o) => s + (o.valor || 0), 0)) || 'R$ 0'} estimados` },
    ])}</div>`;
  }

  function funil() {
    $('#fnE').innerHTML = `<button type="button" class="chip" data-eixo="" aria-pressed="${!eixo}">Todos</button>${EIXOS.map((e) => `<button type="button" class="chip" data-eixo="${e}" aria-pressed="${eixo === e}">${e} <span class="num">${P.filter((o) => o.eixo === e && o.estagio !== 'Perdida').length}</span></button>`).join('')}<button type="button" class="sm" id="fnNova" aria-expanded="${nova}">${nova ? 'Fechar' : 'Nova oportunidade'}</button>`;
    $('#fnN').innerHTML = nova ? `<form class="lc-box fn-form" id="fnF" novalidate><div class="det fm">
      <div class="f"><label for="fo_eixo">Eixo</label><select id="fo_eixo">${EIXOS.map((e) => `<option${(eixo || 'Privado') === e ? ' selected' : ''}>${e}</option>`).join('')}</select></div>
      <div class="f"><label for="fo_tit">Oportunidade *</label><input id="fo_tit" required></div>
      <div class="f"><label for="fo_alvo">Alvo</label><input id="fo_alvo" placeholder="cliente, agência, órgão"></div>
      <div class="f"><label for="fo_val">Valor estimado (R$)</label><input id="fo_val" inputmode="decimal"></div>
      <div class="f"><label for="fo_passo">Próximo passo *</label><input id="fo_passo" required></div>
      <div class="f"><label for="fo_prazo">Até</label><input id="fo_prazo" type="date"></div></div>
      <p class="erro" id="fo_e" role="alert"></p><div class="dacts"><button type="submit">Registrar</button><button type="button" class="ghost" id="fnNovaX">Cancelar</button></div></form>` : '';
    const M = P.filter((o) => !eixo || o.eixo === eixo), perdidas = M.filter((o) => o.estagio === 'Perdida');
    $('#fnQ').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : `<div class="lc-kanban fn-quadro">${ATIVOS.map((et, i) => {
      const itens = M.filter((o) => o.estagio === et);
      return `<section class="lc-col${et === 'Negociação' ? ' quente' : ''}" aria-label="${et}: ${itens.length}"><div class="lc-colh"><span class="lab">${et}</span><span class="note num">${int(itens.length)}</span></div>
      ${itens.length ? itens.map((o) => `<div class="lc-card"><span class="note">${esc(o.eixo)}${o.alvo ? ' · ' + esc(o.alvo) : ''}</span><b>${esc(o.titulo)}</b>
        <span class="note">${esc(o.proximoPasso || '')}${o.prazo ? ' · até ' + dt(o.prazo) : ''}</span>${o.valor ? `<span class="note num">${brl(o.valor)}</span>` : ''}${fonteLink(o.fonte)}
        <div class="lc-mv">${i > 0 ? `<button type="button" class="ghost sm" data-mv="${esc(o.id)}" data-para="${ATIVOS[i - 1]}" aria-label="Voltar ${esc(o.titulo)} para ${ATIVOS[i - 1]}">← ${ATIVOS[i - 1]}</button>` : '<span></span>'}${i < ATIVOS.length - 1 ? `<button type="button" class="ghost sm" data-mv="${esc(o.id)}" data-para="${ATIVOS[i + 1]}" aria-label="Avançar ${esc(o.titulo)} para ${ATIVOS[i + 1]}">${ATIVOS[i + 1]} →</button>` : ''}</div>
        <button type="button" class="lnk" data-mv="${esc(o.id)}" data-para="Perdida">Marcar como perdida</button></div>`).join('') : '<span class="note">Nada aqui ainda</span>'}</section>`;
    }).join('')}</div>
    ${perdidas.length ? `<details class="fn-perdidas"><summary class="note">Perdidas (${perdidas.length})</summary><ul class="vc-l">${perdidas.map((o) => `<li class="fn-pd"><span>${esc(o.titulo)}</span><button type="button" class="ghost sm" data-mv="${esc(o.id)}" data-para="Identificada">Reabrir</button><button type="button" class="lnk perigo" data-apaga="${esc(o.id)}">Apagar</button></li>`).join('')}</ul></details>` : ''}`;
    $('#fnQ').querySelectorAll<HTMLButtonElement>('[data-apaga]').forEach((b) => confirmarNoBotao(b, 'Confirmar exclusão', async () => {
      if (!db) return;
      try { await db.collection('pipeline').doc(b.dataset.apaga!).delete(); avisar('Oportunidade apagada.'); } catch { avisar('Não foi possível apagar.'); }
    }));
    $('#fnA').innerHTML = ANTICICLICAS.map((e, i) => `<div class="lc-box"><span class="lab">${e.eixo}</span><h3 class="d d-sub">${esc(e.titulo)}</h3><p>${esc(e.texto)}</p><p class="note">Próximo passo: ${esc(e.passo)} ${fonteLink(e.fonte)}</p>
      ${P.some((o) => o.titulo === e.titulo) ? '<span class="tag ok">No funil</span>' : `<div><button type="button" class="ghost sm" data-ac="${i}">Levar para o funil</button></div>`}</div>`).join('');
  }

  function mapa() {
    const S = [...L].sort((a, b) => a.ordem - b.ordem), atual = S.map((l) => l.receita12m || 0), meta = S.map((l) => l.meta12m || 0);
    const f = atual.reduce((s, v) => s + v, 0), h = meta.reduce((s, v) => s + v, 0), hA = hhi(atual), hM = hhi(meta);
    const nova = S.filter((l) => l.grupo === 'Nova').reduce((s, l) => s + (l.meta12m || 0), 0), N = Math.max(1, ...atual, ...meta);
    $('#fnMK').innerHTML = `<div class="kpis">${kpis([
      { rotulo: 'Receita dos últimos 12 meses', valor: `<b>${f ? brl(f) : '—'}</b>`, nota: 'soma das linhas informadas' },
      { rotulo: 'Meta para os próximos 12 meses', valor: `<b>${h ? brl(h) : '—'}</b>`, nota: f && h ? `${h >= f ? '+' : ''}${Math.round(((h - f) / f) * 100)}% sobre o atual` : '' },
      { rotulo: 'Concentração hoje (HHI)', valor: `<b${(hA ?? 0) >= 2500 ? ' class="quente"' : ''}>${hA == null ? '—' : int(hA)}</b>`, nota: leituraHHI(hA) },
      { rotulo: 'Concentração na meta (HHI)', valor: `<b>${hM == null ? '—' : int(hM)}</b>`, nota: leituraHHI(hM) },
      { rotulo: 'Meta vinda de linhas novas', valor: `<b>${h ? Math.round((nova / h) * 100) + '%' : '—'}</b>`, nota: nova ? brl(nova) : '' },
    ])}</div>`;
    const foco = document.activeElement as HTMLElement | null, focoId = foco && $('#fnL').contains(foco) ? foco.id : '';
    $('#fnL').innerHTML = !carregado ? '<p class="note">Carregando…</p>' : S.length ? `<ul class="vc-l fn-linhas">${S.map((l) => `<li class="fn-ln"><span class="vc-c"><b>${esc(l.nome)}</b><span class="tag${l.grupo === 'Nova' ? ' w' : ''}">${esc(l.grupo)}</span></span>
      <div class="f"><label for="ln-r-${esc(l.id)}">Últimos 12 meses</label><input id="ln-r-${esc(l.id)}" class="num" inputmode="decimal" data-ln="${esc(l.id)}" data-campo="receita12m" value="${l.receita12m ?? ''}" placeholder="—"></div>
      <div class="f"><label for="ln-m-${esc(l.id)}">Meta 12 meses</label><input id="ln-m-${esc(l.id)}" class="num" inputmode="decimal" data-ln="${esc(l.id)}" data-campo="meta12m" value="${l.meta12m ?? ''}" placeholder="—"></div>
      <div class="fn-barras" aria-hidden="true"><i class="fn-b atual" style="width:${((l.receita12m || 0) / N) * 100}%;min-width:${l.receita12m ? 2 : 0}px"></i><i class="fn-b meta" style="width:${((l.meta12m || 0) / N) * 100}%;min-width:${l.meta12m ? 2 : 0}px"></i></div></li>`).join('')}</ul>`
      : vazio({ titulo: 'Nenhuma linha registrada', texto: 'Cadastre as linhas atuais (produção audiovisual, gráfica, comunicação visual, mídia exterior…) e as novas. Os valores ficam com a equipe: o Studio não estima receita.' });
    if (focoId) root.querySelector<HTMLElement>('#' + CSS.escape(focoId))?.focus();
    $<HTMLButtonElement>('#fnIA').disabled = !S.length;
  }

  // ---------------------------------------------------------------- eventos
  root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!b || !root.contains(b)) return;
    const d = b.dataset;
    if (d.eixo !== undefined) { eixo = d.eixo; funil(); return; }
    if (b.id === 'fnNova') { nova = !nova; funil(); if (nova) $<HTMLInputElement>('#fo_tit').focus(); return; }
    if (b.id === 'fnNovaX') { nova = false; funil(); $<HTMLElement>('#fnNova').focus(); return; }
    if (d.mv && d.para) { const o = P.find((x) => x.id === d.mv); if (o) await salvar('pipeline', o.id, { estagio: d.para }, `${o.titulo}: ${d.para}.`); return; }
    if (d.ac) {
      const e = ANTICICLICAS[Number(d.ac)];
      await criar('pipeline', novoId('fn'), { eixo: e.eixo, titulo: e.titulo, alvo: '', valor: null, estagio: 'Identificada', proximoPasso: e.passo, fonte: e.fonte || '', criadoEm: new Date().toISOString(), origem: 'Estratégia' }, `${e.titulo} entrou no funil.`);
      return;
    }
    if (d.grupo) { grupo = d.grupo; root.querySelectorAll<HTMLElement>('[data-grupo]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.grupo === grupo))); return; }
    if (b.id === 'fnIA') {
      const S = [...L].sort((a, b2) => a.ordem - b2.ordem), bt = b as HTMLButtonElement;
      const dados = S.map((l) => `${l.nome} [${l.grupo}]: últimos 12 meses ${l.receita12m == null ? '—' : 'R$ ' + l.receita12m.toFixed(0)}; meta 12 meses ${l.meta12m == null ? '—' : 'R$ ' + l.meta12m.toFixed(0)}`).join('\n');
      bt.disabled = true; bt.textContent = 'Escrevendo…'; $('#fnIAe').textContent = '';
      try {
        const t = await perguntar(`${CONTEXTO}\n\nLeia o mapa de receitas da PRODUCERIA (valores informados pela equipe) e escreva um diagnóstico de diversificação em até 350 palavras: concentração atual · o que a meta muda · riscos (caixa, capacidade, dependência de poucos clientes ou do setor público) · 3 movimentos para os próximos 90 dias. Use só os números abaixo; onde houver "—", diga que falta o dado.\n\n${dados}`,
          { aoEscrever: (x) => { $('#fnIAo').textContent = x; } });
        $('#fnIAo').textContent = String(t);
      } catch (e) { $('#fnIAe').textContent = e instanceof ErroIA ? e.message : 'O diagnóstico falhou. Tente de novo.'; }
      finally { bt.disabled = !L.length; bt.textContent = 'Diagnóstico de diversificação'; }
    }
  });
  root.addEventListener('submit', async (ev) => {
    const f = ev.target as HTMLFormElement;
    ev.preventDefault();
    if (f.id === 'fnF') {
      const g = (id: string) => $<HTMLInputElement>('#' + id).value.trim();
      if (!g('fo_tit') || !g('fo_passo')) { $('#fo_e').textContent = 'Dê um título e o próximo passo.'; $<HTMLInputElement>(g('fo_tit') ? '#fo_passo' : '#fo_tit').focus(); return; }
      const id = novoId('fn');
      if (await criar('pipeline', id, { id, eixo: $<HTMLSelectElement>('#fo_eixo').value, titulo: g('fo_tit'), alvo: g('fo_alvo'), valor: numeroBR(g('fo_val')), estagio: 'Identificada', proximoPasso: g('fo_passo'), prazo: g('fo_prazo') || '', fonte: '', criadoEm: new Date().toISOString(), origem: 'Equipe' }, 'Oportunidade registrada no funil.')) {
        nova = false; funil(); $<HTMLElement>('#fnNova').focus();
      }
    } else if (f.id === 'fnLN') {
      const nome = $<HTMLInputElement>('#fnLNn').value.trim();
      if (!nome) { $('#fnLNe').textContent = 'Dê um nome à linha de receita.'; $<HTMLInputElement>('#fnLNn').focus(); return; }
      $('#fnLNe').textContent = '';
      if (await criar('linhas', novoId('ln'), { nome, grupo, receita12m: null, meta12m: null, ordem: L.length + 1 }, `Linha ${nome} adicionada.`)) $<HTMLInputElement>('#fnLNn').value = '';
    }
  });
  root.addEventListener('focusout', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (!t.dataset.ln) return;
    const l = L.find((x) => x.id === t.dataset.ln), k = t.dataset.campo as 'receita12m' | 'meta12m', v = numeroBR(t.value);
    if (!l || l[k] === v) return;
    salvar('linhas', l.id, { [k]: v }, 'Salvo.');
  });

  topo(); funil(); mapa();
  (async () => {
    db = await banco();
    carregado = true;
    if (!db) { topo(); funil(); mapa(); return; }
    offs.push(db.collection<Oportunidade>('pipeline').onSnapshot((s) => { P = s.docs.map(comId); topo(); funil(); }, () => {}));
    offs.push(db.collection<Linha>('linhas').onSnapshot((s) => { L = s.docs.map(comId); mapa(); }, () => {}));
    offs.push(db.collection<Projeto>('projetos').onSnapshot((s) => { projetos = s.docs.map(comId); topo(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
