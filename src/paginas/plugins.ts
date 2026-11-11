// Plugins e integrações: o Produceria Bridge (plugin UXP para Photoshop) e o que dá para ligar com Firefly e Magnific.
import manifesto from '../oficina/bridge/manifest.json?raw';
import indice from '../oficina/bridge/index.html?raw';
import principal from '../oficina/bridge/main.js?raw';
import leiame from '../oficina/bridge/LEIAME.md?raw';
import { esc } from '../lib/formato';
import { seletor } from './dom';
import { navOficina, cabecalho, baixarArquivo } from './oficina';

export const ARQUIVOS_BRIDGE: [string, string][] = [['manifest.json', manifesto], ['index.html', indice], ['main.js', principal], ['LEIAME.md', leiame]];
export const INTEGRACOES = [
  { nome: 'Produceria Bridge (Photoshop)', status: 'Pronto para teste', tag: 'ok', faz: 'Pré-checagem contra a ficha do job, base dos formatos do desdobramento, exportação de prova no padrão do Studio e upscale pelo Magnific.', exige: 'Photoshop 2023 (v24) ou mais novo e o UXP Developer Tool para instalar.' },
  { nome: 'Magnific (upscale)', status: 'Dentro do plugin', tag: 'ok', faz: 'Amplia 2x a 16x com IA, para retoque e grandes formatos. O resultado abre como documento novo no Photoshop.', exige: 'Conta e chave de API Magnific; cobrança por imagem conforme a área final.', fonte: 'https://docs.magnific.com/api-reference/image-upscaler-creative/image-upscaler' },
  { nome: 'Adobe Firefly Services', status: 'Depende de contrato Adobe', tag: 'w', faz: 'Expand Image e Fill (estender KV para formatos sem cortar), Remove Background, máscaras, Replace Smart Object em lote e renditions pela Photoshop API.', exige: 'Credencial corporativa (OAuth servidor-a-servidor) e créditos de operação. A chave não pode ficar no plugin: precisa de um servidor intermediário.', fonte: 'https://helpx.adobe.com/enterprise/kb/automation-operation-definition.html' },
  { nome: 'InDesign e Illustrator (Data Merge)', status: 'Próximo passo', tag: 'w', faz: 'Gerar variações de peças com texto e preço (varejo, cooperativas) a partir de uma planilha.', exige: 'Os mesmos créditos do Firefly Services, ou script local no InDesign.' },
];
const FLUXO = ['Studio: ficha + pacote do job', 'Photoshop: pré-checagem e formatos', 'Arte-finalista: acabamento manual', 'Photoshop: prova exportada', 'Studio: aprovação e rodadas'];

export function montar(root: HTMLElement): () => void {
  root.innerHTML = `${navOficina('plugins')}<div class="wrap vc pl">
  ${cabecalho('Oficina', 'Plugins e integrações', 'Ferramentas da casa dentro do Photoshop, e o que dá para ligar com Firefly e Magnific.')}
  <section class="lc-box pl-bridge" aria-labelledby="pl-b"><span class="lab">Plugin da casa</span><h2 class="d d-sub" id="pl-b">Produceria Bridge</h2>
    <p class="measure">Liga o Studio à mesa do arte-finalista. O Studio gera a ficha e o pacote do job (em Gráfica); o plugin confere o arquivo no Photoshop, monta a base de cada formato e exporta a prova com o nome certo.</p>
    <ol class="pl-passos"><li>Baixe os quatro arquivos e guarde numa pasta "Produceria Bridge".</li><li>Instale o UXP Developer Tool pela Creative Cloud.</li><li>No Photoshop: Configurações › Plugins › Ativar modo desenvolvedor.</li><li>No UXP Developer Tool: Add Plugin › manifest.json › Load.</li></ol>
    <div class="acts"><button type="button" id="plB">Baixar o plugin (4 arquivos)</button></div>
    <p class="note">Versão 0.1, escrita e conferida fora do Photoshop: teste primeiro numa cópia de arquivo. O UXP Developer Tool também empacota um .ccx para instalar na equipe sem modo desenvolvedor.</p>
    <p class="sr" id="plLive" aria-live="polite" aria-atomic="true"></p></section>
  <section aria-labelledby="pl-i"><div class="ph"><h2 class="d d-sub" id="pl-i">Integrações</h2><span class="note">o que existe, o que depende de contrato</span></div>
    <ul class="vc-l">${INTEGRACOES.map((x) => `<li class="pl-it"><span class="vc-c"><b>${esc(x.nome)}</b><span>${esc(x.faz)}</span><span class="note">Exige: ${esc(x.exige)}${x.fonte ? ` · <a class="cn-f" href="${esc(x.fonte)}" target="_blank" rel="noopener">documentação ↗<span class="sr"> (abre em nova aba)</span></a>` : ''}</span></span><span class="tag ${x.tag}">${esc(x.status)}</span></li>`).join('')}</ul></section>
  <section class="lc-box" aria-labelledby="pl-f"><span class="lab" id="pl-f">Como os dados circulam</span>
    <ol class="pl-fluxo">${FLUXO.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    <p class="note">A troca é por arquivo: o plugin não grava direto no banco do Studio. Isso evita guardar credenciais no Photoshop e mantém a decisão humana entre as etapas.</p></section></div>`;
  const $ = seletor(root);
  const b = $<HTMLButtonElement>('#plB');
  b.onclick = async () => {
    b.disabled = true;
    let ok = 0;
    for (const [nome, data] of ARQUIVOS_BRIDGE) { const m = await baixarArquivo(nome, data); if (m.startsWith('Arquivo salvo')) ok++; else if (m) { $('#plLive').textContent = m; break; } }
    if (ok) $('#plLive').textContent = `${ok} de ${ARQUIVOS_BRIDGE.length} arquivos salvos.`;
    b.disabled = false;
  };
  return () => {};
}
