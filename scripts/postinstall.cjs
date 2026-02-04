const { spawnSync } = require('child_process');
const path = require('path');

// When package managers run lifecycle scripts, they usually set INIT_CWD
// to the original working directory where the install was invoked.
// If INIT_CWD differs from the package's own directory (process.cwd()),
// this package is being installed as a dependency — skip heavy postinstall.

const cwd = process.cwd();
const initCwd = process.env.INIT_CWD || '';

// By default run the setup even when installed as a dependency so the
// toolkit has required unpacked assets available at runtime. Consumers
// that want to skip the heavy download can set
// OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP=1 in their environment.
if (initCwd && path.resolve(initCwd) !== path.resolve(cwd)) {
  if (process.env.OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP === '1') {
    console.log('Skipping obsidian-e2e-toolkit postinstall (skipped by env)');
    process.exit(0);
  }
  console.log('Running obsidian-e2e-toolkit postinstall (installed as dependency)');
}

function run(nodePath, args) {
  const r = spawnSync(nodePath, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status);
}

try {
  console.log('Running electron installer...');
  run(process.execPath, [path.resolve('node_modules', 'electron', 'install.js')]);
} catch (err) {
  console.error('Electron install failed:', err);
  process.exit(1);
}

try {
  console.log('Running setup.mjs...');
  run(process.execPath, [path.resolve('scripts', 'setup.mjs')]);
} catch (err) {
  console.error('Setup script failed:', err);
  process.exit(1);
}
