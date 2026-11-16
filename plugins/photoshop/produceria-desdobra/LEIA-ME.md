# PRODUCERIA Desdobra KV — 1.3.0

Painel UXP de adaptação de campanhas em **piloto**, com regras próprias de geometria. O código não contém o motor de ImageFactory ou Smart Resize. Não foi executado no Photoshop nesta rodada; testes automatizados usam dados e host simulados.

## Instalação de desenvolvimento

No Adobe UXP Developer Tool, use Add Plugin, selecione `manifest.json` e carregue. Abra Plug-ins > Desdobra KV. O manifesto mantém Photoshop 23.3 como mínimo declarado; compatibilidade real precisa de homologação. Para distribuir um instalador validado, empacote pelo UXP Developer Tool.

## Fluxo

1. Abra cópias de KVs aprovados. Preencha cliente, campanha e versão.
2. No modo **Adaptar por papéis**, deixe um KV ativo e clique em **Adicionar ou atualizar KV aberto**. Repita para outras orientações. Nesta versão, a seleção é de documentos já abertos; não há importador de arquivos fechado.
3. Confira o papel de cada unidade de primeiro nível. Nomes em português e inglês ajudam, mas não há reconhecimento visual por IA. Papéis desconhecidos bloqueiam o lote. Grupos são tratados como unidades; um grupo que contém a composição inteira não será reorganizado internamente.
4. Cole os formatos (`1080x1920` ou `stories;1080;1920`) e as margens percentuais do job. O valor inicial de 5% não é uma exigência de plataforma. Medidas em mm/cm usam o PPI do primeiro KV selecionado.
5. **Diagnosticar formatos** lê dados sem criar documentos ou arquivos. Confira a fonte escolhida, o escore geométrico e os avisos. Um escore alto não aprova o layout.
6. **Gerar cópias para revisão** abre até 12 cópias se Salvar estiver desmarcado. Para lotes de até 100 alvos, marque Salvar e defina uma pasta.
7. Ao salvar, PSD é obrigatório; JPG e PNG são opcionais e exigem KVs RGB de 8 bits neste piloto. Nenhuma conversão de cor é feita. Cada rodada cria uma pasta com subpastas por extensão e `relatorio.json`. As cópias de trabalho são fechadas; os KVs ficam abertos.
8. Use **Cancelar lote** para interromper. O formato em andamento pode falhar por cancelamento; os restantes ficam pendentes. O relatório mantém os caminhos dos arquivos concluídos, mesmo se outra extensão falhar.
9. Confira visualmente cada resultado, incluindo efeitos, máscaras, enquadramento, textos, logos, legibilidade e nitidez. Use Guias com os mesmos percentuais para conferir limites.

## Como o piloto adapta

- Escolhe o mestre pela proximidade da proporção; usa qualidade do mapa no desempate.
- Compara nomes/papéis entre KVs e sinaliza correspondências ambíguas, elementos importantes ausentes e textos divergentes. Não troca os textos entre masters.
- Escala cada unidade uniformemente: proporção do logo/produto é mantida. Fundos e decoração cobrem o canvas; outros elementos são posicionados por coordenadas relativas dentro da área segura.
- Expande o canvas de trabalho antes de transformar e só recorta no final, para evitar perda prematura do conteúdo na cópia.
- Não rasteriza deliberadamente texto ou Smart Objects. A fidelidade real dos efeitos/máscaras precisa de conferência no Photoshop.
- Restringe pranchetas, camadas especiais Background, unidades travadas, vínculos e recortes incompatíveis em vez de desfazê-los silenciosamente.

## Memória e rastreio

Campos e papéis manuais ficam no armazenamento local do plugin. Mapas só são restaurados para KVs abertos com assinatura estrutural correspondente. Fontes fechadas ou alteradas devem ser relidas; a validação usa assinatura estrutural e ID do histórico quando disponível; arquivos não são reabertos automaticamente. Não há envio de imagens pela rede.

O relatório identifica gerados para revisão, falhas, pendentes e arquivos parciais. Não existe retomada automática depois de reiniciar o Photoshop, retry seletivo pelo painel ou integração com o banco do Studio. Um novo lote cria outra rodada, sem sobrescrever a anterior.

## Limites

Sem reflow/encaixe tipográfico, expansão generativa, OCR de artes achatadas ou otimização criativa por IA. Quando o histórico não puder ser lido, uma alteração só de pixels pode escapar da assinatura; o diagnóstico avisa para reler a fonte. Camadas de efeitos e máscaras podem mudar limites reais. Banners extremos exigem masters apropriados e acabamento humano. O piloto pode abortar um formato em vez de produzir uma saída incompleta silenciosamente.

Cobrir e Conter continuam disponíveis como encaixe global. Não usam o mapa nem reposicionam elementos por papel.
