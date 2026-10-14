const { spawnSync } = require('child_process');
const path = require('path');
const { existsSync } = require('fs');

const fs = require('fs');
const distPath = path.resolve(__dirname, '..', 'dist');

// When package managers run lifecycle scripts, they usually set INIT_CWD
// to the original working directory where the install was invoked.
// If INIT_CWD differs from the package's own directory (process.cwd()),
// this package is being installed as a dependency — skip heavy postinstall.

const cwd = process.cwd();
const initCwd = process.env.INIT_CWD || '';
const isDependencyInstall = initCwd && path.resolve(initCwd) !== path.resolve(cwd);

// When installed as a dependency, avoid running the heavy setup by default.
// Reuse assets already prepared in the consumer project. A Git dependency does
// not contain the local-pack assets, so a dist-only check would leave the
// package unusable. In that case, prepare the assets as part of installation.
if (isDependencyInstall) {
  if (process.env.OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP === '1') {
    console.log('Skipping obsidian-e2e-toolkit postinstall (skipped by OBSIDIAN_E2E_TOOLKIT_SKIP_SETUP)');
    process.exit(0);
  }

  const consumerAssets = path.join(initCwd, 'obsidian-e2e-toolkit-assets', 'obsidian-unpacked', 'main.cjs');
  if (fs.existsSync(consumerAssets) && process.env.OBSIDIAN_E2E_TOOLKIT_RUN_SETUP !== '1') {
    console.log('obsidian-e2e-toolkit: consumer assets already exist, skipping setup.');
    process.exit(0);
  }

  if (process.env.OBSIDIAN_E2E_TOOLKIT_RUN_SETUP === '1') {
    console.log('Running obsidian-e2e-toolkit postinstall (forced by OBSIDIAN_E2E_TOOLKIT_RUN_SETUP)');
  } else {
    console.log('Running obsidian-e2e-toolkit postinstall (consumer assets are missing).');
  }
}

// A source checkout used directly can skip setup once its build is ready.
if (fs.existsSync(distPath) && !isDependencyInstall) {
  console.log('obsidian-e2e-toolkit: dist already exists, skipping build.');
  process.exit(0);
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
    console.log('If you plan to run E2E tests, ensure `electron` is installed in the project.');
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
