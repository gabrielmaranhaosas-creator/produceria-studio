# Produceria Prova (v1.0.0)

Painel do Photoshop que gera o JPG de prova para o cliente aprovar: cópia achatada e reduzida, marca d'água
("PROVA · NÃO APROVADO") e uma linha de identificação no rodapé (cliente · campanha · versão · data).

## Como carregar
Duplo clique no .ccx, ou no UXP Developer Tool: Add Plugin > manifest.json > Load. Painel em Plug-ins > Prova para aprovação.
Precisa do Photoshop 2023 (v24.2) ou mais novo.

## Uso
1. Abra o PSD. 2. Preencha cliente e campanha (a versão sai do nome do arquivo: _v03 vira v03).
3. Ajuste a marca d'água, a opacidade e o tamanho máximo (2000 px é bom para e-mail e WhatsApp).
4. Escolha a pasta e clique em Gerar prova. Marque "Todos os documentos abertos" para a desdobra inteira.

## Regras
- Trabalha numa cópia: o documento aberto não muda e a cópia é fechada sem salvar.
- Nome de saída: nome do documento + _PROVA.jpg (sobrescreve uma prova anterior com o mesmo nome).

## Limites conhecidos
- A marca d'água usa a fonte padrão do Photoshop; o tamanho é proporcional ao menor lado.
- Não foi testado dentro do Photoshop; as regras de nome, versão e tamanho foram testadas com dados simulados.
