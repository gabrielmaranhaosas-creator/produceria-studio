# Validação da adaptação de campanhas — 16/11/2026

Base: `1db73c9aaf68a124cd760a0391a84bd698b24c40`, repositório PRODUCERIA Studio.

## Resultado local

| Verificação | Resultado |
|---|---|
| TypeScript (`npm run typecheck`) | Aprovado |
| Vitest (`npm test`) | 165 testes aprovados em 11 arquivos |
| Python (`npm run test:cerebro`) | 27 testes aprovados: 17 + 5 + 5 |
| Build (`npm run build`) | Aprovado; gera `dist/index.html` |
| Diff (`git diff --check`) | Sem erros |
| Execução do plugin no Photoshop | Não realizada neste ambiente |
| Qualidade visual em PSDs reais | Pendente de homologação |

Comando completo executado: `npm run check`. Ambiente local: Node 24.22.1. A configuração de CI do repositório usa Node 22; o status remoto é independente deste registro.

O conjunto inicial tinha 144 testes Vitest. Foram acrescentados 21 casos: 18 de regras/execução e 3 de interação com DOM simulado. Fixtures do roteiro foram atualizadas para as novas versões dos plugins.

## Cobertura nova

- Classificação em português, palavras inteiras, ambiguidade e escolha manual.
- Seleção de fonte por proporção, limites e margens assimétricas.
- Ausência de deformação do logo no plano geométrico.
- Detecção de textos divergentes e papéis críticos ausentes entre mestres.
- Detecção de fonte alterada pela estrutura e pelo histórico quando disponível.
- Invalidação de papéis manuais se a estrutura da fonte mudar.
- Bloqueio de dimensões parcialmente numéricas em listas de formatos.
- Preservação de fonte no adaptador simulado e uso das camadas da cópia.
- Expansão do canvas antes da transformação e recorte somente no final.
- Falha, cancelamento, checkpoint e retenção dos caminhos de saídas parciais.
- Não sobrescrita e remoção de placeholder incompleto na simulação de exportação.
- Restrição de exportação web a RGB/8 sem conversão silenciosa.
- Consistência entre margens do Desdobra e guias assimétricas.
- Conferência de dimensões digitais do job sem reprovação por PPI isolado.
- Diagnóstico sem mutação e tratamento seguro dos nomes no DOM.

Os testes não verificam instalação UXP, fidelidade de fontes/efeitos/máscaras, performance real, renderização nativa ou aprovação criativa. O roteiro de homologação está no estudo e no catálogo de testes do Studio.

Um ResourceWarning de arquivo aberto apareceu no teste Python de PCA, sem falha dos testes. Esse aviso pertence ao código preexistente e não foi alterado nesta entrega.
