declare module '*.css?inline' { const css: string; export default css; }
declare module '*?raw' { const texto: string; export default texto; }
interface ImportMeta {
  /** Vite: carrega vários arquivos de uma vez (usado com { query: '?raw', import: 'default', eager: true }). */
  glob(padrao: string | string[], opcoes?: { query?: string; import?: string; eager?: boolean }): Record<string, unknown>;
}
