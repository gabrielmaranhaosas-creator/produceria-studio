# PRODUCERIA Desdobra KV — 1.4.0

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

## Galeria e simulação das saídas (1.4)

1. **Diagnosticar formatos** também monta os cartões com medidas, KV de origem, avisos, área segura e esquema geométrico das camadas. O esquema usa retângulos por papel: não é uma prévia da arte.
2. **Gerar prévias reais para revisão** adapta uma cópia temporária por formato, captura uma miniatura e fecha a cópia sem gravar as artes. Os KVs originais não são transformados. Até 100 formatos, um de cada vez. O botão Cancelar também atua nesta fila.
3. A captura depende de `require("photoshop").imaging.getPixels/encodeImageData` disponíveis na instalação. A API com esse nome aparece na documentação da Adobe a partir da linha 24.4; não basta cumprir o mínimo 23.3 do manifesto. A disponibilidade é detectada por capacidade. Sem ela, use o esquema e valide uma versão atual do Photoshop.
4. As miniaturas são JPEG reduzido em sRGB sobre branco, limitadas a 440 px no maior lado. Preservam a posição do conteúdo quando a API recorta a transparência. Não representam transparência original, prova de cor ou inspeção em 100%. Não mudam o perfil ou a profundidade do PSD.
5. **Mostrar** filtra por Google Display, Meta, Mac/computador, celular, vídeo/DOOH e próprios. A classificação automática usa o nome e algumas medidas usuais, podendo precisar de ajuste.
6. **Visualização** alterna entre peça isolada e contexto. **Moldura** permite forçar outro contexto. Mac é um cenário de navegador em computador, não um placement publicitário nem uma especificação de hardware. Meta é um grupo separado. As molduras são exemplos aproximados; não reproduzem a interface atual de cada serviço.
7. **Sobrepor área segura do job** controla apenas a apresentação. Molduras e guias da galeria nunca entram no PSD/JPG/PNG. As escalas dos cartões são ajustadas individualmente para caber; não são uma comparação em escala única.
8. **Ver detalhe** amplia um formato. **Salvar folha de revisão (.html)** inclui todos os formatos, mesmo os ocultos pelo filtro, com as miniaturas disponíveis incorporadas. Abra no navegador; para PDF use Imprimir > Salvar como PDF. Não há upload, aprovação automática ou envio a cliente.
9. Se alterar medidas, margens, modo, foco, campanha ou mapa no painel, a galeria é invalidada. Edições feitas no Photoshop não são monitoradas em tempo real: as miniaturas são capturas da última execução. Atualize o KV e gere novas prévias após editar. Ao reabrir o painel, as miniaturas não são restauradas da memória.
10. Ao gerar entregas, o painel tenta capturar os resultados automaticamente quando a Imaging API está disponível. Uma falha só na miniatura não invalida a exportação; o cartão explica a falha. Falha na criação/exportação do formato continua registrada como falha.

Pacotes adicionais: Meta, telas de Mac/computador e celular. Todos são editáveis. Os dez tamanhos do pacote Display constam na lista pública do Google Ads consultada em 16/11/2026; isso não valida peso, políticas, região ou modalidade da campanha. Outros pacotes são exemplos internos, sem alegação de homologação das plataformas.

### Conferência da galeria na primeira estação

- Diagnostique 728x90, 160x600, 300x250, 1080x1920 e mac-navegador;1440;900. Confira os contextos e proporções.
- Gere prévias reais com KVs de teste. Compare com as cópias em Photoshop. Confira transparência, máscaras, sobreposição e posições.
- Troque moldura, desligue guias, filtre e abra detalhes. As medidas e o arquivo-fonte devem permanecer iguais.
- Salve a folha HTML, abra sem internet e confira todos os formatos. Imprima em PDF, se necessário.
- Cancele uma fila de prévias; confira os pendentes e se alguma cópia temporária ficou aberta. Falha ao fechar é informada no cartão.
- Mude uma medida no painel: os cartões antigos devem desaparecer. Edite o PSD: gere novas prévias para atualizar.

Fontes técnicas: [Imaging API Adobe](https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging), [changelog Adobe](https://developer.adobe.com/photoshop/uxp/ps_reference/changelog/), [Google Ads: display enviado](https://support.google.com/google-ads/answer/1722096?hl=pt-BR).

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
