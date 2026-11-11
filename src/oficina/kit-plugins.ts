/**
 * Plugins da casa para o Photoshop (UXP) e o After Effects: catálogo, pacotes para download, tutorial de instalação
 * e roteiro de teste. Os arquivos vêm de `plugins/` (testados em tests/plugins.test.ts) e do Bridge (src/oficina/bridge).
 * O .ccx é o próprio plugin compactado (manifest.json na raiz), o formato que o Creative Cloud instala com duplo clique.
 */
import { zipar, type EntradaZip } from './zip';
import bManifest from './bridge/manifest.json?raw';
import bIndex from './bridge/index.html?raw';
import bMain from './bridge/main.js?raw';
import bLeia from './bridge/LEIAME.md?raw';

const ARQ = import.meta.glob('../../plugins/{photoshop,after-effects}/**/*', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export interface Plugin {
  id: string; pasta: string; nome: string; painel: string; versao: string; minPs: string; faz: string; referencia: string;
  novo?: boolean; experimental?: string; arquivos: [string, string][];
}

const arquivosDe = (pasta: string): [string, string][] => Object.entries(ARQ)
  .filter(([k]) => k.includes(`/plugins/photoshop/${pasta}/`))
  .map(([k, v]): [string, string] => [k.split(`/plugins/photoshop/${pasta}/`)[1], v])
  .sort(([a], [b]) => a.localeCompare(b));

const INFO: Omit<Plugin, 'arquivos' | 'versao' | 'minPs' | 'nome' | 'painel'>[] = [
  { id: 'desdobra', pasta: 'produceria-desdobra', faz: 'Uma cópia do KV aberto para cada formato (stories, feed, banners), com cobrir ou conter, ponto de foco e o nome no padrão da casa. Pode salvar um PSD de cada.', referencia: 'Banner Resize, Smart Resize, Batch Forge (redimensionar o KV em todos os formatos)' },
  { id: 'retoque', pasta: 'produceria-retoque', faz: 'Estrutura de retoque não destrutiva (limpeza, dodge, burn, cor), antes e depois, nova versão do arquivo e separação de frequência.', referencia: 'Ultimate Retouch Panel, Retouch4me, AUREL Skin Studio (separação de frequência, dodge & burn)', experimental: 'Separação de frequência (botão 4) é nova na v1.1.' },
  { id: 'checar', pasta: 'produceria-checar-arquivo', faz: 'Lê o documento e lista problemas de arte-final: nome, modo de cor, perfil, resolução, textos, fontes ausentes, camadas ocultas e nomes padrão.', referencia: 'Painéis de preflight e checagem de marca (BrandGuard, 3M VAS)' },
  { id: 'exportador', pasta: 'produceria-exportador', faz: 'Exporta o documento aberto, ou todos os abertos, em PNG, JPG e PDF numa pasta, com nome padronizado e sem sobrescrever.', referencia: 'Direct Export, Export Visible, Web Sharp PRO (exportação em um clique)' },
  { id: 'textos', pasta: 'produceria-textos', faz: 'Exporta os textos das camadas para CSV, a revisão corrige no Excel e o painel reaplica só o que mudou, com trava de segurança.', referencia: 'Batch Replace PSD Text, Markup Automator (texto em lote)' },
  { id: 'guias', pasta: 'produceria-guias', faz: 'Guias de arte-final em milímetros: corte (sangria) e margem de segurança, centro, terços, área segura de stories e colunas.', referencia: 'Guides, Ratio Guides, CleanCut, SafeSnap, Better Grids', novo: true },
  { id: 'camadas', pasta: 'produceria-camadas', faz: 'Renomeia camadas em lote com numeração, localiza e substitui nos nomes, aplica os prefixos da casa (TXT_, IMG_, GRP_...) e mostra o que falta arrumar.', referencia: 'ReName Ninja, GD Renamer, Renamebow (organização de camadas)', novo: true },
  { id: 'prova', pasta: 'produceria-prova', faz: 'JPG de prova para aprovação: cópia reduzida com marca d’água e rodapé com cliente, campanha, versão e data. O arquivo aberto não muda.', referencia: 'Watermark 3, CropShare, StreamWork (prova e aprovação)', novo: true },
];

export const PLUGINS: Plugin[] = [
  ...INFO.map((i): Plugin => {
    const arquivos = arquivosDe(i.pasta);
    const m = JSON.parse(arquivos.find(([n]) => n === 'manifest.json')?.[1] || '{}');
    return { ...i, arquivos, versao: m.version, minPs: m.host?.minVersion, nome: m.name, painel: m.entrypoints?.[0]?.label?.default };
  }),
  { id: 'bridge', pasta: 'produceria-bridge', nome: 'Produceria Bridge', painel: 'Produceria Bridge', versao: JSON.parse(bManifest).version, minPs: JSON.parse(bManifest).host.minVersion,
    faz: 'Liga o Studio ao Photoshop: confere o arquivo contra a ficha do job (Gráfica), monta a base de cada formato, exporta a prova no padrão e amplia pelo Magnific.',
    referencia: 'Conectores de fluxo (CI HUB, Canto, MarkupBridge)', experimental: 'Versão 0.1. O upscale pede chave própria do Magnific.',
    arquivos: [['LEIAME.md', bLeia], ['index.html', bIndex], ['main.js', bMain], ['manifest.json', bManifest]] },
];

export const AFTER_EFFECTS: [string, string][] = Object.entries(ARQ)
  .filter(([k]) => k.includes('/plugins/after-effects/'))
  .map(([k, v]): [string, string] => [k.split('/plugins/after-effects/')[1], v]);

const VERSAO_KIT = '1.1';
export const NOME_PACOTE = `Produceria-Plugins-v${VERSAO_KIT}.zip`;

/** O .ccx: os arquivos do plugin na raiz (sem o LEIA-ME, que não faz parte do plugin). */
export const ccx = (p: Plugin): Uint8Array => zipar(p.arquivos.filter(([n]) => !/^LEIA-?ME\.md$/i.test(n)).map(([caminho, dados]) => ({ caminho, dados })));

/** Pacote de um plugin: o .ccx para instalar e a pasta para o UXP Developer Tool. */
export function pacotePlugin(p: Plugin): Uint8Array {
  return zipar([{ caminho: `${p.pasta}.ccx`, dados: ccx(p) }, ...p.arquivos.map(([n, d]) => ({ caminho: `${p.pasta}/${n}`, dados: d }))]);
}

/** Pacote completo: instaladores, código-fonte, After Effects, tutorial e roteiro de teste. */
export function pacoteCompleto(): Uint8Array {
  const e: EntradaZip[] = [
    { caminho: 'LEIA-ME-PRIMEIRO.txt', dados: leiaMePrimeiro() },
    { caminho: 'TUTORIAL.md', dados: tutorialMarkdown() },
    ...PLUGINS.map((p) => ({ caminho: `1-instaladores-ccx/${p.pasta}.ccx`, dados: ccx(p) })),
    ...PLUGINS.flatMap((p) => p.arquivos.map(([n, d]) => ({ caminho: `2-codigo-fonte-para-UXP-Developer-Tool/${p.pasta}/${n}`, dados: d }))),
    ...AFTER_EFFECTS.map(([n, d]) => ({ caminho: `3-after-effects/${n}`, dados: d })),
  ];
  return zipar(e);
}

function leiaMePrimeiro(): string {
  return `PLUGINS PRODUCERIA v${VERSAO_KIT}
${PLUGINS.length} painéis para o Photoshop e 1 script para o After Effects.

PASTAS
1-instaladores-ccx ................. um arquivo .ccx por plugin: duplo clique para instalar (Caminho A do tutorial)
2-codigo-fonte-para-UXP-Developer-Tool  as mesmas pastas abertas, para carregar pelo UXP Developer Tool (Caminho B)
3-after-effects .................... script de variações de template e o CSV de exemplo
TUTORIAL.md ........................ passo a passo completo de instalação, uso e teste (o mesmo da aba Instalar do Studio)

ANTES DE COMEÇAR
- Photoshop 2023 (versão 24.2) ou mais novo. Veja em Photoshop > Sobre o Photoshop.
- Teste sempre numa CÓPIA de arquivo, nunca no original de cliente.
- Nenhum destes painéis foi aberto ainda dentro do Photoshop: esta é a primeira rodada de testes.
  Anote cada resultado no Studio, em Oficina > Plugins > Roteiro de teste.
`;
}

// ---------------- Tutorial ----------------

export interface Etapa { titulo: string; passos: string[]; ver?: string; atencao?: string }
export interface Secao { id: string; titulo: string; intro?: string; etapas: Etapa[] }

const CMD_UPIA = '"/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent" --install ~/Downloads/Produceria-Plugins/1-instaladores-ccx/produceria-guias.ccx';

export const TUTORIAL: Secao[] = [
  { id: 'antes', titulo: '0. Antes de começar (5 minutos)', etapas: [
    { titulo: 'Confira a versão do Photoshop', passos: ['Abra o Photoshop.', 'No menu Photoshop (no topo da tela, ao lado da maçã), clique em "Sobre o Photoshop".', 'Anote o número da versão que aparece na janela (por exemplo 26.1). Feche a janela.'], ver: 'Versão 24.2 ou maior: todos os painéis funcionam. Entre 23.3 e 24.1: todos menos o Prova. Abaixo de 23.3: atualize pelo app Creative Cloud antes de seguir.' },
    { titulo: 'Separe os arquivos de teste', passos: ['Crie no Mac uma pasta "Teste plugins" na Mesa (Desktop).', 'Copie para ela dois ou três PSDs que NÃO sejam de cliente, ou peças antigas já entregues: um KV com camadas de texto, uma foto de pessoa e uma peça com várias camadas.', 'Trabalhe sempre nessas cópias.'], atencao: 'Os painéis foram escritos e testados fora do Photoshop. Esta é a primeira vez que vão rodar de verdade: não use arquivo de cliente em produção até o roteiro de teste passar.' },
  ] },
  { id: 'baixar', titulo: '1. Baixar os plugins (2 minutos)', etapas: [
    { titulo: 'Baixe o pacote completo', passos: ['Aqui no Studio, aba "Plugins", clique em "Baixar todos os plugins (.zip)".', 'O Claude mostra uma confirmação com o nome do arquivo (' + NOME_PACOTE + '). Clique em Salvar.', 'O arquivo vai para a pasta Downloads do Mac.'] },
    { titulo: 'Descompacte', passos: ['Abra o Finder e vá em Downloads.', 'Dê dois cliques em ' + NOME_PACOTE + '. O Mac cria uma pasta com o mesmo nome.', 'Renomeie essa pasta para "Produceria-Plugins" (clique uma vez no nome, Enter, digite e Enter de novo). Isso deixa os comandos do Caminho C iguais aos do tutorial.', 'Abra a pasta: dentro estão 1-instaladores-ccx, 2-codigo-fonte-para-UXP-Developer-Tool, 3-after-effects, TUTORIAL.md e LEIA-ME-PRIMEIRO.txt.'], ver: 'Na pasta 1-instaladores-ccx há ' + PLUGINS.length + ' arquivos terminados em .ccx, um por plugin.' },
  ] },
  { id: 'caminho-a', titulo: '2. Instalar: Caminho A, duplo clique no .ccx (o mais simples)', intro: 'É o jeito de instalar que fica para sempre, como um plugin da loja. Faça um plugin primeiro (sugestão: Guias, que é o mais simples) e, se der certo, repita para os outros.', etapas: [
    { titulo: 'Prepare', passos: ['Feche o Photoshop (menu Photoshop > Sair, ou Cmd + Q).', 'Abra o app Creative Cloud (ícone colorido na barra do Mac) e faça login, se pedir.'] },
    { titulo: 'Instale um plugin', passos: ['No Finder, abra Produceria-Plugins > 1-instaladores-ccx.', 'Dê dois cliques em produceria-guias.ccx.', 'O Creative Cloud abre uma janela perguntando se quer instalar o plugin e avisando que ele não foi verificado pela Adobe (porque é da casa, não da loja). Clique em Instalar (ou OK).', 'Espere a mensagem de que o plugin foi instalado.'], ver: 'A janela some e o Creative Cloud mostra "Instalado". Em alguns Macs a confirmação aparece só como notificação no canto da tela.', atencao: 'Se o duplo clique abrir outro programa (por exemplo o Arquivador), clique no .ccx com o botão direito > Abrir com > Creative Cloud. Se o Creative Cloud recusar o arquivo, siga o Caminho C (Terminal) ou o Caminho B (UXP Developer Tool).' },
    { titulo: 'Repita para os outros', passos: ['Faça o mesmo com cada .ccx da pasta: desdobra, retoque, checar-arquivo, exportador, textos, camadas, prova e bridge.'] },
    { titulo: 'Abra o Photoshop e encontre os painéis', passos: ['Abra o Photoshop.', 'No menu do topo, clique em "Plug-ins". Cada plugin aparece com o nome (por exemplo "Produceria Guias") e, dentro dele, o painel ("Guias e áreas seguras").', 'Clique no painel: ele abre flutuando. Arraste pela barra de título até a lateral direita, junto dos outros painéis, para deixá-lo encaixado.'], ver: 'O painel abre com os campos e botões descritos no roteiro de teste. Painel em branco: feche e abra de novo pelo menu Plug-ins; se continuar, anote no roteiro.' },
  ] },
  { id: 'caminho-c', titulo: '3. Instalar: Caminho C, pelo Terminal (se o duplo clique não funcionar)', intro: 'Usa o mesmo instalador do Creative Cloud, chamado direto. Funciona com o Photoshop fechado.', etapas: [
    { titulo: 'Rode o instalador', passos: ['Abra o Terminal (Cmd + Espaço, digite Terminal, Enter).', 'Copie o comando abaixo inteiro, cole no Terminal e aperte Enter. Ele instala o Guias; para os outros, troque só o final (produceria-guias.ccx) pelo nome de cada arquivo.', CMD_UPIA], ver: 'O Terminal responde com uma linha terminando em "Installation Successful" (ou parecida). Abra o Photoshop e procure em Plug-ins.', atencao: 'Se aparecer "No such file or directory", confira se a pasta se chama Produceria-Plugins e está em Downloads (passo 1).' },
  ] },
  { id: 'caminho-b', titulo: '4. Instalar: Caminho B, UXP Developer Tool (plano de desenvolvedor)', intro: 'Carrega o plugin direto da pasta, sem empacotar. É o caminho mais garantido, e o que se usa para corrigir e recarregar durante os testes. O plugin carregado assim some quando o Photoshop fecha: carregue de novo a cada sessão.', etapas: [
    { titulo: 'Instale o UXP Developer Tool', passos: ['Abra o app Creative Cloud > Todos os aplicativos.', 'Na busca, digite "UXP Developer Tools" e clique em Instalar.'] },
    { titulo: 'Ative o modo de desenvolvedor no Photoshop', passos: ['No Photoshop: menu Photoshop > Configurações (ou Preferências) > Plug-ins.', 'Marque "Ativar o modo de desenvolvedor" (Enable Developer Mode) e clique em OK.', 'Feche e abra o Photoshop.'], atencao: 'Na primeira vez, o UXP Developer Tool também pede para ativar o modo de desenvolvedor e a senha do Mac. É normal.' },
    { titulo: 'Adicione e carregue o plugin', passos: ['Com o Photoshop aberto, abra o UXP Developer Tool.', 'Clique em "Add Plugin" (canto superior direito).', 'Navegue até Produceria-Plugins > 2-codigo-fonte-para-UXP-Developer-Tool > produceria-guias e escolha o arquivo manifest.json.', 'O plugin entra na lista. Na linha dele, clique em "•••" (Actions) > "Load".', 'Volte ao Photoshop: o painel abre sozinho ou aparece no menu Plug-ins.'], ver: 'Na lista do UXP Developer Tool a linha do plugin mostra que está carregado. Se der erro, o botão "•••" > "Debug" abre o console com a mensagem: copie para o relatório.' },
    { titulo: 'Para recarregar depois de uma correção', passos: ['Baixe o pacote novo e substitua a pasta.', 'No UXP Developer Tool: "•••" > "Reload".'] },
  ] },
  { id: 'ae', titulo: '5. After Effects: script de variações de template', etapas: [
    { titulo: 'Rodar o script', passos: ['Abra o projeto com a composição-modelo e dê um clique nela no painel Projeto.', 'Dê às camadas de texto que mudam nomes iguais aos títulos das colunas do CSV (ex.: TXT_TITULO).', 'Menu Arquivo > Scripts > Executar arquivo de script...', 'Escolha Produceria-Plugins > 3-after-effects > produceria_variacoes_template.jsx.', 'Escolha o CSV (use exemplo_variacoes.csv para o primeiro teste).'], ver: 'Uma composição nova por linha do CSV, com os textos trocados. O script nunca apaga nada.' },
  ] },
  { id: 'remover', titulo: '6. Atualizar ou remover', etapas: [
    { titulo: 'Plugin instalado pelo .ccx (Caminho A ou C)', passos: ['Photoshop: menu Plug-ins > Gerenciar plug-ins (abre o Creative Cloud).', 'Na linha do plugin, "•••" > Desinstalar.', 'Para atualizar: desinstale e instale o .ccx novo.'] },
    { titulo: 'Plugin carregado pelo UXP Developer Tool (Caminho B)', passos: ['Na linha do plugin: "•••" > "Unload" para tirar do Photoshop, ou "Remove" para tirar da lista.'] },
  ] },
  { id: 'relatar', titulo: '7. Como anotar e relatar um problema', etapas: [
    { titulo: 'Para cada passo do roteiro', passos: ['Na aba "Roteiro de teste" do Studio, marque Passou ou Falhou em cada passo.', 'Se falhou: escreva na nota o que apareceu (copie a mensagem do painel, que fica abaixo dos botões) e o que esperava.', 'Tire um print (Cmd + Shift + 4 e arraste sobre a área) e guarde na pasta "Teste plugins".'] },
    { titulo: 'No fim da rodada', passos: ['Preencha a versão do Photoshop e do macOS no topo do roteiro.', 'Clique em "Baixar relatório (.md)" e me mande o arquivo (ou cole o texto aqui no Claude). Eu corrijo e publico uma versão nova.'] },
  ] },
];

// ---------------- Roteiro de teste ----------------

export interface Passo { fazer: string; esperado: string }
export const ROTEIRO: Record<string, Passo[]> = {
  desdobra: [
    { fazer: 'Abra um KV de teste. Preencha cliente TESTE, campanha piloto, versão 1. Deixe a lista de formatos como veio, modo Cobrir, foco Centro. Clique em Desdobrar.', esperado: 'Um documento novo por formato, cada um com nome TESTE_piloto_<formato>_v01 e as medidas da lista (confira em Imagem > Tamanho da imagem).' },
    { fazer: 'Volte ao documento original.', esperado: 'Nome e tamanho originais, sem nenhuma mudança.' },
    { fazer: 'Salve o KV (Cmd + S). Marque "Salvar um PSD de cada formato", deixe "Ao lado do arquivo aberto" e desdobre de novo.', esperado: 'Uma pasta "desdobra" aparece ao lado do KV, com um PSD por formato e os mesmos nomes.' },
    { fazer: 'Troque para "Escolher uma pasta", clique em "Escolher pasta para os PSD".', esperado: 'O painel avisa que está abrindo a janela e a janela de pastas do Mac aparece. Se não aparecer, anote o que o painel mostrou.' },
    { fazer: 'Na lista de formatos, escreva 1920x1080 numa linha e capa: 29,7x32 cm em outra. Desdobre.', esperado: 'Dois documentos: 1920x1080 px e o da capa convertido pelo ppi do KV (em 300 ppi, 3508 x 3780 px).' },
    { fazer: 'Troque o modo para Conter e desdobre.', esperado: 'A imagem inteira aparece em cada formato, com área vazia (transparente ou fundo) nas sobras.' },
    { fazer: 'Na lista de formatos, acrescente a linha "erro;abc;10" e clique em Desdobrar.', esperado: 'Mensagem pedindo para corrigir a lista e o erro da linha. Nenhum documento novo.' },
  ],
  retoque: [
    { fazer: 'Abra uma foto de pessoa. Clique em "1. Montar estrutura de retoque".', esperado: 'Grupo RETOQUE com quatro camadas: Limpeza, Dodge, Burn (as duas em Luz suave, cinza neutro) e Cor.' },
    { fazer: 'Clique em "2. Ver antes / depois" duas vezes.', esperado: 'O grupo RETOQUE desliga e liga de novo; a mensagem diz ANTES e DEPOIS.' },
    { fazer: 'Clique em "3. Salvar nova versão" e salve na pasta de teste.', esperado: 'A janela de salvar sugere o nome com a versão seguinte (_v02 ou +1). O documento aberto mantém o nome.' },
    { fazer: 'Selecione a camada da foto, raio 6, clique em "4. Separação de frequência".', esperado: 'Grupo SEPARAÇÃO DE FREQUÊNCIA com Alta (textura, Luz linear) em cima e Baixa (cor e tom, desfocada) embaixo. Ligando e desligando o grupo, a imagem NÃO muda.' },
    { fazer: 'Repita o passo 4 num documento em 16 bits (Imagem > Modo > 16 bits/canal).', esperado: 'Mesmo resultado: imagem idêntica com o grupo ligado.' },
    { fazer: 'Converta uma cópia para CMYK (Imagem > Modo > Cor CMYK) e tente o botão 4.', esperado: 'Mensagem dizendo que funciona só em RGB. Nada é criado.' },
  ],
  checar: [
    { fazer: 'Abra um documento RGB em 72 ppi. Destino: Impressão. Clique em Checar arquivo.', esperado: 'ERRO em Modo de cor (não é CMYK) e em Resolução (abaixo de 300 ppi).' },
    { fazer: 'Mude o destino para Digital e cheque de novo.', esperado: 'OK em Modo de cor e Resolução.' },
    { fazer: 'Crie uma camada vazia (fica "Camada 1") e oculte outra camada. Cheque.', esperado: 'AVISO em Nomes de camada e em Camadas ocultas.' },
    { fazer: 'Abra um PSD com uma fonte que não está instalada (se tiver). Cheque.', esperado: 'ERRO em Fontes com o nome da fonte ausente. Se não tiver esse arquivo, marque como Passou só se a linha Fontes aparecer como OK.' },
  ],
  exportador: [
    { fazer: 'Escolha a pasta de teste, marque PNG e JPG, clique em Exportar.', esperado: 'Dois arquivos na pasta com o nome do documento, sem espaços. O documento aberto não muda.' },
    { fazer: 'Abra dois documentos com o mesmo nome (em pastas diferentes), marque "Todos os documentos abertos" e exporte.', esperado: 'O segundo sai com -2 no nome. Nenhum arquivo é sobrescrito.' },
    { fazer: 'Marque PDF e exporte.', esperado: 'O PDF abre no Pré-visualização do Mac com a imagem correta.' },
  ],
  textos: [
    { fazer: 'Abra um PSD com duas ou mais camadas de texto (salve uma CÓPIA antes). Clique em "Exportar textos (CSV)" e salve.', esperado: 'Um CSV que abre no Excel ou no Numbers com as colunas arquivo, id, camada, texto_original e texto_revisado (separadas por ponto e vírgula).' },
    { fazer: 'No CSV, escreva um texto novo em texto_revisado de UMA linha. Salve como CSV UTF-8. No painel, "Aplicar CSV revisado".', esperado: 'Só aquela camada muda. O resumo do painel diz 1 texto aplicado.' },
    { fazer: 'Mude à mão o texto de outra camada no Photoshop e aplique um CSV que também altera essa camada.', esperado: 'A linha aparece como [PULADO] no relatório: a trava de segurança impede sobrescrever texto que mudou depois da exportação.' },
  ],
  guias: [
    { fazer: 'Crie um documento A4 com sangria: Arquivo > Novo, 216 x 303 mm, 300 ppi. No painel, deixe só "Impresso" marcado (sangria 3, margem 5, "já inclui a sangria" marcado). Criar guias.', esperado: '8 guias: corte a 35 px de cada borda e segurança a 94 px. A lista do painel mostra cada guia.' },
    { fazer: 'Crie um documento 1080 x 1920 px. Marque só "Stories". Criar guias.', esperado: 'Duas guias horizontais: 269 px e 1651 px.' },
    { fazer: 'Marque Colunas (6, calha 20, margem 60) e Centro. Criar guias.', esperado: 'Guias das colunas e do centro. As de antes somem (opção "Apagar as guias que já existem" marcada).' },
    { fazer: 'Clique em "Remover todas as guias" e depois Cmd + Z.', esperado: 'As guias somem e voltam com o Cmd + Z.' },
  ],
  camadas: [
    { fazer: 'Num PSD de teste, selecione três camadas no painel Camadas (Cmd + clique). Padrão "TXT_{n}". Renomear.', esperado: 'As três viram TXT_01, TXT_02 e TXT_03. A lista mostra antes → depois.' },
    { fazer: 'Duplique uma camada (fica "... cópia"). Localizar " cópia", substituir por vazio, em Todas as camadas.', esperado: 'O trecho " cópia" sai do nome.' },
    { fazer: 'Aplicar em Todas e clicar em "Aplicar prefixos por tipo".', esperado: 'Textos com TXT_, imagens com IMG_, grupos com GRP_, objetos inteligentes com SO_. O Plano de fundo não muda.' },
    { fazer: 'Clique em "Relatório de camadas". Depois Cmd + Z algumas vezes.', esperado: 'Lista de camadas com nome padrão, vazias e ocultas. O Cmd + Z desfaz as renomeações.' },
  ],
  prova: [
    { fazer: 'Abra um PSD com camadas. Preencha cliente e campanha, escolha a pasta de teste, Gerar prova.', esperado: 'Um JPG <nome>_PROVA.jpg na pasta: maior lado 2000 px, "PROVA · NÃO APROVADO" na diagonal em cinza claro e o rodapé com cliente · campanha · versão · data.' },
    { fazer: 'Confira o Photoshop depois de gerar.', esperado: 'O documento aberto continua igual (camadas, nome) e nenhuma janela extra ficou aberta.' },
    { fazer: 'Apague o texto da marca d’água e gere de novo.', esperado: 'Prova sem a marca, só com o rodapé.' },
    { fazer: 'Abra três documentos, marque "Todos os documentos abertos" e gere.', esperado: 'Uma prova por documento.' },
  ],
  bridge: [
    { fazer: 'Carregue o Bridge e abra o painel pelo menu Plug-ins.', esperado: 'O painel abre sem erro, com as seções descritas no LEIAME do Bridge.' },
    { fazer: 'No Studio, Gráfica, baixe o pacote de um job de teste. No Bridge, carregue o pacote e rode a pré-checagem num PSD de teste.', esperado: 'A lista da pré-checagem compara o documento com a ficha do job.' },
  ],
};

export function tutorialMarkdown(): string {
  const l: string[] = [`# Plugins Produceria v${VERSAO_KIT}: instalar, usar e testar`, '', 'O mesmo conteúdo da aba Instalar e da aba Roteiro de teste do Studio (Oficina > Plugins).', ''];
  l.push('## Os plugins', '');
  for (const p of PLUGINS) l.push(`- **${p.nome}** (v${p.versao}, Photoshop ${p.minPs}+), painel "${p.painel}": ${p.faz}${p.experimental ? ` _${p.experimental}_` : ''}`);
  l.push('- **After Effects · Variações de template**: uma composição por linha de um CSV, com os textos trocados.', '');
  for (const s of TUTORIAL) {
    l.push(`## ${s.titulo}`, '');
    if (s.intro) l.push(s.intro, '');
    for (const e of s.etapas) {
      l.push(`### ${e.titulo}`, '');
      e.passos.forEach((p, i) => l.push(p.startsWith('"/') ? '```bash\n' + p + '\n```' : `${i + 1}. ${p}`));
      if (e.ver) l.push('', `**O que você deve ver:** ${e.ver}`);
      if (e.atencao) l.push('', `**Atenção:** ${e.atencao}`);
      l.push('');
    }
  }
  l.push('## Roteiro de teste', '');
  for (const p of PLUGINS) {
    l.push(`### ${p.nome}`, '');
    (ROTEIRO[p.id] || []).forEach((r, i) => l.push(`${i + 1}. **Faça:** ${r.fazer}  `, `   **Deve acontecer:** ${r.esperado}`, '   - [ ] Passou  - [ ] Falhou · nota:', ''));
  }
  return l.join('\n');
}
