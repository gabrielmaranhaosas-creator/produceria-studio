// Regras de checagem da Produceria. Funções puras: recebem dados do documento
// e devolvem uma lista de avisos. Não alteram nada no arquivo.

const PADRAO_NOME = /^[^_\s]+_[^_\s]+_[^_\s]+_v\d{2,}/i; // CLIENTE_campanha_formato_v01
const NOME_PADRAO_CAMADA = /^(layer|camada)\s*\d+(\s*(copy|cópia|copia)(\s*\d+)?)?$/i;

function semExtensao(nome) {
  return String(nome || "").replace(/\.[^.]+$/, "");
}

// info: { nome, modo, perfil, resolucao, bits, camadas: [{nome, tipo, visivel, ehTexto, fonte}] }
// opcoes: { destino: "impressao" | "digital", fontesInstaladas: Set|null }
function analisar(info, opcoes) {
  const itens = [];
  const add = (nivel, titulo, detalhe) => itens.push({ nivel, titulo, detalhe });
  const impressao = opcoes.destino === "impressao";
  const modo = String(info.modo || "").toUpperCase();

  // 1. Nome do arquivo
  if (PADRAO_NOME.test(semExtensao(info.nome))) {
    add("OK", "Nome do arquivo", "Segue o padrão CLIENTE_campanha_formato_v01.");
  } else {
    add("AVISO", "Nome do arquivo", "\"" + info.nome + "\" não segue o padrão CLIENTE_campanha_formato_v01.");
  }

  // 2. Modo de cor
  if (impressao) {
    if (modo.includes("CMYK")) add("OK", "Modo de cor", "CMYK, adequado para impressão.");
    else add("ERRO", "Modo de cor", "O arquivo está em " + info.modo + ". Para impressão, o esperado é CMYK. Confirme com o produtor gráfico antes de converter.");
  } else {
    if (modo.includes("RGB")) add("OK", "Modo de cor", "RGB, adequado para tela.");
    else add("ERRO", "Modo de cor", "O arquivo está em " + info.modo + ". Para tela, o esperado é RGB.");
  }

  // 3. Perfil de cor
  if (info.perfil) add("INFO", "Perfil de cor", String(info.perfil));
  else add("AVISO", "Perfil de cor", "Não foi possível ler o perfil de cor do documento.");

  // 4. Resolução
  const res = Number(info.resolucao);
  if (!isFinite(res) || res <= 0) {
    add("AVISO", "Resolução", "Não foi possível ler a resolução.");
  } else if (impressao && res < 300) {
    add("ERRO", "Resolução", res + " ppi. Para impressão o esperado é 300 ppi ou mais.");
  } else if (!impressao && res < 72) {
    add("ERRO", "Resolução", res + " ppi. Para tela o esperado é 72 ppi ou mais.");
  } else {
    add("OK", "Resolução", res + " ppi.");
  }

  // 5. Texto
  const textos = info.camadas.filter((c) => c.ehTexto);
  if (textos.length === 0) {
    add("AVISO", "Camadas de texto", "Nenhuma camada de texto editável. Se há texto na peça, ele pode ter sido rasterizado.");
  } else {
    add("OK", "Camadas de texto", textos.length + " camada(s) de texto editável.");
  }

  // 6. Fontes
  if (opcoes.fontesInstaladas instanceof Set && textos.length > 0) {
    const ausentes = Array.from(new Set(
      textos.map((t) => t.fonte).filter((f) => f && !opcoes.fontesInstaladas.has(f))
    ));
    if (ausentes.length === 0) add("OK", "Fontes", "Todas as fontes usadas estão instaladas neste computador.");
    else add("ERRO", "Fontes", "Fonte(s) não encontrada(s): " + ausentes.join(", ") + ".");
  } else if (textos.length > 0) {
    add("AVISO", "Fontes", "Não foi possível verificar as fontes instaladas. Confira em Tipo > Substituir fontes ausentes.");
  }

  // 7. Camadas ocultas
  const ocultas = info.camadas.filter((c) => c.visivel === false);
  if (ocultas.length > 0) {
    add("AVISO", "Camadas ocultas", ocultas.length + " camada(s) oculta(s). Confirme se devem seguir no arquivo de entrega.");
  } else {
    add("OK", "Camadas ocultas", "Nenhuma camada oculta.");
  }

  // 8. Nomes padrão
  const padrao = info.camadas.filter((c) => NOME_PADRAO_CAMADA.test(String(c.nome || "").trim()));
  if (padrao.length > 0) {
    add("AVISO", "Nomes de camada", padrao.length + " camada(s) com nome padrão do Photoshop (ex.: \"" + padrao[0].nome + "\").");
  } else {
    add("OK", "Nomes de camada", "Nenhuma camada com nome padrão.");
  }

  // 9. Itens manuais
  if (impressao) {
    add("MANUAL", "Sangria e margem de segurança", "O plugin não mede a sangria. Confira manualmente (em geral 3 mm) e as margens de segurança.");
  }
  add("MANUAL", "Revisão de texto", "Peça a revisão de texto antes da entrega.");

  const contagem = { ERRO: 0, AVISO: 0, OK: 0, INFO: 0, MANUAL: 0 };
  itens.forEach((i) => { contagem[i.nivel] += 1; });
  return { itens, contagem };
}

module.exports = { analisar, semExtensao };
