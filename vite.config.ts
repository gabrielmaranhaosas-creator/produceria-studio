import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

const commit = (() => { try { return execSync('git rev-parse --short HEAD').toString().trim(); } catch { return 'local'; } })();

export default defineConfig({
  define: { __VERSAO__: JSON.stringify(`${process.env.npm_package_version}+${commit}`) },
  build: {
    outDir: 'dist/modulos',
    emptyOutDir: true,
    lib: { entry: 'src/main.ts', formats: ['es'], fileName: () => 'studio-modulos.js' },
    minify: 'esbuild',
    target: 'es2022',
  },
});
