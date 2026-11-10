// Casos: portfólio citável em propostas e abordagens.
import {esc} from '../lib/formato';
import {chave} from '../lib/nomes';
import {banco,type Colecao} from '../lib/db';
import type {Caso} from '../lib/tipos';
import {seletor,comId,type Dialogo} from './dom';
import {vazio,etiqueta,confirmarNoBotao} from '../componentes';

/** Caso como gravado pela página (além do modelo base). */
type CasoDoc = Caso & { em?: string; origem?: string };

export function montar(root: HTMLElement): () => void {
const SERV=['Arte-final','Retoque','Adaptação','Motion','Edição','HTML','Produção gráfica','OOH/DOOH','Revisão','Direção de arte','Desenvolvimento'];
const PERF: [string,string][]=[['independente','Agência independente'],['publica','Agência com conta pública'],['inhouse','Anunciante com estrutura interna'],['rede','Rede de agências'],['eua','Agência nos EUA']];
root.innerHTML=`<div class="wrap">
 <header class="mc-head"><p class="note">Casos que a equipe pode citar em propostas e abordagens. A proposta da Captação escolhe até 3, pelo perfil do alvo e pelos serviços orçados.</p><div class="acts"><button type="button" id="csN">Adicionar caso</button></div></header>
 <section class="bar cs-bar" aria-label="Filtros de casos"><div class="f"><label for="csQ">Buscar</label><input id="csQ" type="search" placeholder="Cliente, agência ou assunto" autocomplete="off"></div><div class="f"><label for="csS">Serviço</label><select id="csS"><option value="">Todos</option>${SERV.map(s=>`<option>${s}</option>`).join('')}</select></div><div class="f"><label for="csP">Serve para</label><select id="csP"><option value="">Qualquer perfil</option>${PERF.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></div></section>
 <p class="sr" id="csLive" aria-live="polite"></p><div id="csO"></div></div><dialog id="csD" aria-labelledby="csDT"></dialog>`;
const $=seletor(root);let C: CasoDoc[]=[],col: Colecao<CasoDoc>|null=null,off: (()=>void)|null=null;const F={q:'',s:'',p:''};
function render(){const q=chave(F.q);const L=C.filter(c=>(!F.s||(c.servicos||[]).includes(F.s))&&(!F.p||(c.perfis||[]).includes(F.p))&&(!q||chave([c.titulo,c.cliente,c.agencia,c.resumo,c.resultado].join(' ')).includes(q))).sort((a,b)=>String(b.ano||'').localeCompare(String(a.ano||'')));
 $('#csO').innerHTML=L.length?`<ul class="cs-l">${L.map(c=>`<li class="cs-it"><div class="cs-h"><h3 class="cn-t">${esc(c.titulo)}</h3><span class="note">${esc([c.cliente,c.agencia,c.ano].filter(Boolean).join(' · '))}</span></div>${c.resumo?`<p class="cn-r ab">${esc(c.resumo)}</p>`:''}${c.resultado?`<p class="cs-res"><span class="lab">Resultado / prova</span> ${esc(c.resultado)}</p>`:''}<div class="cn-emp">${(c.servicos||[]).map(s=>etiqueta(s)).join('')}${(c.perfis||[]).map(p=>etiqueta((PERF.find(x=>x[0]===p)||[p,p])[1],true)).join('')}</div><div class="cn-acts"><button type="button" class="ghost sm" data-ed="${esc(c.id)}">Editar</button>${c.url?`<a class="cn-f" href="${esc(c.url)}" target="_blank" rel="noopener">ver ↗<span class="sr"> (abre em nova aba)</span></a>`:''}</div></li>`).join('')}</ul>`:vazio({titulo:C.length?'Nenhum caso com esses filtros':'Nenhum caso ainda',texto:'Cadastre os trabalhos que provam o craft da casa: o que foi feito, para quem e o resultado. Só entra o que a equipe pode afirmar.'});
 $('#csLive').textContent=`${L.length} casos.`}
function form(c: CasoDoc|null|undefined,btn: HTMLElement){const d=$<Dialogo>('#csD'),x: Partial<CasoDoc>&{servicos:string[];perfis:string[]}=c||{servicos:[],perfis:[]};
 d.innerHTML=`<div class="dh"><h2 class="d d-sub" id="csDT">${c?'Editar caso':'Novo caso'}</h2><button type="button" class="x" id="csX" aria-label="Fechar">×</button></div><form id="csF" class="det fm" novalidate>
 <div class="f full"><label for="c_t">Título *</label><input id="c_t" required value="${esc(x.titulo||'')}"></div>
 <div class="f"><label for="c_c">Cliente</label><input id="c_c" value="${esc(x.cliente||'')}"></div><div class="f"><label for="c_a">Agência</label><input id="c_a" value="${esc(x.agencia||'')}"></div><div class="f"><label for="c_y">Ano</label><input id="c_y" inputmode="numeric" value="${esc(x.ano||'')}"></div><div class="f"><label for="c_u">Link</label><input id="c_u" type="url" value="${esc(x.url||'')}"></div>
 <div class="f full"><label for="c_r">O que fizemos *</label><textarea id="c_r" rows="3" required>${esc(x.resumo||'')}</textarea></div>
 <div class="f full"><label for="c_p">Resultado ou prova (prêmio, prazo, números)</label><input id="c_p" value="${esc(x.resultado||'')}"></div>
 <fieldset class="f full rs"><legend class="lab">Serviços</legend>${SERV.map(s=>`<label class="rad"><input type="checkbox" name="c_s" value="${s}" ${x.servicos.includes(s)?'checked':''}> ${s}</label>`).join('')}</fieldset>
 <fieldset class="f full rs"><legend class="lab">Serve de prova para</legend>${PERF.map(([v,t])=>`<label class="rad"><input type="checkbox" name="c_pf" value="${v}" ${x.perfis.includes(v)?'checked':''}> ${t}</label>`).join('')}</fieldset>
 <p class="erro full" id="c_e" role="alert"></p><div class="dacts fim full">${c?'<button type="button" class="ghost perigo" id="c_del">Excluir</button>':''}<button type="button" class="ghost" id="c_x">Cancelar</button><button type="submit">Salvar caso</button></div></form>`;
 d._ret=btn;d.showModal();$('#c_t').focus();$('#csX').onclick=$('#c_x').onclick=()=>d.close();
 const del=root.querySelector<HTMLButtonElement>('#c_del');
 if(c&&del)confirmarNoBotao(del,'Confirmar exclusão',async()=>{if(col)await col.doc(c.id).delete().catch(()=>{});else C=C.filter(y=>y.id!==c.id);render();d.close();$('#csLive').textContent='Caso excluído.'});
 $<HTMLFormElement>('#csF').onsubmit=async e=>{e.preventDefault();const g=(i: string)=>$<HTMLInputElement>('#c_'+i).value.trim();const falta=[['t','título'],['r','o que fizemos']].filter(([k])=>!g(k));d.querySelectorAll('[aria-invalid]').forEach(y=>y.removeAttribute('aria-invalid'));if(falta.length){falta.forEach(([k])=>$('#c_'+k).setAttribute('aria-invalid','true'));$('#c_e').textContent='Preencha: '+falta.map(f=>f[1]).join(', ')+'.';$('#c_'+falta[0][0]).focus();return}
  const id=c?c.id:'cs-'+chave(g('t')).replace(/\s+/g,'-').slice(0,50)+'-'+Date.now().toString(36).slice(-4);
  const marcados=(n: string)=>[...d.querySelectorAll<HTMLInputElement>(`[name=${n}]:checked`)].map(y=>y.value);
  const doc: CasoDoc={id,titulo:g('t'),cliente:g('c'),agencia:g('a'),ano:g('y'),url:g('u'),resumo:g('r'),resultado:g('p'),servicos:marcados('c_s'),perfis:marcados('c_pf'),em:new Date().toISOString(),origem:c?.origem||'Equipe'};
  if(col){try{await col.doc(id).set(doc)}catch(err){$('#c_e').textContent='Não foi possível salvar.';return}}else{C=C.filter(y=>y.id!==id).concat([doc]);render()}d.close();$('#csLive').textContent='Caso salvo.'}}
$('#csD').addEventListener('close',()=>{const d=$<Dialogo>('#csD');(d._ret&&d._ret.isConnected?d._ret:$('#csN')).focus()});
$('#csN').onclick=e=>form(null,e.currentTarget as HTMLElement);
$('#csO').onclick=e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-ed]');if(b)form(C.find(c=>c.id===b.dataset.ed),b)};
$<HTMLInputElement>('#csQ').oninput=e=>{F.q=(e.target as HTMLInputElement).value;render()};$<HTMLSelectElement>('#csS').onchange=e=>{F.s=(e.target as HTMLSelectElement).value;render()};$<HTMLSelectElement>('#csP').onchange=e=>{F.p=(e.target as HTMLSelectElement).value;render()};
render();
(async()=>{const db=await banco();if(!db)return;const c=col=db.collection<CasoDoc>('casos');off=c.onSnapshot(s=>{C=s.docs.map(comId);render()},()=>{})})();
return()=>{try{off&&off()}catch(e){}}}
