// Plugins da casa: os painéis do Photoshop e o script do After Effects para baixar, o tutorial de instalação,
// o roteiro de teste (resultados salvos na coleção `testes_plugins`) e as integrações com Magnific e Firefly.
import manifesto from '../oficina/bridge/manifest.json?raw';
import indice from '../oficina/bridge/index.html?raw';
import principal from '../oficina/bridge/main.js?raw';
import leiame from '../oficina/bridge/LEIAME.md?raw';
import { esc } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { quemSou } from '../lib/arquivos';
import { seletor, abaNoEndereco, comId } from './dom';
import { navOficina, cabecalho, baixarArquivo } from './oficina';
import { PLUGINS, ROTEIRO, TUTORIAL, NOME_PACOTE, pacoteCompleto, pacotePlugin, tutorialMarkdown, type Plugin } from '../oficina/kit-plugins';

export const ARQUIVOS_BRIDGE: [string, string][] = [['manifest.json', manifesto], ['index.html', indice], ['main.js', principal], ['LEIAME.md', leiame]];
export const INTEGRACOES = [
  { nome: 'Magnific (upscale)', status: 'Dentro do Bridge', tag: 'ok', faz: 'Amplia 2x a 16x com IA, para retoque e grandes formatos. O resultado abre como documento novo no Photoshop.', exige: 'Conta e chave de API Magnific; cobrança por imagem conforme a área final.', fonte: 'https://docs.magnific.com/api-reference/image-upscaler-creative/image-upscaler' },
  { nome: 'Adobe Firefly Services', status: 'Depende de contrato Adobe', tag: 'w', faz: 'Expand Image e Fill (estender KV para formatos sem cortar), Remove Background, máscaras, Replace Smart Object em lote e renditions pela Photoshop API.', exige: 'Credencial corporativa (OAuth servidor-a-servidor) e créditos de operação. A chave não pode ficar no plugin: precisa de um servidor intermediário.', fonte: 'https://helpx.adobe.com/enterprise/kb/automation-operation-definition.html' },
  { nome: 'InDesign e Illustrator (Data Merge)', status: 'Próximo passo', tag: 'w', faz: 'Gerar variações de peças com texto e preço (varejo, cooperativas) a partir de uma planilha.', exige: 'Os mesmos créditos do Firefly Services, ou script local no InDesign.' },
];
const FLUXO = ['Studio: ficha + pacote do job', 'Photoshop: pré-checagem e formatos', 'Arte-finalista: acabamento manual', 'Photoshop: prova exportada', 'Studio: aprovação e rodadas'];

type Aba = 'plugins' | 'instalar' | 'teste' | 'integracoes';
const ABAS: [Aba, string][] = [['plugins', 'Plugins'], ['instalar', 'Instalar'], ['teste', 'Roteiro de teste'], ['integracoes', 'Integrações']];
type Res = 'ok' | 'falhou' | '';
export interface Teste { id: string; plugin: string; versao: string; passos: Record<string, Res>; notas: Record<string, string>; em: string; autor?: string | null }
export interface Ambiente { id: string; ps: string; mac: string }
export const idTeste = (p: Plugin) => `${p.id}-v${p.versao}`;

/** Relatório da rodada de teste em Markdown, para mandar de volta e corrigir. */
export function relatorio(testes: Record<string, Teste>, amb: Ambiente | null, hoje = new Date().toISOString().slice(0, 10)): string {
  const l = [`# Rodada de teste dos plugins · ${hoje}`, '', `Photoshop: ${amb?.ps || '(não informado)'} · macOS: ${amb?.mac || '(não informado)'}`, ''];
  for (const p of PLUGINS) {
    const t = testes[idTeste(p)], rs = ROTEIRO[p.id] || [];
    const ok = rs.filter((_, i) => t?.passos?.[i] === 'ok').length, falhou = rs.filter((_, i) => t?.passos?.[i] === 'falhou').length;
    l.push(`## ${p.nome} v${p.versao} · ${ok} passou, ${falhou} falhou, ${rs.length - ok - falhou} sem teste`, '');
    rs.forEach((r, i) => {
      const s = t?.passos?.[i], n = t?.notas?.[i];
      l.push(`${i + 1}. [${s === 'ok' ? 'PASSOU' : s === 'falhou' ? 'FALHOU' : 'sem teste'}] ${r.fazer}${n ? `\n   Nota: ${n}` : ''}`);
    });
    l.push('');
  }
  return l.join('\n');
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('plugins')}<div class="wrap vc pl">
  ${cabecalho('Oficina · plugins da casa', 'Plugins', 'Painéis da Produceria para o Photoshop e o After Effects, com tutorial de instalação e roteiro de teste. Feitos a partir do que os plugins mais usados da Adobe Exchange resolvem, no nosso padrão de arte-final.')}
  <div class="pills lc-abas" role="tablist" aria-label="Plugins">${ABAS.map(([v, t]) => `<button type="button" role="tab" id="pl-tab-${v}" aria-controls="plO" data-aba="${v}">${t}</button>`).join('')}</div>
  <div id="plO" role="tabpanel"></div>
  <p class="sr" id="plLive" aria-live="polite" aria-atomic="true"></p></div>`;
  const $ = seletor(root);
  const avisar = (t: string) => { $('#plLive').textContent = t; };
  let aba: Aba = 'plugins', db: Banco | null = null, testes: Record<string, Teste> = {}, amb: Ambiente | null = null, focoPlugin = PLUGINS[0].id;
  const offs: (() => void)[] = [];
  const nav = abaNoEndereco<Aba>(ABAS.map((a) => a[0]), 'plugins', (a) => { aba = a; render(); });
  aba = nav.inicial;
  root.querySelectorAll<HTMLButtonElement>('[data-aba]').forEach((b) => { b.onclick = () => nav.ir(b.dataset.aba as Aba); });

  async function baixar(b: HTMLButtonElement, nome: string, gerar: () => Uint8Array | string) {
    b.disabled = true;
    try { const m = await baixarArquivo(nome, gerar()); if (m) avisar(m); } catch { avisar('Não consegui montar o arquivo.'); }
    b.disabled = false;
  }

  function render() {
    root.querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.aba === aba)); b.setAttribute('aria-pressed', String(b.dataset.aba === aba)); });
    $('#plO').setAttribute('aria-labelledby', 'pl-tab-' + aba);
    $('#plO').onclick = null; $('#plO').onchange = null;
    if (aba === 'plugins') abaPlugins(); else if (aba === 'instalar') abaInstalar(); else if (aba === 'teste') abaTeste(); else abaIntegracoes();
  }

  function abaPlugins() {
    $('#plO').innerHTML = `<div class="pl-sec">
      <section class="lc-box pl-kit" aria-labelledby="pl-k"><span class="lab">Kit completo · ${PLUGINS.length} painéis para Photoshop + After Effects</span><h2 class="d d-sub" id="pl-k">Baixe tudo de uma vez</h2>
        <p class="measure">Um .zip com os instaladores (.ccx, duplo clique), o código-fonte para o UXP Developer Tool, o script do After Effects e o tutorial. Depois siga a aba <a href="#plugins/instalar">Instalar</a> e anote os resultados no <a href="#plugins/teste">Roteiro de teste</a>.</p>
        <div class="acts"><button type="button" id="plTudo">Baixar todos os plugins (.zip)</button><button type="button" class="lnk" id="plTut">Baixar só o tutorial (.md)</button></div>
        <p class="note">Primeira rodada: nenhum painel foi aberto ainda dentro do Photoshop. Teste em cópias de arquivo, nunca no original de cliente.</p></section>
      <ul class="pl-grade">${PLUGINS.map((p) => `<li class="pl-card"><div class="pl-cab"><b>${esc(p.nome)}</b><span class="note">v${esc(p.versao)}</span>${p.novo ? '<span class="tag ok">novo</span>' : ''}${p.experimental ? '<span class="tag w">experimental</span>' : ''}</div>
        <p>${esc(p.faz)}</p>
        <p class="note">Painel: Plug-ins › ${esc(p.painel)} · Photoshop ${esc(p.minPs)} ou mais novo${p.experimental ? ` · ${esc(p.experimental)}` : ''}</p>
        <p class="note">Referência na Adobe Exchange: ${esc(p.referencia)}</p>
        <div class="acts"><button type="button" class="lnk" data-baixa="${esc(p.id)}">Baixar só este (.zip)</button><button type="button" class="lnk" data-roteiro="${esc(p.id)}">Roteiro de teste →</button></div></li>`).join('')}
        <li class="pl-card"><div class="pl-cab"><b>After Effects · Variações de template</b><span class="note">v1.0</span></div><p>Uma composição por linha de um CSV, trocando os textos das camadas com o mesmo nome das colunas. Opcionalmente já manda para a fila de render.</p><p class="note">Arquivo › Scripts › Executar arquivo de script. Vem no kit completo, pasta 3-after-effects.</p></li></ul></div>`;
    const tudo = $<HTMLButtonElement>('#plTudo');
    tudo.onclick = () => baixar(tudo, NOME_PACOTE, pacoteCompleto);
    const tut = $<HTMLButtonElement>('#plTut');
    tut.onclick = () => baixar(tut, 'TUTORIAL-plugins-produceria.md', tutorialMarkdown);
    $('#plO').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      const p = PLUGINS.find((x) => x.id === (b?.dataset.baixa || b?.dataset.roteiro));
      if (!b || !p) return;
      if (b.dataset.baixa) baixar(b, `${p.pasta}.zip`, () => pacotePlugin(p));
      else { focoPlugin = p.id; nav.ir('teste'); }
    };
  }

  function abaInstalar() {
    $('#plO').innerHTML = `<div class="pl-sec pl-tut">
      <nav class="pl-indice" aria-label="Partes do tutorial"><span class="lab">Neste tutorial</span><ol>${TUTORIAL.map((s) => `<li><a href="#plugins/instalar" data-ir="${s.id}">${esc(s.titulo)}</a></li>`).join('')}</ol>
        <p class="note">Caminho A é o normal. Use o C se o duplo clique não instalar e o B para testar e recarregar correções.</p></nav>
      <div class="pl-partes">${TUTORIAL.map((s) => `<section class="pl-parte" id="tut-${s.id}" aria-labelledby="tut-h-${s.id}"><h2 class="d d-sub" id="tut-h-${s.id}">${esc(s.titulo)}</h2>${s.intro ? `<p class="measure">${esc(s.intro)}</p>` : ''}
        ${s.etapas.map((e) => `<div class="pl-etapa"><h3>${esc(e.titulo)}</h3><ol>${e.passos.map((p) => p.startsWith('"/') ? `<li class="pl-cmd"><code>${esc(p)}</code><button type="button" class="lnk" data-copia="${esc(p)}">Copiar comando</button></li>` : `<li>${esc(p)}</li>`).join('')}</ol>
          ${e.ver ? `<p class="pl-ver"><span class="lab">O que você deve ver</span>${esc(e.ver)}</p>` : ''}${e.atencao ? `<p class="pl-atencao"><span class="lab">Atenção</span>${esc(e.atencao)}</p>` : ''}</div>`).join('')}</section>`).join('')}</div></div>`;
    $('#plO').onclick = async (e) => {
      const t = e.target as HTMLElement;
      const ir = t.closest<HTMLElement>('[data-ir]')?.dataset.ir;
      if (ir) { e.preventDefault(); root.querySelector(`#tut-${ir}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      const c = t.closest<HTMLElement>('[data-copia]')?.dataset.copia;
      if (c) { try { await navigator.clipboard.writeText(c); avisar('Comando copiado.'); } catch { avisar('Não consegui copiar: selecione o texto e use Cmd + C.'); } }
    };
  }

  function abaTeste() {
    const p = PLUGINS.find((x) => x.id === focoPlugin) || PLUGINS[0];
    const t = testes[idTeste(p)], rs = ROTEIRO[p.id] || [];
    const resumoDe = (q: Plugin) => { const x = testes[idTeste(q)], n = (ROTEIRO[q.id] || []).length; const ok = Object.values(x?.passos || {}).filter((v) => v === 'ok').length, f = Object.values(x?.passos || {}).filter((v) => v === 'falhou').length; return { ok, f, n }; };
    $('#plO').innerHTML = `<div class="pl-sec">
      <div class="pl-amb"><label>Versão do Photoshop<input id="plPs" value="${esc(amb?.ps || '')}" placeholder="26.1" autocomplete="off"></label><label>macOS<input id="plMac" value="${esc(amb?.mac || '')}" placeholder="15.7" autocomplete="off"></label>
        <div class="acts"><button type="button" id="plRel">Baixar relatório (.md)</button></div></div>
      ${db ? '' : '<p class="note">Sem o banco do Studio nesta visualização: as marcações não ficam salvas.</p>'}
      <div class="pl-teste"><nav class="pl-lista" aria-label="Plugins">${PLUGINS.map((q) => { const r = resumoDe(q); return `<button type="button" class="ag-btn" data-plugin="${q.id}" aria-pressed="${q.id === p.id}"><b>${esc(q.nome.replace('Produceria ', ''))}</b><span class="note">${r.ok}/${r.n} passou${r.f ? ` · ${r.f} falhou` : ''}</span></button>`; }).join('')}</nav>
      <section class="pl-passos-t" aria-labelledby="pl-tp"><h2 class="d d-sub" id="pl-tp">${esc(p.nome)} <span class="note">v${esc(p.versao)}</span></h2>
        <p class="note">Painel em Plug-ins › ${esc(p.painel)}. Marque cada passo assim que testar; a nota é para o que apareceu de diferente.</p>
        <ol class="pl-roteiro">${rs.map((r, i) => `<li><p><b>Faça:</b> ${esc(r.fazer)}</p><p><b>Deve acontecer:</b> ${esc(r.esperado)}</p>
          <div class="acts" role="group" aria-label="Resultado do passo ${i + 1}"><button type="button" class="chip" data-res="ok" data-i="${i}" aria-pressed="${t?.passos?.[i] === 'ok'}">Passou</button><button type="button" class="chip" data-res="falhou" data-i="${i}" aria-pressed="${t?.passos?.[i] === 'falhou'}">Falhou</button></div>
          <label class="sr" for="plN${i}">Nota do passo ${i + 1}</label><input id="plN${i}" data-nota="${i}" value="${esc(t?.notas?.[i] || '')}" placeholder="O que apareceu (mensagem do painel, o que esperava)"></li>`).join('')}</ol></section></div></div>`;

    const gravar = async (mud: Partial<Teste>) => {
      const atual: Teste = testes[idTeste(p)] || { id: idTeste(p), plugin: p.id, versao: p.versao, passos: {}, notas: {}, em: '' };
      const novo: Teste = { ...atual, ...mud, passos: { ...atual.passos, ...(mud.passos || {}) }, notas: { ...atual.notas, ...(mud.notas || {}) }, em: new Date().toISOString(), autor: await quemSou() };
      testes[novo.id] = novo;
      if (db) await db.collection('testes_plugins').doc(novo.id).set(novo).catch(() => avisar('Não consegui salvar no Studio.'));
    };
    $('#plO').onclick = async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.plugin) { focoPlugin = b.dataset.plugin; abaTeste(); return; }
      if (b.dataset.res) {
        const i = b.dataset.i!, atual = testes[idTeste(p)]?.passos?.[i];
        const v: Res = atual === b.dataset.res ? '' : (b.dataset.res as Res);
        await gravar({ passos: { [i]: v } });
        abaTeste(); avisar(`Passo ${Number(i) + 1}: ${v === 'ok' ? 'passou' : v === 'falhou' ? 'falhou' : 'sem marcação'}.`);
        return;
      }
      if (b.id === 'plRel') baixar(b, `teste-plugins-${new Date().toISOString().slice(0, 10)}.md`, () => relatorio(testes, amb));
    };
    $('#plO').onchange = async (e) => {
      const i = e.target as HTMLInputElement;
      if (i.dataset.nota) { await gravar({ notas: { [i.dataset.nota]: i.value.trim() } }); avisar('Nota salva.'); return; }
      if (i.id === 'plPs' || i.id === 'plMac') {
        amb = { id: 'ambiente', ps: $<HTMLInputElement>('#plPs').value.trim(), mac: $<HTMLInputElement>('#plMac').value.trim() };
        if (db) await db.collection('testes_plugins').doc('ambiente').set(amb).catch(() => {});
        avisar('Versões salvas.');
      }
    };
  }

  function abaIntegracoes() {
    $('#plO').innerHTML = `<div class="pl-sec">
      <section aria-labelledby="pl-i"><div class="ph"><h2 class="d d-sub" id="pl-i">Integrações</h2><span class="note">o que existe, o que depende de contrato</span></div>
        <ul class="vc-l">${INTEGRACOES.map((x) => `<li class="pl-it"><span class="vc-c"><b>${esc(x.nome)}</b><span>${esc(x.faz)}</span><span class="note">Exige: ${esc(x.exige)}${x.fonte ? ` · <a class="cn-f" href="${esc(x.fonte)}" target="_blank" rel="noopener">documentação ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</span></span><span class="tag ${x.tag}">${esc(x.status)}</span></li>`).join('')}</ul></section>
      <section class="lc-box" aria-labelledby="pl-f"><span class="lab" id="pl-f">Como os dados circulam com o Bridge</span>
        <ol class="pl-fluxo">${FLUXO.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
        <p class="note">A troca é por arquivo: o plugin não grava direto no banco do Studio. Isso evita guardar credenciais no Photoshop e mantém a decisão humana entre as etapas.</p></section></div>`;
  }

  render();
  (async () => {
    db = await banco();
    if (!db) return;
    offs.push(db.collection<Teste & Ambiente>('testes_plugins').onSnapshot((s) => {
      testes = {}; amb = null;
      for (const d of s.docs.map(comId)) { if (d.id === 'ambiente') amb = d as unknown as Ambiente; else testes[d.id] = d as unknown as Teste; }
      if (aba === 'teste' && !root.querySelector('#plO input:focus')) abaTeste();
    }, () => {}));
  })();
  return () => { nav.parar(); offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
