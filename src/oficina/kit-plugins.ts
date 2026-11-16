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

const VERSAO_KIT = '1.2.2';
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
- Mac ou Windows, com o app Creative Cloud aberto e com login.
- Photoshop 2023 (versão 24.2) ou mais novo. Mac: Photoshop > Sobre o Photoshop. Windows: Ajuda > Sobre o Photoshop.
- Descompacte este pacote em Downloads e renomeie a pasta para Produceria-Plugins.
- Teste sempre numa CÓPIA de arquivo, nunca no original de cliente.
- Siga o TUTORIAL.md: instalação (seções 1 a 4), uso (seção 5) e roteiro de teste (fim do arquivo).
`;
}

// ---------------- Tutorial ----------------

export interface Etapa { titulo: string; passos: string[]; ver?: string; atencao?: string }
export interface Secao { id: string; titulo: string; intro?: string; etapas: Etapa[] }

const CMD_MAC = '"/Library/Application Support/Adobe/Adobe Desktop Common/RemoteComponents/UPI/UnifiedPluginInstallerAgent/UnifiedPluginInstallerAgent.app/Contents/MacOS/UnifiedPluginInstallerAgent" --install ~/Downloads/Produceria-Plugins/1-instaladores-ccx/produceria-guias.ccx';
const CMD_WIN = '"C:\\Program Files\\Common Files\\Adobe\\Adobe Desktop Common\\RemoteComponents\\UPI\\UnifiedPluginInstallerAgent\\UnifiedPluginInstallerAgent.exe" /install "%USERPROFILE%\\Downloads\\Produceria-Plugins\\1-instaladores-ccx\\produceria-guias.ccx"';
/** Linhas de comando (vão em bloco de código no tutorial). */
export const ehComando = (p: string): boolean => p === CMD_MAC || p === CMD_WIN;

export const TUTORIAL: Secao[] = [
  { id: 'antes', titulo: '0. Antes de começar (10 minutos)', intro: 'Este tutorial serve para qualquer computador, Mac ou Windows, mesmo um que nunca teve nada da Produceria. Onde o caminho muda, o passo diz "No Mac" e "No Windows".', etapas: [
    { titulo: 'O que precisa ter no computador', passos: ['Photoshop 2023 (versão 24.2) ou mais novo, instalado pelo app Creative Cloud e com a licença ativa (login feito).', 'O app Creative Cloud aberto e com login (é ele que instala os plugins).', 'No Windows, uma conta com permissão de administrador ou alguém de TI por perto: o instalador da Adobe pode pedir confirmação.', 'Para o script de vídeo: After Effects 2022 ou mais novo (opcional).'] },
    { titulo: 'Confira a versão do Photoshop', passos: ['Abra o Photoshop.', 'No Mac: menu Photoshop (no topo, ao lado da maçã) > Sobre o Photoshop. No Windows: menu Ajuda > Sobre o Photoshop.', 'Anote o número da versão (por exemplo 26.1) e feche a janela.'], ver: 'Versão 24.2 ou maior: todos os painéis funcionam. Entre 23.3 e 24.1: todos menos o Prova. Abaixo de 23.3: atualize pelo app Creative Cloud (Aplicativos > Atualizações) antes de seguir.' },
    { titulo: 'Separe arquivos de teste', passos: ['Crie uma pasta "Teste plugins" na Área de Trabalho (Mesa).', 'Copie para ela dois ou três PSDs que NÃO sejam de cliente em produção: um KV com camadas de texto, uma foto de pessoa e uma peça com várias camadas.', 'Trabalhe sempre nessas cópias.'], atencao: 'Primeira rodada de uso real: não use arquivo de cliente em produção até o roteiro de teste (seção 8) passar.' },
  ] },
  { id: 'baixar', titulo: '1. Receber e abrir o pacote (5 minutos)', etapas: [
    { titulo: 'Pegue o arquivo ' + NOME_PACOTE, passos: ['Ele chega por e-mail, WeTransfer, pendrive ou link da pasta da equipe. Também dá para baixar pelo Studio (ou pela cópia de consulta): Oficina > Plugins > "Baixar todos os plugins (.zip)".', 'Salve o arquivo na pasta Downloads do computador.'] },
    { titulo: 'Descompacte com o nome certo', passos: ['No Mac: abra o Finder > Downloads e dê dois cliques no .zip. Aparece uma pasta com o mesmo nome.', 'No Windows: abra o Explorador de Arquivos > Downloads, clique com o botão direito no .zip > Extrair tudo... > Extrair.', 'Renomeie a pasta criada para Produceria-Plugins (exatamente assim, com hífen). Os comandos da seção 3 contam com esse nome.', 'Abra a pasta: dentro estão 1-instaladores-ccx, 2-codigo-fonte-para-UXP-Developer-Tool, 3-after-effects, TUTORIAL.md e LEIA-ME-PRIMEIRO.txt.'], ver: 'Na pasta 1-instaladores-ccx há ' + PLUGINS.length + ' arquivos terminados em .ccx, um por plugin.', atencao: 'No Windows, não abra o .ccx de dentro do .zip sem extrair: o instalador precisa do arquivo extraído.' },
  ] },
  { id: 'caminho-a', titulo: '2. Instalar: Caminho A, dois cliques no .ccx (o mais simples)', intro: 'Instala de vez, como um plugin da loja da Adobe. Faça um plugin primeiro (o Guias, que é o mais simples) e, se der certo, repita para os outros.', etapas: [
    { titulo: 'Prepare', passos: ['Feche o Photoshop (Mac: Cmd + Q; Windows: Arquivo > Sair).', 'Abra o app Creative Cloud e confira se o login está feito.'] },
    { titulo: 'Instale um plugin', passos: ['Abra Produceria-Plugins > 1-instaladores-ccx.', 'Dê dois cliques em produceria-guias.ccx.', 'O Creative Cloud abre uma janela avisando que o plugin não foi verificado pela Adobe (ele é da casa, não da loja) e pergunta se quer instalar. Clique em Instalar (ou OK).', 'Espere a confirmação de que o plugin foi instalado.'], ver: 'O Creative Cloud mostra "Instalado" (às vezes só como notificação no canto da tela).', atencao: 'Se os dois cliques abrirem outro programa (o descompactador, por exemplo): botão direito no .ccx > Abrir com > Creative Cloud (no Windows, "Adobe Unified Plugin Installer Agent" ou "Creative Cloud"). Se o Creative Cloud recusar, use o Caminho C (seção 3).' },
    { titulo: 'Repita para os outros', passos: ['Faça o mesmo com cada .ccx: desdobra, retoque, checar-arquivo, exportador, textos, camadas, prova e bridge.'] },
    { titulo: 'Abra o Photoshop e encaixe os painéis', passos: ['Abra o Photoshop.', 'No menu do topo, clique em "Plug-ins". Cada plugin aparece com o nome (por exemplo "Produceria Guias") e, dentro dele, o painel ("Guias e áreas seguras").', 'Clique no painel: ele abre flutuando. Arraste pela barra do título até a coluna de painéis da direita para deixá-lo encaixado.', 'Para guardar o arranjo: Janela > Área de trabalho > Nova área de trabalho, nome "Produceria".'], ver: 'O painel mostra campos e botões. Painel em branco: feche e abra de novo pelo menu Plug-ins; se continuar, anote no roteiro.' },
  ] },
  { id: 'caminho-c', titulo: '3. Instalar: Caminho C, pela linha de comando (se os dois cliques não funcionarem)', intro: 'Chama direto o mesmo instalador do Creative Cloud. Funciona com o Photoshop fechado.', etapas: [
    { titulo: 'No Mac (Terminal)', passos: ['Abra o Terminal (Cmd + Espaço, digite Terminal, Enter).', 'Copie o comando abaixo inteiro, cole no Terminal e aperte Enter. Ele instala o Guias; para os outros, troque só o final (produceria-guias.ccx) pelo nome de cada arquivo.', CMD_MAC], ver: 'O Terminal responde com uma linha terminando em "Installation Successful" (ou parecida).', atencao: 'Se aparecer "No such file or directory", confira se a pasta se chama Produceria-Plugins e está em Downloads.' },
    { titulo: 'No Windows (Prompt de Comando)', passos: ['Clique em Iniciar, digite cmd, clique com o botão direito em "Prompt de Comando" > Executar como administrador.', 'Copie o comando abaixo inteiro, cole (botão direito na janela) e aperte Enter. Para os outros plugins, troque só o nome do .ccx no final.', CMD_WIN], ver: 'A janela responde que a instalação terminou com sucesso.', atencao: 'Se o Windows disser que o caminho não existe, o Creative Cloud pode estar em outra unidade: procure UnifiedPluginInstallerAgent.exe pela busca do Explorador e use o caminho encontrado.' },
  ] },
  { id: 'caminho-b', titulo: '4. Instalar: Caminho B, UXP Developer Tool (plano de desenvolvedor)', intro: 'Carrega o plugin direto da pasta, sem instalar. É o caminho mais garantido e o que se usa para ver mensagens de erro. O plugin carregado assim some quando o Photoshop fecha: carregue de novo a cada sessão.', etapas: [
    { titulo: 'Instale o UXP Developer Tool', passos: ['App Creative Cloud > Todos os aplicativos.', 'Busque "UXP Developer Tools" e clique em Instalar.'] },
    { titulo: 'Ative o modo de desenvolvedor no Photoshop', passos: ['Mac: Photoshop > Configurações > Plug-ins. Windows: Editar > Preferências > Plug-ins.', 'Marque "Ativar o modo de desenvolvedor" (Enable Developer Mode) e clique em OK.', 'Feche e abra o Photoshop.'], atencao: 'Na primeira vez o UXP Developer Tool também pede para ativar o modo de desenvolvedor e a senha do computador. É normal.' },
    { titulo: 'Adicione e carregue o plugin', passos: ['Com o Photoshop aberto, abra o UXP Developer Tool.', 'Clique em "Add Plugin" (canto superior direito).', 'Vá até Produceria-Plugins > 2-codigo-fonte-para-UXP-Developer-Tool > produceria-guias e escolha o arquivo manifest.json.', 'Na linha do plugin, clique em "•••" > "Load".', 'Volte ao Photoshop: o painel abre sozinho ou aparece no menu Plug-ins.'], ver: 'A linha do plugin indica que está carregado. Se der erro: "•••" > "Debug" abre o console com a mensagem; copie para o relatório.' },
    { titulo: 'Recarregar depois de uma correção', passos: ['Substitua a pasta pela do pacote novo.', 'No UXP Developer Tool: "•••" > "Reload".'] },
  ] },
  { id: 'usar', titulo: '5. Usar no dia a dia', intro: 'O que cada painel faz e a ordem de cliques. Todos trabalham no documento aberto e mostram embaixo dos botões o resumo do que fizeram (OK, AVISO, ERRO). Tudo que mexe no documento pode ser desfeito com Cmd + Z (Mac) ou Ctrl + Z (Windows).', etapas: [
    { titulo: 'Desdobra KV: um KV em todos os formatos', passos: ['Abra o KV aprovado.', 'Preencha cliente, campanha e versão (os nomes saem no padrão CLIENTE_campanha_formato_v01).', 'Em "Pacote de formatos", escolha Redes sociais, Display, Vídeo e telas ou Impresso, ou escreva a sua lista (uma linha por formato: nome;largura;altura, ou 1920x1080, ou 29,7x42 cm).', 'Escolha Cobrir (preenche e corta) ou Conter (mostra tudo e sobra área) e o ponto de foco do corte.', 'Para já salvar os PSD: marque a opção e diga onde. Três jeitos: o botão Escolher pasta; colar o caminho da pasta no campo de baixo (Mac: botão direito na pasta, segure Option, "Copiar como nome de caminho"; Windows: Shift + botão direito > Copiar como caminho); ou deixar o campo vazio, e os PSD vão para a pasta "desdobra" ao lado do KV. O painel lembra a pasta na próxima vez.', 'Clique em Desdobrar.'], ver: 'Um documento novo por formato, com o nome no padrão. O KV original não muda. A ampliação acima de 2x aparece como aviso para conferir a nitidez.', atencao: 'Se a janela de pastas não abrir em alguns segundos, o painel avisa: cole o caminho ou deixe vazio. Para salvar ao lado, o KV precisa estar salvo em disco.' },
    { titulo: 'Retoque Rápido: estrutura e separação de frequência', passos: ['Abra a foto. Botão 1 cria o grupo RETOQUE (Limpeza, Dodge, Burn, Cor).', 'Botão 2 liga e desliga o retoque para comparar antes e depois.', 'Botão 3 salva uma cópia com a versão seguinte no nome.', 'Botão 4: selecione a camada da foto, ajuste o raio (6 px é um bom começo) e crie a separação de frequência. Retoque textura na Alta e cor e tom na Baixa.'] },
    { titulo: 'Checar Arquivo: pré-checagem antes de entregar', passos: ['Escolha o destino (Impressão ou Digital).', 'Clique em Checar arquivo e corrija o que vier como ERRO: modo de cor, perfil, resolução, fontes ausentes, camadas ocultas e nomes padrão.'] },
    { titulo: 'Exportador: PNG, JPG e PDF no padrão', passos: ['Escolha a pasta de saída pelo botão, cole o caminho no campo ou deixe vazio para salvar em "exportados" ao lado de cada arquivo (fica lembrada).', 'Marque os formatos e a qualidade do JPG; marque "Todos os documentos abertos" para exportar a desdobra inteira de uma vez.', 'Clique em Exportar. Nenhum arquivo é sobrescrito: nomes repetidos ganham -2, -3.'] },
    { titulo: 'Textos: revisão em planilha', passos: ['Exportar textos (CSV) gera uma planilha com o texto de cada camada.', 'A revisão preenche só a coluna texto_revisado e devolve o CSV.', 'Aplicar CSV revisado troca só o que mudou e pula a camada que alguém alterou depois da exportação.'] },
    { titulo: 'Guias, Camadas e Prova', passos: ['Guias: escolha impresso (sangria e margem em mm), centro, terços, área segura de stories ou colunas, e clique em Criar guias.', 'Camadas: renomeie em lote (TXT_{n}), localize e substitua nos nomes, aplique os prefixos da casa e veja o relatório do que falta arrumar.', 'Prova: escolha a pasta pelo botão, cole o caminho ou deixe vazio para salvar em "provas" ao lado do arquivo (fica lembrada), preencha cliente e campanha e gere o JPG com marca d\'água e rodapé para aprovação.'] },
    { titulo: 'Bridge: Studio, ficha do job e Magnific', passos: ['Carregue o pacote do job baixado no Studio (Oficina > Gráfica) para conferir o arquivo contra a ficha.', 'Para ampliar pelo Magnific: informe a chave da API (fica guardada no computador), escolha o fator e clique em ampliar. A imagem nova abre como documento.'], atencao: 'O Bridge é a versão 0.1: use para teste. A chave do Magnific é da conta da Produceria; não compartilhe.' },
  ] },
  { id: 'ae', titulo: '6. After Effects: variações de template', etapas: [
    { titulo: 'Rodar o script', passos: ['Abra o projeto e dê um clique na composição-modelo no painel Projeto.', 'Dê às camadas de texto que mudam nomes iguais aos títulos das colunas do CSV (ex.: TXT_TITULO).', 'Arquivo > Scripts > Executar arquivo de script...', 'Escolha Produceria-Plugins > 3-after-effects > produceria_variacoes_template.jsx.', 'Escolha o CSV (para o primeiro teste, exemplo_variacoes.csv).'], ver: 'Uma composição nova por linha do CSV, com os textos trocados. O modelo não muda e nada é apagado.' },
  ] },
  { id: 'remover', titulo: '7. Atualizar ou remover', etapas: [
    { titulo: 'Instalado pelo .ccx (Caminhos A e C)', passos: ['Photoshop: menu Plug-ins > Gerenciar plug-ins (abre o Creative Cloud).', 'Na linha do plugin, "•••" > Desinstalar.', 'Para atualizar: desinstale e instale o .ccx da versão nova.'] },
    { titulo: 'Carregado pelo UXP Developer Tool (Caminho B)', passos: ['Na linha do plugin: "•••" > "Unload" tira do Photoshop; "Remove" tira da lista.'] },
  ] },
  { id: 'relatar', titulo: '8. Testar e relatar um problema', etapas: [
    { titulo: 'Para cada passo do roteiro', passos: ['Siga o Roteiro de teste (no Studio, Oficina > Plugins > Roteiro de teste, ou no fim deste arquivo) e marque Passou ou Falhou.', 'Se falhou: copie a mensagem que o painel mostrou e escreva o que esperava.', 'Tire um print (Mac: Cmd + Shift + 4; Windows: Windows + Shift + S) e guarde na pasta "Teste plugins".'] },
    { titulo: 'No fim da rodada', passos: ['Anote a versão do Photoshop e do sistema (macOS ou Windows).', 'No Studio, "Baixar relatório (.md)", ou mande este arquivo com as marcações, junto com os prints, para a Produceria. A correção sai numa versão nova do pacote.'] },
  ] },
];

// ---------------- Roteiro de teste ----------------

export interface Passo { fazer: string; esperado: string }
export const ROTEIRO: Record<string, Passo[]> = {
  desdobra: [
    { fazer: 'Abra um KV de teste. Preencha cliente TESTE, campanha piloto, versão 1. Deixe a lista de formatos como veio, modo Cobrir, foco Centro. Clique em Desdobrar.', esperado: 'Um documento novo por formato, cada um com nome TESTE_piloto_<formato>_v01 e as medidas da lista (confira em Imagem > Tamanho da imagem).' },
    { fazer: 'Volte ao documento original.', esperado: 'Nome e tamanho originais, sem nenhuma mudança.' },
    { fazer: 'Marque "Salvar um PSD de cada formato", clique em "Escolher pasta para os PSD", escolha a pasta "Teste plugins" e desdobre de novo.', esperado: 'A janela de pastas abre e o caminho aparece no campo; depois os PSD aparecem na pasta com os mesmos nomes. Se a janela não abrir, o painel avisa em 4 segundos: anote no relatório e siga o próximo passo.' },
    { fazer: 'Apague o campo do caminho, cole o caminho da pasta "Teste plugins" (Mac: botão direito na pasta, segure Option, "Copiar como nome de caminho") e desdobre de novo.', esperado: 'Os PSD aparecem na pasta colada, sem abrir janela nenhuma.' },
    { fazer: 'Deixe o campo do caminho vazio, com o KV salvo em disco, e desdobre.', esperado: 'Uma pasta "desdobra" aparece ao lado do KV com os PSD dentro. Com um KV nunca salvo, a mensagem pede para salvar antes.' },
    { fazer: 'Troque o modo para Conter e desdobre.', esperado: 'A imagem inteira aparece em cada formato, com área vazia (transparente ou fundo) nas sobras.' },
    { fazer: 'Na lista de formatos, acrescente a linha "erro;abc;10" e clique em Desdobrar.', esperado: 'Mensagem pedindo para corrigir a lista e o erro da linha. Nenhum documento novo.' },
    { fazer: 'Em "Pacote de formatos", escolha Display e depois Impresso.', esperado: 'A lista de formatos troca a cada escolha e o resumo diz qual pacote foi carregado. No Impresso, as medidas em mm e cm viram pixels pelo ppi do documento.' },
    { fazer: 'Feche o painel (ou o Photoshop) e abra de novo.', esperado: 'Cliente, campanha, versão, lista e a pasta dos PSD voltam preenchidos ("Pasta (lembrada)").' },
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
    { fazer: 'Apague o campo do caminho e exporte de novo (documento salvo em disco).', esperado: 'Os arquivos vão para a pasta "exportados" ao lado do documento; o resumo mostra a pasta.' },
    { fazer: 'Abra dois documentos com o mesmo nome (em pastas diferentes), marque "Todos os documentos abertos" e exporte.', esperado: 'O segundo sai com -2 no nome. Nenhum arquivo é sobrescrito.' },
    { fazer: 'Marque PDF e exporte.', esperado: 'Um PDF na pasta, que abre no leitor de PDF com a imagem correta. (Na v1.0 o PDF sempre dava erro.)' },
    { fazer: 'Feche e abra o painel.', esperado: 'A pasta de saída e os formatos marcados continuam escolhidos.' },
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
      e.passos.forEach((p, i) => l.push(ehComando(p) ? '```\n' + p + '\n```' : `${i + 1}. ${p}`));
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
