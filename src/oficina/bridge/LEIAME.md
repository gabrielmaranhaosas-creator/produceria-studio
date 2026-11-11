# Produceria Bridge · plugin para Photoshop (v0.1)

Ponte entre o PRODUCERia Studio e a mesa do arte-finalista.

## O que faz
- **Pré-checagem**: confere o documento ativo (modo de cor, perfil, resolução, formato com sangria, camadas ocultas, textos vivos, objetos inteligentes) contra a ficha técnica do pacote do job.
- **Desdobrar**: a partir do KV mestre, gera um PSD base para cada formato do pacote (escala sem distorcer e corte pelo centro). É ponto de partida; a composição de cada formato segue manual.
- **Exportar**: salva a prova em JPG com o nome no padrão do Studio, para enviar em Aprovação.
- **Upscale**: amplia a imagem pela API do Magnific (chave própria, custo por imagem) e abre o resultado como documento novo.

## Como instalar (modo desenvolvedor)
1. Instale o **UXP Developer Tool** pela Creative Cloud (aba Todos os apps).
2. No Photoshop: Configurações › Plugins › marque "Ativar modo desenvolvedor"; reinicie.
3. No UXP Developer Tool: **Add Plugin** › escolha o `manifest.json` desta pasta › **Load**.
4. No Photoshop: Plugins › Produceria Bridge.

Para distribuir à equipe sem modo desenvolvedor, o UXP Developer Tool empacota em `.ccx` (Package), instalado com dois cliques.

## Pacote do job
Gerado no Studio (Oficina › Gráfica › "Baixar pacote do job"). Formato:
```json
{ "job": "Black Friday", "cliente": "Cliente", "ficha": { "larguraMm": 210, "alturaMm": 297, "sangriaMm": 3, "perfil": "PSO Coated v3", "dpiMin": 300, "processo": "offset" },
  "formatos": [ { "nome": "Feed", "largura": 1080, "altura": 1350, "unidade": "px", "dpi": 72 } ] }
```

## Limites desta versão
- Não foi testado dentro do Photoshop no ambiente em que foi escrito: teste primeiro numa cópia de arquivo.
- A checagem de perfil compara pelo nome do perfil; a conferência final de PDF/X, sobreimpressão e limite de tinta (TAC) é no Acrobat (Preflight) ou no fluxo da gráfica.
- O endpoint de consulta do Magnific (`GET /v1/ai/image-upscaler/{task_id}`) segue o padrão da API; se a Magnific mudar, ajuste em `main.js`.
- Firefly Services (Expand, Fill, Photoshop API) exige credencial corporativa Adobe (OAuth servidor-a-servidor) e cobra por operação: fica para a v0.2, por um servidor intermediário, para a chave não ficar no plugin.
