# Produceria Textos (v1.0.0)

Painel do Photoshop para a revisão de texto: exporta os textos das camadas para um CSV, a revisão de texto confere no Excel, e o painel reaplica os textos corrigidos.

## Como carregar (teste)
Descompacte o .zip; no UXP Developer Tool use Add Plugin > manifest.json > Load. Painel em Plug-ins > Textos (revisão).

## Fluxo
1. Abra o PSD (trabalhe numa CÓPIA). Clique em "Exportar textos (CSV)" e salve o arquivo.
2. Entregue o CSV para a revisão. Regras para quem revisa: editar SOMENTE a coluna texto_revisado; deixar em branco o que não muda; manter \n onde houver quebra de linha; não mexer nas outras colunas; salvar como CSV UTF-8.
3. Abra o(s) PSD(s) de novo, clique em "Aplicar CSV revisado" e escolha o arquivo.
4. Confira cada texto alterado na tela.

## Segurança embutida
- Só altera a camada se o texto atual ainda é igual ao texto original exportado.
- Linhas com texto_revisado vazio ou igual ao original são ignoradas.
- Documento fechado, camada inexistente ou erro: a linha é pulada e aparece no relatório.

## Limites conhecidos
- Camada com várias formatações (negrito no meio da frase etc.) pode perder a formatação interna ao receber o texto novo.
- Texto dentro de Smart Objects não é lido.
- Não foi testado dentro do Photoshop; a leitura e escrita do CSV foram testadas com dados simulados.
