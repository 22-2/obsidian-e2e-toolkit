const { spawnSync } = require('child_process');
const path = require('path');
const { existsSync } = require('fs');

// When package managers run lifecycle scripts, they usually set INIT_CWD
// to the original working directory where the install was invoked.
// If INIT_CWD differs from the package's own directory (process.cwd()),
// this package is being installed as a dependency — skip heavy postinstall.

const cwd = process.cwd();
const initCwd = process.env.INIT_CWD || '';
const isDependencyInstall = initCwd && path.resolve(initCwd) !== path.resolve(cwd);

// By default run the setup even when installed as a dependency so the
// toolkit has required unpacked assets available at runtime. Consumers
// that want to skip the heavy download can set
// OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP=1 in their environment.
if (isDependencyInstall) {
  if (process.env.OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP === '1') {
    console.log('Skipping obsidian-e2e-toolkit postinstall (skipped by env)');
    process.exit(0);
  }
  console.log('Running obsidian-e2e-toolkit postinstall (installed as dependency)');
}

function run(nodePath, args, envOverrides = {}) {
  const r = spawnSync(nodePath, args, {
    stdio: 'inherit',
    env: { ...process.env, ...envOverrides },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status);
}

try {
  const electronInstall = path.resolve('node_modules', 'electron', 'install.js');
  if (existsSync(electronInstall)) {
    console.log('Running electron installer...');
    run(process.execPath, [electronInstall]);
  } else {
    console.log('Skipping electron installer (electron not installed).');
  }
} catch (err) {
  console.error('Electron install failed:', err);
  process.exit(1);
}

try {
  console.log('Running setup.mjs...');
  const envOverrides = isDependencyInstall
    ? { OBSIDIAN_E2E_TOOLKIT_HOME: initCwd }
    : {};
  run(process.execPath, [path.resolve('scripts', 'setup.mjs')], envOverrides);
} catch (err) {
  console.error('Setup script failed:', err);
  process.exit(1);
}
