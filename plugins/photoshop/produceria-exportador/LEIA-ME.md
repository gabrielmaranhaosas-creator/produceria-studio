# Produceria Exportador (v1.0.0)

Painel do Photoshop que exporta o documento aberto (ou todos os abertos) para PNG, JPG e PDF numa pasta, com nome padronizado. Exporta cópias: o arquivo aberto não muda.

## Como carregar (teste)
1. Descompacte o .zip. 2. Abra o Photoshop e o UXP Developer Tool.
3. Add Plugin > escolha manifest.json desta pasta > Load.
4. Painel em Plug-ins > Exportador.

## Como usar
1. Marque os formatos. 2. Ajuste a qualidade do JPG (padrão 10). 3. Marque "Todos os documentos abertos" se quiser a desdobra inteira.
4. Escolha a pasta de saída. 5. Clique em Exportar e confira a lista.

## Regras
- O nome do arquivo de saída é o nome do documento, sem espaços nem caracteres proibidos.
- Se dois documentos tiverem o mesmo nome, o segundo recebe -2, -3 etc.: nunca sobrescreve.
- Aviso quando o nome do documento não segue CLIENTE_campanha_formato_v01.

## Limites conhecidos
- Não converte perfil de cor: PNG e JPG saem no modo do documento. Para tela, use RGB.
- Opções do PDF são as padrão do Photoshop; para gráfica, confirme com o produtor gráfico.
- Não foi testado dentro do Photoshop; a lógica de nomes foi testada com dados simulados.
