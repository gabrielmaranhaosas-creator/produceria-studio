/** Modelos dos documentos do banco do Studio (collections do artifact). */

export type Perfil = 'independente' | 'publica' | 'inhouse' | 'rede' | 'eua';
export type Etapa = 'Mapeado' | 'Pesquisado' | 'Abordado' | 'Conversa' | 'Proposta' | 'Cliente';

export interface PassoCadencia { canal?: string; dia?: string; texto?: string }

export interface Toque { em: string; canal: string; resultado: string; nota?: string }

export interface Alvo {
  id: string;
  nome: string;
  perfil?: Perfil | string;
  contato?: string;
  gatilho?: string;
  fonte?: string;
  status?: Etapa | string;
  proximoPasso?: string;
  prazo?: string | null;
  notas?: string;
  origem?: string;
  criadoEm?: string;
  nota?: number;
  notaMotivo?: string;
  triagem?: string;
  triadoEm?: string;
  motivoDescarte?: string;
  abordagem?: { cadencia?: PassoCadencia[]; mensagem?: string; angulo?: string; insight?: string };
  toques?: Toque[];
  ultimoToque?: string;
  proximoToque?: { data: string | null; texto?: string; canal?: string } | null;
  etapas?: Partial<Record<Etapa, string>>;
  proposta?: unknown;
}

export interface Movimento {
  id?: string; data: string; anunciante: string; agencia: string;
  anterior?: string; escopo?: string; fonte?: string; tipo?: string;
}

export interface ContratoPublico {
  id: string; fornecedor: string; cnpj?: string; orgao: string; uf?: string;
  objeto?: string; frente?: string; valor?: number | null;
  inicio?: string; fim?: string; publicado?: string; link?: string;
  segmento?: string; tipoEmpresa?: string;
}

export interface Licitacao {
  ref: string; objeto: string; orgao: string; uf?: string; modalidade?: string;
  valor?: number | null; prazo?: string | null; publicado?: string | null;
  score: number; frente: string; url?: string; carteira?: boolean;
}

export interface Noticia {
  id: string; data: string; titulo: string; resumo?: string;
  categoria?: 'conta' | 'licitacao' | 'inhouse' | 'negocio' | 'mercado';
  empresas?: string[]; veiculo?: string; url?: string;
  lead?: { nome: string; perfil?: Perfil; porque?: string } | null;
}

export interface Caso {
  id: string; titulo: string; cliente?: string; agencia?: string; ano?: string; url?: string;
  resumo: string; resultado?: string; servicos: string[]; perfis: string[];
}
