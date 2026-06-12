import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: {
    cjsReexport: true,
  },
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  target: 'node24',
  // Inject CJS shims for import.meta.url, __dirname, etc.
  shims: true,
});
