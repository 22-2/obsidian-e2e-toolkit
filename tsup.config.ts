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
  external: [
    ...Object.keys(require('./package.json').dependencies || {}),
    ...Object.keys(require('./package.json').peerDependencies || {}),
  ],
});
