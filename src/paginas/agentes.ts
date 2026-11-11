// Agentes: conversas com o Claude que leem os dados reais do Studio (memória da casa, tabela, radar e funil)
// e podem registrar oportunidades no funil. Cada conversa fica salva em `conversas`.
import { esc, dt } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { conversar, iaDisponivel, aceitaImagens, CONTEXTO, ErroIA, type Ferramenta, type Mensagem } from '../lib/ia';
import { PERSONAS, FERRAMENTAS_IMAGEM, imagemParaIA } from '../oficina/personas';
import { quemSou } from '../lib/arquivos';
import { SERVICOS, rotulo } from '../lib/servicos';
import { EMPRESAS } from './licitacoes';
import { seletor, comId } from './dom';
import { navOficina, cabecalho } from './oficina';

export interface Agente { id: string; grupo: string; nome: string; foco: string; pede: string[]; guia?: string; imagem?: boolean }
const ESP = (id: string, nome: string, foco: string, grupo = 'Especialistas'): Agente => ({ id, nome, foco, grupo, pede: [] });
/** Agentes da casa. Tráfego e Produção executiva saíram com a produção (dependiam de projetos e tarefas). */
export const AGENTES: Agente[] = [
  { id: 'orcamentista', grupo: 'Operação', nome: 'Orçamentista SINAPRO', foco: 'Monta e revisa orçamentos pela tabela da Produceria, com o desconto da planilha, a etapa certa e as regras de adaptação.', pede: ['Quanto custa desdobrar um KV em 10 formatos digitais?', 'Orce 3 outdoors e 10 cartazes A2 para uma campanha regional'] },
  { id: 'revisor', grupo: 'Operação', nome: 'Revisor de texto e claims', foco: 'Revisão ortográfica e de padrão, glossário do cliente e afirmações que pedem comprovação.', pede: ['Revise este texto de post para cooperativa financeira'] },
  { id: 'comercial', grupo: 'Receita', nome: 'Diversificação e novos negócios', foco: 'Funil privado, público e internacional; concentração de receita; plays anticíclicos de reaproveitamento e fee mensal.', pede: ['Quais as 5 melhores oportunidades abertas agora?', 'Registre no funil o cadastro de fornecedor nas contas públicas de SP', 'Monte um plano anticíclico para o próximo trimestre'] },
  { id: 'b2g', grupo: 'Receita', nome: 'Licitações e B2G', foco: 'Radar do PNCP, carteira, habilitação do hub e estratégia de entrada em contas públicas via agências.', pede: ['Quais licitações de comunicação visual ou OOH vencem esta semana?', 'Qual empresa do hub disputa a melhor oportunidade do radar?'] },
  ...PERSONAS.map((p): Agente => ({ id: p.id, grupo: 'Craft e imagem', nome: p.nome, foco: p.foco, pede: p.pede, guia: p.guia, imagem: true })),
  ESP('producao', 'Assistente de Produção Executiva e Craft Audiovisual', 'Planejar produção, cronograma, equipe e fornecedores de filmes, motion e finalização; transformar briefing em plano executável.'),
  ESP('producao_grafica', 'Engenharia Gráfica & Comunicação Visual', 'Especificar materiais, acabamentos, arte-final e instalação de peças gráficas e de sinalização.'),
  ESP('operacoes_campo', 'Operações de Campo & Positivação', 'Logística de campo, instalação, positivação em PDV e checagem de execução.'),
  ESP('midia', 'Especialista em Mídia OOH/DOOH e AdTech', 'Planejar e comparar meios OOH/DOOH, formatos, praças e tecnologia de veiculação.'),
  ESP('midia_ooh', 'Planejamento OOH & Inteligência de Praças', 'Escolha de praças, pontos, alcance e cobertura para mídia exterior.'),
  ESP('midia_dooh', 'Especialista em Mídia OOH/DOOH e AdTech (DOOH)', 'DOOH programático, telas, conteúdo dinâmico e mensuração.'),
  ESP('financeiro', 'CFO e Controller Financeiro', 'Orçamento, margem, fluxo de caixa e premissas financeiras; nunca aprova despesas.'),
  ESP('juridico', 'Consultor Jurídico e Compliance', 'Contratos, direitos de imagem e uso, licitações e riscos; exige verificação da norma vigente.'),
  ESP('tecnologia', 'Arquiteto de Software e Creative Technologist', 'Soluções técnicas, IA aplicada, automação e arquitetura de produtos digitais.'),
  ESP('executivo', 'Conselheiro Estratégico Executivo', 'Decisões de negócio, priorização, posicionamento e diversificação de receita.'),
  ESP('social_head', 'Head de Estratégia, Marca e Operações Sociais', 'Transformar metas empresariais em um sistema editorial mensurável para Instagram e LinkedIn.', 'Social Intelligence'),
  ESP('social_linkedin', 'Estrategista de LinkedIn, Autoridade B2B e ABM', 'LinkedIn como canal de reputação e abertura de conversas comerciais qualificadas, sem spam.', 'Social Intelligence'),
  ESP('social_instagram', 'Estrategista de Instagram e Portfólio Visual', 'Instagram como vitrine de craft e capacidade produtiva, sem vender performance como viralização.', 'Social Intelligence'),
  ESP('social_criacao', 'Diretor de Criação para Social e Brand Craft', 'Direção conceitual e editorial; rigor estético e coerência de marca.', 'Social Intelligence'),
  ESP('social_copy', 'Copywriter Sênior B2B — PT e EN', 'Textos claros e autorais que traduzem o valor técnico, sem texto inflado nem claims sem prova.', 'Social Intelligence'),
  ESP('social_midia', 'Diretor de Mídia Paga e Performance B2B', 'Impulsionamento mensurável e financeiramente responsável em Meta e LinkedIn.', 'Social Intelligence'),
  ESP('social_bi', 'Analista de Dados, Social BI e Experimentação', 'Dados de social, mídia e CRM em decisões editoriais confiáveis, sem fabricar atribuições.', 'Social Intelligence'),
  ESP('social_comunidade', 'Gestor de Comunidade, Relacionamento e Parcerias B2B', 'Respostas, interações e encaminhamento de oportunidades, preservando reputação e confidencialidade.', 'Social Intelligence'),
  ESP('social_cases', 'Gestor Editorial de Cases, Ativos, Créditos e Direitos', 'Acervo de projetos aptos para comunicação, com autorizações, créditos e versionamento.', 'Social Intelligence'),
  ESP('social_conteudo', 'Produtor de Conteúdo Social, Vídeo e IA Aplicada', 'Roteiros de produção e pós escaláveis, distinguindo documentação real de conteúdo gerado por IA.', 'Social Intelligence'),
];
const ROTULOS: Record<string, string> = { memoria_da_casa: 'Consultando a memória da casa', buscar_tabela: 'Consultando a tabela', oportunidades: 'Lendo oportunidades', registrar_oportunidade: 'Registrando no funil', calcular_pixels: 'Calculando pixels', regras_do_kit: 'Lendo as regras do kit' };
const sem = (s: unknown) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export interface Conversa { id: string; agente: string; mensagens: Mensagem[]; acoes: string[]; em: string; autor?: string | null; titulo: string }
type Doc = Record<string, unknown> & { id: string };
export interface Dados { biblioteca: Doc[]; swot: Doc[]; tows: Doc[]; alvos: Doc[]; b2g: Doc[]; pipeline: Doc[]; descontos: Record<string, number> }

/** Ferramentas dos agentes sobre um retrato dos dados. `gravar` registra no funil; `log` anota a ação na conversa. */
export function ferramentas(d: Dados, gravar: (doc: Doc) => Promise<void>, log: (t: string) => void, hoje = new Date().toISOString().slice(0, 10)): Ferramenta[] {
  return [
    { name: 'memoria_da_casa', description: 'Memória da Produceria: arquivos da Biblioteca (guias de marca, specs, glossários, regras de texto, contratos), itens da SWOT e estratégias TOWS, e alvos da Captação. Filtre por termo (cliente, marca, agência, assunto) ou deixe vazio para o panorama.',
      inputSchema: { type: 'object', properties: { termo: { type: 'string' } } },
      execute: (a) => {
        const t = sem(a.termo), ok = (x: unknown) => !t || sem(JSON.stringify(x)).includes(t);
        return {
          biblioteca: d.biblioteca.filter(ok).slice(0, 25).map((x) => ({ nome: x.nome, categoria: x.categoria, cliente: x.cliente || null, nota: x.nota || null, url: x.url })),
          swot: d.swot.filter(ok).slice(0, 20).map((x) => ({ quadrante: x.q, texto: x.texto, evidencia: x.evidencia || x.fonte || null, certeza: x.certeza })),
          estrategias: d.tows.filter(ok).slice(0, 10).map((x) => ({ tipo: x.tipo, titulo: x.titulo, texto: x.texto || null, passo: x.passo || null })),
          alvos: d.alvos.filter(ok).slice(0, 15).map((x) => ({ nome: x.nome, perfil: x.perfil, status: x.status, porQueAgora: x.gatilho, proximoPasso: x.proximoPasso, fonte: x.fonte })),
          aviso: d.biblioteca.length ? undefined : 'A Biblioteca ainda está vazia: diga isso se o pedido depender de guia de marca ou regra do cliente.',
        };
      } },
    { name: 'buscar_tabela', description: 'Busca serviços na tabela de preços da Produceria (709 itens). Devolve id, categoria, serviço, etapa, valor de referência, desconto da planilha e valor com desconto.',
      inputSchema: { type: 'object', properties: { termo: { type: 'string' }, etapa: { type: 'string', enum: ['CRIAÇÃO', 'FINALIZAÇÃO', 'ADAPTAÇÃO', ''] } }, required: ['termo'] },
      execute: (a) => {
        const termos = sem(a.termo).split(/\s+/).filter(Boolean), etapa = String(a.etapa || '');
        return SERVICOS.filter((s) => (!etapa || s.etapa === etapa) && termos.every((x) => sem(`${s.id} ${s.cat} ${s.sub} ${s.esp} ${s.etapa} ${s.sinaproNome || ''}`).includes(x))).slice(0, 15)
          .map((s) => { const p = d.descontos[String(s.id)] || 0; return { id: s.id, cat: s.cat, servico: rotulo(s), etapa: s.etapa, referencia: s.ref, desconto: p, comDesconto: Math.round(s.ref * (1 - p / 100) * 100) / 100 }; });
      } },
    { name: 'oportunidades', description: 'Melhores oportunidades: licitações do radar (nota, prazo, órgão) e itens do funil (eixo, estágio, valor, próximo passo).',
      inputSchema: { type: 'object', properties: { tipo: { type: 'string', enum: ['b2g', 'funil', 'todas'] } } },
      execute: (a) => ({
        b2g: a.tipo === 'funil' ? [] : d.b2g.filter((o) => !o.descartada && (!o.prazo || String(o.prazo) >= hoje)).sort((x, y) => Number(y.score || 0) - Number(x.score || 0)).slice(0, 12)
          .map((o) => ({ nota: o.score, objeto: String(o.objeto || '').slice(0, 160), orgao: o.orgao, uf: o.uf, prazo: o.prazo, valor: o.valor, empresas: o.entidades, carteira: !!o.carteira, url: o.url })),
        funil: a.tipo === 'b2g' ? [] : d.pipeline.filter((o) => o.estagio !== 'Perdida').map((o) => ({ eixo: o.eixo, titulo: o.titulo, alvo: o.alvo, estagio: o.estagio, valor: o.valor, proximoPasso: o.proximoPasso })),
      }) },
    { name: 'registrar_oportunidade', description: 'Registra uma oportunidade no funil de diversificação (privado, público ou internacional).',
      inputSchema: { type: 'object', properties: { eixo: { type: 'string', enum: ['Privado', 'Público', 'Internacional'] }, titulo: { type: 'string' }, alvo: { type: 'string' }, valor: { type: 'number' }, proximo_passo: { type: 'string' }, fonte: { type: 'string' } }, required: ['eixo', 'titulo', 'proximo_passo'] },
      execute: async (a) => {
        const doc: Doc = { id: 'fn-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), eixo: ['Privado', 'Público', 'Internacional'].includes(String(a.eixo)) ? String(a.eixo) : 'Privado', titulo: String(a.titulo).slice(0, 140), alvo: String(a.alvo || ''), valor: Number(a.valor) || null, estagio: 'Identificada', proximoPasso: String(a.proximo_passo).slice(0, 200), fonte: String(a.fonte || ''), criadoEm: new Date().toISOString(), origem: 'Agente' };
        await gravar(doc); d.pipeline.push(doc);
        log(`Oportunidade “${doc.titulo}” registrada no funil (${doc.eixo}).`);
        return doc;
      } },
    ...FERRAMENTAS_IMAGEM,
  ];
}

export function instrucao(a: Agente, pedido: string, hoje = new Date().toISOString().slice(0, 10)): string {
  return `Você é o agente "${a.nome}" do PRODUCERia Studio. ${CONTEXTO}
Empresas do hub: ${EMPRESAS.map((e) => e.nome).join(', ')}.
Foco deste agente: ${a.foco}
${a.guia ? a.guia + '\n' : ''}${a.imagem ? 'Se houver imagem anexada, descreva em uma linha o que vê antes de opinar e baseie tudo no que está na imagem.\n' : ''}Hoje: ${hoje}.
- Use as ferramentas para ler dados reais antes de afirmar qualquer número. Se a ferramenta não trouxer, diga que não há dado.
- Memória da casa: antes de falar de cliente, marca, agência, proposta, regra de texto ou estratégia, chame memoria_da_casa (Biblioteca, SWOT e alvos da Captação) e use o que vier; cite o nome do arquivo ou do item.
- A ferramenta que grava (registrar_oportunidade) só quando o pedido pede ação; diga no fim exatamente o que gravou.
- Responda direto, com listas curtas quando ajudar.

PEDIDO
${pedido}`;
}

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('agentes')}<div class="wrap vc ag">
  ${cabecalho('Agentes', 'Agentes que trabalham', 'Cada agente lê os dados reais do Studio (Biblioteca, SWOT, alvos da Captação, tabela de serviços, radar de licitações e funil) e pode registrar oportunidades no funil. Tudo o que fazem fica listado na conversa.')}
  <div class="ag-grid"><aside class="ag-lado"><div class="f"><label for="agQ" class="sr">Buscar agente</label><input id="agQ" type="search" placeholder="Buscar entre ${AGENTES.length} agentes…"></div><div id="agL" class="ag-lista"></div><div id="agS"></div></aside>
  <section class="ag-chat" aria-labelledby="agN"><div class="lc-box ag-topo"><div class="ph"><h2 class="d d-sub" id="agN"></h2><button type="button" class="ghost sm" id="agNova" hidden>Nova conversa</button></div><span class="note" id="agF"></span></div>
    <div id="agM" class="ag-msgs" aria-live="polite"></div><div id="agA"></div>
    <form id="agForm" class="ag-form"><div class="ag-anexo" id="agX" hidden></div><label for="agT" class="sr">Mensagem para o agente</label><textarea id="agT" rows="3"></textarea><p class="erro" id="agE" role="alert"></p><div class="acts"><button type="submit" id="agEnv" disabled>Enviar</button><label class="lnk ag-clipe" id="agClipe" hidden><input type="file" id="agImg" accept="image/png,image/jpeg,image/webp" class="sr">Anexar imagem</label><button type="button" class="lnk" id="agPara" hidden>Parar</button></div></form></section></div></div>`;
  const $ = seletor(root);
  const d: Dados = { biblioteca: [], swot: [], tows: [], alvos: [], b2g: [], pipeline: [], descontos: {} };
  let db: Banco | null = null, conversas: Conversa[] = [], agente = AGENTES[0], busca = '', ia = true;
  let msgs: Mensagem[] = [], acoes: string[] = [], convId = '', ocupado = false, parcial = '', status = '', ctrl: AbortController | null = null;
  let anexo: { blob: Blob; nome: string; url: string } | null = null, imagensOk = false;
  const offs: (() => void)[] = [];

  function lista() {
    const q = busca.toLowerCase();
    $('#agL').innerHTML = [...new Set(AGENTES.map((a) => a.grupo))].map((g) => {
      const L = AGENTES.filter((a) => a.grupo === g && (!q || (a.nome + ' ' + a.foco).toLowerCase().includes(q)));
      return L.length ? `<div role="group" aria-label="${esc(g)}"><span class="lab">${esc(g)} · ${L.length}</span>${L.map((a) => `<button type="button" class="ag-btn" data-ag="${a.id}" aria-pressed="${a.id === agente.id}"><b>${esc(a.nome)}</b><span class="note">${esc(a.foco)}</span></button>`).join('')}</div>` : '';
    }).join('') || '<p class="note">Nenhum agente com essa busca.</p>';
  }
  function salvas() {
    const L = [...conversas].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 12);
    $('#agS').innerHTML = L.length ? `<span class="lab">Conversas salvas</span><ul class="ag-salvas">${L.map((c) => `<li><button type="button" class="lnk" data-conv="${esc(c.id)}">${esc(AGENTES.find((a) => a.id === c.agente)?.nome || 'Agente')}: ${esc(c.titulo)}<span class="note">${dt(c.em)}${c.acoes?.length ? ` · ${c.acoes.length} ação(ões)` : ''}</span></button></li>`).join('')}</ul>` : '';
  }
  function chat() {
    $('#agN').textContent = agente.nome; $('#agF').textContent = agente.foco;
    $('#agNova').hidden = !msgs.length;
    $<HTMLTextAreaElement>('#agT').placeholder = `Peça ao agente ${agente.nome}… (Ctrl+Enter envia)`;
    const sugest = agente.pede.length ? agente.pede : ['O que você precisa saber para me ajudar?'];
    $('#agM').innerHTML = (!msgs.length && !ocupado ? `<div class="ag-sug"><span class="note">${ia ? 'Comece por um destes pedidos ou escreva o seu:' : 'Os agentes precisam do Studio aberto no Claude.'}</span><div class="acts">${sugest.map((s) => `<button type="button" class="chip" data-sug="${esc(s)}" ${ia ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>` : '')
      + msgs.map((m) => m.role === 'user' ? `<div class="ag-eu lc-box"><div class="lc-pre">${esc(m.content)}</div></div>` : `<div class="ag-ele"><span class="lab">${esc(agente.nome)}</span><div class="lc-pre">${esc(m.content)}</div></div>`).join('')
      + (ocupado ? `<div class="ag-ele"><span class="lab">${esc(agente.nome)}</span><div class="lc-pre" id="agP">${esc(parcial || (status ? status + '…' : 'Pensando…'))}</div></div>` : '');
    $('#agA').innerHTML = acoes.length ? `<div class="lc-box"><span class="lab">Ações feitas nesta conversa</span><ul class="rv-mud">${acoes.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '';
    $<HTMLButtonElement>('#agEnv').textContent = ocupado ? 'Trabalhando…' : 'Enviar';
    $<HTMLButtonElement>('#agEnv').disabled = ocupado || !ia || !$<HTMLTextAreaElement>('#agT').value.trim();
    $('#agPara').hidden = !ocupado;
    $('#agClipe').hidden = !agente.imagem || !imagensOk;
    $('#agX').hidden = !anexo || !agente.imagem;
    $('#agX').innerHTML = anexo ? `<img src="${anexo.url}" alt=""><span class="note">${esc(anexo.nome)} vai junto de cada mensagem</span><button type="button" class="lnk" id="agXt">tirar</button>` : '';
    $('#agM').lastElementChild?.scrollIntoView({ block: 'nearest' });
  }
  const tirarAnexo = () => { if (anexo) URL.revokeObjectURL(anexo.url); anexo = null; };
  const novaConversa = () => { ctrl?.abort(); msgs = []; acoes = []; convId = ''; parcial = ''; tirarAnexo(); chat(); };

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || ocupado) return;
    $('#agE').textContent = '';
    const hist: Mensagem[] = [...msgs, { role: 'user', content: anexo && agente.imagem && !msgs.length ? `${t}\n(imagem anexada: ${anexo.nome})` : t }];
    msgs = hist; ocupado = true; parcial = ''; status = '';
    $<HTMLTextAreaElement>('#agT').value = '';
    chat();
    const novas: string[] = [];
    const gravar = async (doc: Doc) => { if (!db) throw new Error('Sem o banco do Studio: nada foi gravado.'); await db.collection('pipeline').doc(doc.id).set(doc); };
    const fs = ferramentas(d, gravar, (x) => { novas.push(x); acoes = [...acoes, x]; chat(); }).map((f) => ({ ...f, execute: async (a: Record<string, unknown>) => { status = ROTULOS[f.name] || 'Trabalhando'; const p = root.querySelector('#agP'); if (p && !parcial) p.textContent = status + '…'; return f.execute(a); } }));
    const envio: Mensagem[] = [{ role: 'user', content: instrucao(agente, hist[0].content) }, ...hist.slice(1)];
    ctrl = new AbortController();
    try {
      const r = await conversar(envio, { ferramentas: fs, signal: ctrl.signal, imagens: anexo && agente.imagem ? [anexo.blob] : undefined, aoEscrever: (x) => { parcial = x; const p = root.querySelector('#agP'); if (p) p.textContent = x; } });
      msgs = [...hist, { role: 'assistant', content: r }];
      if (db) {
        const id = convId || 'cv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const c: Conversa = { id, agente: agente.id, mensagens: msgs.slice(-30), acoes, em: new Date().toISOString(), autor: await quemSou(), titulo: hist[0].content.slice(0, 80) };
        await db.collection('conversas').doc(id).set(c).catch(() => {});
        convId = id;
      }
    } catch (e) {
      const x = e as ErroIA & { parcial?: string; cancelada?: boolean };
      if (!x.cancelada) $('#agE').textContent = e instanceof ErroIA ? e.message : 'A conversa falhou. Tente de novo.';
      if (x.parcial) msgs = [...hist, { role: 'assistant', content: x.parcial }];
    } finally { ocupado = false; parcial = ''; status = ''; ctrl = null; chat(); }
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    const k = b.dataset;
    if (k.ag) { if (k.ag !== agente.id) { agente = AGENTES.find((a) => a.id === k.ag)!; novaConversa(); lista(); root.querySelector<HTMLElement>(`[data-ag="${k.ag}"]`)?.focus(); } return; }
    if (k.sug) { enviar(k.sug); return; }
    if (k.conv) { const c = conversas.find((x) => x.id === k.conv); if (c) { agente = AGENTES.find((a) => a.id === c.agente) || agente; msgs = c.mensagens || []; acoes = c.acoes || []; convId = c.id; lista(); chat(); $<HTMLElement>('#agT').focus(); } return; }
    if (b.id === 'agXt') { tirarAnexo(); chat(); return; }
    if (b.id === 'agNova') { novaConversa(); $<HTMLElement>('#agT').focus(); return; }
    if (b.id === 'agPara') ctrl?.abort();
  });
  root.addEventListener('submit', (ev) => { if ((ev.target as HTMLElement).id === 'agForm') { ev.preventDefault(); enviar($<HTMLTextAreaElement>('#agT').value); } });
  root.addEventListener('keydown', (ev) => { const t = ev.target as HTMLElement; if (t.id === 'agT' && ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); enviar((t as HTMLTextAreaElement).value); } });
  root.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'agImg') {
      const f = t.files?.[0]; t.value = '';
      if (f) imagemParaIA(f).then((blob) => { tirarAnexo(); anexo = { blob, nome: f.name, url: URL.createObjectURL(blob) }; chat(); }).catch(() => { $('#agE').textContent = 'Não consegui abrir essa imagem.'; });
    }
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'agQ') { busca = t.value; lista(); }
    else if (t.id === 'agT') $<HTMLButtonElement>('#agEnv').disabled = ocupado || !ia || !t.value.trim();
  });

  lista(); chat();
  iaDisponivel().then((ok) => { ia = ok; chat(); });
  aceitaImagens().then((ok) => { imagensOk = ok; chat(); });
  (async () => {
    db = await banco();
    if (!db) return;
    for (const c of ['biblioteca', 'swot', 'tows', 'alvos', 'b2g', 'pipeline'] as const) offs.push(db.collection<Doc>(c).onSnapshot((s) => { d[c] = s.docs.map(comId); }, () => {}));
    offs.push(db.collection<{ valores?: Record<string, number> }>('config').onSnapshot((s) => { d.descontos = s.docs.find((x) => x.id === 'descontos')?.data().valores || {}; }, () => {}));
    offs.push(db.collection<Conversa>('conversas').onSnapshot((s) => { conversas = s.docs.map(comId); salvas(); }, () => {}));
  })();
  return () => { ctrl?.abort(); tirarAnexo(); offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
