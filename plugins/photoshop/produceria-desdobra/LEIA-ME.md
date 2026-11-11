# Produceria Desdobra KV (v1.1.0)

Cria, a partir do KV aberto, uma cópia para cada formato (stories, feed, banners...) já com o nome no padrão CLIENTE_campanha_formato_v01. É a base da desdobra: depois o arte-finalista ajusta o que exige olho.

## Como carregar
Descompacte; no UXP Developer Tool: Add Plugin > manifest.json > Load. Painel em Plug-ins > Desdobra KV.

## Uso
1. Abra o PSD do KV. 2. Preencha cliente, campanha e versão.
3. Escolha "Cobrir" (preenche o formato e corta o excesso) ou "Conter" (mostra tudo) e o ponto de foco do corte.
4. Edite a lista de formatos se precisar, uma linha por formato: nome;largura;altura, ou medidas como 1920x1080 e 29,7x32 cm (cm e mm viram pixels pelo ppi do documento).
5. Opcional: marque "Salvar um PSD de cada formato". Por padrão os PSD vão para a pasta "desdobra" ao lado do arquivo aberto (o PSD precisa estar salvo); ou escolha uma pasta. 6. Clique em Desdobrar.

## Limites conhecidos
- Reescala e corta o documento inteiro; não reposiciona logo, texto ou elementos por regra. Em formatos muito diferentes (ex.: banner 728x90 a partir de um KV vertical) o resultado é só um ponto de partida.
- Avisa quando a ampliação passa de 2x.
- Funciona em um documento por vez; o original não é alterado.
- Não foi testado dentro do Photoshop; os cálculos e a leitura da lista foram testados com dados simulados.
