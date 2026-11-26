// Arquivos de exemplo no formato do "Obter uma cópia dos seus dados" do LinkedIn (pessoas fictícias).

export const CONEXOES_A = `Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Juliana,Prado,https://www.linkedin.com/in/juliana-prado,,Itaú Unibanco,Diretora de Marketing,12 Mar 2025
Rafael,Moura,https://www.linkedin.com/in/rafael-moura,rafael@exemplo.com,Heineken Brasil,Head de Mídia,02 Feb 2019
Camila,Torres,https://www.linkedin.com/in/camila-torres,,Publicis Brasil,Diretora de Mídia,10 Jan 2018
Bruno,Lima,https://www.linkedin.com/in/bruno-lima,,Itaú Unibanco,Analista de Dados,05 May 2021
Carla,Dias,https://www.linkedin.com/in/carla-dias,,Mento Publicidade,Planejamento,01 Jan 2023
"Pedro, Jr.",Alves,https://www.linkedin.com/in/pedro-alves,,Natura &Co,"Gerente de Marca, Natura",20 Oct 2026
`;
export const CONEXOES_B = `First Name,Last Name,URL,Email Address,Company,Position,Connected On
Juliana,Prado,https://www.linkedin.com/in/juliana-prado/,,Itaú Unibanco,Diretora de Marketing,15 Jun 2022
Lia,Campos,https://www.linkedin.com/in/lia-campos,,Volkswagen,CMO,08 Aug 2020
Marcos,Reis,https://www.linkedin.com/in/marcos-reis,,Heineken Brasil,Coordenador de Trade Marketing,09 Sep 2024
`;
export const POSICOES_A = `Company Name,Title,Description,Location,Started On,Finished On
Mento Publicidade,Diretora de Mídia,,São Paulo,Jan 2022,
Publicis Brasil,Gerente de Mídia,"Planejamento, compra e negociação",São Paulo,Mar 2018,Dec 2021
`;
export const PERFIL_A = `First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers
Fulana,de Tal,,,,Diretora de Mídia na Mento Publicidade,,Publicidade,,São Paulo,,,
`;
export const POSICOES_B = `Company Name,Title,Description,Location,Started On,Finished On
Mento Publicidade,Sócio-diretor,,São Paulo,Mar 2020,
Heineken Brasil,Gerente de Marketing,,São Paulo,Jan 2015,Feb 2020
`;
export const PERFIL_B = `First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers
Ciclano,Souza,,,,Sócio na Mento,,Publicidade,,São Paulo,,,
`;
/** Um .zip como o do LinkedIn (deflate), com os arquivos dados, mais uma mensagem que nunca deve ser lida. */
export async function zipar(arquivos: Record<string, string>): Promise<ArrayBuffer> {
  const enc = new TextEncoder(), partes: Uint8Array[] = [], central: Uint8Array[] = []; let off = 0, n = 0;
  const deflate = async (d: Uint8Array) => new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  for (const [nome, texto] of Object.entries({ ...arquivos, 'messages.csv': 'CONVERSATION ID,FROM,CONTENT\n1,X,segredo' })) {
    const nm = enc.encode(nome), dados = enc.encode(texto), comp = await deflate(dados);
    const loc = new DataView(new ArrayBuffer(30)); loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(8, 8, true); loc.setUint32(18, comp.length, true); loc.setUint32(22, dados.length, true); loc.setUint16(26, nm.length, true);
    const cen = new DataView(new ArrayBuffer(46)); cen.setUint32(0, 0x02014b50, true); cen.setUint16(6, 20, true); cen.setUint16(10, 8, true); cen.setUint32(20, comp.length, true); cen.setUint32(24, dados.length, true); cen.setUint16(28, nm.length, true); cen.setUint32(42, off, true);
    partes.push(new Uint8Array(loc.buffer), nm, comp); central.push(new Uint8Array(cen.buffer), nm); off += 30 + nm.length + comp.length; n++;
  }
  const tamC = central.reduce((t, x) => t + x.length, 0), fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, n, true); fim.setUint16(10, n, true); fim.setUint32(12, tamC, true); fim.setUint32(16, off, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)]).arrayBuffer();
}
