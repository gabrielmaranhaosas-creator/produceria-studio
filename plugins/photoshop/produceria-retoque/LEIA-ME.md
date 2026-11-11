# Produceria Retoque Rápido (v1.1.0)

Três atalhos para o retoque: montar a estrutura de camadas, comparar antes e depois, salvar nova versão.

## Como carregar
Descompacte; no UXP Developer Tool: Add Plugin > manifest.json > Load. Painel em Plug-ins > Retoque Rápido.

## Botões
1. Montar estrutura de retoque: cria o grupo RETOQUE com Limpeza (carimbo), Dodge e Burn (Soft Light preenchidas com cinza neutro) e Cor (ajuste). Não cria nada se o grupo já existir.
2. Ver antes / depois: liga e desliga o grupo RETOQUE para a direção de arte comparar.
3. Salvar nova versão (v+1): sugere o nome com o número de versão seguinte (CLI_camp_formato_v03.psd vira v04) e salva uma cópia. O arquivo aberto não muda.
4. Separação de frequência (v1.1, experimental): cria Baixa (cor e tom) e Alta (textura, Luz Linear) a partir da camada ativa, num grupo próprio.

## Limites conhecidos
- O grupo é criado acima da camada ativa; confira a ordem das camadas.
- Separação de frequência (botão 4, experimental desde a v1.1): só em RGB. Confira que, com as duas camadas ligadas, a imagem fica idêntica à original.
- Não foi testado dentro do Photoshop; a regra de versão foi testada com dados simulados.
