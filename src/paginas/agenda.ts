// Agenda de contatos da Captação: fila do dia, semana, todos os ativos e conversão por origem.
import {esc,int,dt} from '../lib/formato';
import {hoje,addDias,addUteis} from '../lib/datas';
import {ETAPAS,ativo,devido,calibrar,prioridadeDoAlvo} from '../lib/prioridade';
import {CANAIS,RESULTADOS,passoAtual,sugerirProximo,registrarContato,type Resultado} from '../lib/cadencia';
import {banco,type Colecao} from '../lib/db';
import type {Alvo} from '../lib/tipos';
import {seletor,elDe,mensagem,comId,type Dialogo} from './dom';

type Aba = 'hoje'|'semana'|'todos'|'conv';
interface ItemFila { a: Alvo; d: string; p: { nota: number; motivo: string } }

export function montar(root: HTMLElement): () => void {
root.innerHTML=`<div class="wrap">
 <section class="kpis" id="agK" aria-label="Resumo da agenda"></section>
 <div class="ag-tabs pills" role="tablist" aria-label="Visão" id="agT"></div>
 <p class="sr" id="agLive" aria-live="polite" aria-atomic="true"></p>
 <div id="agO"></div>
</div><dialog id="agD" aria-labelledby="agDT"></dialog>`;
const $=seletor(root);
let A: Alvo[]=[],col: Colecao<Alvo>|null=null,off: (()=>void)|null=null,aba: Aba='hoje',mode: 'carregando'|'local'|'db'='carregando';
try{aba=(localStorage.getItem('ag.aba') as Aba|null)||'hoje'}catch(e){}
const CAN=CANAIS,RES=RESULTADOS;
const proximoPasso=passoAtual;
function fila(): ItemFila[]{const cal=calibrar(A);return A.filter(ativo).map(a=>({a,d:devido(a),p:prioridadeDoAlvo(a,cal)})).sort((x,y)=>(x.d||'9').localeCompare(y.d||'9')||y.p.nota-x.p.nota)}
function linha({a,d,p}: ItemFila): string{const h=hoje(),atras=d&&d<h,ps=proximoPasso(a),pt=a.proximoToque;
 const oque=pt&&pt.texto?pt.texto:ps?ps.texto:a.proximoPasso||'Definir próximo passo';const canal=pt&&pt.canal?pt.canal:ps?ps.canal:'';
 return `<li class="ag-it${atras?' atras':''}"><div class="ag-d"><span class="num">${d?dt(d).slice(0,5):'—'}</span><span class="note">${atras?'atrasado':d===h?'hoje':''}</span></div>
 <div class="ag-c"><div class="ag-n"><b>${esc(a.nome)}</b><span class="tag">${esc(a.status||'Mapeado')}</span><span class="prio" title="${esc(p.motivo)}" aria-label="Prioridade ${p.nota} de 100: ${esc(p.motivo)}">${p.nota}</span></div>
 <p class="ag-o">${canal?`<span class="lab">${esc(canal)}</span> `:''}${esc(oque)}</p>
 ${a.contato?`<p class="note">Contato: ${esc(a.contato)}</p>`:'<p class="note">Sem contato registrado</p>'}
 <div class="ag-a"><button type="button" class="sm" data-reg="${esc(a.id)}">Registrar contato</button><button type="button" class="ghost sm" data-adi="${esc(a.id)}">Adiar 2 dias úteis</button>${a.fonte?`<a class="cn-f" href="${esc(a.fonte)}" target="_blank" rel="noopener">fonte ↗<span class="sr"> (abre em nova aba)</span></a>`:''}<a class="cn-f" href="#captacao">abrir na Captação</a></div></div></li>`}
function conversao(): string{const g: Record<string,Alvo[]>={};for(const a of A){const o=a.origem||'Sem origem';(g[o]=g[o]||[]).push(a)}
 const etapas=ETAPAS as readonly string[];
 const rate=(L: Alvo[],k: number)=>{const n=L.filter(a=>etapas.indexOf(a.status||'Mapeado')>=k).length;return {n,p:L.length?Math.round(n/L.length*100):0}};
 const linhas=Object.entries(g).sort((x,y)=>y[1].length-x[1].length);const tot=A;
 const cel=(L: Alvo[],k: number)=>{const r=rate(L,k);return `<td class="num">${r.n?`${int(r.n)} <span class="note">${r.p}%</span>`:'<span class="note">0</span>'}</td>`};
 return `<section class="p" aria-labelledby="h-conv"><div class="ph"><h2 class="d d-sub" id="h-conv">Conversão por origem</h2><span class="note">quantos chegaram a cada etapa</span></div>
 <div class="tw" tabindex="0" role="region" aria-labelledby="h-conv"><table class="conv"><thead><tr><th scope="col">Origem</th><th scope="col" class="num">Alvos</th><th scope="col" class="num">Abordados</th><th scope="col" class="num">Conversa</th><th scope="col" class="num">Proposta</th><th scope="col" class="num">Cliente</th><th scope="col" class="num">Descartados</th></tr></thead><tbody>
 ${linhas.map(([o,L])=>`<tr><th scope="row">${esc(o)}</th><td class="num">${int(L.length)}</td>${cel(L,2)}${cel(L,3)}${cel(L,4)}${cel(L,5)}<td class="num">${int(L.filter(a=>/descart/i.test(a.triagem||'')).length)}</td></tr>`).join('')}
 <tr class="tot"><th scope="row">Total</th><td class="num">${int(tot.length)}</td>${cel(tot,2)}${cel(tot,3)}${cel(tot,4)}${cel(tot,5)}<td class="num">${int(tot.filter(a=>/descart/i.test(a.triagem||'')).length)}</td></tr></tbody></table></div>
 <p class="note">Percentuais sobre os alvos de cada origem. O tempo entre etapas começa a ser medido a partir de agora, a cada contato registrado aqui.</p>${tempos()}</section>`}
function tempos(): string{const dif: [string,number][]=[];for(const a of A){const e=a.etapas||{};for(let k=2;k<ETAPAS.length;k++){const x=e[ETAPAS[k-1]],y=e[ETAPAS[k]];if(x&&y)dif.push([ETAPAS[k],(new Date(y).getTime()-new Date(x).getTime())/864e5])}}
 if(!dif.length)return '';const m: Record<string,number[]>={};for(const [k,v] of dif)(m[k]=m[k]||[]).push(v);
 return `<ul class="cn-fun">${Object.entries(m).map(([k,v])=>`<li><span>Dias até ${k}</span><b>${Math.round(v.reduce((s,x)=>s+x,0)/v.length)}</b></li>`).join('')}</ul>`}
function render(){try{localStorage.setItem('ag.aba',aba)}catch(e){}
 const F=fila(),h=hoje(),fim=addDias(h,7),atras=F.filter(x=>x.d&&x.d<h),hj=F.filter(x=>x.d===h),sem=F.filter(x=>x.d>h&&x.d<=fim),semd=F.filter(x=>!x.d);
 $('#agK').innerHTML=`<div class="k"><span class="kl">Para hoje</span><b>${int(atras.length+hj.length)}</b><span class="kn">${int(atras.length)} atrasado${atras.length===1?'':'s'}</span></div><div class="k"><span class="kl">Próximos 7 dias</span><b>${int(sem.length)}</b><span class="kn">toques agendados</span></div><div class="k"><span class="kl">Alvos ativos</span><b>${int(F.length)}</b><span class="kn">${int(semd.length)} sem data de próximo passo</span></div><div class="k"><span class="kl">Contatos registrados · 30 dias</span><b>${int(A.reduce((s,a)=>s+(a.toques||[]).filter(t=>String(t.em).slice(0,10)>=addDias(h,-30)).length,0))}</b><span class="kn">pela agenda</span></div>`;
 const tabs: [Aba,string][]=[['hoje',`Hoje (${atras.length+hj.length})`],['semana',`Semana (${sem.length})`],['todos',`Todos os ativos (${F.length})`],['conv','Conversão']];
 $('#agT').innerHTML=tabs.map(([v,t])=>`<button type="button" role="tab" id="tab-${v}" aria-selected="${aba===v}" aria-pressed="${aba===v}" aria-controls="agO" data-aba="${v}">${t}</button>`).join('');
 const L=aba==='hoje'?[...atras,...hj]:aba==='semana'?sem:F;
 $('#agO').setAttribute('role','tabpanel');$('#agO').setAttribute('aria-labelledby','tab-'+aba);
 $('#agO').innerHTML=mode==='carregando'&&!A.length?'<p class="note">Carregando alvos…</p>':aba==='conv'?conversao():L.length?`<ol class="ag-l">${L.map(linha).join('')}</ol>`:`<div class="empty"><h2 class="d d-sub">${aba==='hoje'?'Nada para hoje':'Nada nesta janela'}</h2><p class="note">${aba==='hoje'?'Nenhum contato vencendo. Veja a semana ou puxe leads novos da Central.':'Sem toques agendados.'}</p><a class="lnk" href="#central">Abrir a Central de notícias</a></div>`;
 $('#agLive').textContent=`${atras.length+hj.length} contatos para hoje.`}
async function salvar(a: Alvo,patch: Partial<Alvo>): Promise<boolean>{if(!col){Object.assign(a,patch);render();return true}try{await col.doc(a.id).update(patch);return true}catch(e){$('#agLive').textContent='Não foi possível salvar: '+mensagem(e);return false}}
function registrar(a: Alvo,btn: HTMLElement){const d=$<Dialogo>('#agD'),ps=proximoPasso(a);
 d.innerHTML=`<div class="dh"><div><p class="lab">Registrar contato</p><h2 class="d d-sub" id="agDT">${esc(a.nome)}</h2></div><button type="button" class="x" id="agX" aria-label="Fechar">×</button></div>
 <form id="agF" class="det fm"><div class="f"><label for="ag_c">Canal</label><select id="ag_c">${CAN.map(c=>`<option ${ps&&ps.canal===c?'selected':''}>${c}</option>`).join('')}</select></div>
 <fieldset class="f rs"><legend class="lab">Resultado</legend>${RES.map(([v,t],i)=>`<label class="rad"><input type="radio" name="ag_r" value="${v}" ${i===0?'checked':''}> ${t}</label>`).join('')}</fieldset>
 <div class="f full"><label for="ag_n">Nota (opcional)</label><textarea id="ag_n" rows="3" placeholder="O que foi dito, quem respondeu, próximo combinado"></textarea></div>
 <div class="f"><label for="ag_p">Próximo contato</label><input id="ag_p" type="date"></div><div class="f"><label for="ag_t">O que fazer</label><input id="ag_t"></div>
 <div class="dacts fim full"><button type="button" class="ghost" id="agC">Cancelar</button><button type="submit">Salvar contato</button></div></form>`;
 const resultado=()=>d.querySelector<HTMLInputElement>('[name=ag_r]:checked')!.value as Resultado;
 const val=(s: string)=>$<HTMLInputElement>(s);
 const sug=()=>{const x=sugerirProximo(a,resultado());val('#ag_p').value=x.data;val('#ag_t').value=x.texto};
 sug();d.querySelectorAll<HTMLInputElement>('[name=ag_r]').forEach(x=>x.onchange=sug);
 d._ret=btn;d.showModal();$('#ag_c').focus();$('#agX').onclick=$('#agC').onclick=()=>d.close();
 $<HTMLFormElement>('#agF').onsubmit=async e=>{e.preventDefault();const r=resultado(),agora=new Date().toISOString();
  const patch=registrarContato(a,{canal:$<HTMLSelectElement>('#ag_c').value,resultado:r,nota:$<HTMLTextAreaElement>('#ag_n').value,proxima:val('#ag_p').value,oQueFazer:val('#ag_t').value},agora),novo=patch.status;
  const sb=d.querySelector<HTMLButtonElement>('[type=submit]')!;sb.disabled=true;sb.textContent='Salvando…';
  if(await salvar(a,patch)){d.close();$('#agLive').textContent=`Contato com ${a.nome} registrado${novo!==a.status?', etapa: '+novo:''}.`}else{sb.disabled=false;sb.textContent='Salvar contato'}}}
$('#agD').addEventListener('close',()=>{const d=$<Dialogo>('#agD');const id=d._ret&&d._ret.dataset&&d._ret.dataset.reg;const b=id?root.querySelector<HTMLElement>(`[data-reg="${CSS.escape(id)}"]`):null;(b||$<HTMLElement>('#agT button[aria-selected=true]'))?.focus()});
root.addEventListener('click',async e=>{const el=elDe(e);const t=el.closest<HTMLElement>('[data-aba]');if(t){aba=t.dataset.aba as Aba;render();root.querySelector<HTMLElement>(`[data-aba="${aba}"]`)!.focus();return}
 const r=el.closest<HTMLElement>('[data-reg]');if(r){const a=A.find(x=>x.id===r.dataset.reg);a&&registrar(a,r);return}
 const ad=el.closest<HTMLButtonElement>('[data-adi]');if(ad){const a=A.find(x=>x.id===ad.dataset.adi);if(!a)return;ad.disabled=true;const nd=addUteis(hoje(),2);await salvar(a,{proximoToque:{...(a.proximoToque||{}),data:nd},prazo:nd});$('#agLive').textContent=`${a.nome} adiado para ${dt(nd)}.`}});
root.addEventListener('keydown',e=>{const t=elDe(e).closest<HTMLElement>('[role=tab]');if(!t||!['ArrowLeft','ArrowRight'].includes(e.key))return;const all=[...root.querySelectorAll<HTMLElement>('[role=tab]')],i=all.indexOf(t),n=all[(i+(e.key==='ArrowRight'?1:-1)+all.length)%all.length];n.click()});
render();
(async()=>{const db=await banco();if(!db){mode='local';render();return}const c=col=db.collection<Alvo>('alvos');const tm=setTimeout(()=>{mode='local';render()},10000);off=c.onSnapshot(s=>{clearTimeout(tm);mode='db';A=s.docs.map(comId);render()},()=>{clearTimeout(tm);mode='local';render()})})();
return()=>{try{off&&off()}catch(e){}}}
