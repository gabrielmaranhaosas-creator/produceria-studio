# Produceria Checar Arquivo (v1.0.0)

Painel do Photoshop que lê o documento aberto e lista problemas de arte-final. Não altera o arquivo.

## Como carregar (teste)
1. Descompacte o .zip numa pasta, por exemplo Documentos/produceria-plugins.
2. Abra o Photoshop e o UXP Developer Tool (Creative Cloud).
3. No UXP Developer Tool: Add Plugin e escolha o arquivo manifest.json desta pasta.
4. Clique em Load. O painel aparece em Plug-ins > Checar Arquivo.
5. Abra um PSD, escolha o destino (Impressão ou Digital) e clique em Checar arquivo.

## O que verifica
Nome do arquivo (CLIENTE_campanha_formato_v01), modo de cor, perfil, resolução, camadas de texto, fontes instaladas, camadas ocultas e nomes padrão de camada. Sangria e revisão de texto aparecem como lembrete manual.

## Limites conhecidos
- Não detecta texto rasterizado; só avisa quando não há nenhuma camada de texto.
- A checagem de fontes pode falhar em algumas versões; nesse caso o painel avisa.
- Não foi testado dentro do Photoshop pela autora; a lógica das regras foi testada com dados simulados (teste_checks.js).

## Se der erro
Copie a mensagem do painel e a versão do Photoshop e envie para ajuste.
