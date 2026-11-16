// Big Data do mercado: anunciantes (dos grandes aos que mais investem), as agências que os atendem e as pessoas
// que decidem em cada lado, tudo ligado e com fonte. A base publicada dá o ponto de partida; a rotina diária amplia.
import { esc, int, dt } from '../lib/formato';
import { chave, slug, nomeLegivel, mesmaEmpresa } from '../lib/nomes';
import { banco, lerBase, type Colecao } from '../lib/db';
import { montarGrafo, type Grafo, type NoEmpresa, type NoAgencia, type PessoaMapa, type EmpresaMapa, type AgenciaMapa, type MercadoBase, type MovimentoBase } from '../lib/grafo';
import type { Alvo } from '../lib/tipos';
import { seletor, elDe, mensagem, comId, type Dialogo } from './dom';
import { kpis, numero, vazio } from '../componentes';

type Visao = 'empresas' | 'agencias' | 'pessoas';
const VISOES: [Visao, string][] = [['empresas', 'Anunciantes'], ['agencias', 'Agências'], ['pessoas', 'Pessoas']];
const link = (url: string, texto: string) => url ? `<a class="cn-f" href="${esc(url)}" target="_blank" rel="noopener">${texto} ↗<span class="sr"> (abre em nova aba)</span></a>` : '';
const redes = (o: { site?: string; instagram?: string; linkedin?: string }) => [link(o.site || '', 'Site'), link(o.instagram || '', 'Instagram'), link(o.linkedin || '', 'LinkedIn')].filter(Boolean).join(' ');
const veiculo = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'fonte'; } };

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap">
 <section class="kpis" id="bdK" aria-label="Tamanho da base"></section>
 <section class="bar cnbar" aria-label="Filtros do Big Data">
  <div class="f f-wide" role="group" aria-labelledby="bdLV"><span class="lab" id="bdLV">Ver</span><div class="pills" id="bdV"></div></div>
  <div class="f"><label for="bdQ">Buscar</label><input id="bdQ" type="search" placeholder="Anunciante, agência, pessoa ou setor" autocomplete="off"></div>
  <div class="f"><label for="bdO">Ordenar</label><select id="bdO"><option value="relevancia">Relevância</option><option value="recente">Movimento mais recente</option><option value="nome">Nome</option></select></div>
 </section>
 <p class="sr" id="bdLive" aria-live="polite"></p>
 <div id="bdL"></div></div><dialog id="bdD" class="bd-det" aria-labelledby="bdDT"></dialog>`;
  const $ = seletor(root);
  let mercado: MercadoBase | null = null, movs: MovimentoBase[] = [], emp: EmpresaMapa[] = [], ags: AgenciaMapa[] = [], pes: PessoaMapa[] = [], alvos: Alvo[] = [];
  let G: Grafo = montarGrafo({}), colAlvos: Colecao<Alvo> | null = null, lim = 60;
  const offs: (() => void)[] = [];
  const F: { v: Visao; q: string; o: string } = { v: 'empresas', q: '', o: 'relevancia' };
  try { const sv = JSON.parse(localStorage.getItem('bd.filtros') || 'null'); if (sv) Object.assign(F, sv); } catch { /* sem armazenamento */ }
  const ehAlvo = (nome: string) => alvos.some((a) => a.id === 'al-' + slug(nome) || mesmaEmpresa(a.nome, nome));

  const recalcular = () => { G = montarGrafo({ mercado, movimentos: movs, empresas: emp, agencias: ags, pessoas: pes }); render(); };

  function linhaEmpresa(e: NoEmpresa): string {
    const ags = [...new Set(e.ligacoes.map((l) => l.agencia))];
    return `<li><button type="button" class="bd-linha" data-e="${esc(e.k)}">
  <span class="bd-rank num">${e.ranking ? e.ranking + 'º' : '·'}</span>
  <span class="bd-c"><b>${esc(nomeLegivel(e.nome))}</b><span class="note">${esc([e.setor, e.grupo].filter(Boolean).join(' · ') || (e.ranking ? 'entre os 20 que mais investiram em mídia em 2025' : 'anunciante'))}${ags.length ? ' · ' + esc(ags.slice(0, 3).map(nomeLegivel).join(', ')) + (ags.length > 3 ? ` e mais ${ags.length - 3}` : '') : ''}</span></span>
  <span class="bd-n"><b class="num">${int(e.pessoas.length)}</b><span class="note">pessoa(s)</span></span>
  <span class="bd-n"><b class="num">${int(ags.length)}</b><span class="note">agência(s)</span></span></button></li>`;
  }
  function linhaAgencia(a: NoAgencia): string {
    const cl = [...new Set(a.ligacoes.map((l) => l.empresa))];
    return `<li><button type="button" class="bd-linha" data-a="${esc(a.k)}">
  <span class="bd-rank num" title="${a.cenp ? 'Posição no Cenp-Meios 2025' : ''}">${a.cenp ? a.cenp + 'º' : '·'}</span>
  <span class="bd-c"><b>${esc(nomeLegivel(a.nome))}</b><span class="note">${esc([a.grupo, a.perfil, a.uf].filter(Boolean).join(' · '))}${cl.length ? ' · ' + esc(cl.slice(0, 3).map(nomeLegivel).join(', ')) + (cl.length > 3 ? ` e mais ${cl.length - 3}` : '') : ''}</span></span>
  <span class="bd-n"><b class="num">${int(a.pessoas.length)}</b><span class="note">pessoa(s)</span></span>
  <span class="bd-n"><b class="num">${int(cl.length)}</b><span class="note">cliente(s)</span></span></button></li>`;
  }
  function linhaPessoa(p: PessoaMapa): string {
    return `<li><div class="bd-linha bd-pessoa"><span class="bd-c"><b>${esc(p.nome)}</b><span class="note">${esc(p.cargo)}${p.area ? ' · ' + esc(p.area) : ''}</span></span>
  <span class="bd-org"><button type="button" class="chip sm" data-org="${esc(p.organizacao)}">${esc(nomeLegivel(p.organizacao))}</button></span>
  <span class="bd-links">${redes(p)} ${link(p.fonte, veiculo(p.fonte))}</span></div></li>`;
  }

  function render() {
    try { localStorage.setItem('bd.filtros', JSON.stringify(F)); } catch { /* sem armazenamento */ }
    $('#bdV').innerHTML = VISOES.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${F.v === v}">${t} <span class="note">${int(v === 'empresas' ? G.empresas.length : v === 'agencias' ? G.agencias.length : G.pessoas.length)}</span></button>`).join('');
    const qi = $<HTMLInputElement>('#bdQ'); if (document.activeElement !== qi) qi.value = F.q;
    $<HTMLSelectElement>('#bdO').value = F.o;
    const comFonte = G.ligacoes.filter((l) => l.fonte).length;
    $('#bdK').innerHTML = kpis([
      { rotulo: 'Anunciantes', valor: numero(int(G.empresas.length)), nota: `${int(G.empresas.filter((e) => e.ranking).length)} entre os maiores investidores em mídia` },
      { rotulo: 'Agências', valor: numero(int(G.agencias.length)), nota: `${int(G.agencias.filter((a) => a.perfil === 'rede').length)} de redes globais` },
      { rotulo: 'Pessoas', valor: numero(int(G.pessoas.length)), nota: 'quem decide, com cargo e fonte' },
      { rotulo: 'Ligações', valor: numero(int(G.ligacoes.length)), nota: `${int(comFonte)} com link da fonte` },
    ]);
    const q = chave(F.q);
    const ordem = <T extends { nome: string; ultima?: string }>(L: T[]) => F.o === 'nome' ? [...L].sort((x, y) => chave(x.nome).localeCompare(chave(y.nome))) : F.o === 'recente' ? [...L].sort((x, y) => (y.ultima || '').localeCompare(x.ultima || '')) : L;
    let html = '', n = 0;
    if (F.v === 'empresas') {
      const L = ordem(G.empresas.filter((e) => !q || chave([e.nome, e.setor, e.grupo, ...e.ligacoes.map((l) => l.agencia), ...e.pessoas.map((p) => p.nome)].join(' ')).includes(q)));
      n = L.length; html = L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaEmpresa).join('')}</ul>` : '';
    } else if (F.v === 'agencias') {
      const L = ordem(G.agencias.filter((a) => !q || chave([a.nome, a.grupo, ...a.ligacoes.map((l) => l.empresa), ...a.pessoas.map((p) => p.nome)].join(' ')).includes(q)));
      n = L.length; html = L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaAgencia).join('')}</ul>` : '';
    } else {
      const L = [...G.pessoas].filter((p) => !q || chave([p.nome, p.cargo, p.organizacao, p.area].join(' ')).includes(q)).sort((x, y) => F.o === 'recente' ? (y.data || '').localeCompare(x.data || '') : chave(x.nome).localeCompare(chave(y.nome)));
      n = L.length; html = L.length ? `<ul class="bd-l">${L.slice(0, lim).map(linhaPessoa).join('')}</ul>` : '';
    }
    $('#bdL').innerHTML = html ? html + (n > lim ? `<p class="mais"><button type="button" class="ghost" id="bdM">Mostrar mais ${int(Math.min(60, n - lim))} (${int(n - lim)} restantes)</button></p>` : '')
      : vazio({ titulo: F.q ? 'Nada com essa busca' : F.v === 'pessoas' ? 'Nenhuma pessoa mapeada ainda' : 'Base vazia', texto: F.q ? 'Tente parte do nome ou limpe a busca.' : 'A rotina diária da Central grava aqui, todo dia, quem decide em cada anunciante e agência, sempre com a fonte.' });
    $('#bdLive').textContent = `${int(n)} resultados.`;
  }

  function detalhe(no: NoEmpresa | NoAgencia, tipo: 'e' | 'a', btn: HTMLElement) {
    const d = $<Dialogo>('#bdD');
    const lig = [...no.ligacoes].sort((x, y) => (y.data || '').localeCompare(x.data || ''));
    const outro = (l: { empresa: string; agencia: string }) => tipo === 'e' ? l.agencia : l.empresa;
    const e = tipo === 'e' ? no as NoEmpresa : null, a = tipo === 'a' ? no as NoAgencia : null;
    const inv = e?.investimento;
    d.innerHTML = `<div class="dh"><div><span class="lab">${tipo === 'e' ? 'Anunciante' : 'Agência'}</span><h2 class="d d-sub" id="bdDT">${esc(nomeLegivel(no.nome))}</h2>
  <p class="note">${esc([e?.setor, e?.grupo, a?.grupo, a?.perfil, a?.uf].filter(Boolean).join(' · '))}${e?.ranking ? ` · ${e.ranking}º maior anunciante de 2025` : ''}${a?.cenp ? ` · ${a.cenp}º no Cenp-Meios 2025` : ''}</p></div><button type="button" class="x" id="bdX" aria-label="Fechar">×</button></div>
 <div class="bd-corpo">
  ${no.nota ? `<p class="note">${esc(no.nota)}</p>` : ''}
  ${inv ? `<p><span class="lab">Investimento em mídia</span> ${int(inv.valor)} em ${inv.ano} <span class="note">(${esc(inv.escala || 'como publicado')})</span> ${link(inv.fonte, veiculo(inv.fonte))}</p>` : ''}
  ${redes(no) ? `<p>${redes(no)}</p>` : ''}
  <h3 class="bd-h">${tipo === 'e' ? 'Agências e o que cada uma faz' : 'Clientes e o que atende'}</h3>
  ${lig.length ? `<ul class="bd-lig">${lig.map((l) => `<li><button type="button" class="chip sm" data-org="${esc(outro(l))}">${esc(nomeLegivel(outro(l)))}</button> <span class="note">${esc(l.disciplina || l.tipo || '')}${l.data ? ' · ' + esc(/^\d{4}-\d{2}-\d{2}/.test(l.data) ? dt(l.data) : l.data) : ''}</span> ${link(l.fonte, veiculo(l.fonte))}</li>`).join('')}</ul>` : '<p class="note">Nenhuma ligação registrada ainda.</p>'}
  <h3 class="bd-h">Quem decide</h3>
  ${no.pessoas.length ? `<ul class="bd-lig">${no.pessoas.map((p) => `<li><b>${esc(p.nome)}</b> · ${esc(p.cargo)} ${redes(p)} ${link(p.fonte, veiculo(p.fonte))}</li>`).join('')}</ul>` : '<p class="note">Ninguém mapeado ainda. A rotina diária procura os responsáveis por marketing, criação e produção.</p>'}
  <div class="dacts fim">${ehAlvo(no.nome) ? `<a class="tag ok" href="#captacao">Já é alvo da Captação</a>` : `<button type="button" id="bdAlvo">Virar alvo da Captação</button>`}</div>
 </div>`;
    d._ret = btn; d.showModal(); $<HTMLElement>('#bdX').focus();
    $('#bdX').onclick = () => d.close();
    const b = root.querySelector<HTMLButtonElement>('#bdAlvo');
    if (b) b.onclick = async () => {
      const id = 'al-' + slug(no.nome), ult = lig[0];
      const doc = { id, nome: nomeLegivel(no.nome), perfil: tipo === 'a' ? ((no as NoAgencia).perfil === 'rede' ? 'rede' : 'independente') : 'inhouse', contato: no.pessoas.map((p) => `${p.nome} (${p.cargo})`).join('; '),
        gatilho: ult ? `${nomeLegivel(ult.empresa)} com ${nomeLegivel(ult.agencia)}${ult.data ? ' em ' + dt(ult.data) : ''}` : 'Big Data do mercado', fonte: ult?.fonte || '', status: 'Mapeado',
        proximoPasso: 'Pesquisar quem decide produção e fazer o primeiro contato', prazo: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), notas: '', origem: 'Big Data do mercado', criadoEm: new Date().toISOString() } as Alvo;
      b.disabled = true; b.textContent = 'Criando…';
      if (!colAlvos) { alvos = [...alvos, doc]; d.close(); render(); return; }
      try { await colAlvos.doc(id).set(doc); $('#bdLive').textContent = `${doc.nome} entrou como alvo na Captação.`; d.close(); } catch (err) { b.disabled = false; b.textContent = 'Tentar de novo'; $('#bdLive').textContent = 'Não foi possível criar o alvo: ' + mensagem(err); }
    };
  }
  const abrirOrg = (nome: string, btn: HTMLElement) => {
    const e = G.empresas.find((x) => x.k === chave(nome)) || G.empresas.find((x) => mesmaEmpresa(x.nome, nome));
    const a = G.agencias.find((x) => x.k === chave(nome)) || G.agencias.find((x) => mesmaEmpresa(x.nome, nome));
    if (a) detalhe(a, 'a', btn); else if (e) detalhe(e, 'e', btn);
  };

  $('#bdD').addEventListener('close', () => { const d = $<Dialogo>('#bdD'); if (d._ret && d._ret.isConnected) d._ret.focus(); });
  root.addEventListener('click', (ev) => {
    const el = elDe(ev);
    const v = el.closest<HTMLElement>('[data-v]'); if (v) { F.v = v.dataset.v as Visao; lim = 60; render(); root.querySelector<HTMLElement>(`[data-v="${F.v}"]`)?.focus(); return; }
    if (el.id === 'bdM') { lim += 60; render(); return; }
    const org = el.closest<HTMLElement>('[data-org]'); if (org) { const dd = $<Dialogo>('#bdD'); if (dd.open) dd.close(); abrirOrg(org.dataset.org || '', org); return; }
    const be = el.closest<HTMLElement>('[data-e]'); if (be) { const e = G.empresas.find((x) => x.k === be.dataset.e); if (e) detalhe(e, 'e', be); return; }
    const ba = el.closest<HTMLElement>('[data-a]'); if (ba) { const a = G.agencias.find((x) => x.k === ba.dataset.a); if (a) detalhe(a, 'a', ba); }
  });
  $<HTMLInputElement>('#bdQ').oninput = (e) => { F.q = (e.target as HTMLInputElement).value; lim = 60; render(); };
  $<HTMLSelectElement>('#bdO').onchange = (e) => { F.o = (e.target as HTMLSelectElement).value; render(); };
  render();
  lerBase<MercadoBase>('mercado').then((m) => { mercado = m; recalcular(); }).catch(() => {});
  (async () => {
    const db = await banco(); if (!db) return;
    const sub = <T>(nome: string, f: (l: T[]) => void) => offs.push(db.collection<T>(nome).onSnapshot((s) => { f(s.docs.map(comId) as T[]); recalcular(); }, () => {}));
    sub<MovimentoBase & { id: string }>('movimentos', (l) => { movs = l; });
    sub<EmpresaMapa & { id: string }>('mapa_empresas', (l) => { emp = l; });
    sub<AgenciaMapa & { id: string }>('mapa_agencias', (l) => { ags = l; });
    sub<PessoaMapa>('mapa_pessoas', (l) => { pes = l; });
    colAlvos = db.collection<Alvo>('alvos');
    offs.push(colAlvos.onSnapshot((s) => { alvos = s.docs.map(comId); }, () => {}));
  })();
  return () => { for (const o of offs) { try { o(); } catch { /* já cancelado */ } } };
}
