// Duas pessoas fictícias, com redes geradas de forma determinística, para ver a página antes dos arquivos reais.
import type { Pessoa, Conexao } from './exportacao';

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiana', 'Vitor'];
const SOBRENOMES = ['Almeida', 'Barros', 'Costa', 'Duarte', 'Esteves', 'Farias', 'Gomes', 'Holanda', 'Lopes', 'Martins', 'Nunes', 'Pires', 'Queiroz', 'Rocha', 'Teixeira'];
const EMPRESAS = ['Banco Horizonte', 'Cervejaria Serra Alta', 'Varejo Bom Preço', 'Montadora Rota', 'Cosméticos Flor', 'Telecom Vox', 'Seguradora Âncora', 'Farmácias Vida', 'Construtora Prisma', 'Agência Faro Comunicação', 'Laticínios Campo Verde', 'Fintech Pulso'];
const CARGOS = ['Diretora de Marketing', 'Gerente de Marca', 'Head de Mídia', 'CMO', 'Coordenador de Trade Marketing', 'Analista de Mídia Sênior', 'Gerente de Comunicação', 'Especialista em Growth', 'Analista Financeiro', 'Engenheira de Dados', 'Gerente Comercial', 'Sócio-fundador'];

function gerar(semente: number, n: number, foco: string[]): Conexao[] {
  let s = semente; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out: Conexao[] = [];
  for (let i = 0; i < n; i++) {
    const nome = `${NOMES[Math.floor(r() * NOMES.length)]} ${SOBRENOMES[Math.floor(r() * SOBRENOMES.length)]}`;
    const empresa = r() < 0.55 ? foco[Math.floor(r() * foco.length)] : EMPRESAS[Math.floor(r() * EMPRESAS.length)];
    const ano = 2014 + Math.floor(r() * 13), mes = ['Jan', 'Mar', 'May', 'Aug', 'Oct', 'Dec'][Math.floor(r() * 6)];
    out.push({ nome, url: `https://www.linkedin.com/in/exemplo-${nome.toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').replace(/ /g, '-')}`, email: '', empresa, cargo: CARGOS[Math.floor(r() * CARGOS.length)], desde: `${ano}-${String(['Jan', 'Mar', 'May', 'Aug', 'Oct', 'Dec'].indexOf(mes) * 2 + 1).padStart(2, '0')}-10` });
  }
  return out;
}

export function EXEMPLO(): Pessoa[] {
  return [
    { id: '1', nome: 'Fulana de Tal', titulo: 'Diretora de Mídia na Mento Publicidade', url: '', arquivos: ['exemplo'], conexoes: gerar(7, 140, ['Banco Horizonte', 'Cervejaria Serra Alta', 'Agência Faro Comunicação', 'Telecom Vox']),
      posicoes: [{ empresa: 'Mento Publicidade', cargo: 'Diretora de Mídia', inicio: '2022-01', fim: '', atual: true }, { empresa: 'Agência Faro Comunicação', cargo: 'Gerente de Mídia', inicio: '2018-03', fim: '2021-12', atual: false }] },
    { id: '2', nome: 'Ciclano Souza', titulo: 'Sócio-diretor na Mento Publicidade', url: '', arquivos: ['exemplo'], conexoes: gerar(19, 110, ['Cervejaria Serra Alta', 'Montadora Rota', 'Varejo Bom Preço', 'Banco Horizonte']),
      posicoes: [{ empresa: 'Mento Publicidade', cargo: 'Sócio-diretor', inicio: '2020-03', fim: '', atual: true }, { empresa: 'Cervejaria Serra Alta', cargo: 'Gerente de Marketing', inicio: '2015-01', fim: '2020-02', atual: false }] },
  ];
}
