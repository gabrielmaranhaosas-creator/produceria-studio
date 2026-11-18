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

A Oficina saiu do Studio (18/11/2026), que passa a ser só Comercial e Gestão. Bancada, Gráfica, Plugins, Agentes, Ateliê, Desdobramento, Conferência e Retoque saem do menu, da busca Ctrl K e do pacote publicado (de 860 KB para 680 KB). O código delas continua no repositório, com os testes, para virar um projeto próprio. Endereços antigos como #grafica abrem o Início. O Início se chama "Comercial e Gestão": o bloco lateral da Oficina virou "Gestão · A casa em ordem" (rotinas, tabela, biblioteca, casos), os atalhos de venda ganharam "Seguir uma pista" na Investigação, e o indicador da Biblioteca conta casos do portfólio em vez de fichas da Gráfica.

Investigação viva, fase 1 (18/11/2026): o mapa passa a mostrar o que a coleta diária trouxe.
- No topo fica a faixa "Hoje no mapa". Ela mostra as pessoas da coleta mais recente e as trocas de conta mais recentes, cada uma com a sua data. Um ponto pulsa enquanto houver novidade não vista, e a faixa avisa quando a coleta para de trazer pessoas há mais de 2 dias.
- Na chegada, a reação abre pela troca de conta mais recente, se ela tiver até 7 dias. A PRODUCERIA fica no rastro para voltar. A semente é a casa da troca com mais nota e maior reação. Quem já mexeu no mapa não é levado para outro ponto quando chegam dados.
- Os pontos novos ganham a etiqueta "novo", com um anel que pulsa 3 vezes. A etiqueta some ao abrir o dossiê e a lembrança fica no navegador. O fio até um ponto novo fica em tinta, e o radar ganhou o filtro "Novos".
- Ao mudar o ponto de partida, a reação entra em cascata, uma ramificação por vez, e os fios se desenham. Quem pede menos movimento no sistema vê tudo parado.
- A linha do tempo "Chegadas por dia", de 7 ou 30 dias, mostra em barras as pessoas gravadas e em selos as trocas noticiadas. Clicar num dia põe o dia em foco: faixa, etiquetas e filtro passam a mostrar o que chegou nele.

### Multiverso ordenado e mapa para baixar (18/11/2026)

- **Quadro em ordem:** cada ramificação segue a ordem dos pais. Os filhos de um mesmo ponto ficam juntos, sob a linha "de AlmapBBDO", "de Localiza"…, e os fios correm quase retos em vez de se cruzarem. Quando um ponto chega por mais de um caminho, o fio principal fica forte e os outros ficam claros até o ponto ser escolhido. O título de cada coluna mostra "abertos de alcançáveis" (ex.: 14 de 117).
- **Tamanho do multiverso:** seção abaixo dos controles com uma barra por ramificação até onde as ligações alcançam (sem o corte da reação): abertos em preto, alcançáveis em cinza, e a linha "Fora de alcance" com os pontos que não têm ligação com o ponto de partida. Com a base de 18/11, a partir da PRODUCERIA: 221 dos 532 pontos em 6 ramificações (31, 117, 32, 21, 17 e 3) e 311 fora de alcance.
- **Baixar o mapa interativo:** gera um HTML único (cerca de 260 KB, sem rede, com as fontes da casa) com o multiverso inteiro em árvore radial: o ponto de partida no centro, uma volta por ramificação, cada ponto num arco proporcional ao que ele abre. Zoom pela roda ou pinça, arrasto, busca, dossiê com caminho, fatos e fontes, radar dos mais fortes, ramificações que se escondem, "Só a reação aberta", "Todas as ligações" e tema claro ou escuro. Pontos e rótulos mantêm o tamanho na tela em qualquer zoom.

Lógica em `multiverso`, `ordenarReacao` e `dadosDoArquivo` (`src/lib/investigacao.ts`, testadas em `tests/multiverso.test.ts`); o arquivo em `src/lib/mapa-arquivo.ts`, com o visor em `src/lib/mapa-visor.js` e `mapa-visor.css`.
Multiverso dentro da Investigação (18/11/2026). O mapa radial que circulava como arquivo solto tinha cinco problemas:
- o clique não abria o dossiê;
- o zoom fugia do cursor;
- os nomes ficavam girados e encavalados;
- 117 pontos se espremiam na 2ª volta;
- o desenho usava menos da metade do palco.

Agora ele é a visão padrão da Investigação, ao lado de "Colunas", e lê os dados vivos que a coleta diária alimenta:
- A semente fica no centro, com uma elipse por ramificação para usar a largura da tela. A 1ª volta sai afastada do centro.
- O mapa mostra só a reação aberta (Essencial ou Ampla), não o universo inteiro. Cada ponto fica perto de quem o trouxe.
- Os nomes ficam na horizontal. Aparecem os que cabem sem encavalar, com o caminho aceso primeiro e depois os mais fortes. Os demais aparecem ao passar o mouse. Ao aproximar, cabem mais nomes, que mantêm o tamanho de leitura.
- Clicar acende o caminho e os vizinhos, apaga o resto e abre o dossiê flutuando por cima do mapa. O mapa desliza para deixar o grupo aceso inteiro na parte livre.
- O arraste anda pelo mapa sem selecionar nada. A pinça, Ctrl + rolar e os botões aproximam no ponto do cursor. A rolagem comum continua rolando a página.
- Os pontos aceitam Tab e Enter.
- Os pontos novos pulsam, e na troca de ponto de partida as voltas entram uma por vez.
- Na cópia de consulta, o "+" do zoom deixa de ser escondido junto com os botões de gravar.

### Arquivo do Multiverso com o desenho novo (18/11/2026)

O HTML baixado pelo botão "Baixar o mapa interativo" passa a usar o mesmo desenho do Multiverso do Studio, no lugar da árvore radial com nomes girados:
- Elipses por ramificação, cada ponto perto de quem o trouxe. Cada volta ganha espaço conforme a quantidade de pontos, para a 2ª volta (117 pontos) não espremer as outras.
- Abre em "Só a reação aberta" (os 50 pontos mais fortes). "Multiverso inteiro" mostra os 221 alcançáveis.
- Os nomes ficam na horizontal, só os que cabem inteiros e sem encavalar: o caminho aceso primeiro, depois os da lista do radar e os mais fortes.
- O clique acende o caminho até o centro, os filhos e as outras ligações, abre o dossiê e desliza o mapa para o grupo caber. Escolher pela busca um ponto escondido pelo filtro mostra o multiverso inteiro.
- O arraste anda pelo mapa. Ctrl + rolar, a pinça e os botões aproximam em torno do cursor. A rolagem do trackpad também anda.
- Esconder uma ramificação redesenha as voltas que sobram.
- No celular, os pontos encolhem e a 1ª volta sai mais afastada do centro.

### Investigação: fora de alcance, nomes legíveis e tela inicial fixa (18/11/2026)

- A tela abre sempre pela PRODUCERIA. A troca de conta do dia (antes aberta sozinha, por exemplo Wigoo) fica a um clique em "Abrir a reação pela troca do dia", na faixa "Hoje no mapa".
- O botão "Fora de alcance" mostra no Multiverso os pontos sem ligação com o ponto de partida. Eles ficam numa volta própria, na borda, com a reação nos 80% de dentro. A escolha fica guardada. Clicar num desses pontos abre o dossiê e acende as ligações próprias dele. O arquivo baixado leva os mesmos pontos (g = -1) e tem o mesmo botão na lista de ramificações.
- Os nomes tentam quatro lugares: o lado de fora do mapa, o outro lado, acima e abaixo do ponto. A 1ª ramificação tem prioridade. Os nomes das voltas alternam entre topo e base e somem quando batem em outro nome. Depois da 1ª ramificação, os pontos também contam como obstáculo.
- Em "Tamanho do multiverso", as barras usam a escala das ramificações. O fora de alcance aparece em % do mapa, com o botão de mostrar. Os plurais foram revistos: "1 aberto", "todos abertos", "1 pessoa que pede", "contas novas ou mudanças".
- Controles em duas linhas: o rastro e a busca em cima; visão, abertura e fora de alcance embaixo, com o botão de baixar à direita.
- Big Data, Por setor: "Sem setor" saiu das barras. Ele achatava a escala e não filtrava nada. Agora vira nota com a contagem. A coluna do número tem largura fixa, para as barras alinharem, e o nome cortado mostra o texto inteiro ao passar o mouse.
- Licitações, Habilitação: o CNPJ e os CNAEs quebram linha (antes invadiam a coluna vizinha). Também entrou um respiro entre a tabela e os cartões.

### Investigação: Pontes para o que está longe (18/11/2026)

- Diagnóstico: os fora de alcance formam ilhas. São agências com o próprio pessoal e marcas com a sua agência, sem fio até a semente. Só 6 de 346 pessoas tinham trajetória. Os dados que já existiam ligam poucos pontos; a ponte depende de informação nova, com fonte.
- O motor passou a usar dois campos que estavam parados. A campanha da pessoa ("Marca · campanha") liga a pessoa à marca, e a agência dela à marca. O grupo/holding liga as casas do mesmo grupo, pela casa-mãe quando ela está no mapa.
- Coleção `mapa_ligacoes`: ligações registradas no Studio. Tipos: trabalha em, passou por, atende a conta, fez campanha para, mesmo grupo e ponte com a equipe (que exige dizer quem da equipe conhece). Toda ligação pede fonte: um link, ou na ponte o registro da conversa.
- Painel "Pontes", logo abaixo de "Tamanho do multiverso":
  - "Ilhas fora de alcance" lista cada ilha pelo valor, com os membros e as missões. As missões são: Juntar (o mesmo nome escrito de outro jeito), Trajetória (com o link do LinkedIn quando há), Equipe (quem conhece alguém lá), Agência (descobrir a agência da marca) e Pista (mesmo setor de uma casa alcançada).
  - "Abertos longe" lista os pontos da 3ª ramificação em diante, com o caminho atual e as missões que os trazem para perto.
- "Registrar ligação" fica no dossiê e em cada cartão. A busca do outro ponto usa a mesma busca da Investigação, e o mapa se refaz com a ligação gravada. No modo consulta, a gravação avisa que é só leitura.

### 18/11/2026 · Ramificações sem abertos e identidade em destaque
- Arquivo do mapa: na vista "Só a reação aberta", da 4ª ramificação em diante não há pontos abertos. Se as ramificações deixadas à mostra não têm nenhum aberto, o mapa passa sozinho para "Multiverso inteiro" e avisa; com tudo escondido, o mapa diz isso e oferece "Mostrar todas".
- Arquivo e Studio: radar, dossiê, busca, atalhos e leads mostram o tipo como etiqueta (Agência cheia, Anunciante com contorno, Pessoa tracejada), o cargo em negrito e a organização em destaque.

## Números clicáveis e buscas que sugerem (nov/2026)
- Todo indicador (`kpi()`) com `kpi`/`href` vira botão: filtra a lista da própria tela, troca de aba ou leva à tela certa. O ativo fica marcado ("Mostrando na lista abaixo").
- `sugerir()` em todos os campos de busca: ao clicar, antes de digitar, mostra os dados divididos por categoria (com contagem e atalhos); ao digitar, filtra por grupo. Teclado: ↑ ↓ Enter Esc.
- Ctrl K abre com amostras de dados (alvos, licitações, frentes) antes das telas.
- Arquivo do multiverso: os 6 números do topo agem no mapa (alcance, fora de alcance, ramificações, abertos, pessoas que contratam) e a busca sugere Agências / Anunciantes / Pessoas.

### 18/11/2026 · Multiverso como narrativa de venda
- A venda começa pelo problema: o arquivo do multiverso abre o painel com "Por que este mapa existe" (problema → tratamento → solução), com os números tirados dos próprios dados do arquivo.
- Tratamento = os quatro mapeamentos (perfil de cliente ideal, stakeholders, conexões, sinais de compra). Solução = forecasting, inteligência comercial e eficiência do time.
- A planilha do multiverso ganhou na frente as abas Narrativa, Funil e forecast (premissas editáveis: ticket médio e chance por etapa, marcadas como ponto de partida), Perfil ideal, Stakeholders e Sinais de compra.
