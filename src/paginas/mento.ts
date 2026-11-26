// Reação · Mento: a reação em cadeia e o multiverso da MENTO Publicidade a partir dos LinkedIns da equipe. Cola-se o
// perfil de cada pessoa (texto da página ou do "Salvar em PDF"), confere-se a trajetória lida e o Studio abre as
// ramificações: MENTO → equipe → casas por onde cada um passou → o que o Big Data sabe delas. Tudo na identidade da
// Mento (preto, branco, verde e títulos em stencil). Os perfis ficam só neste navegador: nada é gravado no banco.
import { esc } from '../lib/formato';
import { slug } from '../lib/nomes';
import { banco, lerBase } from '../lib/db';
import { MENTO } from '../lib/casa';
import { lerPerfil, type Experiencia } from '../lib/linkedin';
import { reacaoDaCasa, csvDoRadar, type PerfilEquipe, type ReacaoCasa } from '../lib/reacao-casa';
import { dadosDoArquivo, type OrgInv, type PessoaInv, type LigacaoInv } from '../lib/investigacao';
import { montarGrafo, type EmpresaMapa, type AgenciaMapa, type MercadoBase, type MovimentoBase, type PessoaMapa } from '../lib/grafo';
import type { Alvo } from '../lib/tipos';
import { htmlDoMapaPronto, fonteDaCasa } from '../lib/mapa-arquivo';
import { baixarArquivo } from './oficina';
import { seletor, comId, mensagem } from './dom';

const CASA = MENTO;
const GUARDA = 'studio.mento.perfis';
const curto = (s = '', n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const TIPO: Record<string, string> = { origem: 'Ponto zero', empresa: 'Anunciante', agencia: 'Agência', pessoa: 'Pessoa' };
const pl = (n: number, um: string, varios: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? um : varios}`;

interface Slot { url: string; texto: string; perfil: PerfilEquipe | null }
const vazioSlot = (): Slot => ({ url: '', texto: '', perfil: null });

/** A fonte stencil da Mento, uma vez por página (vem do banco na página publicada; sem ela, a condensada do sistema). */
function fonte() {
  if (document.getElementById('mento-fonte')) return;
  const el = document.createElement('style'); el.id = 'mento-fonte'; document.head.appendChild(el);
  void fonteDaCasa(CASA).then((css) => { el.textContent = css; if (!css) el.remove(); });
}

export function montar(root: HTMLElement): () => void {
  fonte();
  root.innerHTML = `<div class="mt">
 <header class="mt-hero">
  <p class="mt-eb"><i></i>Estratégia. Mídia. Pessoas. · teste da reação em cadeia</p>
  <h1 class="mt-marca" aria-label="MENTO">MENTO<sup>®</sup></h1>
  <p class="mt-h2">Conexões que <em>movem marcas.</em></p>
  <p class="mt-lead">Cole o LinkedIn de duas pessoas. O Studio lê a trajetória de cada uma, põe a MENTO no ponto zero e abre a reação: <b>MENTO → equipe → casas por onde cada um passou → contas, agências e pessoas que o Big Data já liga a essas casas</b>. No fim, o multiverso inteiro na identidade da Mento, para navegar aqui ou baixar.</p>
  <p class="mt-base" id="mtBase" aria-live="polite">Carregando o Big Data…</p>
 </header>
 <section class="mt-passo" aria-labelledby="mtP1"><h2 class="mt-t" id="mtP1"><span>01</span>Os dois LinkedIns</h2>
  <p class="mt-nota">No LinkedIn, abra o perfil, selecione tudo (Ctrl+A ou ⌘A), copie e cole no quadro. Também vale o texto do "Mais → Salvar em PDF". O link sozinho dá só o nome: a trajetória vem do texto.</p>
  <div class="mt-slots" id="mtSlots"></div>
  <div class="mt-acoes"><button type="button" class="mt-btn" data-rodar>Rodar a reação em cadeia</button><button type="button" class="mt-btn mt-sec" data-exemplo>Carregar um exemplo</button><button type="button" class="mt-lnk" data-limpar-tudo>Limpar os dois</button></div>
  <p class="mt-msg" id="mtMsg" aria-live="polite"></p>
 </section>
 <div id="mtRes" hidden>
  <section class="mt-passo" aria-labelledby="mtP2"><h2 class="mt-t" id="mtP2"><span>02</span>O tamanho da reação</h2><ul class="mt-kpis" id="mtK"></ul></section>
  <section class="mt-passo" aria-labelledby="mtP3"><h2 class="mt-t" id="mtP3"><span>03</span>Por onde cada um abre</h2><div class="mt-pp" id="mtPP"></div><h3 class="mt-st">Pontes em comum</h3><p class="mt-nota">O que as duas pessoas alcançam em até dois passos cada: a conversa pode vir de qualquer uma, e a outra reforça.</p><div id="mtCm"></div></section>
  <section class="mt-passo" aria-labelledby="mtP4"><h2 class="mt-t" id="mtP4"><span>04</span>Reação em cadeia</h2><p class="mt-nota">As ramificações mais fortes, da MENTO para fora. A força soma quem decide a contratação, conta nova ou troca de agência recente, ponte com a MENTO e quantos caminhos chegam no ponto.</p><div class="mt-rc" id="mtRc" tabindex="0" role="region" aria-label="Ramificações da reação, rola de lado"></div></section>
  <section class="mt-passo" aria-labelledby="mtP5"><h2 class="mt-t" id="mtP5"><span>05</span>Multiverso</h2><p class="mt-nota">Tudo o que as ligações alcançam a partir da MENTO, sem corte. Clique num ponto para acender o caminho até a equipe; arraste para andar; Ctrl + rolar aproxima.</p><div class="mt-camadas" id="mtCa"></div>
   <div class="mt-acoes"><button type="button" class="mt-btn" data-baixar>Baixar o multiverso interativo (HTML)</button><button type="button" class="mt-btn mt-sec" data-csv>Baixar o radar (planilha)</button><button type="button" class="mt-btn mt-sec" data-ver-mv aria-expanded="false">Abrir o multiverso aqui</button></div>
   <div class="mt-mv" id="mtMv" hidden></div></section>
  <section class="mt-passo" aria-labelledby="mtP6"><h2 class="mt-t" id="mtP6"><span>06</span>Radar · por onde começar</h2><ol class="mt-radar" id="mtL"></ol><p class="mt-nota" id="mtLM"></p></section>
 </div>
 <p class="sr" id="mtLive" aria-live="polite"></p>
</div>`;
  const $ = seletor(root);
  let slots: Slot[] = (() => { try { const v = JSON.parse(localStorage.getItem(GUARDA) || 'null'); if (Array.isArray(v) && v.length === 2) return v.map((s: Slot) => ({ url: String(s.url || ''), texto: String(s.texto || ''), perfil: s.perfil || null })); } catch { /* sem armazenamento */ } return [vazioSlot(), vazioSlot()]; })();
  const guardar = () => { try { localStorage.setItem(GUARDA, JSON.stringify(slots)); } catch { /* vale só nesta visita */ } };
  let mercado: MercadoBase | null = null, movs: MovimentoBase[] = [], emp: (EmpresaMapa & OrgInv)[] = [], ags: (AgenciaMapa & OrgInv)[] = [], pes: PessoaInv[] = [], ligs: LigacaoInv[] = [], alvos: Alvo[] = [];
  let r: ReacaoCasa | null = null, lim = 15, rodou = false, tRe = 0, carregou = false;
  const offs: (() => void)[] = [];

  /* ── 01 · os perfis ── */
  const expLinha = (i: number, j: number, e: Experiencia) => `<tr><td><input aria-label="Casa" data-p="${i}" data-e="${j}" data-k="org" value="${esc(e.org)}" placeholder="Empresa ou agência"></td><td><input aria-label="Cargo" data-p="${i}" data-e="${j}" data-k="cargo" value="${esc(e.cargo)}"></td><td><input aria-label="Período" data-p="${i}" data-e="${j}" data-k="periodo" value="${esc(e.periodo)}"></td><td class="mt-c"><input type="checkbox" aria-label="Trabalha lá hoje" data-p="${i}" data-e="${j}" data-k="atual"${e.atual ? ' checked' : ''}></td><td><button type="button" class="mt-x" data-tirar="${i}:${j}" aria-label="Tirar esta passagem">×</button></td></tr>`;
  function slotsHtml() {
    $('#mtSlots').innerHTML = slots.map((s, i) => {
      const p = s.perfil;
      const lido = p ? `<div class="mt-lido">
   <div class="mt-quem"><label>Nome<input data-p="${i}" data-k="nome" value="${esc(p.nome)}"></label><label>Cargo hoje<input data-p="${i}" data-k="cargo" value="${esc(p.cargo)}"></label></div>
   ${p.linkedin ? `<p class="mt-nota"><a href="${esc(p.linkedin)}" target="_blank" rel="noopener">${esc(p.linkedin.replace(/^https:\/\/www\./, ''))} ↗<span class="sr"> (abre em nova aba)</span></a></p>` : ''}
   <table class="mt-exp"><caption>Trajetória lida · confira e corrija</caption><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"></colgroup><thead><tr><th scope="col">Casa</th><th scope="col">Cargo</th><th scope="col">Período</th><th scope="col">Hoje</th><th><span class="sr">Tirar</span></th></tr></thead><tbody>${p.experiencias.map((e, j) => expLinha(i, j, e)).join('')}</tbody></table>
   ${p.experiencias.length ? '' : '<p class="mt-aviso">Nenhuma passagem lida. Cole o texto inteiro do perfil (com a seção Experiência) ou adicione as casas à mão.</p>'}
   <button type="button" class="mt-lnk" data-mais="${i}">+ adicionar passagem</button></div>` : '';
      return `<article class="mt-slot" aria-labelledby="mtS${i}"><h3 class="mt-st" id="mtS${i}">Pessoa ${i + 1}${p?.nome ? ` · <b>${esc(p.nome)}</b>` : ''}</h3>
  <label>Link do LinkedIn<input type="url" data-p="${i}" data-k="url" value="${esc(s.url)}" placeholder="https://www.linkedin.com/in/…" autocomplete="off"></label>
  <label>Texto do perfil<textarea data-p="${i}" data-k="texto" rows="6" placeholder="Cole aqui o perfil inteiro (nome, título, Experiência…)">${esc(s.texto)}</textarea></label>
  <div class="mt-acoes"><button type="button" class="mt-btn mt-sec" data-ler="${i}">${p ? 'Ler de novo' : 'Ler o perfil'}</button>${s.url || s.texto || p ? `<button type="button" class="mt-lnk" data-limpar="${i}">Limpar</button>` : ''}</div>${lido}</article>`;
    }).join('');
  }
  function ler(i: number) {
    const s = slots[i]; if (!s.url.trim() && !s.texto.trim()) { $('#mtMsg').textContent = `Pessoa ${i + 1}: cole o link ou o texto do perfil.`; return; }
    const p = lerPerfil(s.texto, s.url);
    s.perfil = { id: `mento-${i + 1}-${slug(p.nome || 'pessoa')}`, ...p };
    if (!s.url && p.linkedin) s.url = p.linkedin;
    guardar(); slotsHtml();
    $('#mtMsg').textContent = p.nome ? `${p.nome}: ${pl(p.experiencias.length, 'passagem lida', 'passagens lidas')}.` : `Pessoa ${i + 1}: não achei o nome. Preencha à mão.`;
  }
  const perfis = () => slots.map((s) => s.perfil).filter((p): p is PerfilEquipe => !!p && !!p.nome.trim())
    .map((p) => ({ ...p, trajetoria: p.experiencias.filter((e) => e.org.trim()).map((e) => `${e.cargo || 'Passagem'} na ${e.org}${e.periodo ? ` (${e.periodo})` : ''}`).join('; '), organizacao: p.experiencias.find((e) => e.atual)?.org || p.organizacao }));

  /* ── 02 a 06 · a reação ── */
  function rodar() {
    const P = perfis();
    if (!P.length) { $('#mtMsg').textContent = 'Leia pelo menos um perfil antes de rodar.'; return; }
    const G = montarGrafo({ mercado, movimentos: movs, empresas: emp, agencias: ags, pessoas: pes.filter((p) => p.nome && p.organizacao) as PessoaMapa[] });
    r = reacaoDaCasa(CASA, { empresas: G.empresas, agencias: G.agencias, pessoas: pes, orgsInv: [...ags, ...emp], alvos, ligacoes: ligs }, P);
    rodou = true; lim = 15; resultado();
    $('#mtMsg').textContent = P.length < 2 ? 'Rodou com uma pessoa. Leia o segundo perfil para ver as pontes em comum.' : carregou ? '' : 'Rodou antes do Big Data terminar de carregar: a reação se refaz sozinha quando chegar.';
  }
  const nome = (id: string) => r?.U.nos.get(id)?.nome || '';
  const chip = (id: string) => { const n = r?.U.nos.get(id); return n ? `<span class="mt-chip t-${n.tipo}${n.equipe ? ' eq' : ''}">${esc(curto(n.nome, 34))}</span>` : ''; };
  function resultado() {
    if (!r) return; const R = r;
    $('#mtRes').hidden = false;
    const orgs = [...R.U.nos.values()].filter((n) => n.tipo === 'agencia' || n.tipo === 'empresa').length;
    const decide = R.radar.filter((x) => x.no.nivel === 'contrata').length;
    $('#mtK').innerHTML = [
      [R.M.alcance, 'pontos ao alcance', `de ${R.M.total.toLocaleString('pt-BR')} no mapa (${orgs.toLocaleString('pt-BR')} organizações)`],
      [R.M.camadas.length - 1, 'ramificações', 'da MENTO até o ponto mais distante'],
      [R.radar.length, 'possibilidades abertas', 'na reação, com força e caminho'],
      [decide, 'decidem a contratação', 'pessoas no radar que contratam fornecedor'],
      [R.comuns.length, 'pontes em comum', 'alcançadas pelas duas pessoas'],
    ].map(([v, t, d]) => `<li><b>${Number(v).toLocaleString('pt-BR')}</b><span>${esc(String(t))}</span><small>${esc(String(d))}</small></li>`).join('');
    // por pessoa
    $('#mtPP').innerHTML = R.porPessoa.map((p) => `<article class="mt-pes"><h3 class="mt-st">${chip(p.id)}<span class="mt-al">${pl(p.alcance, 'ponto alcançado', 'pontos alcançados')} sozinha(o)</span></h3>
  <ul class="mt-casas">${p.casas.map((c) => `<li class="${c.conhecida ? 'on' : ''}"><b>${esc(c.nome)}</b><span>${esc(curto(c.rotulo, 70))}</span><em>${c.conhecida ? `abre ${pl(c.abre, 'ligação', 'ligações')} no Big Data` : 'ainda sem ligações no Big Data'}</em></li>`).join('') || '<li><span>Nenhuma casa na trajetória lida.</span></li>'}</ul></article>`).join('');
    const cm = R.comuns.slice(0, 24);
    $('#mtCm').innerHTML = cm.length ? `<ul class="mt-cm">${cm.map((c) => `<li>${chip(c.id)}<small>${esc(TIPO[c.tipo])} · ${c.passos.map((k, i) => `${esc(R.porPessoa[i]?.nome.split(' ')[0] || '')} a ${k} ${k === 1 ? 'passo' : 'passos'}`).join(' · ')}</small></li>`).join('')}</ul>${R.comuns.length > cm.length ? `<p class="mt-nota">+${R.comuns.length - cm.length} outras pontes em comum no multiverso.</p>` : ''}` : `<p class="mt-aviso">${R.porPessoa.length < 2 ? 'Com uma pessoa só não há ponte em comum.' : 'As duas trajetórias ainda não se cruzam no Big Data. O multiverso mostra cada lado; uma ligação nova (agência que atende a mesma conta, por exemplo) costura os dois.'}</p>`;
    // reação em cadeia: colunas por ramificação
    const GER = ['Ponto zero', 'Equipe', 'Casas da trajetória', '3ª ramificação', '4ª ramificação', '5ª ramificação'];
    $('#mtRc').innerHTML = R.G.map((col, g) => `<div class="mt-col"><h3 class="mt-ct">${esc(GER[g] || `${g}ª ramificação`)}<span>${col.length}${g && (R.M.camadas[g]?.ids.length || 0) > col.length ? ` de ${R.M.camadas[g].ids.length}` : ''}</span></h3>${col.map((x) => {
      const n = R.U.nos.get(x.id)!, pai = x.pais[0];
      return `<div class="mt-card t-${n.tipo}${n.equipe ? ' eq' : ''}${n.extinta ? ' ext' : ''}"><span class="mt-k">${esc(n.tipo === 'origem' ? 'Ponto zero' : n.equipe ? 'Equipe MENTO' : TIPO[n.tipo])}</span><b>${esc(n.nome)}</b>${n.tipo === 'pessoa' && n.sub ? `<span class="mt-m">${esc(curto(n.sub, 50))}${n.org && !n.equipe ? ' · ' + esc(curto(n.org, 30)) : ''}</span>` : ''}${pai ? `<span class="mt-de">de ${esc(curto(nome(pai.id), 26))} · ${esc(curto(pai.rotulo, 34))}</span>` : ''}${g > 1 && !n.equipe ? `<span class="mt-f" title="Força na reação">${x.forca}</span>` : ''}</div>`;
    }).join('')}</div>`).join('');
    // multiverso: as voltas
    const max = Math.max(1, ...R.M.camadas.slice(1).map((c) => c.ids.length));
    $('#mtCa').innerHTML = `<ol class="mt-voltas">${R.M.camadas.slice(1).map((c) => `<li><span>${c.ger}ª volta</span><span class="mt-barra"><i style="width:${(c.ids.length / max * 100).toFixed(1)}%"></i><s style="width:${(c.abertos / max * 100).toFixed(1)}%"></s></span><b>${c.ids.length}</b><small>${[c.agencias && pl(c.agencias, 'agência', 'agências'), c.empresas && pl(c.empresas, 'anunciante', 'anunciantes'), c.pessoas && pl(c.pessoas, 'pessoa', 'pessoas')].filter(Boolean).join(' · ')}</small></li>`).join('')}${R.M.fora ? `<li class="fora"><span>Fora de alcance</span><span class="mt-barra"><i style="width:${Math.min(100, R.M.fora / max * 100).toFixed(1)}%"></i></span><b>${R.M.fora}</b><small>sem ligação com a MENTO ainda</small></li>` : ''}</ol><p class="mt-nota">Verde: aberto na reação em cadeia. Cinza: alcançável no multiverso.</p>`;
    if (!$('#mtMv').hidden) void multiversoAqui();
    radar();
  }
  function radar() {
    if (!r) return; const R = r, L = R.radar.slice(0, lim);
    $('#mtL').innerHTML = L.map((x) => `<li><b class="mt-f">${x.forca}</b><div><b>${esc(x.no.nome)}</b> <span class="mt-k">${esc(x.no.tipo === 'pessoa' ? [x.no.sub, x.no.org].filter(Boolean).join(' · ') : TIPO[x.no.tipo] + (x.no.sub && !/^(Agência|Anunciante|Organização)$/.test(x.no.sub) ? ' · ' + x.no.sub : ''))}</span>
  <p class="mt-cam">${x.caminho.map((c, i) => (i ? `<em>→ ${esc(curto(c.rotulo, 30))}</em> ` : '') + chip(c.id)).join(' ')}</p>${x.no.fatos.length ? `<p class="mt-nota">${esc(x.no.fatos.slice(0, 3).join(' · '))}</p>` : ''}</div></li>`).join('') || '<li><div>Nada aberto ainda: as casas da trajetória não têm ligações no Big Data.</div></li>';
    $('#mtLM').innerHTML = R.radar.length > lim ? `<button type="button" class="mt-lnk" data-rmais>Mostrar mais ${Math.min(15, R.radar.length - lim)} (${R.radar.length - lim} restantes)</button>` : '';
  }
  const arquivo = () => { const R = r!; return htmlDoMapaPronto(dadosDoArquivo(R.U, R.R, R.M, { geradoEm: new Date().toISOString() }), '', CASA); };
  let vez = 0;
  async function multiversoAqui() {
    if (!r) return; const box = $('#mtMv'), minha = ++vez;
    box.innerHTML = '<p class="mt-nota mt-esp">Montando o multiverso…</p>';
    try { const html = await arquivo(); if (minha === vez && !box.hidden) box.innerHTML = `<iframe class="mt-if" title="Multiverso da MENTO, interativo" srcdoc="${esc(html)}"></iframe>`; }
    catch (e) { if (minha === vez) box.innerHTML = `<p class="mt-aviso">Não deu para montar o multiverso: ${esc(mensagem(e))}</p>`; }
  }
  async function baixar(btn: HTMLButtonElement, tipo: 'html' | 'csv') {
    if (!r) return; const t = btn.textContent; btn.disabled = true; btn.textContent = 'Montando o arquivo…';
    try {
      const dia = new Date().toISOString().slice(0, 10), base = `mento-${slug(r.equipe.map((e) => e.nome.split(' ')[0]).join('-'))}`;
      const msg = tipo === 'html' ? await baixarArquivo(`${base}-multiverso-${dia}.html`, await arquivo()) : await baixarArquivo(`${base}-radar-${dia}.csv`, csvDoRadar(r));
      $('#mtLive').textContent = msg || 'Download cancelado.'; btn.textContent = msg && msg.startsWith('Arquivo salvo') ? 'Arquivo baixado' : t; window.setTimeout(() => { btn.textContent = t; }, 2500);
    } catch (e) { $('#mtLive').textContent = 'Não foi possível montar o arquivo: ' + mensagem(e); btn.textContent = t; }
    finally { btn.disabled = false; }
  }

  /* ── eventos ── */
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement, i = Number(t.dataset.p), k = t.dataset.k; if (!k || Number.isNaN(i)) return;
    const s = slots[i];
    if (k === 'url' || k === 'texto') { s[k] = t.value; guardar(); return; }
    if (!s.perfil) return;
    if (k === 'nome' || k === 'cargo') { s.perfil[k] = t.value; guardar(); return; }
    const j = Number(t.dataset.e), e = s.perfil.experiencias[j]; if (!e) return;
    if (k === 'atual') e.atual = t.checked; else if (k === 'org' || k === 'cargo' || k === 'periodo') e[k] = t.value;
    guardar();
  });
  root.addEventListener('click', (ev) => {
    const el = ev.target as HTMLElement, b = el.closest<HTMLElement>('button'); if (!b || !root.contains(b)) return;
    if (b.dataset.ler != null) { ler(Number(b.dataset.ler)); return; }
    if (b.dataset.limpar != null) { slots[Number(b.dataset.limpar)] = vazioSlot(); guardar(); slotsHtml(); return; }
    if (b.hasAttribute('data-limpar-tudo')) { slots = [vazioSlot(), vazioSlot()]; guardar(); slotsHtml(); r = null; rodou = false; $('#mtRes').hidden = true; $('#mtMsg').textContent = 'Os dois perfis foram limpos.'; return; }
    if (b.dataset.mais != null) { const p = slots[Number(b.dataset.mais)].perfil; if (p) { p.experiencias.push({ org: '', cargo: '', periodo: '', atual: false }); guardar(); slotsHtml(); } return; }
    if (b.dataset.tirar) { const [i, j] = b.dataset.tirar.split(':').map(Number); slots[i].perfil?.experiencias.splice(j, 1); guardar(); slotsHtml(); return; }
    if (b.hasAttribute('data-rodar')) { rodar(); if (r) $('#mtRes').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (b.hasAttribute('data-exemplo')) { slots = EXEMPLO.map((x) => ({ ...x, perfil: null })); slotsHtml(); ler(0); ler(1); $('#mtMsg').textContent = 'Exemplo carregado (perfis fictícios). Troque pelos dois LinkedIns reais e rode de novo.'; return; }
    if (b.hasAttribute('data-baixar')) { void baixar(b as HTMLButtonElement, 'html'); return; }
    if (b.hasAttribute('data-csv')) { void baixar(b as HTMLButtonElement, 'csv'); return; }
    if (b.hasAttribute('data-ver-mv')) { const box = $('#mtMv'), abrir = box.hidden; box.hidden = !abrir; b.setAttribute('aria-expanded', String(abrir)); b.textContent = abrir ? 'Fechar o multiverso' : 'Abrir o multiverso aqui'; if (abrir) void multiversoAqui(); else box.innerHTML = ''; return; }
    if (b.hasAttribute('data-rmais')) { lim += 15; radar(); }
  });

  slotsHtml();
  const base = () => {
    const n = emp.length + ags.length + (mercado ? 1 : 0);
    $('#mtBase').textContent = n ? `Big Data: ${pl(ags.length, 'agência', 'agências')}, ${pl(emp.length, 'anunciante', 'anunciantes')} e ${pl(pes.length, 'pessoa', 'pessoas')} prontos para cruzar com as trajetórias.` : 'Big Data ainda não carregou (fora do Claude, a reação roda só com as casas da trajetória).';
  };
  const agendar = () => { clearTimeout(tRe); tRe = window.setTimeout(() => { base(); if (rodou) { r = null; rodar(); } }, 400); };
  if (slots.some((s) => s.perfil)) $('#mtMsg').textContent = 'Os perfis da última visita estão aqui. Rode a reação quando o Big Data carregar.';
  lerBase<MercadoBase>('mercado').then((m) => { mercado = m; carregou = true; agendar(); }).catch(() => {});
  (async () => {
    const db = await banco(); if (!db) { base(); return; }
    const sub = <T>(nm: string, f: (l: T[]) => void) => offs.push(db.collection<T>(nm).onSnapshot((s) => { f(s.docs.map(comId) as T[]); carregou = true; agendar(); }, () => {}));
    sub<MovimentoBase & { id: string }>('movimentos', (l) => { movs = l; });
    sub<PessoaInv>('mapa_pessoas', (l) => { pes = l; });
    sub<AgenciaMapa & OrgInv>('mapa_agencias', (l) => { ags = l; });
    sub<EmpresaMapa & OrgInv>('mapa_empresas', (l) => { emp = l; });
    sub<LigacaoInv>('mapa_ligacoes', (l) => { ligs = l; });
    sub<Alvo>('alvos', (l) => { alvos = l; });
  })().catch(() => base());
  return () => { clearTimeout(tRe); for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}

/** Dois perfis fictícios para ver a tela funcionando antes do teste com os LinkedIns reais. */
const EXEMPLO: { url: string; texto: string }[] = [
  { url: 'https://www.linkedin.com/in/exemplo-fulana-de-tal', texto: 'Fulana de Tal\nDiretora de Mídia na Mento Publicidade\nSão Paulo, São Paulo, Brasil\nExperiência\nDiretora de Mídia\nMento Publicidade · Tempo integral\njan de 2022 - o momento · 2 anos 11 meses\nGerente de Mídia\nAfrica Creative DDB · Tempo integral\nmar de 2018 - dez de 2021 · 3 anos 10 meses\nSupervisora de Mídia\nAlmapBBDO · Tempo integral\n2014 - 2018 · 4 anos' },
  { url: 'https://www.linkedin.com/in/exemplo-ciclano-souza', texto: 'Ciclano Souza\nSócio-diretor na Mento Publicidade\nSão Paulo, São Paulo, Brasil\nExperiência\nSócio-diretor\nMento Publicidade · Tempo integral\nmar de 2020 - o momento · 4 anos 9 meses\nDiretor de Negócios\nPublicis Brasil · Tempo integral\njan de 2015 - fev de 2020 · 5 anos 2 meses\nAtendimento\nWMcCann · Tempo integral\n2011 - 2014 · 3 anos' },
];
