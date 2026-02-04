#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';
import { existsSync } from 'fs';

const args = ['--emitDeclarationOnly'];

// Prefer running the local TypeScript compiler via node
const tscJs = path.join(process.cwd(), 'node_modules', 'typescript', 'lib', 'tsc.js');
if (existsSync(tscJs)) {
  const res = spawnSync(process.execPath, [tscJs, ...args], { stdio: 'inherit' });
  if (res.error) {
    console.error(res.error);
    process.exit(1);
  }
  process.exit(res.status || 0);
}

// Fallback: use the platform-specific bin in node_modules/.bin
let tscBin = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');
if (process.platform === 'win32') tscBin += '.cmd';
if (existsSync(tscBin)) {
  const res = spawnSync(tscBin, args, { stdio: 'inherit' });
  if (res.error) {
    console.error(res.error);
    process.exit(1);
  }
  process.exit(res.status || 0);
}

// Last resort: use pnpm exec (should be available in CI)
const res = spawnSync('pnpm', ['exec', 'tsc', ...args], { stdio: 'inherit' });
if (res.error) {
  console.error('Failed to run tsc:', res.error);
  process.exit(1);
}
process.exit(res.status || 0);
