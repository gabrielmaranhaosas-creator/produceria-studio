---
id: "trig_01YMWm5m5RsHNxfv3UEqxWE5"
nome: "Studio · publicação automática do main"
cron: "30 9 * * *"
ativa: true
modelo: "claude-sonnet-5-5"
permissao: null
conectores: []
---

Você publica o PRODUCERia Studio a partir do branch main deste repositório. Responda em português. Não faça commit, não faça push, não altere o repositório, não apague nada e não publique outro arquivo além do descrito. O Studio é o artifact https://claude.ai/artifact/JNYUheiKr7h2Dg9QJM1hVp (chamado de STUDIO abaixo).

1. Versão do main: `git rev-parse --short HEAD` (chame de HEAD).

2. Versão publicada: chame a ferramenta Artifact com action "read" e url do STUDIO. A leitura salva a página num arquivo local (o resultado diz onde). Nesse arquivo, ache o carimbo de versão com `grep -oE '"[0-9]+\.[0-9]+\.[0-9]+\+[0-9a-f]{7,40}"' ARQUIVO | head -1`. O trecho depois do + é o commit publicado (chame de PUB). Se não achar o carimbo, considere PUB desconhecido. Não copie nem resuma o conteúdo da página.

3. Precisa publicar? Se PUB for igual a HEAD, pare: relate "nada a publicar" e termine. Se PUB for conhecido e existir no histórico (`git cat-file -e PUB^{commit}`), rode `git diff --quiet PUB HEAD -- src scripts legacy package.json package-lock.json vite.config.ts tsconfig.json`; se não houver diferença, pare: relate "só mudou documentação, nada a publicar" e termine. Nos outros casos, siga.

4. Testes: rode `npm ci` e depois `npm run check` (tipos, testes do Studio, testes Python e build). Se o comando falhar só porque `python3` não existe, rode no lugar `npm run typecheck && npm test && npm run build`. Se qualquer teste ou o build falhar: NÃO publique. Grave um aviso com ArtifactData action "set" na url do STUDIO, collection "notificacoes", doc_id "av-pub-" seguido de HEAD, data {"id": (o mesmo doc_id), "tipo": "rotina", "titulo": "Publicação automática não rodou: testes falharam", "texto": (o nome do teste ou a última linha de erro, até 300 caracteres), "link": "#rotinas", "em": (data e hora atual em ISO 8601)}. Relate a falha e termine.

5. Confira o arquivo: `dist/index.html` precisa existir, ter mais de 500 KB e conter o texto `data-casca="propria"`. Se não, não publique: grave o mesmo tipo de aviso com titulo "Publicação automática não rodou: página montada incompleta" e termine.

6. Publique: ferramenta Artifact, action "publish", file_path com o caminho absoluto de dist/index.html, url do STUDIO, label "main " seguido de HEAD. Não passe capabilities, files, icon nem force. Se a publicação for recusada por conflito de versão, não insista nem use force: grave um aviso com titulo "Publicação automática parou: o Studio mudou por outro caminho" e termine.

7. Depois de publicar, grave um aviso com ArtifactData action "set", collection "notificacoes", doc_id "av-pub-" seguido de HEAD, data {"id": (o doc_id), "tipo": "rotina", "titulo": "Studio atualizado para a versão " seguido de HEAD, "texto": (as linhas de `git log --oneline PUB..HEAD -- src scripts legacy package.json` se PUB for conhecido, até 600 caracteres; senão "versão do main publicada"), "link": "#painel", "em": (data e hora atual em ISO 8601)}.

8. Termine com um resumo curto: PUB, HEAD, se publicou, o resultado dos testes e a nova versão do artifact.
