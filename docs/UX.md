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

## Investigação: reação em cadeia da prospecção (17/11/2026)

Tela em Comercial, logo abaixo do Big Data (`#investigacao`), no estilo de um mural de investigação (fundo escuro, fichas de papel, fios vermelhos, carimbo "Extinta"). Não é um retrato da equipe: é o mapa da prospecção, que parte de um ponto e abre ramificações até chegar a empresas, agências e pessoas que ainda não estão no radar.

- **Universo:** junta numa rede só tudo o que o Big Data sabe. Contas e movimentações (`base_mercado` e `movimentos`), anunciantes e agências (`mapa_empresas`, `mapa_agencias`, com critérios do "fora do radar"), quem trabalha onde e por onde passou (`mapa_pessoas`, campo `trajetoria`), a extinta e a herdeira (`perfil: 'extinta'`, `sucessora`) e as pontes da PRODUCERIA (`conexao` com "Ponte PRODUCERIA" e notas que citam a equipe). Quando o cargo de alguém cita uma conta do mapa ("Gerente de Projetos – Natura & Avon"), a pessoa também liga a essa conta.
- **Ponto zero e ramificações:** a PRODUCERIA abre as casas onde temos ponte. Cada ramificação seguinte traz os vizinhos ainda não vistos: clientes da agência, outras agências do cliente, quem trabalha lá, a herdeira da extinta. Só os ramos mais fortes seguem abrindo (10, 14 e 18 por ramificação, ou o dobro em "Ampla"), com no máximo 60% de pessoas para a reação continuar abrindo casas.
- **Força:** cada ponto tem uma nota de possibilidade de negócio, sempre explicada por fatos com fonte: contrata produção, conta nova ou mudança de agência nos últimos 120 dias, encaixe do craft, grande anunciante, agência independente, portas que contratam, ponte com a PRODUCERIA. A força soma ainda quantos caminhos chegam no ponto e desconta a distância.
- **Partir de qualquer ponto:** busca por nome ou "Abrir a reação a partir daqui" no dossiê; o rastro guarda os pontos de partida.
- **Radar de prospecção:** ranking da reação com o caminho de cada ponto, filtros (empresas e agências, pessoas, "sem ponte ainda") e o botão "Pôr no radar", que cria o alvo na Captação (coluna Mapeado) com o caminho e os gatilhos.
- **Gráficos:** mais fortes, possibilidades por ramificação, por tipo e por gatilho. O rastro das agências extintas continua no fim da tela.
- No celular as colunas empilham e os fios saem; o dossiê mostra o caminho.

Lógica em `src/lib/investigacao.ts` (`montarUniverso`, `reacao`, `caminho`, `leads`; testada em `tests/investigacao.test.ts`), tela em `src/paginas/investigacao.ts`, visual em `src/estilos/investigacao.css`. Com a base de 17/11: 571 pontos no mapa (349 organizações, 222 pessoas); a partir da PRODUCERIA, 32 possibilidades em 3 ramificações.

### Coleta da reação no LinkedIn (17/11/2026)

Primeira rodada de coleta seguindo as ramificações, só leitura no LinkedIn (sem convite, seguir ou mensagem): busca de pessoas filtrada pela empresa atual, ficando só com quem pede ou aprova produção (produção, RTV, art buyer, atendimento, projetos, operações; nos anunciantes, marketing, marca, trade e conteúdo). Perfis ocultos, estagiários, mídia, criação e quem está hoje em outra casa ficam de fora. Cada pessoa entra em `mapa_pessoas` com o link do perfil como fonte.

- 1ª ramificação: 34 pessoas em Artplan, Lola\TBWA, AlmapBBDO, Suno United Creators, WMcCann e VML.
- 2ª ramificação: 19 pessoas em Heineken, Localiza, Petrobras, Bling e Natura e Avon.
- Resultado: o mapa passou de 571 para 624 pontos, e o radar "sem ponte ainda" ganhou portas que contratam em Heineken e Localiza.
- Resto da 1ª ramificação: 18 pessoas em YouDare, Fbiz e Publicis Production. DeBrito não devolveu ninguém de produção ou atendimento; Philip Morris não tem página própria com filtro de empresa e a busca por palavra não achou ninguém; Nova/SB não tem página no LinkedIn.
- 3ª ramificação: 4 pessoas na Ogilvy (produção, RTVC e atendimento) e 5 em marketing e marca na QuintoAndar.
- Resultado: 648 pontos. Abrindo a reação na Fbiz, a cadeia chega à QuintoAndar; abrindo na Ogilvy, chega à Petrobras.
- 4ª ramificação: 12 pessoas em Brasilcap (comunicação), Cacau Show (trade marketing), Keeta (marca e marketing) e WT.AG (produção gráfica e atendimento). Leo Burnett, We e Governo de São Paulo ficaram sem nome: a Leo não tem página com filtro de empresa, "We" é um nome ambíguo demais para a busca, e no governo a compra passa por licitação, que tem tela própria.
- Resultado: 661 pontos. A cadeia PRODUCERIA → Suno → Keeta → WT.AG chega a quem atende a Keeta; Cacau Show e Brasilcap ficam na 5ª, e aparecem quando a reação parte delas.

O quadro passou a abrir 4 ramificações (17/11/2026): a 4ª coluna mostra até 14 ramos no modo Essencial (25 no Ampla). Para os cartões não espremerem, o quadro tem largura mínima de uns 186px por ramificação e rola de lado quando a tela é estreita. No celular as colunas continuam empilhadas. Com a base de hoje, a partir da PRODUCERIA são 50 possibilidades em 4 ramificações, e a 4ª traz Cacau Show, WT.AG, We e quem atende a Keeta.

## Visualização: telas que cabem na tela (17/11/2026)

Diagnóstico feito a partir de uma gravação de tela da Investigação e de um passeio pelas telas do Comercial, medindo quantas telas de rolagem cada uma ocupa (a 1440×860):

- Investigação: 8,8 telas. O quadro era uma parede escura de 2.600px com colunas de alturas desiguais (a 4ª ramificação descia sozinha sobre um fundo vazio), e o dossiê abria embaixo do quadro, longe do clique: quem clicava num cartão não via o resultado. O tema de mural (faixa zebrada amarela e preta, fios vermelhos, papel envelhecido) destoava do resto do Studio, que é monocromático.
- Captação: 9,8 telas. A coluna "Mapeado" do quadro de etapas empilhava 37 cartões (7.500px) enquanto as outras ficavam vazias.
- Contas e agências: 15,7 telas. As 148 movimentações apareciam todas de uma vez.

O que mudou:

- Investigação na identidade do Studio: só preto, cinzas, linhas e off-white, sem a faixa zebrada nem o vermelho. Cartões brancos e compactos (tipo, nome, cargo, um gatilho e a força); agência tem filete preto, anunciante filete cinza, extinta tracejada e riscada.
- O quadro ocupa uma tela e rola por dentro, para baixo e para os lados, com o título de cada ramificação preso no topo.
- O dossiê abre ao lado do quadro, junto do clique, com botão de fechar (e Esc). Em telas médias e no celular ele sobe como uma folha presa ao pé da tela.
- O radar de prospecção mostra 10 possibilidades por vez, com "Mostrar mais".
- Os quadros de etapas (Captação, Licitações e Funil) passaram a ter colunas que rolam por dentro, com o título da etapa preso no topo.
- Contas e agências mostra 30 movimentações (ou agências) por vez, com "Mostrar mais".
- Resultado: Investigação de 8,8 para 4,6 telas, Captação de 9,8 para 1,9 e Contas e agências de 15,7 para 5,7.

Oficina e Gestão (18/11/2026), com a mesma medida: nenhuma tela passa de 2,6 telas de rolagem no computador, nenhuma usa cor fora da paleta e nenhuma rola de lado no celular. No celular, Gráfica (5,8 telas) e Plugins (5,4) são as mais longas, por serem formulários e fichas; ficam como estão. Ateliê e Agentes somem do menu na cópia de consulta de propósito, por dependerem da IA.

Biblioteca e Casos passaram da Oficina para a Gestão (18/11/2026): saem das abas da Oficina e do bloco da Oficina no Início, entram no menu da Gestão entre a Tabela de serviços e a Lixeira, com o rótulo "Gestão · Biblioteca" e "Gestão · Casos". A Oficina deve virar um projeto próprio mais adiante.
