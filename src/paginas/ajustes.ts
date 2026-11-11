// Ajustes e dados: tema, estado do banco compartilhado, contagens, exportação de tudo, remoção de exemplos, IA e regras da casa.
import { int } from '../lib/formato';
import { banco, type Banco } from '../lib/db';
import { iaDisponivel } from '../lib/ia';
import { SERVICOS } from '../lib/servicos';
import { seletor } from './dom';
import { confirmarNoBotao } from '../componentes';

/** Coleções contadas na tela. */
export const CONTADAS: [string, string][] = [
  ['projetos', 'Projetos'], ['alvos', 'Alvos de captação'], ['pipeline', 'Oportunidades no funil'], ['b2g', 'Licitações no radar'],
  ['casos', 'Casos'], ['noticias', 'Notícias'], ['movimentos', 'Trocas de conta (rotina)'], ['contratos_novos', 'Contratos novos (rotina)'], ['notificacoes', 'Avisos'],
];
/** Coleções onde podem existir registros marcados como exemplo. */
export const COM_EXEMPLOS = ['projetos', 'b2g', 'ofertas', 'frentes', 'linhas', 'habilitacao'];
/** Tudo o que a exportação leva. */
export const EXPORTADAS = [...new Set([...CONTADAS.map(([c]) => c), ...COM_EXEMPLOS, 'pecas', 'fichas', 'biblioteca', 'swot', 'tows', 'config', 'cerebro', 'contas'])];
export type Tema = 'sistema' | 'dark' | 'light';
const TEMAS: [Tema, string][] = [['sistema', 'Seguir o sistema'], ['dark', 'Palco · escuro'], ['light', 'Papel · claro']];

export function aplicarTema(t: Tema) {
  const e = document.documentElement;
  if (t === 'sistema') e.removeAttribute('data-theme'); else e.setAttribute('data-theme', t);
  try { localStorage.setItem('studio-tema', t); } catch { /* sem armazenamento */ }
}
const temaAtual = (): Tema => { try { return (localStorage.getItem('studio-tema') as Tema) || 'sistema'; } catch { return 'sistema'; } };
interface Downloads { save(o: { filename: string; data: string }): Promise<{ status?: string } | void> }

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `<div class="wrap vc aj">
  <header class="page-head"><span class="eyebrow">Ajustes e dados</span><h1 class="d d-title">Studio</h1></header>
  <p class="sr" id="ajLive" aria-live="polite" aria-atomic="true"></p>
  <section aria-labelledby="aj-t"><div class="ph"><h2 class="d d-sub" id="aj-t">Tema</h2></div>
    <div class="acts" role="group" aria-label="Tema">${TEMAS.map(([v, t]) => `<button type="button" class="chip" data-tema="${v}" aria-pressed="false">${t}</button>`).join('')}</div></section>
  <section aria-labelledby="aj-d"><div class="ph"><h2 class="d d-sub" id="aj-d">Dados</h2><span class="tag w" id="ajModo">Conectando</span></div>
    <p class="measure" id="ajTxt"></p><div class="kpis aj-n" id="ajN"></div>
    <div class="acts"><button type="button" id="ajExp" disabled>Exportar todos os dados (.json)</button><button type="button" class="ghost" id="ajEx" hidden></button></div>
    <p class="note">O backup semanal leva uma cópia de tudo para o Google Drive toda segunda (veja em Rotinas do Claude).</p></section>
  <section aria-labelledby="aj-i"><div class="ph"><h2 class="d d-sub" id="aj-i">IA</h2><span class="tag w" id="ajIA">Verificando</span></div>
    <p class="measure">A leitura de editais, as análises go/no-go, as abordagens, as propostas, a SWOT e os diagnósticos consultam o Claude com a conta de quem está usando. Não há chave de API para configurar: a primeira consulta pede autorização.</p></section>
  <section aria-labelledby="aj-s"><div class="ph"><h2 class="d d-sub" id="aj-s">Sobre</h2></div><div class="measure aj-sobre">
    <p>O PRODUCERia Studio é a mesa interna do hub: Oficina (bancada, gráfica, plugins, agentes, biblioteca, casos), Comercial (central de notícias, agenda, captação, contas e agências, licitações, vencedores, mapa de contas, estratégia e funil) e Gestão (rotinas do Claude, tabela de serviços, ajustes).</p>
    <p>Preços: a planilha “Com Desconto” do Luciano (valores SINAPRO), ${int(SERVICOS.length)} serviços, com o desconto % de cada um editável em Gestão › Tabela de serviços. Licitações: PNCP, varrido toda madrugada pela rotina do Claude.</p>
    <p>Regras da casa: nada de dado inventado (o que é hipótese vem marcado); a automação só preenche campo vazio e nunca sobrescreve o que a equipe definiu; o Studio não envia e-mail, não compra mídia e não aprova gasto.</p></div></section>
</div>`;
  const $ = seletor(root);
  let db: Banco | null = null, modo: 'conectando' | 'db' | 'local' = 'conectando';
  const dados: Record<string, { id: string; [k: string]: unknown }[]> = {};
  const offs: (() => void)[] = [];
  const avisar = (t: string) => { $('#ajLive').textContent = t; };
  const exemplos = () => COM_EXEMPLOS.flatMap((c) => (dados[c] || []).filter((d) => d.exemplo).map((d) => ({ c, id: d.id })));

  function tema() { const t = temaAtual(); root.querySelectorAll<HTMLElement>('[data-tema]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tema === t))); }
  function render() {
    const m = $('#ajModo');
    m.textContent = modo === 'db' ? 'Compartilhados' : modo === 'local' ? 'Só nesta sessão' : 'Conectando';
    m.className = 'tag ' + (modo === 'db' ? 'ok' : 'w');
    $('#ajTxt').textContent = modo === 'local'
      ? 'Esta visualização não tem acesso ao armazenamento compartilhado: o que você registrar some ao fechar. Abra o Studio no Claude para salvar.'
      : 'Tudo o que a equipe registra (alvos, oportunidades, propostas, casos, avisos) fica no armazenamento deste Studio e aparece em tempo real para quem tem acesso. Só o tema e as escolhas de tela ficam no seu navegador.';
    $('#ajN').innerHTML = CONTADAS.map(([c, t]) => `<div class="k"><span class="kl">${t}</span><b>${dados[c] ? int(dados[c].length) : '—'}</b></div>`).join('');
    $<HTMLButtonElement>('#ajExp').disabled = modo !== 'db';
    const ex = exemplos(), b = $<HTMLButtonElement>('#ajEx');
    b.hidden = !ex.length;
    if (!b.hasAttribute('aria-live')) b.textContent = `Remover exemplos (${ex.length})`;
  }

  async function exportar() {
    const tudo = Object.fromEntries(EXPORTADAS.map((c) => [c, dados[c] || []]));
    try {
      const d = (await window.claude?.use('downloads')) as Downloads | undefined;
      if (!d) { avisar('Download disponível só com o Studio aberto no Claude.'); return; }
      const nome = `produceria-studio-${new Date().toISOString().slice(0, 10)}.json`;
      const r = await d.save({ filename: nome, data: JSON.stringify(tudo, null, 2) });
      if (r && r.status === 'saved') avisar('Arquivo salvo: ' + nome);
    } catch (e) { if ((e as { code?: string })?.code !== 'declined') avisar('Não foi possível gerar o arquivo agora.'); }
  }

  root.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || !root.contains(b)) return;
    if (b.dataset.tema) { aplicarTema(b.dataset.tema as Tema); tema(); avisar('Tema: ' + b.textContent + '.'); return; }
    if (b.id === 'ajExp') exportar();
  });
  const bEx = $<HTMLButtonElement>('#ajEx');
  confirmarNoBotao(bEx, 'Confirmar: remover exemplos', async () => {
    const ex = exemplos();
    if (!db || !ex.length) return;
    let n = 0;
    for (const e of ex) { try { await db.collection(e.c).doc(e.id).delete(); n++; } catch { /* segue */ } }
    avisar(`${n} registro(s) de exemplo removido(s).`);
  });

  tema(); render();
  iaDisponivel().then((ok) => { const t = $('#ajIA'); t.textContent = ok ? 'Disponível' : 'Indisponível'; t.className = 'tag ' + (ok ? 'ok' : 'erro'); });
  (async () => {
    db = await banco();
    modo = db ? 'db' : 'local'; render();
    if (!db) return;
    for (const c of EXPORTADAS) offs.push(db.collection<Record<string, unknown>>(c).onSnapshot((s) => { dados[c] = s.docs.map((d) => ({ ...d.data(), id: d.id })); render(); }, () => {}));
  })();
  return () => { offs.forEach((x) => { try { x(); } catch { /* já cancelado */ } }); };
}
