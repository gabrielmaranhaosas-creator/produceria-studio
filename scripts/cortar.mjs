// Corta funções inteiras do script legado (as cópias antigas das páginas migradas).
// O fim de cada função é achado pelo próprio parser do Node: a primeira "}" depois do início com a qual
// `(function nome(...){...})` compila é o fim real. Evita reimplementar strings, templates e regex à mão.
import vm from 'node:vm';

function compila(trecho) {
  try { new vm.Script('(' + trecho + ')'); return true; } catch { return false; }
}

/** Troca `function nome(...){...}` por `substituto`. Exige exatamente uma definição. */
export function cortarFuncao(src, nome, substituto) {
  const marca = `function ${nome}(`;
  const n = src.split(marca).length - 1;
  if (n !== 1) throw new Error(`Esperava 1 definição de ${nome} no legado, achei ${n}.`);
  const ini = src.indexOf(marca);
  for (let i = src.indexOf('}', ini); i >= 0; i = src.indexOf('}', i + 1)) {
    if (compila(src.slice(ini, i + 1))) {
      return { src: src.slice(0, ini) + substituto + src.slice(i + 1), removido: i + 1 - ini };
    }
  }
  throw new Error(`Não achei o fim de ${nome}.`);
}
