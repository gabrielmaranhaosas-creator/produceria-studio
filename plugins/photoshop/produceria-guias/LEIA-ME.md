# Produceria Guias (v1.1.0)

Painel do Photoshop que cria as guias da arte-final no documento aberto: corte e margem de segurança em milímetros,
centro, terços, área segura de stories e colunas. Não mexe nos pixels.

## Como carregar
Duplo clique no .ccx, ou no UXP Developer Tool: Add Plugin > manifest.json > Load. Painel em Plug-ins > Guias e áreas seguras.

## Uso
1. Abra o documento. 2. Marque os tipos de guia e ajuste as medidas. 3. Clique em Criar guias. 4. A lista mostra cada guia e o motivo.

## Regras
- Milímetros viram pixels pelo ppi do documento (Imagem > Tamanho da imagem). Em 72 ppi, 3 mm são só 9 px.
- "O documento já inclui a sangria": a guia de corte fica a 3 mm da borda e a de segurança a 3 + 5 mm. Desmarcado: só a de segurança.
- Stories: 14% no topo e na base é um exemplo editável; confira o placement e o spec do job.

## Limites conhecidos
- Não desenha marcas de corte para a gráfica: isso sai no PDF de impressão.
- Não foi testado dentro do Photoshop; os cálculos foram testados com dados simulados.

## Área segura do job — 1.1.0

A opção assimétrica aceita topo, base, esquerda e direita em percentuais independentes. Use os mesmos valores escolhidos na adaptação do Desdobra. Margens que eliminam a área útil geram erro antes da alteração das guias. Os valores iniciais e o preset Stories são exemplos a confirmar no plano de mídia, não especificações universais de plataforma. Homologação visual no Photoshop permanece pendente.
