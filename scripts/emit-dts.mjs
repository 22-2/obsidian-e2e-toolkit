#!/usr/bin/env node
import { spawnSync } from 'child_process';

const args = ['--emitDeclarationOnly'];
const res = spawnSync('tsc', args, { stdio: 'inherit' });
if (res.error) {
  console.error(res.error);
  process.exit(1);
}
process.exit(res.status || 0);
