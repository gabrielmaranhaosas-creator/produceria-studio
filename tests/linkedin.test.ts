import { describe, expect, it } from 'vitest';
import { lerPerfil, nomeDoLink, linkDoTexto } from '../src/lib/linkedin';

const PAGINA = `Fulana de Tal
Fulana de Tal
(Ela/Dela)
Diretora de Mídia na Mento Publicidade
São Paulo, São Paulo, Brasil · Informações de contato
500+ conexões
Enviar mensagem
Sobre
Mídia e conexões há 15 anos.
Experiência
Experiência
Diretora de Mídia
Mento Publicidade · Tempo integral
jan de 2022 - o momento · 2 anos 11 meses
São Paulo, Brasil
Africa Creative DDB
5 anos 2 meses
Gerente de Mídia
mar de 2018 - dez de 2021 · 3 anos 10 meses
Supervisora de Mídia
nov de 2016 - fev de 2018 · 1 ano 4 meses
São Paulo, Brasil
Planejou a mídia de grandes contas.
Analista de Mídia
Ogilvy Brasil · Estágio
2014 - 2016 · 2 anos
Formação acadêmica
ESPM
Publicidade e Propaganda`;

const PDF = `Contato
www.linkedin.com/in/ciclano-souza-12ab34 (LinkedIn)
Principais competências
Mídia
Ciclano Souza
Sócio-diretor na Mento
São Paulo, Brasil
Resumo
Experiência
Mento Publicidade
Sócio-diretor
março de 2020 - Present (4 anos 9 meses)
São Paulo, Brasil
Publicis Brasil
Diretor de Negócios
janeiro de 2015 - fevereiro de 2020 (5 anos 2 meses)
São Paulo
Page 1 of 2
Formação acadêmica
FAAP`;

describe('Leitura do perfil do LinkedIn', () => {
  it('lê o texto copiado da página, com funções agrupadas na mesma casa', () => {
    const p = lerPerfil(PAGINA, 'https://www.linkedin.com/in/fulana-de-tal-9x8y7z/?originalSubdomain=br');
    expect(p.nome).toBe('Fulana de Tal');
    expect(p.titulo).toBe('Diretora de Mídia na Mento Publicidade');
    expect(p.linkedin).toBe('https://www.linkedin.com/in/fulana-de-tal-9x8y7z');
    expect(p.experiencias.map((e) => [e.org, e.cargo])).toEqual([
      ['Mento Publicidade', 'Diretora de Mídia'],
      ['Africa Creative DDB', 'Gerente de Mídia'],
      ['Africa Creative DDB', 'Supervisora de Mídia'],
      ['Ogilvy Brasil', 'Analista de Mídia'],
    ]);
    expect(p.experiencias[0].atual).toBe(true);
    expect(p.organizacao).toBe('Mento Publicidade');
    expect(p.trajetoria).toContain('Gerente de Mídia na Africa Creative DDB');
  });
  it('lê o texto do "Salvar em PDF"', () => {
    const p = lerPerfil(PDF);
    expect(p.nome).toBe('Ciclano Souza');
    expect(p.linkedin).toBe('https://www.linkedin.com/in/ciclano-souza-12ab34');
    expect(p.experiencias.map((e) => [e.org, e.cargo, e.atual])).toEqual([
      ['Mento Publicidade', 'Sócio-diretor', true],
      ['Publicis Brasil', 'Diretor de Negócios', false],
    ]);
    expect(p.cargo).toBe('Sócio-diretor');
  });
  it('sem texto, tira o nome do link; sem experiências, usa o título "Cargo na Casa"', () => {
    expect(nomeDoLink('https://br.linkedin.com/in/maria-da-silva-a1b2c3d4')).toBe('Maria da Silva');
    expect(linkDoTexto('veja br.linkedin.com/in/joao-1?x=1')).toBe('https://www.linkedin.com/in/joao-1');
    const p = lerPerfil('Beltrano Lima\nHead de Planejamento na Mento Publicidade');
    expect(p).toMatchObject({ nome: 'Beltrano Lima', organizacao: 'Mento Publicidade', cargo: 'Head de Planejamento' });
    expect(lerPerfil('', 'https://www.linkedin.com/in/ana-paula-reis').nome).toBe('Ana Paula Reis');
  });
});
