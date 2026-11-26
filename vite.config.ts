import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import tabelaCompacta from './scripts/tabela-compacta.mjs';
import kitFora from './scripts/kit-fora.mjs';
import textoMini from './scripts/texto-mini.mjs';

const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'local'; } })();

// Dois builds: o completo (dist/modulos, para a cópia de consulta e o legado) e o enxuto (`--mode enxuto`,
// dist/enxuto, para o Studio no claude.ai), sem os arquivos dos plugins, que ficam no banco (scripts/kit-fora.mjs).
export default defineConfig(({ mode }) => ({
  define: { __VERSAO__: JSON.stringify(`${process.env.npm_package_version}+${commit}`) },
  plugins: [textoMini(), tabelaCompacta(), ...(mode === 'enxuto' ? [kitFora()] : [])],
  build: {
    outDir: mode === 'enxuto' ? 'dist/enxuto' : 'dist/modulos',
    emptyOutDir: true,
    lib: { entry: 'src/main.ts', formats: ['es'], fileName: () => 'studio-modulos.js' },
    minify: 'esbuild',
    target: 'es2022',
  },
}));
