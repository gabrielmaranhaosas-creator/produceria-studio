# Desdobra KV 1.4 — Galeria e simulação de saídas

Referência: gravação de 84,4 s enviada em 16/11/2026. O vídeo exibe um demonstrativo do Smart Resize: dois KVs, leitura de camadas, lista colada de dimensões, geração sequencial, barra de progresso e pastas de PSDs e imagens. Isso documenta o comportamento mostrado, sem revelar seu código ou garantir a qualidade do motor comercial.

O pedido adicional foi um display simulando saídas para Google, Mac e outros. Mac foi tratado literalmente como cenário de computador. Meta foi incluído separadamente, sem presumir que uma palavra substituía a outra.

## Entrega implementada

| Necessidade | Implementação |
|---|---|
| Carregar masters de orientações diferentes | Seleção dos documentos já abertos, existente na 1.3 |
| Identificar elementos | Heurística pelo nome/tipo e mapa manual; sem reconhecimento visual |
| Colar medidas e gerar em lote | Parser e fila da 1.3, com barra e estados visuais na 1.4 |
| Antecipar a composição | Esquema por bounds e papéis, sem mutação de documentos |
| Ver a arte adaptada antes de exportar | Cópia temporária, transformação e miniatura pela Imaging API opcional |
| Simular a saída | Molduras aproximadas Google Display, Meta, Mac/computador, celular e vídeo/DOOH |
| Conferir os formatos | Filtros, peça isolada, troca de moldura, guias do job e detalhe |
| Compartilhar revisão | HTML autossuficiente, sem scripts, com imagens incorporadas e impressão pelo navegador |

## Cuidados de implementação

- O esquema usa o mesmo plano geométrico enviado ao adaptador. Nos modos globais, os bounds acompanham as dimensões efetivas e a âncora do corte.
- A miniatura real é capturada depois da transformação na cópia, antes de fechar. Não há rasterização do KV-fonte para simular um reposicionamento que não aconteceu.
- A API opcional é detectada por capacidade. O modo de prévias exige a API; a geração de artes pode seguir se só a miniatura falhar.
- A miniatura usa sRGB/8 e fundo branco apenas na leitura de pixels. Fonte e saídas mantêm o tratamento anterior de cor.
- `dispose()` é executado mesmo se a codificação falhar. O maior lado da miniatura é limitado a 440 px. Cópias temporárias são fechadas no `finally`; falhas de fechamento são informadas.
- A leitura respeita `sourceBounds` e o nível da pirâmide retornado pela API, evitando esticar conteúdo recortado sobre áreas originalmente transparentes.
- Alterações de parâmetros invalidam a galeria. Mudanças externas ao painel não têm monitoramento em tempo real; uma captura não equivale ao estado atual do PSD.
- Os estados de revisão nunca se tornam aprovação. HTML exportado inclui todos os itens, inclusive os ocultos por filtros, e distingue esquemas de pixels.
- Nomes/avisos são escapados. Imagens aceitam apenas JPEG base64 local na folha de revisão. Não há rede ou tracking no HTML.
- Miniaturas ficam na sessão e no HTML explicitamente salvo; não entram no JSON de checkpoint.

## Limites

Não há reconstrução semântica por IA, reflow de texto, expansão generativa, importação de PSD fechado ou reprodução exata da plataforma de anúncios. Mac e celular são contextos de tela. Os tamanhos de viewport são exemplos, não especificações de modelos Apple. As interfaces simuladas não são versões oficiais de Google/Meta/Apple.

Nenhuma execução deste desenvolvimento ocorreu no Photoshop. A validação automatizada usa host simulado e navegador, não substituindo homologação na estação Adobe. O teste real deve comparar a miniatura com o PSD, incluindo transparência, máscara, smart object, efeito, fontes e cor.

## Fontes verificadas em 16/11/2026

- Adobe Imaging API: https://developer.adobe.com/photoshop/uxp/2022/ps-reference/media/imaging
- Adobe API Changelog: https://developer.adobe.com/photoshop/uxp/ps_reference/changelog/
- Google Ads, especificações de anúncios de display enviados: https://support.google.com/google-ads/answer/1722096?hl=pt-BR

O pacote Google contém dez dimensões presentes na fonte oficial. Essa checagem não certifica peso de arquivo, política, região ou elegibilidade de campanha. Meta/Mac/celular são exemplos editáveis internos. Os requisitos de mídia do job continuam determinantes.
