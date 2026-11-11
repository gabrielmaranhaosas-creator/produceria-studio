// Bancada: ferramentas do estúdio. Desdobramento de KV (orçamento das adaptações pela tabela), revisão de texto e
// pré-checagem de peça com IA, e cotação de fornecedor (três preços, o menor fica registrado com as fontes).
import { esc, int, brl, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { perguntar, aceitaImagens, ErroIA } from '../lib/ia';
import { SERVICOS, rotulo, type Servico } from '../lib/servicos';
import { CATEGORIAS } from './tabela';
import { seletor, comId, abaNoEndereco } from './dom';
import { confirmarNoBotao } from '../componentes';
import { navOficina, cabecalho, baixarArquivo } from './oficina';

type Aba = 'desdobrar' | 'revisao' | 'precheck' | 'cotacao';
const ABAS: [Aba, string][] = [['desdobrar', 'Desdobramento de KV'], ['revisao', 'Revisão de texto'], ['precheck', 'Pré-checagem de peça'], ['cotacao', 'Cotação de fornecedor']];
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ADAPTACOES = SERVICOS.filter((s) => s.etapa === 'ADAPTAÇÃO');
const indice = ADAPTACOES.map((s) => sem(`${s.id} ${s.cat} ${s.sub} ${s.esp} ${s.sinaproNome || ''}`));

/** Adaptações da tabela (etapa ADAPTAÇÃO) que casam com a busca e a categoria. */
export function adaptacoes(busca: string, cat: string, max = 80): Servico[] {
  const t = sem(busca).split(/\s+/).filter(Boolean), r: Servico[] = [];
  for (let i = 0; i < ADAPTACOES.length && r.length < max; i++) if ((!cat || ADAPTACOES[i].cat === cat) && t.every((x) => indice[i].includes(x))) r.push(ADAPTACOES[i]);
  return r;
}
/** Total das derivadas, cada uma com o desconto da tabela (config/descontos). */
export function totalDesdobramento(qtd: Record<string, number>, descontos: Record<string, number>) {
  let n = 0, total = 0;
  for (const [id, q] of Object.entries(qtd)) {
    if (!(q > 0)) continue;
    const s = SERVICOS.find((x) => String(x.id) === id); if (!s) continue;
    n += q; total += s.ref * q * (1 - (descontos[id] || 0) / 100);
  }
  return { n, total };
}
export interface Cotacao { id: string; item: string; qtd: number; job?: string; fornecedores: { nome: string; valor: number }[]; escolhido: string; em: string }
export const valorBR = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? n : 0; };
export function menor(fs: { nome: string; valor: string }[]) {
  const ok = fs.filter((f) => f.nome.trim() && valorBR(f.valor) > 0);
  return { validos: ok, menor: [...ok].sort((a, b) => valorBR(a.valor) - valorBR(b.valor))[0] };
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('ferramentas')}<div class="wrap vc bc">
  ${cabecalho('Ferramentas do estúdio', 'Bancada', 'O trabalho repetitivo feito pela máquina, o acabamento pela equipe: orçar um desdobramento pela tabela, revisar texto, checar a peça antes da prova e registrar as cotações de fornecedor.')}
  <div class="pills lc-abas" role="tablist" aria-label="Ferramentas">${ABAS.map(([v, t]) => `<button type="button" role="tab" id="bc-tab-${v}" aria-controls="bcO" data-aba="${v}">${t}</button>`).join('')}</div>
  <p class="sr" id="bcLive" aria-live="polite" aria-atomic="true"></p>
  <div id="bcO" role="tabpanel"></div></div>`;
  const $ = seletor(root);
  let aba: Aba = 'desdobrar', db: Banco | null = null, descontos: Record<string, number> = {}, cotacoes: Cotacao[] = [];
  const q: Record<string, number> = {};
  let busca = '', cat = '', imagem: File | null = null, urlImg = '';
  let forn = [{ nome: '', valor: '' }, { nome: '', valor: '' }, { nome: '', valor: '' }];
  const offs: (() => void)[] = [];
  const navAba = abaNoEndereco<Aba>(['desdobrar', 'revisao', 'precheck', 'cotacao'], 'desdobrar', (a) => { aba = a; render(); });
  aba = navAba.inicial;
  const avisar = (t: string) => { $('#bcLive').textContent = t; };

  function abas() {
    try { localStorage.setItem('bc.aba', aba); } catch { /* sem armazenamento */ }
    root.querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.aba === aba)); b.setAttribute('aria-pressed', String(b.dataset.aba === aba)); });
    $('#bcO').setAttribute('aria-labelledby', 'bc-tab-' + aba);
  }
  function render() {
    abas();
    const o = $('#bcO');
    if (aba === 'desdobrar') {
      o.innerHTML = `<p class="measure">Um key visual vira N formatos. Marque as adaptações da tabela e a quantidade de cada uma: o Studio soma o valor de cada derivada já com o desconto da Tabela de serviços.</p>
      <div class="vc-campos"><div class="f vc-q"><label for="bdQ">Buscar formato</label><input id="bdQ" type="search" value="${esc(busca)}" placeholder="Ex.: post, outdoor, banner"></div>
        <div class="f"><label for="bdC">Categoria</label><select id="bdC"><option value="">Todas</option>${CATEGORIAS.map((c) => `<option${c === cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div></div>
      <ul class="vc-l bd-lista" id="bdL"></ul><div class="lc-box bd-total" id="bdT"></div>`;
      linhas(); total();
    } else if (aba === 'revisao') {
      o.innerHTML = `<div class="f"><label for="rvT">Texto da peça</label><textarea id="rvT" rows="8" placeholder="Cole o texto do anúncio, post, roteiro ou e-mail."></textarea></div>
      <div class="f"><label for="rvR">Regras do cliente <span class="note">(grafias obrigatórias, termos proibidos, assinatura)</span></label><textarea id="rvR" rows="3" placeholder="Ex.: Sicredi sempre com S maiúsculo; nunca usar “banco”, e sim “instituição financeira cooperativa”."></textarea></div>
      <div class="acts"><button type="button" id="rvB">Revisar</button></div><p class="erro" id="rvE" role="alert"></p><div id="rvO"></div>`;
    } else if (aba === 'precheck') {
      o.innerHTML = `<p class="measure">Antes de mandar a prova: a IA olha a peça e aponta o que ajustar. O registro vira prova do craft para o cliente: o que foi corrigido antes de ele ver.</p>
      <div class="bc-duo"><div><label class="bi-zona"><span><b>${imagem ? esc(imagem.name) : 'Escolha a imagem da peça (JPG, PNG)'}</b></span><span class="note">Exporte a prova em JPG ou PNG. O arquivo não é guardado.</span><input type="file" accept="image/*" id="pcF" class="sr"></label>
        ${urlImg ? `<img src="${urlImg}" alt="Prévia da peça" class="pc-img">` : ''}</div>
        <div><div class="f"><label for="pcR">Especificação e regras da marca</label><textarea id="pcR" rows="6" placeholder="Ex.: post 1080×1350, assinatura no canto inferior direito, área de respiro de 60 px, texto legal obrigatório."></textarea></div>
        <div class="acts"><button type="button" id="pcB" ${imagem ? '' : 'disabled'}>Checar peça</button></div><p class="erro" id="pcE" role="alert"></p></div></div><div id="pcO"></div>`;
      aceitaImagens().then((ok) => { if (!ok && aba === 'precheck') $('#pcE').textContent = 'A pré-checagem por imagem precisa do Studio aberto no Claude com envio de imagens autorizado.'; });
    } else {
      o.innerHTML = `<p class="measure">Gráfica, impressão, locação, frete: três cotações, o menor preço fica registrado com as três como fonte, no padrão das contas públicas (Lei 12.232/2010, art. 14).</p>
      <div class="det fm"><div class="f"><label for="ctI">Item *</label><input id="ctI" placeholder="Ex.: Impressão de 500 folders A4 4×4"></div><div class="f"><label for="ctQ">Quantidade</label><input id="ctQ" class="num" inputmode="decimal" value="1"></div><div class="f"><label for="ctJ">Job ou cliente</label><input id="ctJ"></div></div>
      <div class="ct-forn">${forn.map((f, i) => `<div class="f"><label for="ctN${i}">Fornecedor ${i + 1}</label><input id="ctN${i}" data-forn="${i}" data-k="nome" value="${esc(f.nome)}"></div><div class="f"><label for="ctV${i}">Valor unitário (R$)</label><input id="ctV${i}" class="num" inputmode="decimal" data-forn="${i}" data-k="valor" value="${esc(f.valor)}" placeholder="0,00"></div>`).join('')}</div>
      <div class="lc-box bd-total" id="ctT"></div><div id="ctH"></div>`;
      cotTotal(); historico();
    }
  }
  function linhas() {
    const L = adaptacoes(busca, cat);
    $('#bdL').innerHTML = L.length ? L.map((s) => { const d = descontos[String(s.id)] || 0; return `<li class="bd-it"><span class="vc-c"><span>${esc(rotulo(s))}</span><span class="note">${brl(s.ref)}${d ? ` · −${String(d).replace('.', ',')}% da tabela` : ''} · ID ${s.id}</span></span><input class="num bd-q" inputmode="numeric" aria-label="Quantidade de ${esc(rotulo(s))}" data-q="${s.id}" value="${q[s.id] || ''}" placeholder="0"></li>`; }).join('') : '<li class="note">Nenhuma adaptação com essa busca.</li>';
  }
  function total() {
    const t = totalDesdobramento(q, descontos);
    $('#bdT').innerHTML = `<span><b class="num">${int(t.n)}</b> derivada(s) · <b class="num">${brl(t.total)}</b></span><div class="acts"><button type="button" class="ghost sm" id="bdCopiar" ${t.n ? '' : 'disabled'}>Copiar orçamento</button><button type="button" class="ghost sm" id="bdCSV" ${t.n ? '' : 'disabled'}>Baixar (.csv)</button><button type="button" class="lnk" id="bdLimpar" ${t.n ? '' : 'disabled'}>Limpar</button></div>`;
  }
  const itensDesd = () => Object.entries(q).filter(([, n]) => n > 0).map(([id, n]) => { const s = SERVICOS.find((x) => String(x.id) === id)!, d = descontos[id] || 0; return { s, n, d, v: s.ref * n * (1 - d / 100) }; });
  function cotTotal() {
    const { validos, menor: m } = menor(forn), qt = Math.max(1, valorBR(root.querySelector<HTMLInputElement>('#ctQ')?.value || '1'));
    $('#ctT').innerHTML = `<span>${m ? `Menor: <b>${esc(m.nome)}</b> · <b class="num">${brl(valorBR(m.valor) * qt)}</b>${validos.length < 3 ? ' · <span class="note">menos de 3 cotações</span>' : ''}` : 'Informe as cotações'}</span><button type="button" class="sm" id="ctB" ${m ? '' : 'disabled'}>Registrar cotação</button>`;
  }
  function historico() {
    const el = root.querySelector('#ctH'); if (!el) return;
    el.innerHTML = cotacoes.length ? `<div class="ph"><h2 class="d d-sub">Cotações registradas</h2><span class="note num">${cotacoes.length}</span></div><ul class="vc-l">${[...cotacoes].sort((a, b) => b.em.localeCompare(a.em)).map((c) => `<li class="ct-it"><span class="vc-c"><b>${esc(c.item)}</b><span class="note">${c.qtd} un.${c.job ? ' · ' + esc(c.job) : ''} · ${dt(c.em)} · ${c.fornecedores.map((f) => `${esc(f.nome)} ${brl(f.valor)}`).join(' · ')}</span></span><span class="vc-num"><span class="tag ok">${esc(c.escolhido)}</span>${c.fornecedores.length < 3 ? '<span class="note">menos de 3</span>' : ''}</span><button type="button" class="lnk perigo" data-delct="${esc(c.id)}">Apagar</button></li>`).join('')}</ul>` : '';
    el.querySelectorAll<HTMLButtonElement>('[data-delct]').forEach((b) => confirmarNoBotao(b, 'Confirmar', async () => { if (db) { await db.collection('cotacoes').doc(b.dataset.delct!).delete().catch(() => avisar('Não foi possível apagar.')); avisar('Cotação apagada.'); } }));
  }

  async function revisar(b: HTMLButtonElement) {
    const t = $<HTMLTextAreaElement>('#rvT').value, r = $<HTMLTextAreaElement>('#rvR').value;
    if (!t.trim()) { $('#rvE').textContent = 'Cole o texto da peça.'; return; }
    b.disabled = true; b.textContent = 'Revisando…'; $('#rvE').textContent = '';
    try {
      const x = (await perguntar(`Você é revisor de texto publicitário da PRODUCERIA. Revise o texto: ortografia, gramática, concordância, pontuação, padronização (números, datas, maiúsculas) e coerência. Não reescreva o estilo nem o conteúdo; mude só o necessário. Aponte em "alertas" afirmações que pedem comprovação (preço, taxa, percentual, promessa, condição legal), comuns em financeiro e telecom.
Regras do cliente (glossário, grafias obrigatórias): ${r || 'nenhuma informada'}
Responda só com JSON: {"texto": "texto revisado completo", "mudancas": [{"de": "", "para": "", "motivo": ""}], "alertas": [""]}

TEXTO
${t.slice(0, 15000)}`, { json: true })) as { texto?: string; mudancas?: { de: string; para: string; motivo: string }[]; alertas?: string[] } | null;
      if (!x?.texto) throw new ErroIA('A resposta não trouxe o texto revisado. Tente de novo.');
      const mud = Array.isArray(x.mudancas) ? x.mudancas : [], al = Array.isArray(x.alertas) ? x.alertas.filter(Boolean) : [];
      $('#rvO').innerHTML = `<div class="lc-box"><span class="lab">Texto revisado</span><div class="lc-pre" id="rvTxt">${esc(x.texto)}</div><div class="acts"><button type="button" class="ghost sm" id="rvCp">Copiar</button></div></div>
      <div><span class="lab">${mud.length} mudança(s)</span><ul class="rv-mud">${mud.map((m) => `<li><s>${esc(m.de)}</s> → <b>${esc(m.para)}</b> <span class="note">(${esc(m.motivo)})</span></li>`).join('')}</ul></div>
      ${al.length ? `<div class="lc-box"><span class="lab">Pedem comprovação</span><ul class="rv-mud">${al.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}`;
      $<HTMLButtonElement>('#rvCp').onclick = async () => { try { await navigator.clipboard.writeText(x.texto!); avisar('Texto copiado.'); } catch { avisar('Selecione o texto e copie.'); } };
    } catch (e) { $('#rvE').textContent = e instanceof ErroIA ? e.message : 'A revisão falhou. Tente de novo.'; }
    finally { b.disabled = false; b.textContent = 'Revisar'; }
  }
  async function checar(b: HTMLButtonElement) {
    if (!imagem) return;
    const r = $<HTMLTextAreaElement>('#pcR').value;
    b.disabled = true; b.textContent = 'Checando…'; $('#pcE').textContent = '';
    try {
      const x = await perguntar(`Você faz a pré-checagem de arte-final da PRODUCERIA antes de enviar a peça ao cliente. A imagem anexada é a peça. Verifique, pelo que a imagem mostra: texto (ortografia, cortes, legibilidade, contraste), hierarquia, alinhamentos e margens de segurança, elementos cortados nas bordas, logo e assinatura presentes e íntegros, consistência com as regras abaixo e com a especificação. Não afirme o que não dá para ver na imagem (perfil de cor, resolução real, sangria do arquivo): marque esses itens como "conferir no arquivo".
Especificação e regras: ${r || 'não informadas'}
Responda só com JSON: [{"item": "", "status": "ok|ajustar|conferir no arquivo", "obs": ""}]`, { json: true, imagens: [imagem] });
      if (!Array.isArray(x)) throw new ErroIA('A resposta não veio no formato esperado. Tente de novo.');
      $('#pcO').innerHTML = `<div class="tw"><table class="vc-t pc-t"><thead><tr><th scope="col"><span class="th">Item</span></th><th scope="col"><span class="th">Situação</span></th><th scope="col"><span class="th">Observação</span></th></tr></thead><tbody>
        ${x.map((i: { item?: string; status?: string; obs?: string }) => `<tr><td>${esc(i.item || '')}</td><td><span class="tag ${i.status === 'ok' ? 'ok' : i.status === 'ajustar' ? 'erro' : 'w'}">${esc(i.status || '')}</span></td><td>${esc(i.obs || '')}</td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { $('#pcE').textContent = e instanceof ErroIA ? e.message : 'A checagem falhou. Tente de novo.'; }
    finally { b.disabled = false; b.textContent = 'Checar peça'; }
  }

  root.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.aba) { navAba.ir(b.dataset.aba as Aba); $<HTMLElement>('#bc-tab-' + aba).focus(); return; }
    if (b.id === 'rvB') { revisar(b); return; }
    if (b.id === 'pcB') { checar(b); return; }
    if (b.id === 'bdLimpar') { for (const k of Object.keys(q)) delete q[k]; linhas(); total(); return; }
    if (b.id === 'bdCopiar' || b.id === 'bdCSV') {
      const L = itensDesd(), t = totalDesdobramento(q, descontos);
      if (b.id === 'bdCopiar') {
        const txt = ['Desdobramento de KV', ...L.map((x) => `${x.n}× ${rotulo(x.s)} · ${brl(x.v)}${x.d ? ` (−${x.d}%)` : ''}`), `Total: ${brl(t.total)} (${t.n} derivadas)`].join('\n');
        try { await navigator.clipboard.writeText(txt); avisar('Orçamento copiado.'); } catch { avisar('Não foi possível copiar.'); }
      } else {
        const csv = '﻿' + [['ID', 'Serviço', 'Qtd', 'Valor de referência', 'Desconto %', 'Total'], ...L.map((x) => [x.s.id, rotulo(x.s), x.n, String(x.s.ref).replace('.', ','), String(x.d).replace('.', ','), x.v.toFixed(2).replace('.', ',')])].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
        const m = await baixarArquivo('desdobramento-kv.csv', csv); if (m) avisar(m);
      }
      return;
    }
    if (b.id === 'ctB') {
      const item = $<HTMLInputElement>('#ctI').value.trim(), { validos, menor: m } = menor(forn);
      if (!item || !m) { avisar('Descreva o item e informe ao menos um fornecedor com valor.'); $<HTMLElement>(item ? '#ctN0' : '#ctI').focus(); return; }
      if (!db) { avisar('Sem o banco do Studio: a cotação não foi registrada.'); return; }
      const id = 'ct-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try {
        await db.collection('cotacoes').doc(id).set({ id, item, qtd: Math.max(1, valorBR($<HTMLInputElement>('#ctQ').value)), job: $<HTMLInputElement>('#ctJ').value.trim(), fornecedores: validos.map((f) => ({ nome: f.nome.trim(), valor: valorBR(f.valor) })), escolhido: m.nome.trim(), em: new Date().toISOString() });
        avisar(validos.length < 3 ? 'Cotação registrada. Atenção: menos de 3 cotações; contas públicas via agência exigem 3 (Lei 12.232, art. 14).' : `Cotação registrada: ${m.nome} (menor preço).`);
        forn = [{ nome: '', valor: '' }, { nome: '', valor: '' }, { nome: '', valor: '' }]; render();
      } catch { avisar('Não foi possível registrar a cotação.'); }
    }
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'bdQ') { busca = t.value; linhas(); }
    else if (t.dataset.q) { q[t.dataset.q] = Math.max(0, Math.round(Number(t.value) || 0)); total(); }
    else if (t.dataset.forn) { forn[Number(t.dataset.forn)][t.dataset.k as 'nome' | 'valor'] = t.value; cotTotal(); }
    else if (t.id === 'ctQ') cotTotal();
  });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'bdC') { cat = t.value; linhas(); }
    else if (t.id === 'pcF') { imagem = t.files?.[0] || null; if (urlImg) URL.revokeObjectURL(urlImg); urlImg = imagem ? URL.createObjectURL(imagem) : ''; const r = root.querySelector<HTMLTextAreaElement>('#pcR')?.value || ''; render(); $<HTMLTextAreaElement>('#pcR').value = r; }
  });

  render();
  (async () => {
    db = await banco();
    if (!db) return;
    offs.push(db.collection<{ valores?: Record<string, number> }>('config').onSnapshot((s) => { descontos = s.docs.find((d) => d.id === 'descontos')?.data().valores || {}; if (aba === 'desdobrar') { linhas(); total(); } }, () => {}));
    offs.push(db.collection<Cotacao>('cotacoes').onSnapshot((s) => { cotacoes = s.docs.map(comId); historico(); }, () => {}));
  })();
  return () => { navAba.parar(); if (urlImg) URL.revokeObjectURL(urlImg); offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
