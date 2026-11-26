# Reação · Mento: teste com dois LinkedIns

A reação em cadeia e o multiverso da **MENTO Publicidade**, partindo das trajetórias de duas pessoas. Fica no Studio em
**Privado › Prospecção › Reação · Mento** (`#mento`).

## Como funciona

```
MENTO (ponto zero)
 └─ 1ª ramificação: as duas pessoas (equipe)
     └─ 2ª: as casas por onde cada uma passou (lidas do LinkedIn)
         └─ 3ª em diante: o que o Big Data já liga a essas casas (contas, trocas de agência, pessoas, grupo, extinta → herdeira)
```

- Casa que o Big Data ainda não conhece entra no mapa mesmo assim (como "Organização", ou "Agência" quando o nome
  denuncia), ligada à pessoa: vira ponto de partida para pesquisar.
- **Pontes em comum**: o que as duas pessoas alcançam em até dois passos cada.
- **Radar**: as possibilidades da reação, da mais forte para a mais fraca, cada uma com o caminho até a MENTO.
- A força segue a regra da Investigação (quem decide a contratação, conta nova ou troca de agência nos últimos 120 dias,
  ponte com a MENTO, quantos caminhos chegam no ponto, distância).

## Passo a passo do teste

1. No LinkedIn, abra o perfil da pessoa 1, selecione tudo (Ctrl+A ou ⌘A), copie e cole no quadro **Pessoa 1** com o
   link do perfil. Também vale o texto do **Mais → Salvar em PDF**.
2. **Ler o perfil**. Confira a tabela "Trajetória lida": casa, cargo, período e se trabalha lá hoje. Corrija o que vier
   errado (nome de empresa abreviado, função agrupada) ou acrescente passagens à mão.
3. Repita com a pessoa 2.
4. **Rodar a reação em cadeia**. Leia, de cima para baixo: tamanho da reação, por onde cada um abre, pontes em comum,
   ramificações, multiverso e radar.
5. **Baixar o multiverso interativo (HTML)** para mandar à Mento (abre sozinho, sem rede, na identidade da marca) e
   **Baixar o radar (planilha)** para trabalhar a lista.

"Carregar um exemplo" preenche dois perfis fictícios para ver a tela antes do teste real.

## Privacidade

Os perfis colados ficam só neste navegador (`localStorage`); nada é gravado no banco do Studio. "Limpar os dois" apaga.
O arquivo baixado leva nome, cargo e trajetória das duas pessoas: mande só a quem pode ver.

## Identidade

Preto `#000`, branco e o verde da Mento `#0BCF55` (medido no site), títulos em stencil condensado (Big Shoulders
Stencil, SIL OFL 1.1, licença em `src/lib/fontes/`), texto na grotesca do sistema. A tela e o arquivo baixado usam os
mesmos tokens (`.mt` em `src/estilos/mento.css`, `:root[data-casa="mento"]` em `src/lib/mapa-visor.css`).

## Outra casa

`src/lib/casa.ts` descreve a casa (nome, quem é equipe, marca da ponte, problema, perfil de cliente ideal, identidade).
`reacaoDaCasa(casa, base, perfis)` em `src/lib/reacao-casa.ts` serve para qualquer casa e qualquer número de perfis.
