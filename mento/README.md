# MENTO · Reação em cadeia

Produto **separado do PRODUCERia Studio**: não importa nada de `src/`, não lê o banco nem o Big Data do Studio e não
aparece no menu dele. É uma página única (`mento/dist/mento.html`, ~64 KB) que roda inteira no navegador.

## O que faz

Lê os arquivos de dados do LinkedIn das pessoas da equipe da MENTO e monta a rede:

```
MENTO (ponto zero)
 └─ 1ª volta: a equipe (as pessoas que entregaram o arquivo)
     └─ 2ª: quem cada uma conhece (conexões de 1º grau) e as empresas por onde passou
         └─ 3ª: as empresas onde essas conexões trabalham hoje
             └─ 4ª: quem mais está nessas empresas (aberto pela reação)
```

- **Em comum**: pessoas que as duas conhecem e empresas onde as duas têm gente.
- **Reação em cadeia**: volta por volta, os pontos mais fortes.
- **Multiverso**: a rede inteira em anéis, clicável (dossiê e caminho até a MENTO), com busca, zoom e filtros
  (só quem decide, em comum). Baixa em SVG.
- **Radar**: as oportunidades da mais forte para a mais fraca, com o caminho; baixa em planilha (CSV para o Excel).

A nota (0 a 100) soma: cargo que decide a contratação de agência e mídia (CMO, diretoria/gerência de marketing,
marca, mídia, comunicação, sócio, CEO), pessoa conhecida pelas duas, outros conhecidos na mesma empresa, empresa onde
alguém da equipe já trabalhou, conexão recente. Agências ficam marcadas (parceira ou concorrente) e pesam menos.
Colegas da própria MENTO não entram como oportunidade.

## Como cada pessoa entrega os dados (caminho oficial do LinkedIn)

1. LinkedIn → **Eu** → **Configurações e privacidade** → **Privacidade de dados** → **Obter uma cópia dos seus dados**.
2. **Quero um pacote de dados específico**: marcar **Conexões**, **Cargos** e **Perfil** → **Solicitar arquivo**.
3. O e-mail chega em cerca de 10 minutos; baixar o `.zip` e arrastar no quadro da pessoa.

Ninguém passa senha a ninguém, nada é raspado do site e cada pessoa decide o que entrega. Do `.zip` só são lidos
`Profile.csv`, `Positions.csv` e `Connections.csv`; mensagens, convites e o resto nunca são abertos (há teste para isso).

## Privacidade

- Nada sai do navegador: sem servidor, sem rede, sem banco.
- "Lembrar neste navegador" vem desligado; ligado, guarda os dados só no `localStorage` daquele navegador.
  "Apagar tudo" limpa.
- As conexões são dados de terceiros (nome, empresa, cargo e, às vezes, e-mail). A planilha baixada leva isso: compartilhe
  só com quem trabalha a prospecção.

## Comandos

```bash
npm run build:mento        # gera mento/dist/mento.html
npx vitest run mento       # testes do leitor do arquivo e da rede
```

Código: `src/exportacao.ts` (zip e CSV do LinkedIn), `src/rede.ts` (rede, notas, reação, multiverso, radar),
`src/main.ts` (página), `src/estilo.css` (identidade: preto, branco, verde `#0BCF55`, stencil Big Shoulders, SIL OFL 1.1
em `src/fonte/OFL.txt`), `montar.mjs` (página única).
