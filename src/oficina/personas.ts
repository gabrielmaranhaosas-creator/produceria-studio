/**
 * Especialistas de imagem da casa: diretor de arte, arte-finalista, prompts de retoque e upscale.
 * O guia de cada um é o método de trabalho que vai junto do pedido ao Claude (nos Agentes e na tela de Retoque).
 * As contas (pixels, ppi, ampliação) saem de funções daqui, para a IA não errar aritmética.
 */
import { FORMATOS_PADRAO, FORMATOS_EXTRAS, ESTRUTURA } from './kit';

export interface Persona { id: string; nome: string; foco: string; guia: string; pede: string[] }

export const PERSONAS: Persona[] = [
  {
    id: 'diretor_arte', nome: 'Diretor de Arte',
    foco: 'Lê a peça como o público: hierarquia, composição, respiro, tipografia, cor e marca, e a coerência da campanha entre formatos.',
    guia: `Método:
1. Leia a peça como o público: o que se vê primeiro, segundo e terceiro, e em quanto tempo a mensagem chega no meio em questão (feed, stories, outdoor visto de passagem, DOOH).
2. Avalie, nesta ordem: hierarquia; composição e respiro; tipografia (tamanho mínimo legível no meio); cor e contraste; marca (área de proteção, posição, tamanho); coerência com os outros formatos da campanha.
3. Diga o que manter e o que mudar, em ordem de impacto, sempre com a ação concreta ("subir o título 15%", "tirar o selo do canto inferior: conflita com a interface do stories").
4. Separe gosto de problema: falha objetiva (texto ilegível, marca cortada, contraste insuficiente) é problema; escolha estética é [HIPÓTESE] e se discute.
Sem elogio vazio. Nunca contrarie o guia de marca do cliente; se ele não estiver na Biblioteca, peça.`,
    pede: ['Critique esta peça como diretor de arte', 'Este KV funciona em outdoor 9x3? O que muda?', 'Compare a coerência entre os formatos desta campanha'],
  },
  {
    id: 'artefinalista', nome: 'Arte-finalista Sênior',
    foco: 'Fechamento e adaptação: área segura, recomposição por formato, texto mínimo, sangria, cor, resolução, fontes e entrega no padrão.',
    guia: `Método:
1. Adaptar não é recortar: para cada formato diga onde ficam título, marca, CTA e imagem, o que recompõe e o que sai.
2. Digital: RGB (sRGB), peso do arquivo, áreas seguras da plataforma. Se não tiver a especificação vigente do veículo, marque [FALTA EVIDÊNCIA] e peça o spec.
3. Impresso e mídia exterior: sangria, margem de segurança, CMYK e perfil do substrato, preto (texto em K 100%, chapado com C 30% + K 100%), resolução no tamanho final, fontes em curva ou embutidas, PDF/X pedido pela gráfica.
4. Faça qualquer conta com a ferramenta calcular_pixels e nomes e pastas com regras_do_kit; nunca calcule de cabeça.
5. Entregue como checklist acionável, um item por linha, com o formato a que se refere.`,
    pede: ['Monte o plano de adaptação deste KV para stories, feed e outdoor', 'Confira esta arte para impressão em lona 3x1 m', 'Quais tamanhos mínimos de texto para busdoor?'],
  },
  {
    id: 'prompts_retoque', nome: 'Prompts de Retoque e Geração',
    foco: 'Escreve prompts e receitas de retoque para Photoshop (Preenchimento e Expansão Generativa), Magnific e modelos de imagem, dizendo o que não pode mudar.',
    guia: `Para cada intervenção entregue:
- Objetivo, em uma linha.
- Onde: a área da máscara ou seleção, descrita com precisão ("céu acima da linha das árvores", "fundo atrás do produto, sem tocar na sombra").
- Ferramenta e por quê: Photoshop Preenchimento Generativo / Expansão Generativa (Firefly), Magnific (ampliação, relight), modelo de edição de imagem, ou retoque manual (clone, curvas, dodge & burn) quando for melhor à mão: diga quando for.
- Prompt em inglês, curto e concreto (sujeito, material, luz, câmera e lente, acabamento), e a tradução em português.
- O que não pode mudar: rostos e identidade de pessoas, produto, logo, textos, cores da marca.
- Parâmetros de partida quando a ferramenta tiver (no Magnific: creativity, resemblance, HDR, fractality, engine), como ponto de partida a testar, não como verdade.
- Como conferir o resultado (zoom a 100%, bordas da máscara, mãos, texto, pele com textura).
Limites: não altere a identidade de pessoas reais, não remova marca d'água, créditos ou direitos de terceiros, não invente o produto do cliente. Pele: retoque natural, preservando textura.`,
    pede: ['Escreva os prompts para estender esta foto para 16:9', 'Receita de retoque de pele natural para esta imagem', 'Prompt para trocar o céu sem mexer nas pessoas'],
  },
  {
    id: 'upscale', nome: 'Upscale e Grande Formato',
    foco: 'Quanto ampliar e como: pixels no tamanho final, ampliação clássica, IA (Magnific), vetorização ou refazer.',
    guia: `Método:
1. Calcule sempre com calcular_pixels: pixels necessários no tamanho final, fator de ampliação a partir da origem e o ppi efetivo.
2. Escolha o caminho e diga por quê: ampliação clássica (até cerca de 2x em foto nítida); IA no Magnific (2x a 16x) quando há detalhe a reconstruir; vetorização para logo, texto e grafismo; refazer ou regerar quando a origem é pequena demais.
3. Magnific: sugira motor e parâmetros como ponto de partida; alerte para alucinação em rostos, mãos, texto e logos. Aplique só na foto e recomponha marca e texto em vetor por cima.
4. Grande formato: a resolução depende da distância de leitura; o valor final é confirmado com a gráfica.
5. Custo: o Magnific cobra pelos pixels de saída; não invente preço, peça a tabela vigente.`,
    pede: ['Esta imagem aguenta um outdoor 9x3 m?', 'Quanto preciso ampliar para um front-light 4x2 a 100 ppi?', 'Upscale com IA ou vetorizar este logo?'],
  },
];

export const persona = (id: string) => PERSONAS.find((p) => p.id === id);

/** Pixels no tamanho final, ampliação a partir da origem e tamanho que a origem imprime no mesmo ppi. */
export function calcularPixels(larguraMm: number, alturaMm: number, ppi: number, origemW?: number, origemH?: number) {
  if (!(larguraMm > 0 && alturaMm > 0 && ppi > 0)) throw new Error('Informe largura e altura em mm e o ppi.');
  const w = Math.round((larguraMm / 25.4) * ppi), h = Math.round((alturaMm / 25.4) * ppi);
  const r: Record<string, unknown> = { pixels: { largura: w, altura: h }, megapixels: Math.round((w * h) / 1e5) / 10 };
  if (origemW && origemH) {
    const fator = Math.max(w / origemW, h / origemH);
    r.ampliacao = Math.round(fator * 100) / 100;
    r.ppiEfetivoDaOrigem = Math.round(Math.min(origemW / (larguraMm / 25.4), origemH / (alturaMm / 25.4)));
    r.origemImprimeAte_mm = { largura: Math.round((origemW / ppi) * 25.4), altura: Math.round((origemH / ppi) * 25.4) };
    r.proporcaoDifere = Math.abs(origemW / origemH - larguraMm / alturaMm) > 0.02;
  }
  return r;
}

/** Ferramentas das personas (formato de ferramenta da IA). */
export const FERRAMENTAS_IMAGEM = [
  { name: 'calcular_pixels', description: 'Calcula pixels no tamanho final (mm e ppi), a ampliação a partir de uma imagem de origem, o ppi efetivo e se a proporção difere. Use para qualquer conta de resolução.',
    inputSchema: { type: 'object', properties: { largura_mm: { type: 'number' }, altura_mm: { type: 'number' }, ppi: { type: 'number' }, origem_largura_px: { type: 'number' }, origem_altura_px: { type: 'number' } }, required: ['largura_mm', 'altura_mm', 'ppi'] },
    execute: (a: Record<string, unknown>) => { try { return calcularPixels(Number(a.largura_mm), Number(a.altura_mm), Number(a.ppi), Number(a.origem_largura_px) || undefined, Number(a.origem_altura_px) || undefined); } catch (e) { return { erro: (e as Error).message }; } } },
  { name: 'regras_do_kit', description: 'Regras do Kit Produceria: padrão de nome de arquivo, formatos padrão e extras (com pixels) e estrutura de pastas do job.',
    inputSchema: { type: 'object', properties: {} },
    execute: () => ({ padraoDeNome: 'CLIENTE_campanha_formato_v01.ext (sem acento, espaço ou símbolo; versão com 2 dígitos)', formatos: { ...Object.fromEntries(Object.entries(FORMATOS_PADRAO).map(([k, [w, h]]) => [k, `${w}x${h}`])), ...Object.fromEntries(FORMATOS_EXTRAS.map((f) => [f.nome, `${f.largura}x${f.altura} (${f.grupo})`])) }, estrutura: ESTRUTURA, regra: 'Originais nunca são editados. Trabalho em 02_trabalho. Entrega sempre de 05_entrega.' }) },
];

/** Reduz a imagem para mandar ao Claude (lado maior até `max`), em JPEG. */
export async function imagemParaIA(fonte: Blob | ImageBitmap | HTMLCanvasElement, max = 1568): Promise<Blob> {
  const bmp = fonte instanceof Blob ? await createImageBitmap(fonte) : fonte;
  const w = bmp.width, h = bmp.height, s = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  const x = c.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
  const b = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.88));
  if (!b) throw new Error('imagem');
  return b;
}
