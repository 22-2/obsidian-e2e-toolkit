import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Delegate to CommonJS postinstall for maximum compatibility.
require('./postinstall.cjs');
