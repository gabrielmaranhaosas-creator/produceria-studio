// Gerado a partir do módulo em produção e refatorado para usar src/lib. Próxima fase: tipar e migrar para componentes.
import {nomeLegivel,chave,slug,mesmaEmpresa} from '../lib/nomes';
import {banco,lerArquivo} from '../lib/db';
export function montar(root){
root.innerHTML=`<div class="wrap">
 <header class="mc-head">
  <p class="note" id="info">Carregando bases…</p>
  <div class="acts"><button type="button" class="ghost" id="bCsv">Baixar seleção (.csv)</button><button type="button" class="ghost" id="bAdd">Adicionar conta</button><button type="button" id="bImp">Importar dados</button></div>
 </header>
 <section class="bar" aria-label="Filtros do mapa de contas">
  <div class="f f-q"><label for="fQ">Empresa detentora</label><input id="fQ" type="search" placeholder="Nome ou CNPJ" autocomplete="off" aria-describedby="fQh"><span class="hint" id="fQh">Atalho: tecla /</span></div>
  <div class="f"><label for="fC">Cliente / órgão</label><input id="fC" type="search" placeholder="Parte do nome" autocomplete="off"></div>
  <div class="f"><label for="fS">Serviço</label><select id="fS"></select></div>
  <div class="f" role="group" aria-labelledby="lTipo"><span class="lab" id="lTipo">Tipo de conta</span><div class="seg" id="sTipo"><button type="button" data-v="" aria-pressed="true">Todas</button><button type="button" data-v="publica" aria-pressed="false">Públicas</button><button type="button" data-v="privada" aria-pressed="false">Privadas</button></div></div>
  <div class="f"><label for="fV">Vigência</label><select id="fV"><option value="">Qualquer</option><option value="vig">Vigentes</option><option value="90">Vencem em 90 dias</option><option value="enc">Encerradas</option><option value="sem">Sem data de fim</option></select></div>
  <div class="f"><label for="fM">Valor mínimo</label><div class="money"><span aria-hidden="true">R$</span><input id="fM" inputmode="numeric" placeholder="0" autocomplete="off" aria-describedby="fMh"></div><span class="hint" id="fMh">Contas sem valor divulgado somem com este filtro.</span></div>
 </section>
 <div class="chips" id="chips"></div>
 <p class="sr" id="live" aria-live="polite" aria-atomic="true"></p>
 <div id="out"></div>
</div>
<dialog id="dl" aria-labelledby="dlT"></dialog>`;
const $=s=>root.querySelector(s);let off=null;
const brl=n=>n==null?'não divulgado':n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});
const brk=n=>n>=1e9?'R$ '+(n/1e9).toFixed(2).replace('.',',')+' bi':n>=1e6?'R$ '+(n/1e6).toFixed(1).replace('.',',')+' mi':n>=1e3?'R$ '+Math.round(n/1e3)+' mil':brl(n);
const brs=n=>n>=1e9?(n/1e9).toFixed(2).replace('.',',')+' bi':n>=1e6?(n/1e6).toFixed(1).replace('.',',')+' mi':n>=1e3?Math.round(n/1e3)+' mil':String(Math.round(n));
const int=n=>Number(n).toLocaleString('pt-BR');
const dt=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const mesL=m=>MES[+m.slice(5,7)-1]+'/'+m.slice(2,4);
const nm=nomeLegivel;
let alvos=[],colA=null,offA=null;let rows=[],base=[],man=[],lim=50,F0={tipo:'',q:'',c:'',s:'',v:'',m:0,mes:''},F={...F0},sort={k:'valor',d:-1},col=null,mode='carregando',metric='auto',open={},cur=[],timer=null;
try{const sv=JSON.parse(localStorage.getItem('mc.estado')||'null');if(sv){F={...F0,...sv.F};metric=sv.metric||'auto';if(sv.sort)sort=sv.sort}}catch(e){}
const persist=()=>{try{localStorage.setItem('mc.estado',JSON.stringify({F,metric,sort}))}catch(e){}};
const hoje=new Date().toISOString().slice(0,10);
const plus=d=>{const x=new Date();x.setDate(x.getDate()+d);return x.toISOString().slice(0,10)};
const d90=plus(90);
const status=r=>!r.fim?'sem':r.fim<hoje?'enc':r.fim<=d90?'90':'vig';
const dias=r=>Math.round((new Date(r.fim)-new Date(hoje))/864e5);
const nrm=chave;const alvoDe=n=>chave(n)?alvos.find(a=>a.id==='al-'+slug(n)||mesmaEmpresa(a.nome,n)):null;
async function virarAlvo(r,btn){if(alvoDe(r.empresa))return;const nome=nm(r.empresa),id='al-'+nrm(r.empresa).replace(/\s+/g,'-').slice(0,60);
 const doc={id,nome,perfil:r.tipo==='publica'?'publica':'independente',contato:'',gatilho:`${r.tipo==='publica'?'Detém contrato público':'Conta privada'} com ${nm(r.cliente)} (${r.servico})${r.valor?', '+brl(r.valor):''}${r.fim?', vigente até '+dt(r.fim):''}.`,fonte:r.url||r.fonte||'',status:'Mapeado',proximoPasso:'Pesquisar quem decide produção e fazer o primeiro contato',prazo:plus(7),notas:'',origem:'Mapa de contas',criadoEm:new Date().toISOString()};
 btn.disabled=true;btn.textContent='Criando…';
 if(!colA){alvos.push(doc);btn.outerHTML='<span class="tag">Alvo criado (só nesta sessão)</span>';return}
 try{await colA.doc(id).set(doc);alvos.push(doc);$('#live').textContent=nome+' entrou como alvo na Captação.';btn.outerHTML='<a class="tag" href="#captacao">Já é alvo · Mapeado</a>'}catch(e){btn.disabled=false;btn.textContent='Tentar de novo';$('#live').textContent='Não foi possível criar o alvo.'}}
async function baixar(){const L=filt();const c=v=>{v=String(v??'');return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
 const lin=[['tipo','empresa','cnpj','cliente','servico','valor','inicio','fim','confianca','fonte','url'].join(';'),...L.map(r=>[r.tipo,nm(r.empresa),r.cnpj,nm(r.cliente),r.servico,r.valor==null?'':String(r.valor).replace('.',','),r.inicio,r.fim,r.confianca,r.fonte,r.url].map(c).join(';'))];
 let d=null;try{d=await window.claude.use('downloads')}catch(e){}
 if(!d){$('#live').textContent='O download não está disponível nesta visualização.';return}
 try{await d.save({filename:'mapa-de-contas-'+hoje+'.csv',data:'﻿'+lin.join('\n')});$('#live').textContent=L.length+' contas exportadas.'}catch(e){$('#live').textContent=e&&e.code==='declined'?'Download cancelado.':'Não foi possível baixar o arquivo.'}}
function filt(){const q=F.q.toLowerCase().trim(),c=F.c.toLowerCase().trim();return rows.filter(r=>(!F.tipo||r.tipo===F.tipo)&&(!q||r._q.includes(q))&&(!c||r._c.includes(c))&&(!F.s||r.servico===F.s)&&(!F.m||(r.valor||0)>=F.m)&&(!F.mes||(r.fim&&r.fim.slice(0,7)===F.mes))&&(!F.v||(F.v==='vig'?['vig','90'].includes(status(r)):status(r)===F.v)))}
function agg(list,key,by){const m=new Map;for(const r of list){const k=r[key]||'—';const o=m.get(k)||{k,v:0,n:0};o.v+=r.valor||0;o.n++;m.set(k,o)}return [...m.values()].sort(by==='n'?(a,b)=>b.n-a.n||b.v-a.v:(a,b)=>b.v-a.v||b.n-a.n)}
const FK={empresa:'q',cliente:'c',servico:'s'};
const ativo=(key,k)=>key==='servico'?F.s===k:(key==='empresa'?F.q:F.c)===k;
function chart(id,title,list,key,by){const all=agg(list,key,by),n=open[id]?20:8,a=all.slice(0,n),mx=Math.max(1,...a.map(x=>by==='n'?x.n:x.v));
 const body=a.length?a.map(x=>{const val=by==='n'?x.n:x.v,on=ativo(key,x.k),lab=nm(x.k),txt=by==='n'?`${int(x.n)} conta${x.n>1?'s':''}`+(x.v?` · ${brs(x.v)}`:''):(x.v?brs(x.v):'sem valor')+` · ${int(x.n)}`;
  return `<li><button type="button" class="row" data-f="${key}" data-k="${esc(x.k)}" aria-pressed="${on}" title="${esc(lab)}" aria-label="${esc(lab)}: ${esc(by==='n'?int(x.n)+' contas':(x.v?brl(x.v):'sem valor divulgado')+', '+int(x.n)+' contas')}. ${on?'Remover filtro':'Filtrar'}"><span class="n">${esc(lab)}</span><span class="t" aria-hidden="true"><i style="width:${val?Math.max(1.5,val/mx*100):0}%"></i></span><em aria-hidden="true">${txt}</em></button></li>`}).join(''):'<li class="vazio">Nada nesta seleção.</li>';
 return `<section class="p" aria-labelledby="h-${id}"><div class="ph"><h2 class="d d-sub" id="h-${id}">${title}</h2><span class="note">${int(all.length)} no total</span></div><ol class="bars">${body}</ol>${all.length>8?`<button type="button" class="ghost sm" data-mais="${id}" aria-expanded="${!!open[id]}">${open[id]?'Mostrar só os 8 primeiros':'Mostrar até 20'}</button>`:''}</section>`}
function opts(el,vals,lab){const curv=el.value||F.s;const u=[...new Set(vals.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));el.innerHTML=`<option value="">${lab}</option>`+u.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=u.includes(curv)?curv:''}
function chips(L){const c=[];const add=(k,t)=>c.push(`<button type="button" class="chip" data-x="${k}" aria-label="Remover filtro: ${esc(t)}">${esc(t)} <span aria-hidden="true">×</span></button>`);
 if(F.tipo)add('tipo',F.tipo==='publica'?'Públicas':'Privadas');if(F.q)add('q','Empresa: '+nm(F.q));if(F.c)add('c','Cliente: '+nm(F.c));if(F.s)add('s',F.s);if(F.v)add('v',{vig:'Vigentes','90':'Vencem em 90 dias',enc:'Encerradas',sem:'Sem data de fim'}[F.v]);if(F.m)add('m','A partir de '+brl(F.m));if(F.mes)add('mes','Vencem em '+mesL(F.mes));
 $('#chips').innerHTML=c.length?`<span class="lab">${int(L.length)} de ${int(rows.length)} contas</span>${c.join('')}<button type="button" class="ghost sm" id="bClr">Limpar tudo</button>`:'';}
function syncInputs(){$('#fQ').value=F.q;$('#fC').value=F.c;$('#fV').value=F.v;$('#fM').value=F.m?int(F.m):'';root.querySelectorAll('#sTipo button').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===F.tipo))}
function render(){persist();
 opts($('#fS'),rows.map(r=>r.servico),'Todos');
 const o=$('#out');
 if(!rows.length){$('#chips').innerHTML='';o.innerHTML=`<div class="p empty"><h2 class="d d-sub">${mode==='carregando'?'Carregando contas…':'Nenhuma conta carregada'}</h2>${mode==='carregando'?'':'<p class="note">Use <b>Importar dados</b> para colar uma planilha (CSV) ou JSON, ou <b>Adicionar conta</b> para cadastrar uma a uma. Cada conta precisa de fonte. Valor desconhecido fica como “não divulgado”.</p>'}</div>`;return}
 const L=filt();cur=L;chips(L);
 const cv=L.filter(r=>r.valor!=null&&r.valor>0),tot=cv.reduce((s,r)=>s+r.valor,0),emp=new Set(L.map(r=>r.empresa)).size,v90=L.filter(r=>status(r)==='90').length,sv=L.length-cv.length;
 const by=metric==='auto'?(cv.length?'valor':'n'):metric;
 const top=agg(L,'empresa','valor').slice(0,10).reduce((s,x)=>s+x.v,0);
 const meses=[];for(let i=0;i<12;i++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+i);meses.push(d.toISOString().slice(0,7))}
 const base12=L.filter(r=>r.fim&&r.fim>=hoje);const tl=meses.map(m=>{const g=base12.filter(r=>r.fim.slice(0,7)===m);return{m,n:g.length,v:g.reduce((s,r)=>s+(r.valor||0),0)}});const tm=Math.max(1,...tl.map(x=>x.n));
 const S=[...L].sort((a,b)=>{const k=sort.k;let x=a[k],y=b[k];if(k==='valor'){x=x??-1;y=y??-1}else{x=String(x??'');y=String(y??'');return x.localeCompare(y,'pt-BR')*sort.d}return (x>y?1:x<y?-1:0)*sort.d});
 const cols=[['empresa','Empresa'],['cliente','Cliente / órgão'],['servico','Serviço'],['tipo','Tipo'],['valor','Valor'],['fim','Vigência até']];
 o.innerHTML=`<section class="kpis" aria-label="Resumo da seleção">
  <div class="k"><span class="kl">Contas encontradas</span><b>${int(L.length)}</b><span class="kn">${L.length===rows.length?'todas as bases':'de '+int(rows.length)+' no total'}</span></div>
  <div class="k"><span class="kl">Valor somado</span>${cv.length?`<b title="${brl(tot)}">${brk(tot)}</b>`:'<b class="nd">Não divulgado</b>'}<span class="kn">${cv.length?`${int(cv.length)} com valor${sv?` · ${int(sv)} sem valor, fora da soma`:''}`:'nenhuma conta da seleção divulga valor'}</span></div>
  <div class="k"><span class="kl">Empresas detentoras</span><b>${int(emp)}</b><span class="kn">${tot&&emp>10?`as 10 maiores somam ${Math.round(top/tot*100)}% do valor`:cv.length?'concentração baixa':'por número de contas'}</span></div>
  <div class="k"><span class="kl">Vencem em 90 dias</span><b>${int(v90)}</b><span class="kn">${v90&&F.v!=='90'?'<button type="button" class="lnk" data-v90>Ver só estas</button>':F.v==='90'?'filtro ativo':'nenhum vencimento próximo'}</span></div>
 </section>
 <div class="medir" role="group" aria-labelledby="lMed"><span class="lab" id="lMed">Ordenar gráficos por</span><div class="seg sm" id="sMed">${[['auto','Automático'],['valor','Valor'],['n','Nº de contas']].map(([v,t])=>`<button type="button" data-m="${v}" aria-pressed="${metric===v}">${t}</button>`).join('')}</div>${metric==='auto'&&!cv.length?'<span class="note">Sem valores divulgados nesta seleção: os gráficos contam contas.</span>':''}</div>
 <div class="grid">${chart('emp','Empresas detentoras',L,'empresa',by)}${chart('cli','Clientes e órgãos',L,'cliente',by)}${chart('srv','Serviços',L,'servico',by)}
  <section class="p" aria-labelledby="h-tl"><div class="ph"><h2 class="d d-sub" id="h-tl">Vencimentos · 12 meses</h2><span class="note">${int(base12.length)} contas</span></div>
  ${base12.length?`<div class="tl">${tl.map(x=>`<button type="button" class="tb" data-mes="${x.m}" aria-pressed="${F.mes===x.m}" ${x.n?'':'disabled'} aria-label="${mesL(x.m)}: ${x.n} conta${x.n===1?'':'s'} vencendo${x.v?', '+brl(x.v):''}. ${F.mes===x.m?'Remover filtro':'Filtrar'}"><span class="c">${x.n||''}</span><span class="ba" aria-hidden="true"><i style="height:${x.n?Math.max(2,x.n/tm*100):0}%"></i></span><span class="m">${mesL(x.m)}</span></button>`).join('')}</div><p class="note">Clique num mês, empresa, cliente ou serviço para filtrar. Clique de novo para tirar o filtro.</p>`:'<p class="note vazio">Nenhuma conta da seleção tem data de fim nos próximos 12 meses.</p>'}</section></div>
 <section class="p" aria-labelledby="h-tab"><div class="ph"><h2 class="d d-sub" id="h-tab">Contas</h2><span class="note">${int(L.length)} · mostrando ${int(Math.min(lim,L.length))}</span></div>
 ${L.length?`<div class="tw" tabindex="0" role="region" aria-labelledby="h-tab"><table><thead><tr>${cols.map(([k,l])=>`<th scope="col" class="${k==='valor'?'num':''}" aria-sort="${sort.k===k?(sort.d>0?'ascending':'descending'):'none'}"><button type="button" class="th" data-s="${k}">${l}<span aria-hidden="true">${sort.k===k?(sort.d>0?' ↑':' ↓'):' ↕'}</span></button></th>`).join('')}</tr></thead><tbody>${S.slice(0,lim).map(r=>{const st=status(r);return `<tr data-id="${esc(r.id)}"><td><button type="button" class="nm" data-open="${esc(r.id)}">${esc(nm(r.empresa))}</button>${r.cnpj?`<span class="sub">${esc(r.cnpj)}</span>`:''}</td><td>${esc(nm(r.cliente))}</td><td>${esc(r.servico)}</td><td><span class="tag ${r.tipo==='publica'?'pub':'pri'}">${r.tipo==='publica'?'Pública':'Privada'}</span></td><td class="num">${r.valor==null?'<span class="tag w">não divulgado</span>':brl(r.valor)}</td><td class="vg">${dt(r.fim)}${st==='90'?`<span class="sub alerta">vence em ${dias(r)} dia${dias(r)===1?'':'s'}</span>`:st==='enc'?'<span class="sub">encerrada</span>':''}</td></tr>`}).join('')}</tbody></table></div>${L.length>lim?`<p class="mais"><button type="button" class="ghost" id="bMais">Mostrar mais ${int(Math.min(50,L.length-lim))} (${int(L.length-lim)} restantes)</button></p>`:''}`:`<div class="empty"><p>Nenhuma conta com esses filtros.</p><button type="button" class="ghost" id="bClr2">Limpar filtros</button></div>`}</section>`;
 $('#live').textContent=`${int(L.length)} conta${L.length===1?'':'s'} encontrada${L.length===1?'':'s'}.`}
function det(id,from){const i=cur.findIndex(x=>x.id===id),r=cur[i]||rows.find(x=>x.id===id);if(!r)return;const d=$('#dl');const st=status(r);
 d.innerHTML=`<div class="dh"><div><p class="lab">${r.tipo==='publica'?'Conta pública':'Conta privada'} · confiança: ${esc(r.confianca||'não informada')}</p><h2 class="d d-sub" id="dlT">${esc(nm(r.empresa))}</h2></div><button type="button" class="x" id="xX" aria-label="Fechar">×</button></div>
 <dl class="det"><div><dt>Cliente / órgão</dt><dd>${esc(nm(r.cliente))}</dd></div><div><dt>Serviço</dt><dd>${esc(r.servico)}</dd></div><div><dt>Valor</dt><dd>${brl(r.valor)}</dd></div><div><dt>CNPJ</dt><dd>${esc(r.cnpj||'—')}</dd></div><div><dt>Início</dt><dd>${dt(r.inicio)}</dd></div><div><dt>Fim</dt><dd>${dt(r.fim)}${st==='90'?` · vence em ${dias(r)} dias`:st==='enc'?' · encerrada':''}</dd></div></dl>
 ${r.obs?`<p class="obs">${esc(r.obs)}</p>`:''}<p class="note">Fonte: ${r.url?`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fonte||r.url)} <span class="sr">(abre em nova aba)</span>↗</a>`:esc(r.fonte||'—')}</p>
 <div class="dacts">${(()=>{const a=alvoDe(r.empresa);return a?`<a class="tag" href="#captacao">Já é alvo · ${esc(a.status||"")}</a>`:`<button type="button" class="sm" id="xAlvo">Virar alvo da Captação</button>`})()}<button type="button" class="ghost sm" id="xEmp">Todas desta empresa</button><button type="button" class="ghost sm" id="xCli">Todas deste cliente</button>${r.base?'':'<button type="button" class="ghost sm perigo" id="xDel">Excluir</button>'}</div>
 <div class="dnav">${i>=0?`<button type="button" class="ghost sm" id="xPrev" ${i>0?'':'disabled'} aria-label="Conta anterior">← Anterior</button><span class="note">${int(i+1)} de ${int(cur.length)} · use ← →</span><button type="button" class="ghost sm" id="xNext" ${i<cur.length-1?'':'disabled'} aria-label="Próxima conta">Próxima →</button>`:''}</div>`;
 if(!d.open){d._ret=from||document.activeElement;d.showModal()}
 $('#xX').onclick=()=>d.close();
 if($('#xAlvo'))$('#xAlvo').onclick=()=>virarAlvo(r,$('#xAlvo'));
 $('#xEmp').onclick=()=>{F.q=r.empresa;lim=50;syncInputs();render();d.close()};$('#xCli').onclick=()=>{F.c=r.cliente;lim=50;syncInputs();render();d.close()};
 if($('#xPrev'))$('#xPrev').onclick=()=>i>0&&det(cur[i-1].id);if($('#xNext'))$('#xNext').onclick=()=>i<cur.length-1&&det(cur[i+1].id);
 if($('#xDel'))$('#xDel').onclick=async()=>{if(!confirm('Excluir esta conta do mapa?'))return;if(col){await col.doc(id).delete().catch(()=>{})}else man=man.filter(x=>x.id!==id);setRows();d.close()};
 d.onkeydown=e=>{if(e.target.matches('input,textarea,select'))return;if(e.key==='ArrowLeft'&&i>0){e.preventDefault();det(cur[i-1].id)}if(e.key==='ArrowRight'&&i>=0&&i<cur.length-1){e.preventDefault();det(cur[i+1].id)}};
 (d.querySelector('#xNext:not([disabled])')||$('#xX')).focus()}
$('#dl').addEventListener('close',()=>{const d=$('#dl');d.onkeydown=null;if(d._ret&&d._ret.isConnected)d._ret.focus();else{const b=root.querySelector('[data-open="'+(d._id||'')+'"]');b&&b.focus()}d._ret=null});
const fld=(id,lab,extra='')=>`<div class="f"><label for="n_${id}">${lab}</label><input id="n_${id}" ${extra}></div>`;
function form(){const d=$('#dl');d.innerHTML=`<div class="dh"><h2 class="d d-sub" id="dlT">Adicionar conta</h2><button type="button" class="x" id="xX" aria-label="Fechar">×</button></div><form id="nf" novalidate><div class="det fm"><div class="f"><label for="n_tipo">Tipo</label><select id="n_tipo"><option value="publica">Pública</option><option value="privada">Privada</option></select></div>${fld('empresa','Empresa detentora *','required')}${fld('cnpj','CNPJ')}${fld('cliente','Cliente / órgão *','required')}${fld('servico','Serviço *','required list="n_sl"')}<datalist id="n_sl">${[...new Set(rows.map(r=>r.servico))].map(s=>`<option value="${esc(s)}">`).join('')}</datalist>${fld('valor','Valor (R$)','type="number" min="0" inputmode="numeric"')}${fld('inicio','Início','type="date"')}${fld('fim','Fim','type="date"')}<div class="f"><label for="n_conf">Confiança</label><select id="n_conf"><option>oficial</option><option>divulgado pela empresa</option><option>imprensa</option><option>estimado</option></select></div>${fld('fonte','Fonte *','required')}${fld('url','Link da fonte','type="url"')}</div><p class="erro" id="n_err" role="alert"></p><div class="dacts fim"><button type="button" class="ghost" id="n_x">Cancelar</button><button type="submit">Salvar conta</button></div></form>`;
 d._ret=document.activeElement;d.showModal();$('#n_empresa').focus();$('#xX').onclick=$('#n_x').onclick=()=>d.close();
 $('#nf').onsubmit=e=>{e.preventDefault();const g=i=>$('#n_'+i).value.trim();const falta=['empresa','cliente','servico','fonte'].filter(k=>!g(k));root.querySelectorAll('#nf [aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));if(falta.length){falta.forEach(k=>$('#n_'+k).setAttribute('aria-invalid','true'));$('#n_err').textContent='Preencha: '+falta.map(k=>({empresa:'empresa',cliente:'cliente',servico:'serviço',fonte:'fonte'}[k])).join(', ')+'.';$('#n_'+falta[0]).focus();return}
  save([{tipo:g('tipo'),empresa:g('empresa'),cnpj:g('cnpj'),cliente:g('cliente'),servico:g('servico'),valor:g('valor')?+g('valor'):null,inicio:g('inicio'),fim:g('fim'),confianca:g('conf'),fonte:g('fonte'),url:g('url')}]).then(()=>d.close())}}
function imp(){const d=$('#dl');d.innerHTML=`<div class="dh"><h2 class="d d-sub" id="dlT">Importar dados</h2><button type="button" class="x" id="xX" aria-label="Fechar">×</button></div><p class="note" id="i_h">Cole JSON (lista de objetos) ou CSV com cabeçalho. Colunas: tipo (publica/privada), empresa, cnpj, cliente, servico, valor, inicio, fim (AAAA-MM-DD), confianca, fonte, url, obs. Linhas sem empresa, cliente, serviço ou fonte são recusadas.</p><label class="lab" for="i_t">Dados</label><textarea id="i_t" aria-describedby="i_h"></textarea><p class="erro" id="i_err" role="status"></p><div class="dacts fim"><button type="button" class="ghost" id="i_x">Cancelar</button><button type="button" id="i_ok">Importar</button></div>`;
 d._ret=document.activeElement;d.showModal();$('#i_t').focus();$('#xX').onclick=$('#i_x').onclick=()=>d.close();$('#i_ok').onclick=async()=>{const t=$('#i_t').value.trim();if(!t){$('#i_err').textContent='Cole os dados primeiro.';return}let a;try{a=t[0]==='['||t[0]==='{'?[].concat(JSON.parse(t)):csv(t)}catch(e){$('#i_err').textContent='Não consegui ler o texto.';return}
 const ok=a.filter(r=>r.empresa&&r.cliente&&r.servico&&r.fonte).map(r=>({...r,tipo:r.tipo==='privada'?'privada':'publica',valor:r.valor===''||r.valor==null?null:+r.valor}));await save(ok);$('#i_err').textContent=`${ok.length} importadas, ${a.length-ok.length} recusadas.`;if(ok.length)setTimeout(()=>d.close(),900)}}
function csv(t){const L=t.split(/\r?\n/).filter(Boolean),sep=L[0].includes(';')?';':',',h=L[0].split(sep).map(x=>x.trim());return L.slice(1).map(l=>{const c=l.split(sep);return Object.fromEntries(h.map((k,i)=>[k,(c[i]||'').trim()]))})}
async function save(list){for(const r of list){const id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);if(col)await col.doc(id).set(r).catch(()=>{});else{man.push({id,...r});setRows()}}}
const deb=(fn)=>{clearTimeout(timer);timer=setTimeout(fn,180)};
const reset=()=>{F={...F0};lim=50;syncInputs();render()};
$('#sTipo').onclick=e=>{const b=e.target.closest('button');if(!b)return;F.tipo=b.dataset.v;lim=50;syncInputs();render()};
$('#fQ').oninput=e=>{F.q=e.target.value;lim=50;deb(render)};$('#fC').oninput=e=>{F.c=e.target.value;lim=50;deb(render)};
$('#fS').onchange=e=>{F.s=e.target.value;lim=50;render()};$('#fV').onchange=e=>{F.v=e.target.value;lim=50;render()};
$('#fM').oninput=e=>{const n=+String(e.target.value).replace(/\D/g,'');F.m=n||0;lim=50;deb(render)};$('#fM').onblur=e=>{e.target.value=F.m?int(F.m):''};
$('#bAdd').onclick=form;$('#bImp').onclick=imp;$('#bCsv').onclick=baixar;
$('#chips').onclick=e=>{if(e.target.closest('#bClr'))return reset();const c=e.target.closest('[data-x]');if(!c)return;const k=c.dataset.x;F[k]=k==='m'?0:'';lim=50;syncInputs();render();const nx=$('#chips [data-x]')||$('#fQ');nx.focus()};
root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#dl').open&&e.target.matches('#fQ,#fC')&&e.target.value){e.target.value='';F[e.target.id==='fQ'?'q':'c']='';render()}});
const onKey=e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!$('#dl').open&&!(e.target&&e.target.matches&&e.target.matches('input,textarea,select,[contenteditable]'))&&root.isConnected&&root.offsetParent!==null){e.preventDefault();$('#fQ').focus()}};document.addEventListener('keydown',onKey);
$('#out').onclick=e=>{const r=e.target.closest('.row');if(r){const key=r.dataset.f,k=r.dataset.k,m=FK[key];F[m]=ativo(key,k)?'':k;lim=50;syncInputs();render();const again=root.querySelector(`.row[data-f="${key}"][data-k="${CSS.escape(k)}"]`);again&&again.focus();return}
 const tb=e.target.closest('.tb');if(tb){F.mes=F.mes===tb.dataset.mes?'':tb.dataset.mes;lim=50;render();const again=root.querySelector(`.tb[data-mes="${tb.dataset.mes}"]`);again&&again.focus();return}
 const mm=e.target.closest('[data-m]');if(mm){metric=mm.dataset.m;render();root.querySelector(`[data-m="${metric}"]`).focus();return}
 const ms=e.target.closest('[data-mais]');if(ms){open[ms.dataset.mais]=!open[ms.dataset.mais];render();root.querySelector(`[data-mais="${ms.dataset.mais}"]`)?.focus();return}
 if(e.target.closest('[data-v90]')){F.v='90';lim=50;syncInputs();render();return}
 if(e.target.closest('#bClr2'))return reset();
 if(e.target.id==='bMais'){const n=lim;lim+=50;render();const tr=root.querySelectorAll('tbody tr')[n];tr&&tr.querySelector('.nm').focus();return}
 const th=e.target.closest('[data-s]');if(th){const k=th.dataset.s;sort=sort.k===k?{k,d:-sort.d}:{k,d:k==='valor'?-1:1};lim=50;render();root.querySelector(`[data-s="${k}"]`).focus();return}
 const op=e.target.closest('[data-open]');if(op){$('#dl')._id=op.dataset.open;det(op.dataset.open,op);return}
 const tr=e.target.closest('tbody tr');if(tr&&!e.target.closest('a,button')){$('#dl')._id=tr.dataset.id;det(tr.dataset.id,tr.querySelector('.nm'))}};
syncInputs();render();
function setRows(){rows=base.concat(man).map(r=>({...r,_q:(r.empresa+' '+nm(r.empresa)+' '+(r.cnpj||'')).toLowerCase(),_c:(r.cliente+' '+nm(r.cliente)).toLowerCase()}));render()}
const FR={eventos:'Eventos',audiovisual:'Audiovisual',grafica:'Gráfica',publicidade:'Publicidade',cenografia:'Cenografia',conteudo:'Conteúdo',transmissao:'Transmissão',design:'Design',fotografia:'Fotografia',audio:'Áudio',ooh:'OOH',comvisual:'Comunicação visual'};
async function jget(u){const r=await fetch(u);if(!r.ok)throw Error('HTTP '+r.status);const a=new Uint8Array(await r.arrayBuffer());if(a[0]===31&&a[1]===139){return JSON.parse(await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream('gzip'))).text())}return JSON.parse(new TextDecoder().decode(a))}
(async()=>{let msg=[];
 try{const v=await lerArquivo('vencedores.bin.wasm','vencedores.json');base=base.concat(v.contratos.map(c=>({id:'p'+c.id,base:1,tipo:'publica',empresa:c.fornecedor,cnpj:c.cnpj,cliente:c.orgao+(c.uf?' ('+c.uf+')':''),servico:FR[c.frente]||c.frente,valor:c.valor,inicio:c.inicio,fim:c.fim,confianca:'oficial (PNCP)',fonte:'PNCP · '+c.id,url:c.link,obs:c.objeto})));
  msg.push('Públicas: '+int(v.contratos.length)+' contratos do PNCP ('+dt(v.meta.periodo[0])+' a '+dt(v.meta.periodo[1])+').')}catch(e){msg.push('Não consegui abrir os contratos públicos ('+e.message+').')}
 try{const m=await jget('mercado.json');base=base.concat(m.movimentos.map((x,i)=>({id:'m'+i,base:1,tipo:'privada',empresa:x.agencia,cliente:x.anunciante,servico:'Conta de publicidade ('+x.tipo+')',valor:null,inicio:x.data,fim:null,confianca:'imprensa',fonte:'Imprensa especializada',url:x.fonte,obs:(x.escopo||'')+(x.anterior?' Antes: '+x.anterior:'')})));
  msg.push('Privadas: '+int(m.movimentos.length)+' movimentos de conta da imprensa, quase todos sem valor divulgado.')}catch(e){msg.push('Não consegui abrir as contas privadas ('+e.message+').')}
 const el=$('#info');if(el)el.textContent=msg.join(' ');setRows()})();
(async()=>{try{const db=await banco();if(!db){mode='local';setRows();return}mode='db';col=db.collection('contas');colA=db.collection('alvos');offA=colA.onSnapshot(s=>{alvos=s.docs.map(d=>({id:d.id,...d.data()}))},()=>{});const t=setTimeout(()=>{mode='local';setRows()},10000);off=col.onSnapshot(s=>{clearTimeout(t);man=s.docs.map(d=>({id:d.id,...d.data()}));mode='db';setRows()},()=>{mode='local';setRows()})}catch(e){mode='local';setRows()}})();
return()=>{document.removeEventListener('keydown',onKey);clearTimeout(timer);try{offA&&offA()}catch(e){}try{typeof off==='function'&&off()}catch(e){}}}
