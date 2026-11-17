# Experiência de uso do Studio: diagnóstico e ações (17/11/2026)

Percurso feito tela a tela no Studio montado com os dados reais (exportação do banco), medindo o que a pessoa vê ao abrir cada busca, quantos cliques leva até a lista completa e quanto tempo cada tela leva.

## O que estava atrapalhando

| Problema | Onde | Efeito |
|---|---|---|
| Filtros padrão escondiam a maior parte da base | Central (30 dias, sem renovações nem licitações fracas), Contas e agências (6 meses e "só criação"), Vencedores ("só vigentes"), Alertas ("novos e em andamento"), Licitações (nota 60+ e só abertas) | A pessoa abria a busca e via uma fração do que existe: 60 movimentações de conta, 92 de 959 sinais na Central, no máximo 238 das 1.308 licitações. Parecia que faltava dado. |
| Nenhum gráfico nas telas de busca | Central, Alertas, Big Data, Contas e agências, Vencedores, Captação | Para entender o todo (quais classes pesam mais, quem lidera, como evolui no tempo) era preciso rolar a lista inteira. |
| Lista única por data, sem classes | Central | Contas, negócios, licitações e renovações ficavam misturados; o ranking por relevância não existia. |
| Base relida a cada troca de tela | Vencedores, Central, Contas e agências, Big Data | No claude.ai cada visita relia do banco cerca de 57 documentos (~13 MB). Voltar a uma tela custava o mesmo que abrir pela primeira vez. |
| Quadro da Captação cortado em 6 por coluna | Captação | Alvos ficavam escondidos atrás de "mostrar mais". |
| Caixa "Só criação e full service" e "Só vigentes" desproporcional | Contas e agências, Vencedores | A caixa de marcar ocupava a largura inteira. |

## O que mudou

1. **Lista completa ao abrir.** Todas as buscas abrem com tudo o que temos: Central em "Tudo o que temos", Contas e agências "Desde 2025" e todos os tipos de agência, Vencedores com encerrados, Alertas em "Todos", Licitações sem os filtros de nota e prazo. Os filtros continuam lá para restringir.
2. **Classes e ranking.** A Central abre organizada por classe (Contas, Negócios, Licitações vencidas, Licitações abertas, Renovações à vista), cada uma com os 6 primeiros em ranking por relevância, valor e data e o botão "ver as N em ranking". O seletor "Organizar" volta à visão por data. As demais telas já ordenam por prioridade, nota ou valor.
3. **Painel visual em cada busca.** Um mesmo componente (`barras`, `porMes`, `contar`, `painel` em `src/componentes`) monta, acima de cada lista:
   - Central: sinais por classe, sinais por mês e empresas com mais sinais.
   - Alertas: por tipo, alertas por mês, empresas mais citadas e situação.
   - Big Data: por setor, agências ligadas, portas de entrada, encaixe do craft, por nível e organizações com mais pessoas, conforme a visão.
   - Contas e agências: movimentações por mês, agências que mais ganharam conta, tipo de agência, por estado e o ranking de investimento dos anunciantes.
   - Vencedores: valor por frente, valor por estado e maiores vencedores ou órgãos.
   - Captação: funil por etapa, por perfil e origem dos alvos.
   - Licitações e Mapa de contas já tinham gráficos; ficaram como estavam.
4. **Gráfico que filtra.** Clicar numa barra aplica o filtro (classe, frente, estado, tipo, perfil ou busca pela empresa) e clicar de novo desfaz. Barras de empresa abrem a ficha.
5. **Rapidez.** A base lida do banco fica em memória durante a visita (`lerBase` em `src/lib/db.ts`): a segunda visita a Vencedores, Central, Contas e Big Data não relê o banco.
6. **Quadro da Captação inteiro** por padrão, com "Recolher" por coluna.

## Números depois da mudança (base de 17/11)

- Central: 959 sinais visíveis ao abrir (antes 92), em 5 classes.
- Contas e agências: 148 movimentações (antes 60).
- Licitações: em ranking por nota, só no escopo do hub (ver ajuste abaixo).
- Página publicada: 822 KB, abaixo do limite de 870 KB da revisão de compartilhamento.

## Ajuste do mesmo dia: precisão em vez de volume

- Licitações voltou a abrir só no **escopo do hub** (nota 45+ ou já trabalhada pela equipe). As fora do escopo ficam num chip próprio, para revisar; novo chip **Compra direta** (dispensa e inexigibilidade).
- Central e Alertas separam **agências e fornecedores** (quem atende) de **anunciantes e órgãos** (quem compra) em dois gráficos, em vez de uma lista única de empresas. A base não tem campo de produto nem de marca à parte do anunciante.

## Próximos passos possíveis

- Levar o mesmo painel para Agenda e Funil, se a equipe sentir falta.
- Medir no claude.ai o tempo da primeira abertura de Vencedores (a leitura em blocos depende do banco, não da página).
