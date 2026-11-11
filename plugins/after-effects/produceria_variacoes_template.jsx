/*
 Produceria Variações de Template v1.0.0 (After Effects, ExtendScript)

 O que faz: a partir de uma composição-modelo e de uma planilha CSV, cria uma composição por linha,
 trocando o texto das camadas indicadas e, se quiser, a duração. Opcionalmente já coloca tudo na fila de render.

 Como usar:
 1. No painel Projeto, selecione a composição-modelo (clique uma vez nela).
 2. Dê às camadas de texto que vão mudar nomes iguais aos títulos das colunas do CSV (ex.: TXT_TITULO).
 3. Arquivo > Scripts > Executar Arquivo de Script... e escolha este arquivo.
 4. Escolha o CSV. Colunas: nome;duracao;TXT_TITULO;TXT_OFERTA ... (separador ; ou ,; UTF-8).
    - nome: sufixo do nome da nova composição (obrigatório)
    - duracao: segundos (opcional; deixe a coluna de fora se não quiser mudar)
    - demais colunas: o título da coluna é o NOME DA CAMADA DE TEXTO a ser trocada.
 O modelo original não é alterado. Use Edit > Undo para desfazer a criação de tudo de uma vez.
 Escrito em ExtendScript (sem recursos modernos de JavaScript), conforme exigido pelo After Effects.
*/

function pcTrim(s) { return String(s).replace(/^\s+|\s+$/g, ""); }

// Lê CSV com aspas e separador ; ou , . Devolve array de linhas (arrays de campos).
function pcLerCsv(texto) {
  var t = String(texto);
  if (t.charCodeAt(0) === 0xFEFF) { t = t.substring(1); }
  var primeira = t.split(/\r\n|\r|\n/)[0] || "";
  var ponto = primeira.split(";").length - 1, virg = primeira.split(",").length - 1;
  var sep = ponto >= virg ? ";" : ",";
  var linhas = [], linha = [], atual = "", aspas = false, i, c;
  for (i = 0; i < t.length; i++) {
    c = t.charAt(i);
    if (aspas) {
      if (c === '"') {
        if (t.charAt(i + 1) === '"') { atual += '"'; i++; } else { aspas = false; }
      } else { atual += c; }
    } else if (c === '"') { aspas = true; }
    else if (c === sep) { linha.push(atual); atual = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t.charAt(i + 1) === "\n") { i++; }
      linha.push(atual); atual = "";
      if (pcTemConteudo(linha)) { linhas.push(linha); }
      linha = [];
    } else { atual += c; }
  }
  linha.push(atual);
  if (pcTemConteudo(linha)) { linhas.push(linha); }
  return linhas;
}

function pcTemConteudo(linha) {
  for (var i = 0; i < linha.length; i++) { if (linha[i] !== "") { return true; } }
  return false;
}

function pcPosicao(lista, valor) {
  for (var i = 0; i < lista.length; i++) { if (lista[i] === valor) { return i; } }
  return -1;
}

// Converte o CSV em { colunas: [...], linhas: [{nome, duracao, textos: {camada: texto}}], erros: [...] }
function pcInterpretar(linhasCsv) {
  var erros = [], saida = { colunas: [], linhas: [], erros: erros };
  if (linhasCsv.length < 2) { erros.push("O CSV precisa de cabeçalho e ao menos uma linha."); return saida; }
  var cab = [], i, j;
  for (i = 0; i < linhasCsv[0].length; i++) { cab.push(pcTrim(linhasCsv[0][i])); }
  var iNome = pcPosicao(cab, "nome"), iDur = pcPosicao(cab, "duracao");
  if (iNome < 0) { erros.push('Falta a coluna "nome".'); return saida; }
  for (j = 0; j < cab.length; j++) { if (j !== iNome && j !== iDur && cab[j] !== "") { saida.colunas.push(cab[j]); } }
  for (i = 1; i < linhasCsv.length; i++) {
    var l = linhasCsv[i], nome = pcTrim(l[iNome] || ""), item = { nome: nome, duracao: null, textos: {} };
    if (nome === "") { erros.push("Linha " + (i + 1) + ": nome vazio, ignorada."); continue; }
    if (iDur >= 0 && pcTrim(l[iDur] || "") !== "") {
      var d = parseFloat(String(l[iDur]).replace(",", "."));
      if (isNaN(d) || d <= 0) { erros.push("Linha " + (i + 1) + ": duração inválida, mantida a do modelo."); } else { item.duracao = d; }
    }
    for (j = 0; j < cab.length; j++) {
      if (j !== iNome && j !== iDur && cab[j] !== "" && l[j] !== undefined && l[j] !== "") {
        item.textos[cab[j]] = String(l[j]).replace(/\\n/g, "\r");
      }
    }
    saida.linhas.push(item);
  }
  return saida;
}

function pcLimparNome(s) { return String(s).replace(/[\\\/:*?"<>|]+/g, "-"); }

function pcMain() {
  var modelo = app.project.activeItem;
  if (!modelo || !(modelo instanceof CompItem)) {
    var sel = app.project.selection;
    if (sel && sel.length === 1 && sel[0] instanceof CompItem) { modelo = sel[0]; }
  }
  if (!modelo || !(modelo instanceof CompItem)) {
    alert("Selecione a composição-modelo no painel Projeto e execute o script de novo.");
    return;
  }
  var arq = File.openDialog("Escolha o CSV de variações", "*.csv");
  if (!arq) { return; }
  arq.encoding = "UTF-8";
  if (!arq.open("r")) { alert("Não consegui abrir o arquivo."); return; }
  var conteudo = arq.read(); arq.close();
  var lido = pcInterpretar(pcLerCsv(conteudo));
  if (lido.linhas.length === 0) { alert("Nada a fazer:\n" + lido.erros.join("\n")); return; }

  // Confere se as camadas existem no modelo antes de criar qualquer coisa
  var faltando = [], k, c;
  for (k = 0; k < lido.colunas.length; k++) {
    var achou = false;
    for (c = 1; c <= modelo.numLayers; c++) { if (modelo.layer(c).name === lido.colunas[k]) { achou = true; break; } }
    if (!achou) { faltando.push(lido.colunas[k]); }
  }
  if (faltando.length > 0) {
    alert("Estas colunas não têm camada com o mesmo nome no modelo:\n" + faltando.join(", ") + "\n\nRenomeie as camadas ou o cabeçalho e tente de novo.");
    return;
  }

  var fila = confirm("Adicionar as " + lido.linhas.length + " composições à fila de render?");
  var pasta = null;
  if (fila) { pasta = Folder.selectDialog("Pasta para os arquivos renderizados"); if (!pasta) { fila = false; } }

  app.beginUndoGroup("Produceria: variações de template");
  var criadas = 0, i2;
  try {
    for (i2 = 0; i2 < lido.linhas.length; i2++) {
      var it = lido.linhas[i2];
      var nova = modelo.duplicate();
      nova.name = pcLimparNome(modelo.name + "_" + it.nome);
      if (it.duracao !== null) { nova.duration = it.duracao; }
      for (c = 1; c <= nova.numLayers; c++) {
        var cam = nova.layer(c);
        if (it.textos.hasOwnProperty(cam.name)) {
          var prop = cam.property("Source Text");
          if (prop) { var td = prop.value; td.text = it.textos[cam.name]; prop.setValue(td); }
        }
      }
      if (fila) {
        var rq = app.project.renderQueue.items.add(nova);
        rq.outputModule(1).file = new File(pasta.fsName + "/" + nova.name);
      }
      criadas++;
    }
  } catch (e) {
    alert("Erro depois de " + criadas + " composição(ões): " + e.toString() + "\nUse Editar > Desfazer para voltar.");
  }
  app.endUndoGroup();
  alert(criadas + " composição(ões) criada(s)." + (lido.erros.length ? "\n\nAvisos:\n" + lido.erros.join("\n") : ""));
}

if (typeof app !== "undefined" && app.project) { pcMain(); }
