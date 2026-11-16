# PRODUCERIA — ImageFactory, Smart Resize e aplicação nos plugins da casa

**Data da pesquisa: 16/11/2026.** Escopo: documentação pública, fluxos descritos, integração, comparação com o código existente e implementação independente. Este documento registra o que é declaração do fornecedor, inferência de engenharia e função implementada. Os produtos comerciais não foram comprados, ativados ou executados. O código da PRODUCERIA ainda depende de homologação no Photoshop.

## 1. Identificação correta dos links

| Referência recebida | Identidade confirmada | Papel no estudo |
|---|---|---|
| imagefactory.co.kr | Plataforma ImageFactory, com plugin Banner Resize para Photoshop/Figma, web, API e MCP | Adaptação orientada a placements e arquitetura de integração |
| smartresize.me/#how-it-works | Smart Resize, plugin de Photoshop para campanhas com masters PSD/PSB | Fluxo, mapeamento de camadas, fontes por orientação e entrega editável |
| Adobe Exchange /23496533 | Listing apontado pela própria documentação de instalação do Smart Resize | Canal de distribuição do mesmo produto, não um terceiro motor |

A página ImageFactory liga seu plugin Photoshop a outro listing: `59be54b7/banner-resize`. As páginas do Exchange retornaram conteúdo dependente de JavaScript na leitura textual; a associação dos produtos foi estabelecida pelos links de seus próprios sites/documentação. Não se inferiram versão, reviews, autorização independente ou dados de downloads a partir de páginas indisponíveis.

Fontes: [Smart Resize — instalação](https://www.smartresize.me/docs/getting-started/installation), [ImageFactory — plugins](https://www.imagefactory.co.kr/en/plugin).

## 2. Método e limites

Foram percorridos a página do produto Smart Resize, seu fluxo, instalação, ativação, documentação de uso, recursos, problemas, formatos, palavras-chave, requisitos, privacidade e termos; e as páginas ImageFactory de plugin, resize web, guia de uso, API, MCP, privacidade e seu repositório público.

A evidência consultada é documental. Uma função escrita na documentação não foi tratada como desempenho medido. A ilustração interativa da landing page do Smart Resize se identifica como exemplo; ela não constitui um teste do motor sobre arquivos PSD reais. As promessas comerciais da ImageFactory sobre escala e produtividade também não foram usadas como resultados da PRODUCERIA.

Não foram obtidos o algoritmo interno, pesos, prompts, executáveis privados ou o código do motor dos fornecedores. A pesquisa no GitHub não consolidou uma origem oficial aberta do motor de resize do Smart Resize. O repositório oficial ImageFactory encontrado contém documentação e manifesto; declara que código do servidor, prompts e pipelines são proprietários. Projetos homônimos de virtualização, como o ImageFactory da Red Hat, foram excluídos por não corresponderem ao produto.

Fonte: [ImageFactory MCP — repositório oficial](https://github.com/ImagesFactory/imagefactory-mcp).

## 3. Smart Resize: análise funcional

### 3.1 Entrada e preparação dos masters

O produto documenta fontes PSD/PSB distribuídas em cinco orientações: vertical, horizontal, quadrada e duas extremas. A ideia útil é começar pela orientação adequada em vez de forçar um único KV a atender a todos os formatos. Indexação e consistência de nomes fazem parte da preparação.

**Aplicação:** o Desdobra agora permite adicionar documentos abertos como mestres e mostra cada um com tamanho e mapa próprio. O cadastro não foi restringido a cinco slots: a seleção usa a proporção de cada fonte. Ainda não há importação automática de PSDs fechados.

Fonte: [Loading Key Visuals](https://www.smartresize.me/docs/using-smart-resize/loading-key-visuals).

### 3.2 Papel semântico da camada

A documentação organiza camadas por função: assunto/produto, título, marca, selo, legal, atmosfera, fundo, outros e desconhecido. A classificação declarada começa por nome e recorre a contexto geométrico/visibilidade. Não há evidência pública de qual modelo, se algum, seria usado internamente.

**Aplicação:** a PRODUCERIA ganhou um classificador próprio por palavras inteiras, incluindo português, com correção manual. Colisões de nome como “logo_produto” exigem decisão. O CTA ganhou papel explícito de chamada, útil para nossa operação. Não se afirma reconhecimento visual por IA.

Fontes: [Layer Map & Roles](https://www.smartresize.me/docs/using-smart-resize/layer-map-and-roles), [Auto Role Detection](https://www.smartresize.me/docs/features/auto-role-detection).

### 3.3 Correspondência entre masters

O Smart Resize descreve correspondências por nome, papel e estrutura, com confirmação para ambiguidades. Esse é um mecanismo de consistência entre orientações, além da escolha de uma fonte.

**Aplicação:** o diagnóstico da PRODUCERIA compara papéis críticos entre os KVs. Nomes equivalentes têm prioridade; na ausência de nome idêntico, um papel único permite comparação. Elementos importantes ausentes, correspondências ambíguas ou títulos/legais/chamadas divergentes viram avisos. Nenhum texto aprovado é substituído automaticamente por outro master.

Fonte: [Cross-Master Matching](https://www.smartresize.me/docs/features/cross-master-matching).

### 3.4 Entrada de formatos e triagem

A entrada descrita pelo fornecedor aceita dimensões por linha e atribui escores para orientar revisão. A fórmula do escore não está publicada nas páginas consultadas. Não é adequado apresentar o número como probabilidade de aprovação ou conformidade com veículo.

**Aplicação:** mantivemos as entradas já existentes em pixels, mm/cm e nome;largura;altura. Corrigimos a aceitação indevida de números parciais como `300abc`. O piloto limita lotes a 100 alvos. O escore próprio penaliza distância de proporção e problemas detectados; cada resultado permanece pendente de revisão.

Fonte: [Entering Sizes](https://www.smartresize.me/docs/using-smart-resize/entering-sizes).

### 3.5 Saídas, editabilidade e revisão

As opções documentadas são PSD editável e JPG/PNG separados, organizados por tipo. A revisão de texto, logo, legal e extremos de proporção aparece na própria documentação do produto.

**Aplicação:** o novo lote gera cópias PSD e, opcionalmente, JPG/PNG. Cada rodada recebe pasta própria, evitando sobrescrita, e registra caminhos por extensão. A versão inicial limita JPG/PNG a RGB/8, sem conversão silenciosa de cor. Não foi assumida equivalência com a preservação de todos os recursos do produto comercial.

Fontes: [Output Settings](https://www.smartresize.me/docs/using-smart-resize/output-settings), [Generating Assets](https://www.smartresize.me/docs/using-smart-resize/generating-assets), [Supported Formats](https://www.smartresize.me/docs/reference/supported-formats).

### 3.6 Memória, problemas e adoção

O fornecedor documenta restauração de slots, papéis e preferências, com necessidade de religar arquivos movidos. Também orienta nomes consistentes e grupos que não escondam conteúdo importante.

**Aplicação:** campos e mapeamentos confirmados ficam locais. O mapa é restaurado para documento aberto de assinatura correspondente. A pessoa adiciona fontes reabertas e lê o mapa; não há reabertura automática de arquivos. Grupos de primeiro nível são unidades de transformação, preservando sua organização. Grupos multicomponentes são sinalizados e não reorganizados internamente.

Fontes: [Session Restore](https://www.smartresize.me/docs/features/session-restore), [PSD Setup Guide](https://www.smartresize.me/docs/features/psd-setup-guide), [Layer Map Not Showing](https://www.smartresize.me/docs/troubleshooting/layer-map-not-showing).

### 3.7 Requisitos, licença e privacidade

O site informa Photoshop 27.0+, macOS/Windows, preço público de US$ 49 em pagamento único por máquina e garantia de reembolso de 30 dias. Isso não equivale a trial gratuito. Ativação usa chave/e-mail e serviços de verificação; não se pode deduzir funcionamento integralmente offline ou ausência de telemetria apenas pelo painel rodar no desktop.

Os termos consultados restringem extração do código e redistribuição do software proprietário. A implementação da PRODUCERIA usa requisitos públicos e código próprio, sem incorporar o pacote comercial. A análise não depende de contornar licença.

Fontes: [página do produto](https://www.smartresize.me/), [ativação](https://www.smartresize.me/docs/getting-started/activation), [privacidade](https://www.smartresize.me/privacy), [termos](https://www.smartresize.me/terms).

## 4. ImageFactory: análise funcional e de arquitetura

### 4.1 Plugin no fluxo de produção

A página do plugin anuncia resize, ajuste de layout e texto, posicionamento de logo e adequação de CTA. A combinação sugere que o objeto do produto é adaptação de composição, não apenas reamostragem de imagem.

**Aplicação:** os elementos agora são tratados por papel no Desdobra. Marcas/produtos mantêm escala uniforme; chamada e legal passam pela mesma área segura configurada. Não foi implementado ajuste tipográfico inteligente nem tratamento criativo de CTA equivalente ao fornecedor.

Fonte: [ImageFactory — plugin](https://www.imagefactory.co.kr/en/plugin).

### 4.2 Placements, áreas seguras e continuidade

O guia público descreve seleção de placements e um motor compartilhado entre web, Figma e Photoshop. Sua biblioteca de formatos e as promessas de reconstrução de fundo são funções do serviço, não algo que se obtenha copiando o painel.

**Aplicação:** a PRODUCERIA deve manter uma única definição de receitas por job quando a integração entre Studio e Photoshop avançar. Nesta entrega, o Guias recebe margens assimétricas e o Desdobra usa os mesmos conceitos de percentual. Os valores não são sincronizados automaticamente; o operador deve informar os mesmos números.

Fonte: [guia de adaptação no design tool](https://www.imagefactory.co.kr/en/guides/figma-banner-resize).

### 4.3 Imagens achatadas e lotes vindos de planilha

O resize web apresenta upload de imagens e importação de medidas por Excel. Isso é distinto de preservar camadas nativas de um PSD. Uma arte achatada não recupera, por simples resize, a estrutura original de fontes, grupos e objetos inteligentes.

**Aplicação:** a implementação atual prioriza mestres editáveis. A leitura de XLSX e normalização de ordens do plano de mídia ficam como evolução do backend/Studio; o painel aceita texto colado. Não foi anunciada reconstrução de camadas nem OCR nesta entrega.

Fonte: [resize web](https://www.imagefactory.co.kr/banner-resize).

### 4.4 API assíncrona e uso por equipes

A página para desenvolvedores publica rotas de resize, geração, consulta de tarefa, estilos e uso por período. Documenta autenticação, idempotência e tratamento de consumo/devolução em jobs de imagem. O OpenAPI ligado pela página não pôde ser recuperado nesta pesquisa; não se inventaram campos de request/response que dependam desse arquivo.

**Aplicação:** o relatório local e a fila da PRODUCERIA adotam estados por item e preservam resultados parciais. A conexão futura com um backend deve oferecer contrato versionado de job e idempotência. Não foi adicionada chamada paga à ImageFactory, nem um cliente API incompleto anunciado como funcional.

Fonte: [Developer API](https://www.imagefactory.co.kr/developers).

### 4.5 MCP e fronteira entre automação e publicação

O material MCP divide consultas, criação de peças e mudanças de campanhas. Descreve aprovação antes de ações com gasto e status consultável para criação. Esse padrão interessa ao Studio: uma proposta de peça e sua execução podem ser etapas separadas, com registro.

Há uma distinção importante: um “plugin” para Claude/Cursor e um plugin UXP do Photoshop não são a mesma coisa. O repositório MCP público não contém a implementação do motor de imagem. O outro repositório citado pelo fornecedor não pôde ser lido pelo mecanismo de pesquisa utilizado.

**Aplicação:** a entrega atual é local no Photoshop. Não publica campanhas, não altera contas de anúncios e não envia imagens à ImageFactory. Um eventual Studio Link terá de especificar autenticação, dados enviados, custo, revisão e execução por operação.

Fontes: [MCP — produto](https://www.imagefactory.co.kr/mcp), [GitHub oficial](https://github.com/ImagesFactory/imagefactory-mcp).

### 4.6 Preço, dados e inconsistências a resolver

As páginas consultadas apresentam cobrança por pontos para criação e modalidades próprias para operação de anúncios. A API informa condições de acesso mediante contato. Não se concluiu um custo universal por job interno da PRODUCERIA, pois ele depende de quantidade de saídas, canal e plano contratado.

A home e materiais MCP usam enquadramentos comerciais diferentes para operação de anúncios. Essa diferença precisa ser resolvida numa cotação concreta; não foi tratada como gratuidade geral. Tampouco as políticas de dados autorizam inferir que qualquer imagem confidencial possa ser enviada sem avaliar o contrato do job.

Fontes: [MCP e planos](https://www.imagefactory.co.kr/mcp), [API](https://www.imagefactory.co.kr/developers), [privacidade](https://www.imagefactory.co.kr/privacy).

## 5. Comparação e decisões para a PRODUCERIA

| Eixo | Smart Resize: declaração documental | ImageFactory: declaração documental | Decisão aplicada / estágio |
|---|---|---|---|
| Centro do fluxo | Master PSD/PSB e camadas | Peça/placement em ecossistema web e plugins | Evoluir o Desdobra já existente |
| Fontes | Orientações e correspondência entre masters | Uma origem adaptada aos placements | Seleção entre KVs abertos por proporção |
| Semântica | Mapa com papéis revisáveis | Ajuste de elementos de marca/texto/CTA | Classificação independente PT/EN com correção manual |
| Texto | Editabilidade e ajuste para revisão | Promessa de preservação/ajuste | Escala uniforme e avisos; sem reflow |
| Área segura | Conferência de legal e margens | Placement e safe zones | Percentuais do job; sem alegação de spec atualizado |
| Entrega | PSD/JPG/PNG | Saídas do serviço | Subpastas por formato e relatório local |
| Erros e continuidade | Memória de sessão e status por alvo | Tarefas e estados externos | Checkpoints, cancelamento, falhas parciais |
| Nuvem | Ativação documentada; processamento não auditado | API/serviço remoto explícitos | Nova adaptação local, sem provedor externo |
| Código | Motor não disponibilizado nas fontes lidas | MCP público não inclui motor | Código novo da PRODUCERIA |
| Qualidade | Revisão de layouts | Promessas de adaptação por IA | Resultado sempre pendente de revisão |

## 6. Antes e depois do código existente

A base encontrada já continha oito painéis Photoshop, um Bridge e um script After Effects. O Desdobra 1.2 reescalava o documento inteiro e ajustava o canvas, com salvamento PSD opcional. Não fazia adaptação semântica. Esta entrega altera funções existentes, mantendo seus IDs de plugin, para preservar o caminho de atualização.

| Componente | Antes | Nesta entrega |
|---|---|---|
| Desdobra 1.3.0 | Uma fonte ativa e encaixe global | Múltiplos KVs abertos, mapa, diagnóstico e modo por camadas |
| Mapeamento | Nenhum papel de produção | Papéis revisáveis, ambiguidade bloqueante e comparação entre KVs |
| Geometria | Cobrir/conter de toda a composição | Transformação uniforme por unidade e margens percentuais |
| Lote | PSD opcional; cópias acumuladas | PSD/JPG/PNG, rodada exclusiva, até 100 alvos salvos ou 12 cópias abertas |
| Acompanhamento | Lista final de nomes/erros | Status por item, checkpoint JSON, cancelamento e caminhos parciais |
| Guias 1.1.0 | Presets e margens existentes | Margens assimétricas em quatro bordas, com validação |
| Checar Arquivo 1.1.0 | PPI mínimo genérico em digital | Conferência de dimensões-alvo em pixels e PPI informativo |
| Studio / kit 1.3.0 | Descrição e roteiro antigos | Catálogo, fontes empacotadas e roteiro atualizados |

O Exportador, Textos, Retoque, Camadas, Prova, Bridge e After Effects continuam disponíveis. Não foram atribuídas a eles capacidades novas que esta alteração não implementa.

## 7. Engenharia da adaptação implementada

### 7.1 Modelo e escolha de fonte

O mapa captura unidades de primeiro nível com chave estrutural, nome, tipo, bounds, visibilidade, conteúdo textual disponível e estrutura de grupo. IDs de camada do original não são reutilizados na cópia: o adaptador resolve a unidade correspondente pela estrutura e confere nome/tipo.

A fonte é escolhida pela menor distância logarítmica entre proporções: `abs(log(proporcaoAlvo/proporcaoMestre))`. Esta fórmula é uma decisão própria, não uma descoberta do algoritmo dos produtos. Quanto maior a mudança de proporção, maior a necessidade de revisão e de um master alternativo.

### 7.2 Regras por unidade

Fundos/decoração recebem escala uniforme para cobrir o formato. As demais unidades recebem escala uniforme de contenção e coordenadas relativas dentro da área segura. O canvas da cópia é expandido antes das transformações e recortado no fim. Assim, evita-se recortar prematuramente o conteúdo que ainda será reposicionado.

Grupos permanecem unidades. Ajustes globais são mantidos sem transformação geométrica. A adaptação não soluciona automaticamente toda a hierarquia de uma composição. As heurísticas podem resultar em pouco aproveitamento de espaço; isso exige acabamento humano, não uma promessa de equivalência ao produto comercial.

### 7.3 Diagnóstico e travas de escopo

Há avisos para proporções distantes, ampliação elevada, textos projetados pequenos, grupos mistos, colisões novas e divergências entre masters. O limiar de 12 px é interno para triagem, não uma norma de plataforma ou prova de legibilidade.

Unidades desconhecidas, estruturas não mensuráveis, pranchetas e determinadas travas/vínculos/recortes impedem geração no modo por camadas. O objetivo é não desmontar essas estruturas automaticamente numa versão não homologada. Uma fonte alterada exige novo diagnóstico, usando assinatura e ID de histórico quando disponível. Se o histórico não puder ser lido, o painel avisa a limitação.

### 7.4 Execução e relatórios

Cada formato usa seu próprio escopo modal, com operações do Photoshop serializadas. Uma falha não anuncia os arquivos incompletos como entregas concluídas. Caminhos já gravados permanecem no relatório. Se a gravação do checkpoint falhar, a fila para, em vez de continuar sem rastreio.

O relatório diferencia `gerado_para_revisao`, `falhou`, cancelamento e pendentes. Não há estado “aprovado”. Restauração de campos/mapas não equivale a retomada automática do lote após reiniciar o Photoshop. Não há retry seletivo no painel nesta versão.

### 7.5 Cor e fontes

JPG/PNG exigem RGB/8 neste piloto; PSD mantém a fonte sem conversão solicitada pelo código. Não se adotou um ICC específico de impressão ou promessa de peso de arquivo adequado ao veículo. Fontes instaladas, efeitos, máscaras e limites reais continuam parte da homologação.

A correção no Checar Arquivo segue a distinção entre pixels, resolução e tamanho físico documentada pela Adobe. Em digital, o alvo informado em pixels é um critério verificável. PPI isolado não prova a adequação da peça.

Fontes técnicas: [Adobe Layer](https://developer.adobe.com/photoshop/uxp/2022/ps_reference/classes/layer/), [Document](https://developer.adobe.com/photoshop/uxp/2022/ps_reference/classes/document/), [HistoryState](https://developer.adobe.com/photoshop/uxp/2022/ps_reference/classes/historystate/), [dimensões e resolução](https://helpx.adobe.com/photoshop/desktop/crop-resize-transform/resize-adjust-resolution/image-size-resolution-and-resampling.html).

## 8. Evoluções decorrentes do estudo, ainda não implementadas

| Próxima função | Por que faz sentido | Dependência concreta |
|---|---|---|
| Receitas versionadas de placements | Compartilhar especificações entre Studio, Desdobra e Guias | Modelo de receita, fontes oficiais e data de revisão |
| Importador XLSX/CSV do plano de mídia | Diminuir digitação e erros de medidas | Normalização e validação de cabeçalhos/unidades |
| Ajuste tipográfico | Tratar quebras e hierarquia em formatos extremos | Medição de texto, fontes e testes reais no host |
| Expansão generativa | Preencher fundos sem deformar produto ou logo | Provedor, contrato de dados, custo e QA |
| Retry seletivo e retomada | Repetir apenas falhas/pendentes | Identidade persistente de fontes e política de arquivo |
| Studio Link | Receber jobs e devolver status/previews | Contrato autenticado, permissões e armazenamento |
| Aprovação por peça | Vincular a entrega à decisão criativa | Workflow de revisão e papéis da equipe |
| Perfis de cor/peso por receita | Adequar entregas ao destino | Configurações aprovadas por produção/mídia |

Não é necessário conectar ImageFactory para aproveitar as ideias de produto. A conexão paga só deve entrar se o seu resultado ou custo justificar a dependência e se os dados do job puderem ser enviados ao serviço.

## 9. Homologação exigida para entrar em produção

1. Carregar pelo UXP Developer Tool em cada versão/arquitetura alvo.
2. Testar três KVs reais autorizados, com orientações distintas e componentes separados.
3. Comparar os originais antes/depois: dimensões, conteúdo, camadas, máscaras e histórico.
4. Conferir camadas editáveis, fontes e Smart Objects nas cópias.
5. Usar Guias com percentuais iguais e verificar as margens reais, inclusive efeitos.
6. Testar fontes fechadas/alteradas entre formatos, grupos, vínculos, pranchetas e camadas travadas.
7. Cancelar uma rodada; provocar falha de exportação; conferir o relatório e saídas parciais.
8. Repetir o lote, confirmando outra pasta de rodada e ausência de sobrescrita.
9. Abrir PSD/JPG/PNG fora do painel e conferir resolução, cor, alfa e conteúdo.
10. Medir tempo total incluindo preparação e revisão, antes de calcular retorno.

## 10. Evidência de validação

A referência inicial do repositório tinha 144 testes Vitest aprovados. A alteração acrescenta testes de aceitação das regras, execução com host simulado e interação do painel com DOM simulado. São verificações de implementação, não uma medição de qualidade criativa ou homologação UXP. O resultado final dos comandos é registrado em `PHOTOSHOP_VALIDACAO.md`.

## 11. Fontes adicionais consultadas e limites de acesso

- [Quick Start](https://www.smartresize.me/docs/getting-started/quick-start)
- [Recognized Keywords](https://www.smartresize.me/docs/reference/recognized-keywords)
- [Common Issues](https://www.smartresize.me/docs/troubleshooting/common-issues)
- [Update Check](https://www.smartresize.me/docs/features/update-check)
- [Keyboard Shortcuts](https://www.smartresize.me/docs/reference/keyboard-shortcuts)
- [System Requirements](https://www.smartresize.me/docs/reference/system-requirements) — recuperação inconsistente; requisito 27.0+ também consta na página principal
- [About & Editorial Policy](https://www.smartresize.me/about) — o próprio fornecedor distingue material editorial de teste de cada fluxo
- [Adobe Exchange — Smart Resize](https://exchange.adobe.com/apps/cc/23496533) — listing ligado pela documentação; leitura textual limitada
- [Adobe Exchange — ImageFactory Banner Resize](https://exchange.adobe.com/apps/cc/59be54b7/banner-resize) — ligação confirmada no site oficial; leitura textual limitada
- [OpenAPI ImageFactory](https://www.imagefactory.co.kr/api/external/v1/openapi.json) — acesso restrito na ferramenta; schema não usado para inventar integração
- [MCP oficial — arquivos públicos](https://github.com/ImagesFactory/imagefactory-mcp) — README e server.json; motor não publicado
- [Repositório AdOps citado pelo fornecedor](https://github.com/ImagesFactory/imagefactory-adops-plugin) — conteúdo não recuperado; nenhuma alegação sobre sua implementação
- [Adobe — empacotamento UXP](https://developer.adobe.com/uxp/guides/how-to/distribution/package/) — empacotar e validar pelo UXP Developer Tool antes de distribuir

Nenhuma informação de release foi deduzida dos rodapés dos sites. A ImageFactory exibiu rodapé 2027 durante a consulta, mas isso não foi usado como data de lançamento ou de atualização do produto.
