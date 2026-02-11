import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  splitting: false,
  target: 'node24',
  // Inject CJS shims for import.meta.url, __dirname, etc.
  shims: true,
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs',
    };
  },
  external: [
    ...Object.keys(require('./package.json').dependencies || {}),
    ...Object.keys(require('./package.json').peerDependencies || {}),
  ],
});

