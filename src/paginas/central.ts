// Central de notícias (lado privado): notícias de negócio e trocas de conta de marcas e agências.
// O lado público (licitações abertas, contratos vencidos e renovações) mora em Licitações e Vencedores.
import {esc,int,brk,dt} from '../lib/formato';
import {nomeLegivel,chave,slug,mesmaEmpresa} from '../lib/nomes';
import {hoje as hojeISO} from '../lib/datas';
import {calibrar,prioridade} from '../lib/prioridade';
import {banco,lerBase,type Banco,type Colecao,type Consulta} from '../lib/db';
import type {Alvo,Movimento,Noticia,Perfil} from '../lib/tipos';
import {seletor,elDe,mensagem,comId} from './dom';
import {ehPublico} from './alertas';
import {kpis,numero,barras,porMes,contar,painel, sugerir, irPara, filtrarFacetas, cliqueFaceta, type Facetas } from '../componentes';
const MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

type TipoItem='conta'|'negocio';
interface Lead { nome: string; perfil: Perfil|string; gatilho: string; fonte: string }
interface Item {
  k: string; tipo: TipoItem; cat: string; data: string; titulo: string; resumo: string; empresas: string[];
  fonte: string; url: string; lead: Lead|null; valor?: number|null; uf?: string; fim?: string; score?: number; prazo?: string|null;
}
interface EstadoCentral { id: string; estado: string; em?: string; chave?: string }
interface Fontes {
  noticias: (Noticia&{coletadoEm?:string})[]; movimentos: Movimento[]; alvos: Alvo[]; central: EstadoCentral[];
}
interface Filtros { t: TipoItem|''; q: string; p: string; e: string; o?: string }
interface Sugerido { nome: string; perfil: Perfil|string; n: number; v: number; ult: string; it: Item|null; pts?: number; motivo?: string }

export function montar(root: HTMLElement): () => void {
root.innerHTML=`<div class="wrap">
 <section class="kpis" id="cnK" aria-label="Resumo da central"></section>
 <section class="bar cnbar" aria-label="Filtros da central">
  <div class="f f-wide" role="group" aria-labelledby="cnLT"><span class="lab" id="cnLT">Mostrar</span><div class="pills" id="cnT"></div></div>
  <div class="f"><label for="cnQ">Buscar</label><input id="cnQ" type="search" placeholder="Agência, anunciante ou assunto" autocomplete="off"></div>
  <div class="f"><label for="cnP">Período</label><select id="cnP"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option><option value="0">Tudo o que temos</option></select></div>
  <div class="f"><label for="cnE">Situação</label><select id="cnE"><option value="">Novas e salvas</option><option value="salvo">Só salvas</option><option value="arquivado">Arquivadas</option></select></div>
  <div class="f"><label for="cnO">Organizar</label><select id="cnO"><option value="classe">Por classe, em ranking</option><option value="data">Por data, mais recentes</option></select></div>
 </section>
 <div id="cnPn"></div>
 <div class="chips" id="cnC"></div>
 <p class="sr" id="cnLive" aria-live="polite" aria-atomic="true"></p>
 <div class="cngrid"><div id="cnF" class="cnfeed" aria-label="Notícias e movimentações"></div><aside id="cnL" class="cnside" aria-label="Leads"></aside></div>
</div>`;
const $=seletor(root);
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const hoje=hojeISO();
const diaMs=864e5;const desde=(n: number)=>new Date(Date.now()-n*diaMs).toISOString().slice(0,10);
const TIPOS: [TipoItem|'',string][]=[['','Tudo'],['conta','Contas'],['negocio','Negócios']];
const TL: Record<TipoItem,string>={conta:'Conta',negocio:'Negócio'};
const CAT: Record<string,TipoItem>={conta:'conta',negocio:'negocio',inhouse:'negocio',mercado:'negocio',pessoas:'negocio'};
const S: Fontes={noticias:[],movimentos:[],alvos:[],central:[]};const fc: Facetas={};let estatico: Movimento[]=[],F: Filtros={t:'',q:'',p:'0',e:'',o:'classe'},lim=100,db: Banco|null=null,timer: ReturnType<typeof setTimeout>|undefined,mode: 'carregando'|'local'|'db'='carregando';
const col: {alvos?: Colecao<Alvo>; central?: Colecao<EstadoCentral>; [nome: string]: Colecao<unknown>|undefined}={},offs: (()=>void)[]=[],aberto: Record<string,boolean>={};
try{const sv=JSON.parse(localStorage.getItem('cn.v2')||'null');if(sv)F={...F,...sv}}catch(e){}
const persist=()=>{try{localStorage.setItem('cn.v2',JSON.stringify(F))}catch(e){}};
const perfilDe=(m: Movimento): Perfil=>/licita/i.test(m.tipo||'')?'publica':/house/i.test(m.tipo||'')?'inhouse':/wpp|omnicom|publicis|ipg|havas|dentsu|ogilvy|vml|bbdo|ddb|leo|mccann|africa|wunderman/i.test(m.agencia||'')?'rede':'independente';
function itens(): Item[]{const out: Item[]=[];const vistos=new Set<string>();
 for(const n of S.noticias){if(ehPublico({id:n.id,data:'',tipo:n.categoria==='licitacao'?'licitacao':'',titulo:n.titulo||'',empresas:n.empresas||[],acao:{perfil:n.lead?.perfil}}))continue;const k='nt:'+n.id;out.push({k,tipo:CAT[n.categoria||'']||'negocio',cat:n.categoria||'',data:String(n.data||n.coletadoEm||'').slice(0,10),titulo:n.titulo||'',resumo:n.resumo||'',empresas:(n.empresas||[]).filter(Boolean),fonte:n.veiculo||'Notícia',url:n.url||'',lead:n.lead&&n.lead.nome?{nome:n.lead.nome,perfil:n.lead.perfil||'independente',gatilho:n.lead.porque||n.titulo,fonte:n.url||''}:null})}
 for(const m of [...S.movimentos,...estatico]){const kk=chave(m.anunciante)+'|'+chave(m.agencia);if(vistos.has(kk))continue;vistos.add(kk);
  const perfil=perfilDe(m),inh=perfil==='inhouse';
  out.push({k:'mv:'+kk,tipo:'conta',cat:m.tipo||'',data:String(m.data||'').slice(0,10),titulo:`${m.anunciante} → ${m.agencia}`,resumo:(m.escopo||'')+(m.anterior?` · Antes: ${m.anterior}`:''),empresas:[m.agencia,m.anunciante].filter(Boolean),fonte:'Imprensa',url:m.fonte||'',
   lead:{nome:inh?m.anunciante:m.agencia,perfil,gatilho:`${inh?'Montou estrutura interna para':'Ganhou a conta de'} ${inh?m.agencia:m.anunciante} em ${dt(m.data)}${m.escopo?': '+String(m.escopo).slice(0,160):''}`,fonte:m.fonte||''}})}
 return out}
const est=(k: string)=>S.central.find(x=>x.id===cid(k));
const cid=(k: string)=>k.replace(/[^A-Za-z0-9_\-.~:@+]/g,'_').slice(0,190);
const alvoDe=(nome: string)=>chave(nome)?S.alvos.find(a=>a.id==='al-'+slug(nome)||mesmaEmpresa(a.nome,nome)):null;
/** Separa quem atende (agência, fornecedor do contrato) de quem compra (anunciante, órgão). Notícia: é agência se já apareceu como agência numa troca de conta ou é de rede. */
const REDE=/wpp|omnicom|publicis|ipg|havas|dentsu|ogilvy|vml|bbdo|ddb|leo burnett|mccann|africa|wunderman|ag[êe]ncia|comunica[çc][ãa]o|propaganda|publicidade/i;
function papeis(i: {tipo: string; empresas: string[]},ags: Set<string>): {ag: string[]; cl: string[]}{
 const [a,b]=i.empresas;
 if(i.tipo==='conta')return{ag:a?[a]:[],cl:b?[b]:[]};
 const ag=i.empresas.filter(n=>ags.has(chave(n))||REDE.test(n));return{ag,cl:i.empresas.filter(n=>!ag.includes(n))};
}
function filt(all: Item[]): Item[]{const q=chave(F.q),lim0=+F.p?desde(+F.p):'';return all.filter(i=>{const e=est(i.k)?.estado||'';if(F.e?e!==F.e:e==='arquivado')return false;if(F.t&&i.tipo!==F.t)return false;if(lim0&&i.data&&i.data<lim0)return false;if(q&&!chave(i.titulo+' '+i.resumo+' '+i.empresas.join(' ')+' '+i.cat).includes(q))return false;return true}).sort(F.o==='data'?((a,b)=>(b.data||'').localeCompare(a.data||'')):rank)}
/** Ranking dentro de cada classe: notícias e contas pela data. */
function rank(a: Item,b: Item){return (b.data||'').localeCompare(a.data||'')}
function sugeridos(all: Item[]): (Sugerido&{pts:number;motivo:string})[]{const m=new Map<string,Sugerido>(),d90=desde(90);for(const i of all){if(!i.lead||i.data<d90)continue;const k=chave(i.lead.nome);if(!k||alvoDe(i.lead.nome))continue;const o=m.get(k)||{nome:i.lead.nome,perfil:i.lead.perfil,n:0,v:0,ult:'',it:null};o.n++;o.v+=i.valor||0;if(i.data>o.ult){o.ult=i.data;o.it=i}m.set(k,o)}
 const cal=calibrar(S.alvos);return [...m.values()].map(o=>{const p=prioridade({perfil:o.perfil,sinais:o.n,valor:o.v,ultimo:o.ult>hoje?hoje:o.ult},cal);return {...o,pts:p.nota,motivo:p.motivo}}).sort((a,b)=>b.pts-a.pts).slice(0,8)}
const dia=(d: string)=>{if(!d)return 'Sem data';if(d>hoje){const x=new Date(d+'T12:00');return `Vence em ${x.getDate()} de ${MES[x.getMonth()]}`}if(d===hoje)return 'Hoje';if(d===desde(1))return 'Ontem';const x=new Date(d+'T12:00');return `${x.getDate()} de ${MES[x.getMonth()]}${d.slice(0,4)!==hoje.slice(0,4)?' de '+d.slice(0,4):''}`};
function card(i: Item): string{const a=i.lead?alvoDe(i.lead.nome):null,e=est(i.k)?.estado||'',ab=aberto[i.k];
 return `<article class="cn-it" data-k="${esc(i.k)}" aria-labelledby="t-${esc(cid(i.k))}">
 <div class="cn-meta"><span class="tag t-${i.tipo}">${TL[i.tipo]}</span>${i.cat&&i.cat!==i.tipo&&CAT[i.cat]!==i.cat?`<span class="note">${esc(i.cat)}</span>`:''}${i.valor?`<span class="cn-v">${brk(i.valor)}</span>`:''}${e==='salvo'?'<span class="tag w">salva</span>':''}</div>
 <h3 class="cn-t" id="t-${esc(cid(i.k))}">${esc(nomeLegivel(i.titulo))}</h3>
 ${i.resumo?`<p class="cn-r${ab?' ab':''}">${esc(i.resumo)}</p>${i.resumo.length>220?`<button type="button" class="lnk" data-x="mais" aria-expanded="${!!ab}">${ab?'Mostrar menos':'Ler tudo'}</button>`:''}`:''}
 ${i.empresas.length?`<div class="cn-emp">${i.empresas.slice(0,4).map(n=>`<button type="button" class="chip sm" data-q="${esc(nomeLegivel(n))}" aria-label="Filtrar por ${esc(nomeLegivel(n))}">${esc(nomeLegivel(n))}</button>`).join('')}</div>`:''}
 <div class="cn-acts">${i.lead?(a?`<a class="tag ok" href="#captacao" title="Abrir na Captação">Já é alvo · ${esc(a.status||'')}</a>`:`<button type="button" class="sm" data-x="lead" aria-label="Transformar ${esc(i.lead.nome)} em alvo da Captação">Virar alvo: ${esc(nomeLegivel(i.lead.nome))}</button>`):''}
 <button type="button" class="ghost sm" data-x="salvo" aria-pressed="${e==='salvo'}">${e==='salvo'?'Salva':'Salvar'}</button>
 <button type="button" class="ghost sm" data-x="arquivado">${e==='arquivado'?'Desarquivar':'Arquivar'}</button>
 ${i.url?`<a class="cn-f" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.fonte)} ↗<span class="sr"> (abre em nova aba)</span></a>`:`<span class="note">${esc(i.fonte)}</span>`}</div></article>`}
/** Itens de uma classe com os mesmos filtros de busca, período e situação (para as barras do painel). */
function filt0(all: Item[],t: TipoItem){const t0=F.t;F.t=t;const l=filt(all);F.t=t0;return l}
function render(){persist();
 $('#cnT').innerHTML=TIPOS.map(([v,t])=>`<button type="button" data-t="${v}" aria-pressed="${F.t===v}">${t}</button>`).join('');
 const cnQ=$<HTMLInputElement>('#cnQ');cnQ.value!==F.q&&document.activeElement!==cnQ&&(cnQ.value=F.q);$<HTMLSelectElement>('#cnP').value=F.p;$<HTMLSelectElement>('#cnE').value=F.e;
 const all=itens(),L0=filt(all),CM={mes:(i:{data:string})=>(i.data||'').slice(0,7)},L=filtrarFacetas(L0,fc,CM),d7=desde(7);
 const novos7=all.filter(i=>i.data>=d7&&i.data<=hoje&&est(i.k)?.estado!=='arquivado'),sug=sugeridos(all),ativos=S.alvos.filter(a=>a.status&&a.status!=='Cliente'),d90=desde(90),contas90=all.filter(i=>i.tipo==='conta'&&i.data>=d90&&i.data<=hoje);
 $('#cnK').innerHTML=kpis([
  {rotulo:'Novidades · 7 dias',kpi:'7d',ativo:F.p==='7'&&!F.t,acao:'Ver só os últimos 7 dias',valor:numero(int(novos7.length)),nota:(['conta','negocio'] as const).map(t=>int(novos7.filter(i=>i.tipo===t).length)+' '+{conta:'de conta',negocio:'de negócio'}[t]).join(' · ')},
  {rotulo:'Leads sugeridos',kpi:'leads',acao:'Ver os leads',valor:numero(int(sug.length)),nota:'sinais dos últimos 90 dias, fora da Captação'},
  {rotulo:'Alvos em andamento',href:'#captacao',acao:'Abrir a Captação',valor:numero(int(ativos.length)),nota:'na Captação, fora os clientes'},
  {rotulo:'Contas trocadas · 90 dias',kpi:'conta',ativo:F.t==='conta'&&F.p==='90',acao:'Ver as trocas de conta',valor:numero(int(contas90.length)),nota:'quem ganhou conta precisa de produção agora'}]);
 const ch: [string,string][]=[];if(fc.mes)ch.push(['fc:mes','Mês: '+MESES[+fc.mes.slice(5)-1]+'/'+fc.mes.slice(0,4)]);if(F.t)ch.push(['t',TL[F.t]]);if(F.q)ch.push(['q','Busca: '+F.q]);if(F.e)ch.push(['e',F.e==='salvo'?'Só salvas':'Arquivadas']);
 $('#cnC').innerHTML=`<span class="lab">${int(L.length)} ite${L.length===1?'m':'ns'}</span>`+ch.map(([k,t])=>`<button type="button" class="chip" data-r="${k}" aria-label="Remover filtro: ${esc(t)}">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')+(ch.length?'<button type="button" class="ghost sm" data-r="*">Limpar</button>':'');
 const ags=new Set(all.filter(i=>i.tipo==='conta').map(i=>chave(i.empresas[0]||'')));
 $('#cnPn').innerHTML=painel([
  barras('Por classe',TIPOS.slice(1).map(([v,t])=>({rotulo:t,valor:filt0(all,v as TipoItem).length,dado:v,ativo:F.t===v})),{attr:'t',nota:'clique para ver só a classe'}),
  porMes('Sinais por mês',filtrarFacetas(L0,fc,CM,'mes').map(i=>i.data).filter(d=>d<=hoje),12,fc.mes?'clique de novo no mês para tirar o filtro':'clique num mês para filtrar',{campo:'mes',ativo:fc.mes}),
  barras('Agências',contar(L,i=>papeis(i,ags).ag.map(nomeLegivel)),{attr:'q',nota:'quem atende a conta'}),
  barras('Anunciantes',contar(L,i=>papeis(i,ags).cl.map(nomeLegivel)),{attr:'q',nota:'quem compra: a marca'})],'Painel da central');
 $<HTMLSelectElement>('#cnO').value=F.o||'classe';
 let html='',ult=null;const V=L.slice(0,lim);
 if(F.o!=='data'&&!F.t&&all.length){const g=TIPOS.slice(1).map(([v,t])=>[v,t,L.filter(i=>i.tipo===v)] as const).filter(x=>x[2].length);
  $('#cnF').innerHTML=g.length?g.map(([v,t,l])=>`<section class="grupo"><div class="grupo-h"><h2>${t} <span class="note">${int(l.length)}</span></h2>${l.length>6?`<button type="button" class="lnk" data-t="${v}">ver as ${int(l.length)} em ranking →</button>`:''}</div><div class="cn-lista">${l.slice(0,6).map(card).join('')}</div></section>`).join(''):`<div class="empty"><h2 class="d d-sub">Nada por aqui</h2><p class="note">Nenhum item com esses filtros. Limpe a busca.</p></div>`;
 }else{
 for(const i of V){if(i.data!==ult){if(ult!==null)html+='</div></section>';ult=i.data;html+=`<section class="cn-dia" aria-label="${esc(dia(i.data))}"><h2 class="cn-dh">${esc(dia(i.data))}</h2><div class="cn-lista">`}html+=card(i)}
 if(V.length)html+='</div></section>';
 $('#cnF').innerHTML=mode==='carregando'&&!all.length?'<p class="note">Carregando a central…</p>':V.length?html+(L.length>lim?`<p class="mais"><button type="button" class="ghost" id="cnM">Mostrar mais ${int(Math.min(40,L.length-lim))} (${int(L.length-lim)} restantes)</button></p>`:''):`<div class="empty"><h2 class="d d-sub">Nada por aqui</h2><p class="note">${F.e==='arquivado'?'Nenhum item arquivado.':'Nenhuma notícia com esses filtros. Tente um período maior ou limpe a busca.'}</p>${S.noticias.length?'':'<p class="note">As notícias de mercado chegam pela rotina diária da central; contas e contratos já aparecem das bases do Studio.</p>'}</div>`;}
 $('#cnL').innerHTML=`<section class="p"><div class="ph"><h2 class="d d-sub">Leads sugeridos</h2></div><p class="note">Agências e marcas com sinais recentes (conta nova, notícia) que ainda não estão na Captação.</p>
 ${sug.length?`<ol class="cn-leads">${sug.map(o=>`<li><div><b>${esc(nomeLegivel(o.nome))} <span class="prio" title="${esc(o.motivo)}" aria-label="Prioridade ${o.pts} de 100: ${esc(o.motivo)}">${o.pts}</span></b><span class="note">${esc(o.perfil)} · ${o.n} sina${o.n>1?'is':'l'}${o.v?' · '+brk(o.v):''} · último ${dt(o.ult)}</span></div><button type="button" class="sm" data-lead="${esc(o.it!.k)}" aria-label="Transformar ${esc(nomeLegivel(o.nome))} em alvo">Virar alvo</button></li>`).join('')}</ol>`:'<p class="note vazio">Nenhum lead novo: todos os sinais recentes já estão na Captação.</p>'}</section>`;
 $('#cnLive').textContent=`${int(L.length)} itens na central.`}
async function virarAlvo(i: Item,btn?: HTMLButtonElement|null){const l=i.lead;if(!l)return;if(alvoDe(l.nome)){render();return}
 const id='al-'+slug(l.nome);const p=new Date(Date.now()+7*diaMs).toISOString().slice(0,10);
 const doc: Alvo={id,nome:nomeLegivel(l.nome),perfil:l.perfil||'independente',contato:'',gatilho:l.gatilho,fonte:l.fonte||i.url||'',status:'Mapeado',proximoPasso:'Pesquisar quem decide produção e fazer o primeiro contato',prazo:p,notas:'',origem:'Central de notícias',criadoEm:new Date().toISOString()};
 if(btn){btn.disabled=true;btn.textContent='Criando…'}
 if(!col.alvos){S.alvos=[...S.alvos,doc];render();$('#cnLive').textContent=`${doc.nome} entrou como alvo (só nesta sessão).`;return}
 try{await col.alvos.doc(id).set(doc);$('#cnLive').textContent=`${doc.nome} entrou como alvo na Captação, coluna Mapeado.`}catch(e){if(btn){btn.disabled=false;btn.textContent='Tentar de novo'}$('#cnLive').textContent='Não foi possível criar o alvo: '+mensagem(e);}}
async function marcar(k: string,estado: string){const id=cid(k),cur=est(k)?.estado||'',novo=cur===estado?'':estado;
 const loc=()=>{S.central=S.central.filter(x=>x.id!==id).concat(novo?[{id,estado:novo}]:[]);render()};
 if(!col.central)return loc();try{if(novo)await col.central.doc(id).set({estado:novo,em:new Date().toISOString(),chave:k});else await col.central.doc(id).delete()}catch(e){loc()}}
const achar=(k: string)=>itens().find(i=>i.k===k);
root.addEventListener('click',e=>{const el=elDe(e);
 if(el.closest('.pn [data-fc]')&&cliqueFaceta(el,fc)){lim=100;render();irPara($('#cnF'));return}
 const kk=el.closest<HTMLElement>('[data-kpi]');if(kk){const k=kk.dataset.kpi;if(k==='leads'){irPara($('#cnL'));return}
  if(k==='7d'){const on=F.p==='7'&&!F.t;F.p=on?'0':'7';F.t=''}else{const on=F.t==='conta'&&F.p==='90';F.t=on?'':'conta';F.p=on?'0':'90'}lim=100;render();irPara($('#cnF'));return}const t=el.closest<HTMLElement>('[data-t]');if(t){const v=t.dataset.t as TipoItem|'';F.t=t.closest('.pn')&&F.t===v?'':v;lim=100;render();root.querySelector<HTMLElement>(`[data-t="${F.t}"]`)!.focus();return}
 const r=el.closest<HTMLElement>('[data-r]');if(r){const k=r.dataset.r||'';if(k==='*'){F={...F,t:'',q:'',e:''};delete fc.mes}else if(k==='fc:mes')delete fc.mes;else F[k as keyof Filtros]='';$<HTMLInputElement>('#cnQ').value=F.q;lim=100;render();(root.querySelector<HTMLElement>('#cnC [data-r]')||$<HTMLElement>('#cnQ')).focus();return}
 const q=el.closest<HTMLElement>('[data-q]');if(q){const v=q.dataset.q||'';F.q=q.closest('.pn')&&F.q===v?'':v;$<HTMLInputElement>('#cnQ').value=F.q;lim=100;render();$('#cnQ').focus();return}
 if(el.id==='cnM'){const n=lim;lim+=40;render();const it=root.querySelectorAll('.cn-it')[n];it&&it.querySelector<HTMLElement>('button,a')?.focus();return}
 const ld=el.closest<HTMLButtonElement>('[data-lead]');if(ld){const i=achar(ld.dataset.lead!);i&&virarAlvo(i,ld);return}
 const x=el.closest<HTMLButtonElement>('[data-x]');if(!x)return;const art=x.closest<HTMLElement>('.cn-it'),k=art&&art.dataset.k;if(!k)return;
 if(x.dataset.x==='mais'){aberto[k]=!aberto[k];render();root.querySelector<HTMLElement>(`.cn-it[data-k="${CSS.escape(k)}"] [data-x="mais"]`)?.focus();return}
 if(x.dataset.x==='lead'){const i=achar(k);i&&virarAlvo(i,x);return}
 marcar(k,x.dataset.x!)});
$<HTMLInputElement>('#cnQ').oninput=e=>{F.q=(e.target as HTMLInputElement).value;lim=100;clearTimeout(timer);timer=setTimeout(render,200)};
$<HTMLSelectElement>('#cnO').onchange=e=>{F.o=(e.target as HTMLSelectElement).value;lim=100;render()};
$<HTMLSelectElement>('#cnP').onchange=e=>{F.p=(e.target as HTMLSelectElement).value;lim=100;render()};$<HTMLSelectElement>('#cnE').onchange=e=>{F.e=(e.target as HTMLSelectElement).value;lim=100;render()};
// a busca abre com tudo o que existe, por categoria: quem atende, quem compra, as classes e os assuntos
sugerir('cnQ',()=>{const all=itens(),ags=new Set(all.filter(i=>i.tipo==='conta').map(i=>chave(i.empresas[0]||'')));
 const conta=(f: (i: Item)=>string[])=>{const m=new Map<string,number>();for(const i of all)for(const n of f(i)){const x=nomeLegivel(n);if(x)m.set(x,(m.get(x)||0)+1)}return [...m].map(([texto,peso])=>({texto,sub:`${int(peso)} sina${peso>1?'is':'l'}`,peso}))};
 return [{nome:'Classes',itens:TIPOS.slice(1).map(([v,t])=>({texto:t,valor:v,sub:`${int(all.filter(i=>i.tipo===v).length)} itens`,peso:all.filter(i=>i.tipo===v).length}))},
  {nome:'Agências',itens:conta(i=>papeis(i,ags).ag)},{nome:'Anunciantes',itens:conta(i=>papeis(i,ags).cl)},
  {nome:'Assuntos',itens:conta(i=>i.cat&&CAT[i.cat]!==i.cat?[i.cat]:[])}]},
 {aoEscolher:(it,g,c)=>{if(g==='Classes'){F.t=(it.valor||'') as TipoItem;F.q='';c.value=''}else{F.q=it.texto;c.value=it.texto}lim=100;render();irPara($('#cnF'))}});
render();
lerBase<{movimentos?: Movimento[]}>('mercado').then((m)=>{if(m&&m.movimentos){estatico=m.movimentos;render()}}).catch(()=>{});
(async()=>{const b=db=await banco();if(!b){mode='local';render();return}mode='db';
 const sub=(nome: string,q: Consulta<unknown>|null,key: keyof Fontes)=>{const c=col[nome]=b.collection(nome);const t=setTimeout(()=>{mode='local';render()},10000);offs.push((q||c).onSnapshot(s=>{clearTimeout(t);(S as unknown as Record<string,unknown[]>)[key]=s.docs.map(comId);render()},()=>{clearTimeout(t)}))};
 sub('noticias',b.collection('noticias').orderBy('data','desc').limit(500),'noticias');
 sub('movimentos',null,'movimentos');
 sub('alvos',null,'alvos');sub('central',null,'central')})();
return()=>{clearTimeout(timer);for(const o of offs){try{typeof o==='function'&&o()}catch(e){}}}}
