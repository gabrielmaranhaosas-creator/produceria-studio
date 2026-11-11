# Navegação, voltar e desfazer

Diagnóstico feito em 11/11/2026, depois de a equipe excluir algo e não conseguir voltar.

## O que estava errado

| Problema | Onde | Efeito |
|---|---|---|
| Sem Desfazer | todas as telas novas (Fases 2 e 3) | o Studio antigo tinha a barra "Desfazer" (Ctrl+Z); ela não foi trazida para as telas novas |
| Exclusão definitiva sem rastro | Casos, Mapa de contas, Funil, SWOT, Estratégias, Frentes, Ofertas, Gráfica, Cotações, Biblioteca, exemplos | apagou, perdeu: só o backup semanal recuperava |
| Descartar alvo sumia de vez | Captação | o alvo descartado não aparecia em lugar nenhum e não havia como reabrir |
| Abas fora do endereço | Licitações, Captação, Vencedores, Contas e agências, Bancada | o Voltar do navegador saía da tela inteira em vez de voltar para a aba anterior; não dava para mandar o link de uma aba |
| Poucos atalhos e nenhuma ajuda | todo o Studio | só existia Ctrl+K, e nada explicava como voltar |
| Confirmação discreta | botões de excluir | o segundo clique em até 4 s confirma; fácil de não perceber que já confirmou |

## O que foi feito

- **Histórico na camada de dados** (`src/lib/historico.ts`): toda gravação das telas guarda o estado anterior.
  Barra "Desfazer" depois de cada alteração; **Ctrl+Z** desfaz e **Ctrl+Shift+Z** (ou Ctrl+Y) refaz, fora de
  campos de texto. Vale para todas as telas de uma vez, porque está no `banco()`.
- **Lixeira** (Gestão › Lixeira, coleção `lixeira`): toda exclusão guarda uma cópia completa antes de apagar.
  Qualquer pessoa da equipe restaura, mesmo depois de recarregar a página. Itens com mais de 90 dias podem ser
  apagados de vez (com confirmação).
- **Captação · Descartados**: o filtro "Descartados" lista os alvos descartados com o motivo, e **Reabrir** os devolve
  para a coluna Mapeado.
- **Abas no endereço** (`abaNoEndereco` em `src/paginas/dom.ts`): `#b2g/pca`, `#captacao/achar`, `#vencedores/orgaos`
  etc. O Voltar do navegador volta para a aba anterior, e o link abre direto na aba.
- **Ajuda e atalhos**: tecla **?** (ou "Atalhos e como voltar" no menu) explica Ctrl+K, Ctrl+Z, Voltar, Esc e onde
  achar a Lixeira e os descartados.

## Onde cada coisa volta

| Ação | Como desfazer |
|---|---|
| Apagou qualquer item | Desfazer na hora, ou Gestão › Lixeira › Restaurar |
| Editou um campo | Desfazer (Ctrl+Z) logo em seguida |
| Descartou um alvo | Captação › Descartados › Reabrir |
| Descartou uma licitação | Licitações › Radar › filtro "Descartadas" › Desfazer |
| Marcou oportunidade como perdida | Funil › Perdidas › Reabrir |
| Moveu de etapa | botão da etapa anterior no cartão |
| Mudou a situação de um requisito da habilitação | clicar de novo na situação (ela alterna) |

## Limites e próximos passos

- O Desfazer vale para a sessão aberta (até 50 passos). Depois de recarregar, só a Lixeira recupera exclusões;
  edições antigas dependem do backup semanal.
- Gravações feitas pelas rotinas do Claude não entram no Desfazer.
- Ainda falta: filtros no endereço (busca, frente, UF), o Voltar do navegador fechar janelas abertas, e uma trilha
  ("Comercial › Licitações › PCA") clicável no topo de cada tela.
