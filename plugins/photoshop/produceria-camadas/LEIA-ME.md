# Produceria Camadas (v1.0.0)

Painel do Photoshop para deixar as camadas prontas para a entrega: renomear em lote, localizar e substituir,
prefixos por tipo (padrão da casa) e um relatório do que falta arrumar.

## Como carregar
Duplo clique no .ccx, ou no UXP Developer Tool: Add Plugin > manifest.json > Load. Painel em Plug-ins > Camadas (nomes).

## Uso
1. Escolha "Camadas selecionadas" (selecione no painel Camadas com Cmd/Ctrl + clique) ou "Todas".
2. Renomear em lote: padrão com {nome} e {n}. Ex.: "TXT_{n}" vira TXT_01, TXT_02...
3. Localizar e substituir: troca um trecho literal em todos os nomes (ex.: apagar "cópia").
4. Prefixos por tipo: TXT_, IMG_, GRP_, SO_, VET_, COR_, AJ_. Não repete prefixo que já existe.
5. Relatório: lista camadas com nome padrão ("Camada 1", "Layer 2 copy"), vazias e ocultas.

## Regras
- Só muda nomes: não move, não apaga e não altera pixels. Ctrl/Cmd + Z desfaz.
- O Plano de fundo nunca é renomeado no modo "Todas".

## Limites conhecidos
- Não foi testado dentro do Photoshop; as regras de nome foram testadas com dados simulados.
