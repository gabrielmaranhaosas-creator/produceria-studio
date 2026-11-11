import { describe, expect, it } from 'vitest';
import {
  limpar, nomeArquivo, gerarNomes, interpretarFormatos, proximaVersao, nomeNoPadrao, recorteCobrir, encaixeConter,
  ampliacao, leiaMe, alertasImagem, manifestoCsv, estruturaJob, ErroKit,
} from '../src/oficina/kit';
import { crc32, zipar } from '../src/oficina/zip';
import { lerCabecalho, sha256 } from '../src/oficina/imagem';

describe('nomes do kit (iguais ao núcleo Python)', () => {
  it('limpa acento, espaço e símbolo', () => {
    expect(limpar('São João — Ação!')).toBe('Sao-Joao-Acao');
    expect(limpar('  ')).toBe('');
  });
  it('monta o nome no padrão', () => {
    expect(nomeArquivo('Sicredi', 'Natal Feliz 2026', 'stories', 2)).toBe('Sicredi_Natal-Feliz-2026_stories_v02.psd');
    expect(nomeArquivo('Banco do Nordeste', 'Safra', 'banner-300x250', 1, '.png')).toBe('Banco-do-Nordeste_Safra_banner-300x250_v01.png');
  });
  it('recusa sem cliente ou campanha', () => {
    expect(() => nomeArquivo('', 'x', 'stories')).toThrow(ErroKit);
  });
  it('interpreta formatos padrão, extras e medidas', () => {
    const f = interpretarFormatos(['stories', 'outdoor-9x3', '1080x1350', 'capa face:820x312']);
    expect(f.map((x) => [x.nome, x.largura, x.altura])).toEqual([['stories', 1080, 1920], ['outdoor-9x3', 3000, 1000], ['1080x1350', 1080, 1350], ['capa-face', 820, 312]]);
    expect(() => interpretarFormatos(['gigante'])).toThrow(/Formato inválido/);
  });
  it('gera a lista de nomes', () => {
    expect(gerarNomes('CLI', 'camp', ['stories', 'feed-quadrado'], 3, 'jpg')).toEqual(['CLI_camp_stories_v03.jpg', 'CLI_camp_feed-quadrado_v03.jpg']);
  });
  it('sobe a versão', () => {
    expect(proximaVersao('CLI_camp_stories_v03.psd')).toBe('CLI_camp_stories_v04.psd');
    expect(proximaVersao('CLI_camp_stories_v09')).toBe('CLI_camp_stories_v10');
    expect(proximaVersao('arte final.psd')).toBe('arte final_v02.psd');
  });
  it('reconhece o padrão', () => {
    expect(nomeNoPadrao('CLI_camp_stories_v01.png')).toBe(true);
    expect(nomeNoPadrao('arte final.png')).toBe(false);
    expect(nomeNoPadrao('CLI_camp_stories_v1.png')).toBe(false);
  });
  it('LEIA-ME e estrutura do job', () => {
    expect(leiaMe('Sicredi', 'Natal', '2026-11-11')).toContain('Criado em: 2026-11-11');
    const e = estruturaJob('Sicredi', 'Natal Feliz', '2026-11-11');
    expect(e[0].caminho).toBe('Sicredi_Natal-Feliz/00_briefing/');
    expect(e).toHaveLength(10);
    expect(e[9]).toMatchObject({ caminho: 'Sicredi_Natal-Feliz/LEIA-ME.txt' });
    expect(() => estruturaJob('', 'x')).toThrow(ErroKit);
  });
});

describe('geometria da desdobra', () => {
  it('cobrir centra no foco sem sair da imagem', () => {
    const r = recorteCobrir(2000, 1000, 1080, 1920, 0.5, 0.5);
    expect(r.h).toBeCloseTo(1000); expect(r.w).toBeCloseTo(562.5); expect(r.x).toBeCloseTo(718.75);
    expect(recorteCobrir(2000, 1000, 1080, 1920, 0, 0.5).x).toBe(0);
    expect(recorteCobrir(2000, 1000, 1080, 1920, 1, 0.5).x).toBeCloseTo(2000 - 562.5);
  });
  it('conter cabe inteiro e centraliza', () => {
    expect(encaixeConter(2000, 1000, 1080, 1080)).toMatchObject({ x: 0, y: 270, w: 1080, h: 540 });
  });
  it('mede a ampliação', () => {
    expect(ampliacao(500, 500, 1080, 1920, 'cobrir')).toBeCloseTo(3.84);
    expect(ampliacao(500, 500, 1080, 1920, 'conter')).toBeCloseTo(2.16);
  });
});

describe('alertas e manifesto', () => {
  it('alerta como o núcleo', () => {
    const a = alertasImagem({ arquivo: 'arte.jpg', formato: 'JPEG', largura: 10, altura: 10, dpi: 72, cmyk: true, perfilIcc: false, tamanhoKb: 1 });
    expect(a).toHaveLength(4);
    expect(alertasImagem({ arquivo: 'C_c_f_v01.png', formato: 'PNG', largura: 10, altura: 10, dpi: 300, cmyk: false, perfilIcc: true, tamanhoKb: 1 })).toEqual([]);
  });
  it('manifesto com BOM e ponto e vírgula', () => {
    const csv = manifestoCsv([{ arquivo: 'C_c_f_v01.png', dimensoes: '1080x1920', tamanhoKb: 123.45, noPadrao: true, sha256: 'a'.repeat(64) }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('arquivo;dimensoes;tamanho_kb;nome_no_padrao;sha256_16\r\n');
    expect(csv).toContain(`C_c_f_v01.png;1080x1920;123.5;sim;${'a'.repeat(16)}\r\n`);
  });
});

describe('zip', () => {
  it('crc32 conhecido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('estrutura válida com pasta e arquivo', () => {
    const z = zipar([{ caminho: 'job/' }, { caminho: 'job/LEIA-ME.txt', dados: 'olá' }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const fim = z.length - 22;
    expect(v.getUint32(fim, true)).toBe(0x06054b50);
    expect(v.getUint16(fim + 10, true)).toBe(2);
    const central = v.getUint32(fim + 16, true);
    expect(v.getUint32(central, true)).toBe(0x02014b50);
  });
});

// Imagens mínimas montadas byte a byte (só o cabeçalho importa)
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number) => [(n >> 8) & 255, n & 255];
const asc = (s: string) => [...s].map((c) => c.charCodeAt(0));
const chunk = (t: string, d: number[]) => [...u32(d.length), ...asc(t), ...d, 0, 0, 0, 0];

describe('leitura de cabeçalho', () => {
  it('PNG com pHYs e iCCP', () => {
    const b = new Uint8Array([0x89, ...asc('PNG'), 13, 10, 26, 10, ...chunk('IHDR', [...u32(1080), ...u32(1920), 8, 2, 0, 0, 0]),
      ...chunk('pHYs', [...u32(11811), ...u32(11811), 1]), ...chunk('iCCP', [...asc('sRGB'), 0, 0]), ...chunk('IEND', [])]);
    expect(lerCabecalho(b)).toEqual({ formato: 'PNG', largura: 1080, altura: 1920, dpi: 300, cmyk: false, perfilIcc: true });
  });
  it('JPEG CMYK com JFIF e ICC', () => {
    const app0 = [0xff, 0xe0, ...u16(16), ...asc('JFIF'), 0, 1, 1, 1, ...u16(300), ...u16(300), 0, 0];
    const app2 = [0xff, 0xe2, ...u16(2 + 12 + 2), ...asc('ICC_PROFILE'), 0, 1, 1];
    const sof = [0xff, 0xc0, ...u16(8 + 4 * 3), 8, ...u16(3508), ...u16(2480), 4, ...Array(12).fill(1)];
    const b = new Uint8Array([0xff, 0xd8, ...app0, ...app2, ...sof, 0xff, 0xd9]);
    expect(lerCabecalho(b)).toEqual({ formato: 'JPEG', largura: 2480, altura: 3508, dpi: 300, cmyk: true, perfilIcc: true });
  });
  it('JPEG com EXIF em 72 dpi vence o JFIF', () => {
    // TIFF big-endian: IFD0 com XResolution (rational no offset 38) e ResolutionUnit = 2
    const tiff = [...asc('MM'), 0, 42, ...u32(8), ...u16(2),
      ...u16(0x011a), ...u16(5), ...u32(1), ...u32(38), ...u16(0x0128), ...u16(3), ...u32(1), ...u16(2), 0, 0, ...u32(0), ...u32(72), ...u32(1)];
    const app1 = [0xff, 0xe1, ...u16(2 + 6 + tiff.length), ...asc('Exif'), 0, 0, ...tiff];
    const app0 = [0xff, 0xe0, ...u16(16), ...asc('JFIF'), 0, 1, 1, 1, ...u16(300), ...u16(300), 0, 0];
    const sof = [0xff, 0xc2, ...u16(8 + 9), 8, ...u16(100), ...u16(200), 3, ...Array(9).fill(1)];
    const r = lerCabecalho(new Uint8Array([0xff, 0xd8, ...app0, ...app1, ...sof, 0xff, 0xd9]));
    expect(r).toMatchObject({ largura: 200, altura: 100, dpi: 72, cmyk: false, perfilIcc: false });
  });
  it('PSD em CMYK', () => {
    const b = new Uint8Array([...asc('8BPS'), 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, ...u32(3000), ...u32(9000), 0, 8, 0, 4, 0, 0]);
    expect(lerCabecalho(b)).toMatchObject({ formato: 'PSD', largura: 9000, altura: 3000, cmyk: true });
  });
  it('arquivo desconhecido devolve null', () => {
    expect(lerCabecalho(new TextEncoder().encode('isto não é uma imagem, só texto comprido'))).toBeNull();
  });
  it('sha256', async () => {
    expect(await sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
