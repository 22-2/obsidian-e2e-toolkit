// node_modules/.pnpm/tsup@8.5.1_typescript@5.9.3/node_modules/tsup/assets/esm_shims.js
import path from "path";
import { fileURLToPath } from "url";
var getFilename = () => fileURLToPath(import.meta.url);
var getDirname = () => path.dirname(getFilename());
var __dirname = /* @__PURE__ */ getDirname();
var __filename = /* @__PURE__ */ getFilename();

// src/internal/logger.ts
import chalk from "chalk";
import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
var colors = {
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
};
prefix.reg(log);
prefix.apply(log, {
  format(level, name, timestamp) {
    const color = colors[level.toUpperCase()] || chalk.white;
    const paddedLevel = level.toUpperCase().padEnd(5, " ");
    const nameStr = name ? `[${name}]` : "";
    return `${chalk.gray(`[${timestamp}]`)} ${color(paddedLevel)} ${chalk.green(
      nameStr
    )}`;
  }
});
log.setDefaultLevel("warn");
function formatScope(scope) {
  if (!scope) {
    return "";
  }
  const entries = [
    scope.runId ? `run=${scope.runId}` : "",
    scope.phase ? `phase=${scope.phase}` : ""
  ].filter(Boolean);
  return entries.length ? `[${entries.join(" ")}] ` : "";
}
function formatLogMessage(message, scope) {
  return `${formatScope(scope)}${message}`;
}
function createScopedLogger(name, scope) {
  const scoped = log.getLogger(name);
  const invoke = (method, message, ...args) => {
    scoped[method](formatLogMessage(message, scope), ...args);
  };
  return {
    trace: (message, ...args) => invoke("trace", message, ...args),
    debug: (message, ...args) => invoke("debug", message, ...args),
    info: (message, ...args) => invoke("info", message, ...args),
    warn: (message, ...args) => invoke("warn", message, ...args),
    error: (message, ...args) => invoke("error", message, ...args)
  };
}
function createRunId(testTitle) {
  const normalized = (testTitle || "test").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return `${normalized || "test"}-${Date.now().toString(36)}`;
}
var DEFAULT_BROWSER_CONSOLE_LOGGING_OPTIONS = {
  enabledTypes: ["warning", "warn", "error", "assert"],
  maxMessageLength: 300,
  previewLength: 160,
  ignoredMessagePatterns: ["Electron Security Warning"],
  demoteErrorMessagePatterns: ["Timeout waiting for plugin .+ to load"],
  includeLocation: false,
  includePageErrors: true,
  includeRequestFailures: true,
  includeHttpErrors: true,
  httpErrorThreshold: 400
};
function resolveBrowserConsoleLoggerConfig(configOrScope, maybeOptions) {
  const isScopeOnly = !!configOrScope && (Object.prototype.hasOwnProperty.call(configOrScope, "runId") || Object.prototype.hasOwnProperty.call(configOrScope, "phase"));
  const scope = isScopeOnly ? configOrScope : configOrScope?.scope;
  const providedOptions = isScopeOnly ? maybeOptions : configOrScope?.options;
  return {
    scope,
    options: {
      ...DEFAULT_BROWSER_CONSOLE_LOGGING_OPTIONS,
      ...providedOptions
    }
  };
}
function abbreviateMessage(text, options) {
  const maxLength = options.maxMessageLength > 0 ? options.maxMessageLength : Number.MAX_SAFE_INTEGER;
  const previewLength = Math.min(
    options.previewLength > 0 ? options.previewLength : maxLength,
    maxLength
  );
  const normalized = text.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, previewLength)}... [${normalized.length} chars; truncated at ${maxLength}]`;
}
function shouldDemoteError(type, message, demoteErrorPatterns) {
  if (!(["error", "assert"].includes(type) || type === "pageerror")) {
    return false;
  }
  return demoteErrorPatterns.some((pattern) => pattern.test(message));
}
function toLogMethod(type) {
  if (["error", "assert"].includes(type)) {
    return "error";
  }
  if (["warning", "warn"].includes(type)) {
    return "warn";
  }
  if (type === "debug") {
    return "debug";
  }
  return "info";
}
function setupBrowserConsoleLogging(window2, configOrScope, maybeOptions) {
  const { scope, options } = resolveBrowserConsoleLoggerConfig(
    configOrScope,
    maybeOptions
  );
  const browserLogger = createScopedLogger("BrowserConsole", scope);
  const enabledTypes = new Set(
    options.enabledTypes.map((type) => type.toLowerCase())
  );
  const ignoredMessagePatterns = options.ignoredMessagePatterns.map(
    (pattern) => new RegExp(pattern, "i")
  );
  const demoteErrorPatterns = options.demoteErrorMessagePatterns.map(
    (pattern) => new RegExp(pattern, "i")
  );
  window2.on("console", (msg) => {
    const type = msg.type().toLowerCase();
    if (!enabledTypes.has(type)) {
      return;
    }
    const text = msg.text();
    if (ignoredMessagePatterns.some((pattern) => pattern.test(text))) {
      return;
    }
    const abbreviated = abbreviateMessage(text, options);
    const method = shouldDemoteError(type, abbreviated, demoteErrorPatterns) ? "warn" : toLogMethod(type);
    browserLogger[method](`[BROWSER:${type.toUpperCase()}] ${abbreviated}`);
    const location = msg.location();
    if (options.includeLocation && location.url && location.url !== "about:blank") {
      browserLogger.debug(
        `[BROWSER:LOCATION] ${location.url}:${location.lineNumber}:${location.columnNumber}`
      );
    }
  });
  window2.on("pageerror", (error) => {
    if (!options.includePageErrors) {
      return;
    }
    const method = shouldDemoteError(
      "pageerror",
      error.message,
      demoteErrorPatterns
    ) ? "warn" : "error";
    browserLogger[method](`[BROWSER:PAGEERROR] ${error.message}`);
    if (error.stack) {
      browserLogger.debug(`[BROWSER:STACK] ${error.stack}`);
    }
  });
  window2.on("requestfailed", (request) => {
    if (!options.includeRequestFailures) {
      return;
    }
    browserLogger.warn(`[BROWSER:REQUESTFAILED] ${request.url()}`);
    const failure = request.failure();
    if (failure) {
      browserLogger.warn(`[BROWSER:FAILURE] ${failure.errorText}`);
    }
  });
  window2.on("response", (response) => {
    if (options.includeHttpErrors && response.status() >= options.httpErrorThreshold) {
      browserLogger.warn(
        `[BROWSER:HTTP] ${response.status()} ${response.statusText()} - ${response.url()}`
      );
    }
  });
}
function toggleLoggerBy(level, filter = () => true) {
  Object.values(log.getLoggers()).filter((logger9) => filter(logger9.name)).forEach((logger9) => {
    logger9.setLevel(level);
  });
  log.setLevel(level);
}

// src/index.ts
import { test as base } from "@playwright/test";
import { merge } from "es-toolkit";
import fs3 from "fs/promises";
import log8 from "loglevel";
import os from "os";
import path9 from "path";

// src/internal/constants.ts
import { findUpSync } from "find-up";
import { existsSync as existsSync2 } from "fs";
import log2 from "loglevel";
import path3 from "path";
import invariant from "tiny-invariant";
import { fileURLToPath as fileURLToPath3 } from "url";

// src/internal/path.ts
import { existsSync, readFileSync } from "fs";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
var filename = typeof __filename !== "undefined" ? __filename : fileURLToPath2(import.meta.url);
var dirname = typeof __dirname !== "undefined" ? __dirname : path2.dirname(filename);
function resolveConfig(config) {
  const pluginDir = path2.resolve(config.pluginDir);
  if (!existsSync(pluginDir)) {
    throw new Error(`Plugin directory not found: ${pluginDir}`);
  }
  const manifestPath = path2.join(pluginDir, "manifest.json");
  let manifest;
  if (config.manifest) {
    manifest = config.manifest;
  } else if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } else {
    manifest = {
      id: "obsidian-e2e-toolkit-dummy-plugin",
      name: "Dummy Plugin",
      version: "1.0.0"
    };
  }
  const pluginId = config.pluginId || manifest.id;
  if (!pluginId) {
    throw new Error(
      "Plugin ID not found. Please provide pluginId in config or ensure manifest.json contains an 'id' field."
    );
  }
  const distDir = config.distDir ? path2.resolve(config.distDir) : path2.join(pluginDir, "dist");
  const defaultAssetsDir = path2.join(dirname, "assets");
  const assetsDir = config.assetsDir ? path2.resolve(config.assetsDir) : defaultAssetsDir;
  const defaultObsidianUnpackedDir = path2.join(dirname, ".obsidian-unpacked");
  const obsidianUnpackedDir = config.obsidianUnpackedDir ? path2.resolve(config.obsidianUnpackedDir) : defaultObsidianUnpackedDir;
  const appMainFile = config.appMainFile || "main.cjs";
  const appMainJsPath = path2.join(obsidianUnpackedDir, appMainFile);
  return {
    pluginDir,
    distDir,
    assetsDir,
    obsidianUnpackedDir,
    appMainFile,
    appMainJsPath,
    pluginId,
    manifest
  };
}
function createLaunchOptions(paths) {
  if (!existsSync(paths.appMainJsPath)) {
    throw new Error(
      `Obsidian app not found at: ${paths.appMainJsPath}. Please run the setup script to unpack Obsidian assets.`
    );
  }
  return {
    args: [
      paths.appMainJsPath,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--unsafely-disable-devtools-self-xss-warnings"
    ],
    env: {
      ...process.env,
      NODE_ENV: "development"
    }
  };
}

// src/internal/constants.ts
var filename2 = typeof __filename !== "undefined" ? __filename : fileURLToPath3(import.meta.url);
var dirname2 = typeof __dirname !== "undefined" ? __dirname : path3.dirname(filename2);
var logger = log2.getLogger("constants");
function getDefaultConfig() {
  const toolkitPackageJsonPath = findUpSync("package.json", { cwd: dirname2 });
  invariant(
    toolkitPackageJsonPath,
    "Could not find package.json for obsidian-e2e-toolkit."
  );
  const toolkitRoot = path3.dirname(toolkitPackageJsonPath);
  const manifestPath = findUpSync("manifest.json", { cwd: toolkitRoot });
  const projectRoot = manifestPath ? path3.dirname(manifestPath) : toolkitRoot;
  const toolkitHome = process.env.OBSIDIAN_E2E_TOOLKIT_HOME || (existsSync2(path3.join(toolkitRoot, "obsidian-e2e-toolkit-assets")) ? toolkitRoot : projectRoot);
  return {
    pluginDir: projectRoot,
    distDir: path3.join(projectRoot, "dist"),
    assetsDir: path3.join(toolkitRoot, "assets"),
    obsidianUnpackedDir: path3.join(
      toolkitHome,
      "obsidian-e2e-toolkit-assets",
      "obsidian-unpacked"
    ),
    appMainFile: "main.cjs"
  };
}
var RESOLVED_PATHS;
try {
  const defaultConfig = getDefaultConfig();
  RESOLVED_PATHS = resolveConfig(defaultConfig);
  logger.debug("Plugin Directory:", RESOLVED_PATHS.pluginDir);
  logger.debug("Dist Directory:", RESOLVED_PATHS.distDir);
  logger.debug("Toolkit Root:", dirname2);
  logger.debug("App Main Path:", RESOLVED_PATHS.appMainJsPath);
  invariant(existsSync2(dirname2), `Toolkit root not found at: ${dirname2}.`);
  invariant(
    existsSync2(RESOLVED_PATHS.appMainJsPath),
    `Obsidian app not found at: ${RESOLVED_PATHS.appMainJsPath}. Did you run the setup script?`
  );
} catch (error) {
  logger.error(
    "Error: Could not resolve paths. Make sure you've run the setup script.",
    error
  );
  throw error;
}
var E2E_ROOT_DIR = dirname2;
var PROJECT_ROOT_DIR = RESOLVED_PATHS.pluginDir;
var DIST_DIR = RESOLVED_PATHS.distDir;
var PLUGIN_ID = RESOLVED_PATHS.pluginId;
var SANDBOX_VAULT_NAME = "Obsidian Sandbox";
var APP_MAIN_JS_PATH = RESOLVED_PATHS.appMainJsPath;
var LAUNCH_OPTIONS = {
  args: [
    APP_MAIN_JS_PATH,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--unsafely-disable-devtools-self-xss-warnings"
  ],
  env: {
    ...process.env,
    NODE_ENV: "development"
  }
};
var CMD_ID_CLOSE_TAB = "workspace:close";
var CMD_ID_UNDO_CLOSE_TAB = "workspace:undo-close-pane";
var HOT_RELOAD_PLUGIN = {
  path: path3.join(E2E_ROOT_DIR, "assets", "hot-reload"),
  pluginId: "hot-reload",
  useSymlink: true
};
function getResolvedPaths() {
  return RESOLVED_PATHS;
}
var DEFAULT_VAULT_OPTIONS = {
  sandbox: false,
  fresh: true,
  logLevel: "warn",
  browserConsoleLogging: {
    enabledTypes: ["warning", "warn", "error", "assert"],
    maxMessageLength: 300,
    previewLength: 160,
    ignoredMessagePatterns: ["Electron Security Warning"],
    demoteErrorMessagePatterns: ["Timeout waiting for plugin .+ to load"],
    includeLocation: false,
    includePageErrors: true,
    includeRequestFailures: true,
    includeHttpErrors: true,
    httpErrorThreshold: 400
  },
  plugins: []
};

// src/internal/services/serviceIds.ts
var SERVICE_IDS = {
  electronManager: "electronManager",
  windowManager: "windowManager",
  storageManager: "storageManager",
  ipcBridge: "ipcBridge",
  vaultManager: "vaultManager",
  pluginManager: "pluginManager"
};

// src/internal/utils.ts
async function getPluginHandleMap(page, plugins) {
  const pluginIds = plugins.map((p) => p.pluginId).filter(Boolean);
  logger2.debug("getPluginHandleMap: waiting for plugin IDs:", pluginIds);
  if (pluginIds.length === 0) {
    logger2.debug(
      "getPluginHandleMap: no plugin IDs to wait for \u2014 returning empty map"
    );
    return page.evaluateHandle(() => /* @__PURE__ */ new Map());
  }
  try {
    await page.waitForFunction(
      (pluginIds2) => {
        const plugins2 = window.app?.plugins?.plugins;
        return !!plugins2 && pluginIds2.every((id) => plugins2[id]);
      },
      pluginIds,
      { timeout: 3e4 }
    );
  } catch (err) {
    logger2.error(
      "getPluginHandleMap: timeout waiting for plugins to load",
      err && err.message
    );
    try {
      const available = await page.evaluate(
        () => Object.keys(window.app?.plugins?.plugins || {})
      );
      logger2.error(
        "getPluginHandleMap: available app.plugins.plugins keys:",
        available
      );
    } catch (e) {
      logger2.error(
        "getPluginHandleMap: failed to enumerate app.plugins.plugins",
        e && e.message
      );
    }
    throw err;
  }
  return page.evaluateHandle((plugins2) => {
    const map = /* @__PURE__ */ new Map();
    const idMapping = /* @__PURE__ */ new Map();
    plugins2.forEach((p) => {
      const plugin = globalThis.app?.plugins.plugins[p.pluginId];
      if (plugin) {
        map.set(p.pluginId, plugin);
        if (p.originalId) {
          map.set(p.originalId, plugin);
          idMapping.set(p.originalId, p.pluginId);
        }
      }
    });
    window.__pluginIdMapping = idMapping;
    return map;
  }, plugins);
}
function handleTestError(testInfo) {
  const status = testInfo.status;
  if (status === "passed" || status === "skipped") {
    logger2.debug(`Test finished with status: ${status}.`);
    return;
  }
  logger2.error(`Test finished with status: ${status}. Pausing for debug.`);
  if (testInfo.error) {
    const separator = "=".repeat(20);
    logger2.error(`
${separator} TEST FAILED ${separator}`);
    logger2.error(testInfo.error.message);
    if (testInfo.error.stack) {
      const firstNewlineIndex = testInfo.error.stack.indexOf("\n");
      const stackWithoutMessage = testInfo.error.stack.substring(
        firstNewlineIndex + 1
      );
      logger2.error(stackWithoutMessage);
    }
    logger2.error("=".repeat(53) + "\n");
  }
  if (!process.env.CI) {
    logger2.debug(testInfo.errors);
  }
}
async function createObsidianContext(launcher) {
  return launcher.launch();
}

// src/internal/features/CreateVaultContextFeature.ts
var CreateVaultContextFeature = class {
  async run(input, ctx, services) {
    const electronManager = services.getValue(
      SERVICE_IDS.electronManager
    );
    const vaultName = await input.page.evaluate(
      () => app?.vault?.getName()
    );
    let pluginHandleMap;
    if (!input.plugins || input.plugins.length === 0) {
      pluginHandleMap = await input.page.evaluateHandle(() => /* @__PURE__ */ new Map());
    } else {
      pluginHandleMap = await getPluginHandleMap(
        input.page,
        input.plugins || []
      );
    }
    return {
      electronApp: electronManager.getApp(),
      page: input.page,
      pluginHandleMap,
      vaultName,
      paths: ctx.paths
    };
  }
};

// src/internal/services/PageWaiter.ts
var PageWaiter = class _PageWaiter {
  static async waitForPage(page, timeout = 15e3) {
    await page.waitForLoadState("domcontentloaded");
    if (_PageWaiter.isStarterPage(page)) {
      await _PageWaiter.waitForStarterReady(page, timeout);
      return;
    }
    await _PageWaiter.waitForVaultReady(page, timeout);
  }
  static isStarterPage(page) {
    return page.url().includes("starter");
  }
  /**
   * Wait for the Obsidian vault to be ready
   * This ensures the workspace layout is initialized
   */
  static async waitForVaultReady(page, timeout) {
    await page.waitForFunction(
      () => {
        const workspace = window.app?.workspace;
        return !!workspace && (workspace.layoutReady === true || !!workspace.activeLeaf);
      },
      { timeout }
    );
  }
  /**
   * Wait for the Obsidian starter (welcome) page to be ready
   * This page appears when no vault is open
   */
  static async waitForStarterReady(page, timeout) {
    await page.waitForSelector(".mod-change-language", {
      state: "visible",
      timeout
    });
  }
};

// src/internal/features/OpenStarterFeature.ts
var OpenStarterFeature = class {
  async run(_input, ctx, services) {
    const windowManager = services.getValue(
      SERVICE_IDS.windowManager
    );
    const ipcBridge = services.getValue(SERVICE_IDS.ipcBridge);
    const electronManager = services.getValue(
      SERVICE_IDS.electronManager
    );
    const page = await windowManager.executeActionAndWaitForNewWindow(
      async () => await ipcBridge.openStarter(),
      PageWaiter.waitForPage
    );
    await PageWaiter.waitForPage(page);
    ctx.runtime.activePage = page;
    return {
      electronApp: electronManager.getApp(),
      page
    };
  }
};

// src/internal/features/OpenVaultFeature.ts
var OpenVaultFeature = class {
  async run(input, ctx, services) {
    const vaultManager = services.getValue(
      SERVICE_IDS.vaultManager
    );
    const result = await vaultManager.openVault(input.options);
    ctx.runtime.activePage = result.page;
    ctx.runtime.vaultPath = result.vaultPath;
    return result;
  }
};

// src/internal/features/PrepareRuntimeFeature.ts
var PrepareRuntimeFeature = class {
  async run(input, ctx, services) {
    const storageManager = services.getValue(
      SERVICE_IDS.storageManager
    );
    const windowManager = services.getValue(
      SERVICE_IDS.windowManager
    );
    await input.initialPage.evaluate(() => {
      window.playwright = true;
    });
    await PageWaiter.waitForPage(input.initialPage);
    await storageManager.clearAll();
    await input.initialPage.evaluate(() => {
      localStorage.setItem("language", "en");
    });
    await input.initialPage.reload({ waitUntil: "domcontentloaded" });
    const starterPage = await windowManager.ensureSingleWindow();
    await PageWaiter.waitForPage(starterPage);
    ctx.runtime.activePage = starterPage;
    return { starterPage };
  }
};

// src/internal/features/SetupPluginsFeature.ts
var SetupPluginsFeature = class {
  async run(input, _ctx, services) {
    const pluginManager = services.getValue(
      SERVICE_IDS.pluginManager
    );
    await pluginManager.installAll();
    await pluginManager.enableAll(input.page);
    await input.page.reload();
    await PageWaiter.waitForPage(input.page);
  }
};

// src/internal/services/ElectronAppManager.ts
import { existsSync as existsSync3 } from "fs";
import fs from "fs/promises";
import log3 from "loglevel";
import { createRequire } from "module";
import path4 from "path";
import { _electron as electron } from "playwright/test";
var logger3 = log3.getLogger("ElectronAppManager");
var ElectronAppManager = class {
  constructor(paths, tempUserDataDir) {
    this.paths = paths;
    this.tempUserDataDir = tempUserDataDir;
  }
  electronApp;
  tempUserDataDir;
  async launch() {
    this.electronApp = await this.launchElectronApp();
    return this.electronApp;
  }
  async launchElectronApp() {
    try {
      const req = createRequire(import.meta.url);
      const pkgJson = req.resolve("electron/package.json");
      const electronRoot = path4.dirname(pkgJson);
      const distDir = path4.join(electronRoot, "dist");
      if (!existsSync3(distDir)) {
        logger3.error(`Electron dist not found at ${distDir}`);
        logger3.error(
          `Electron root contents:`,
          await fs.readdir(electronRoot)
        );
        throw new Error(
          "Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly."
        );
      }
    } catch (err) {
      logger3.error(
        "Electron preflight check failed:",
        err && err.message ? err.message : err
      );
      throw err;
    }
    const baseLaunchOptions = createLaunchOptions(this.paths);
    const launchOptions = {
      ...baseLaunchOptions,
      args: [
        ...baseLaunchOptions.args,
        `--user-data-dir=${this.tempUserDataDir}`
      ],
      env: {
        ...baseLaunchOptions.env,
        PLAYWRIGHT: "true",
        CI: process.env.CI || "false"
      }
    };
    return await electron.launch(launchOptions);
  }
  async cleanup() {
    if (this.electronApp) {
      try {
        await this.closeAllWindows();
        await this.electronApp.close();
      } catch (error) {
        logger3.warn("Error during cleanup:", error);
      }
    }
    logger3.debug("ElectronAppManager cleaned up");
  }
  async closeAllWindows() {
    const windows = this.electronApp.windows();
    await Promise.all(windows.map((win) => win.close()));
  }
  getApp() {
    if (!this.electronApp) {
      throw new Error("ElectronApp not initialized");
    }
    return this.electronApp;
  }
  getCurrentPage() {
    return this.electronApp?.windows()[0];
  }
  getTempUserDataDir() {
    return this.tempUserDataDir;
  }
};

// src/internal/services/ipc.ts
var IPCBridge = class {
  constructor(setup) {
    this.setup = setup;
  }
  async send(channel, ...args) {
    await this.ensurePageLoaded();
    return (await this.setup.ensureSingleWindow()).evaluate(
      (args2) => {
        const [ch, ...restArgs] = args2;
        return window.electron.ipcRenderer.sendSync(
          ch,
          ...restArgs
        );
      },
      [channel, ...args]
    );
  }
  async ensurePageLoaded() {
    const page = await this.setup.ensureSingleWindow();
    await PageWaiter.waitForPage(page);
  }
  async openVault(vaultPath, forceNew = false) {
    return this.send("vault-open", vaultPath, forceNew);
  }
  async openSandbox() {
    return void this.send("sandbox");
  }
  async getSandboxPath() {
    return this.send("get-sandbox-vault-path");
  }
  async openStarter() {
    await this.send("starter");
  }
  async getVaultList() {
    return this.send("vault-list");
  }
  async removeVault(vaultPath) {
    await this.send("vault-remove", vaultPath);
  }
};

// src/internal/services/PluginManager.ts
import { expect } from "@playwright/test";
import {
  copyFileSync,
  existsSync as existsSync4,
  mkdirSync,
  readdirSync,
  readFileSync as readFileSync2,
  statSync,
  symlinkSync,
  writeFileSync
} from "fs";
import log4 from "loglevel";
import path5 from "path";
var logger4 = log4.getLogger("PluginManager");
var PluginManager = class {
  constructor(plugins, vaultPath) {
    this.plugins = plugins;
    this.vaultPath = vaultPath;
  }
  async installAll() {
    const pluginsDir = this.ensurePluginsDirectory();
    const installedIds = [];
    const installedPlugins = [];
    for (const plugin of this.getPlugins()) {
      if (await this.installSingle(pluginsDir, plugin)) {
        installedIds.push(plugin.pluginId);
        installedPlugins.push(plugin);
      }
    }
    this.plugins = installedPlugins;
    this.updateCommunityPluginsJson(installedIds);
    logger4.debug(`Installed plugins: ${installedIds.join(", ")}`);
  }
  getPlugins() {
    return this.plugins || [];
  }
  ensurePluginsDirectory() {
    const obsidianDir = path5.join(this.vaultPath, ".obsidian");
    const pluginsDir = path5.join(obsidianDir, "plugins");
    if (!existsSync4(obsidianDir)) {
      mkdirSync(obsidianDir, { recursive: true });
    }
    if (!existsSync4(pluginsDir)) {
      mkdirSync(pluginsDir, { recursive: true });
    }
    return pluginsDir;
  }
  async installSingle(pluginsDir, plugin) {
    if (!this.validatePluginPath(plugin)) {
      logger4.warn(`Invalid plugin path: ${plugin.path}`);
      return false;
    }
    const destDir = path5.join(pluginsDir, plugin.pluginId);
    if (plugin.symlink) {
      logger4.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
      return this.createPluginSymlink(
        plugin.path,
        destDir,
        plugin.pluginId
      );
    } else {
      logger4.debug(`Copying files for plugin: ${plugin.pluginId}`);
      return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
    }
  }
  validatePluginPath(plugin) {
    if (!existsSync4(plugin.path)) {
      logger4.warn(`Plugin path not found: ${plugin.path}`);
      return false;
    }
    if (!existsSync4(path5.join(plugin.path, "manifest.json"))) {
      logger4.warn(`manifest.json not found in: ${plugin.path}`);
      return false;
    }
    return true;
  }
  createPluginSymlink(sourcePath, destDir, pluginId) {
    if (existsSync4(destDir)) {
      logger4.debug(
        `Destination already exists: ${destDir}, skipping symlink`
      );
      return true;
    }
    try {
      symlinkSync(sourcePath, destDir, "dir");
      logger4.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
      return true;
    } catch (error) {
      logger4.error(`Failed to create symlink for ${pluginId}:`, error);
      return false;
    }
  }
  copyPluginFiles(sourcePath, destDir, pluginId) {
    if (!existsSync4(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    const filesToCopy = ["manifest.json", "main.js", "styles.css"];
    for (const file of readdirSync(sourcePath)) {
      const srcFile = path5.join(sourcePath, file);
      const stat = statSync(srcFile);
      if (stat.isDirectory() || !filesToCopy.includes(file)) {
        continue;
      }
      const destFile = path5.join(destDir, file);
      copyFileSync(srcFile, destFile);
      logger4.debug(`Copied: ${file} to ${destDir}`);
    }
    logger4.debug(`Installed plugin: ${pluginId}`);
    return true;
  }
  updateCommunityPluginsJson(installedIds) {
    const pluginsJsonPath = path5.join(
      this.vaultPath,
      ".obsidian",
      "community-plugins.json"
    );
    writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
  }
  async enableAll(page) {
    await this.disableRestrictedMode(page);
    const pluginIds = this.plugins.map((p) => p.pluginId);
    const enabledIds = await page.evaluate(async (ids) => {
      const app2 = window.app;
      const enabled = [];
      for (const id of ids) {
        await app2.plugins.enablePluginAndSave(id);
        enabled.push(id);
      }
      return enabled;
    }, pluginIds);
    logger4.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
  }
  async disableRestrictedMode(page) {
    await this.waitForPluginsAPI(page);
    if (await this.isCommunityPluginsEnabled(page)) {
      logger4.debug("Community plugins are already enabled.");
      return;
    }
    logger4.debug("Attempting to enable community plugins...");
    await this.openCommunityPluginsSettings(page);
    await this.clickEnableButtons(page);
    await this.closeCommunityPluginsSettings(page);
    await this.verifyCommunityPluginsEnabled(page);
  }
  async waitForPluginsAPI(page) {
    await page.waitForFunction(
      () => {
        const app2 = window.app;
        return app2?.plugins?.isEnabled !== void 0;
      },
      { timeout: 1e4 }
    );
  }
  async isCommunityPluginsEnabled(page) {
    return await page.evaluate(() => {
      const app2 = window.app;
      return app2?.plugins?.isEnabled?.() ?? false;
    });
  }
  async openCommunityPluginsSettings(page) {
    await page.evaluate(() => {
      window.app.setting.open();
      window.app.setting.openTabById("community-plugins");
    });
  }
  async clickEnableButtons(page) {
    const getButtonText = () => page.evaluate(() => {
      const button = window.app.setting.activeTab?.setting?.contentEl?.querySelector(
        "button.mod-cta"
      );
      return button?.textContent?.trim() || null;
    });
    const clickButton = () => page.evaluate(() => {
      const button = window.app.setting.activeTab?.setting?.contentEl?.querySelector(
        "button.mod-cta"
      );
      button?.click();
    });
    let buttonText = await getButtonText();
    if (buttonText === "Turn on and reload") {
      logger4.debug("Clicking 'Turn on and reload'...");
      await clickButton();
      await page.waitForTimeout(1e3);
      buttonText = await getButtonText();
    }
    if (buttonText === "Turn on community plugins") {
      logger4.debug("Clicking 'Turn on community plugins'...");
      await clickButton();
      await page.waitForTimeout(1e3);
    }
  }
  async closeCommunityPluginsSettings(page) {
    await page.keyboard.press("Escape");
  }
  async verifyCommunityPluginsEnabled(page) {
    const isEnabled = await this.isCommunityPluginsEnabled(page);
    expect(isEnabled, "Failed to enable community plugins.").toBe(true);
  }
};
function getActualPluginId(pluginPath) {
  const manifestPath = path5.join(pluginPath, "manifest.json");
  if (existsSync4(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync2(manifestPath, "utf-8"));
      return manifest.id;
    } catch (e) {
      logger4.warn(`Failed to parse manifest.json at ${pluginPath}`);
    }
  }
  return "";
}

// src/internal/services/ServiceContainer.ts
var ServiceContainer = class {
  services = /* @__PURE__ */ new Map();
  register(service) {
    if (this.services.has(service.id)) {
      throw new Error(`Service already registered: ${service.id}`);
    }
    this.services.set(service.id, service);
    return service;
  }
  get(id) {
    const service = this.services.get(id);
    if (!service) {
      throw new Error(`Service not found: ${id}`);
    }
    return service;
  }
  getValue(id) {
    const service = this.get(id);
    return service.value;
  }
  async setupAll(ctx) {
    for (const service of this.services.values()) {
      await service.setup?.(ctx);
    }
  }
  async disposeAll(ctx) {
    const registered = [...this.services.values()].reverse();
    for (const service of registered) {
      await service.dispose?.(ctx);
    }
  }
};
var ValueService = class {
  constructor(id, value, hooks) {
    this.id = id;
    this.value = value;
    this.hooks = hooks;
  }
  async setup(ctx) {
    await this.hooks?.setup?.(ctx, this.value);
  }
  async dispose(ctx) {
    await this.hooks?.dispose?.(ctx, this.value);
  }
};

// src/internal/services/StorageManager.ts
import chalk2 from "chalk";
import { rmSync } from "fs";
import log5 from "loglevel";
import path6 from "path";
var logger5 = log5.getLogger("StorageManager");
var StorageManager = class {
  constructor(electronApp) {
    this.electronApp = electronApp;
  }
  async clearAll() {
    await this.deleteUserDataFiles();
    await this.clearBrowserStorage();
  }
  async deleteUserDataFiles() {
    const userDataDir = await this.electronApp.evaluate(
      ({ app: app2 }) => app2.getPath("userData")
    );
    const pathsToDelete = [
      path6.join(userDataDir, "obsidian.json"),
      path6.join(userDataDir, SANDBOX_VAULT_NAME)
    ];
    for (const p of pathsToDelete) {
      logger5.debug("delete", p);
      rmSync(p, { force: true, recursive: true });
    }
  }
  async clearBrowserStorage() {
    const win = this.electronApp.windows()[0];
    if (!win) return;
    logger5.debug(chalk2.magenta("Clearing browser storage"));
    const success = await win.evaluate(async () => {
      const webContents = window.electron.remote.BrowserWindow.getFocusedWindow()?.webContents;
      if (!webContents) return false;
      webContents.session.flushStorageData();
      await webContents.session.clearStorageData({
        storages: ["indexdb", "localstorage", "websql"]
      });
      await webContents.session.clearCache();
      return true;
    });
    const message = success ? chalk2.magenta("localStorage cleared.") : chalk2.red("failed to clear localStorage");
    logger5.debug(message);
  }
};

// src/internal/services/VaultManager.ts
import chalk3 from "chalk";
import { existsSync as existsSync5, mkdirSync as mkdirSync2, rmSync as rmSync2 } from "fs";
import log6 from "loglevel";
import path7 from "path";
var logger6 = log6.getLogger("VaultManager");
var VaultManager = class {
  constructor(ipc, windowManager, options, vaultPath) {
    this.ipc = ipc;
    this.windowManager = windowManager;
    this.options = options;
    this.vaultPath = vaultPath;
  }
  async openVault(options) {
    const useSandbox = !!(options.sandbox && !process.env.CI);
    if (useSandbox) {
      return this.openSandboxVault();
    }
    return this.openNormalVault(options);
  }
  async openSandboxVault() {
    logger6.debug(chalk3.green("Opening sandbox vault..."));
    const page = await this.windowManager.executeActionAndWaitForNewWindow(
      () => this.ipc.openSandbox(),
      PageWaiter.waitForPage
    );
    const vaultPath = await this.ipc.getSandboxPath();
    logger6.debug(chalk3.green("Sandbox vault opened at:", vaultPath));
    return { vaultPath, page };
  }
  async openNormalVault(options) {
    logger6.debug("Opening normal vault...");
    const vaultPath = await this.resolveVaultPath(options);
    if (options.fresh && existsSync5(vaultPath)) {
      rmSync2(vaultPath, { recursive: true });
    }
    if (!options.fresh && !existsSync5(vaultPath)) {
      logger6.debug("Creating vault directory:", vaultPath);
      mkdirSync2(vaultPath, { recursive: true });
    }
    const page = await this.windowManager.executeActionAndWaitForNewWindow(
      async () => {
        const result = await this.ipc.openVault(
          vaultPath,
          !!options.fresh
        );
        if (result !== true) {
          throw new Error(`Failed to open vault: ${result}`);
        }
      },
      PageWaiter.waitForPage
    );
    logger6.debug("Normal vault opened:", vaultPath);
    return { vaultPath, page };
  }
  async resolveVaultPath(options = this.options) {
    if (options.name) {
      return await this.getVaultPathByName(options.name);
    }
    logger6.debug("options.name not specified, create temp dir");
    const tempPath = this.vaultPath;
    logger6.debug("temp dir created:", tempPath);
    return tempPath;
  }
  async getVaultPathByName(name) {
    return path7.join(
      process.env.USERPROFILE || process.env.HOME || "",
      "ObsidianVaults",
      name
    );
  }
};

// src/internal/services/WindowManager.ts
import chalk4 from "chalk";
import log7 from "loglevel";
var logger7 = log7.getLogger("WindowManager");
var WindowManager = class {
  constructor(electronApp) {
    this.electronApp = electronApp;
  }
  async ensureSingleWindow() {
    logger7.debug("ensureSingleWindow");
    const windows = this.electronApp.windows();
    logger7.debug(`${windows.length} opened`);
    if (windows.length === 0) {
      return await this.getFirstWindow();
    }
    const page = windows.at(-1);
    await page.waitForLoadState("domcontentloaded");
    await this.closeAllExcept(page);
    logger7.debug(`closed all except ${await page.title()}`);
    return page;
  }
  async getFirstWindow() {
    const page = await this.electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    logger7.debug("first window");
    return page;
  }
  async executeActionAndWaitForNewWindow(action, waitCallback) {
    const currentWindows = this.electronApp.windows();
    const windowPromise = this.electronApp.waitForEvent("window", {
      timeout: 1e4
    });
    await action();
    const newPage = await windowPromise;
    await waitCallback(newPage);
    await this.closeOldWindows(currentWindows, newPage);
    logger7.debug(chalk4.green("New window is ready:", newPage.url()));
    return newPage;
  }
  async closeOldWindows(oldWindows, newPage) {
    for (const window2 of oldWindows) {
      if (window2 !== newPage && !window2.isClosed()) {
        logger7.debug(
          chalk4.yellow(`Closing old window: ${await window2.title()}`)
        );
        await window2.close();
      }
    }
  }
  async closeAllExcept(keepPage) {
    for (const window2 of this.electronApp.windows()) {
      if (window2 !== keepPage && !window2.isClosed()) {
        logger7.debug(chalk4.red(`close ${window2.url()}`));
        await window2.close();
      }
    }
  }
};

// src/internal/launcher.ts
var ObsidianE2ELauncher = class {
  electronManager;
  services = null;
  serviceContext = null;
  prepareRuntimeFeature = new PrepareRuntimeFeature();
  openVaultFeature = new OpenVaultFeature();
  setupPluginsFeature = new SetupPluginsFeature();
  createVaultContextFeature = new CreateVaultContextFeature();
  openStarterFeature = new OpenStarterFeature();
  paths;
  options;
  tempVaultDir;
  initialized = false;
  scopedLogger;
  constructor({ paths, options, tempUserDataDir, runId }) {
    this.paths = paths;
    this.options = options;
    this.tempVaultDir = `${tempUserDataDir}-vault`;
    this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
    this.scopedLogger = createScopedLogger("ObsidianTestLauncher", {
      runId,
      phase: "launcher"
    });
  }
  /**
   * Optional explicit bootstrap.
   * launch() and openStarter() call this lazily, so callers usually do not need this.
   */
  async initialize() {
    await this.ensureInitialized();
  }
  async ensureInitialized() {
    if (this.initialized) {
      return;
    }
    const electronApp = await this.electronManager.launch();
    this.scopedLogger.debug("Electron app launched");
    const windowManager = new WindowManager(electronApp);
    const storageManager = new StorageManager(electronApp);
    const services = new ServiceContainer();
    services.register(
      new ValueService(
        SERVICE_IDS.electronManager,
        this.electronManager,
        {
          dispose: async () => {
            await this.electronManager.cleanup();
          }
        }
      )
    );
    services.register(
      new ValueService(SERVICE_IDS.windowManager, windowManager)
    );
    services.register(
      new ValueService(SERVICE_IDS.storageManager, storageManager)
    );
    const serviceContext = {
      paths: this.paths,
      options: this.options,
      tempVaultDir: this.tempVaultDir,
      runtime: {
        initialized: false,
        electronApp
      },
      logger: this.scopedLogger
    };
    await services.setupAll(serviceContext);
    const initialPage = await electronApp.waitForEvent("window");
    this.scopedLogger.debug("Initial window event received");
    const { starterPage } = await this.prepareRuntimeFeature.run(
      { initialPage },
      serviceContext,
      services
    );
    this.scopedLogger.debug("Starter page ready", starterPage.url());
    const ipcBridge = new IPCBridge({
      ensureSingleWindow: windowManager.ensureSingleWindow.bind(windowManager)
    });
    services.register(new ValueService(SERVICE_IDS.ipcBridge, ipcBridge));
    const vaultManager = new VaultManager(
      ipcBridge,
      windowManager,
      this.options,
      this.tempVaultDir
    );
    services.register(
      new ValueService(SERVICE_IDS.vaultManager, vaultManager)
    );
    const vaultPath = await vaultManager.resolveVaultPath();
    this.scopedLogger.debug("Vault path resolved", vaultPath);
    const pluginManager = new PluginManager(
      this.options.plugins.map((plugin) => ({
        ...plugin,
        pluginId: getActualPluginId(plugin.path)
      })),
      vaultPath
    );
    services.register(
      new ValueService(SERVICE_IDS.pluginManager, pluginManager)
    );
    serviceContext.runtime.vaultPath = vaultPath;
    serviceContext.runtime.initialized = true;
    this.services = services;
    this.serviceContext = serviceContext;
    this.initialized = true;
  }
  requireServices() {
    if (!this.services) {
      throw new Error("Service container not initialized");
    }
    return this.services;
  }
  requireServiceContext() {
    if (!this.serviceContext) {
      throw new Error("Service context not initialized");
    }
    return this.serviceContext;
  }
  async cleanup() {
    if (this.services && this.serviceContext) {
      await this.services.disposeAll(this.serviceContext);
    } else {
      await this.electronManager.cleanup();
    }
    this.initialized = false;
    this.services = null;
    this.serviceContext = null;
    this.scopedLogger.debug("Launcher cleanup completed");
  }
  async launch(options = DEFAULT_VAULT_OPTIONS) {
    await this.ensureInitialized();
    const services = this.requireServices();
    const serviceContext = this.requireServiceContext();
    const pluginManager = services.getValue(
      SERVICE_IDS.pluginManager
    );
    this.scopedLogger.debug("Opening vault", options);
    const runOptions = {
      ...this.options,
      ...options
    };
    const { page } = await this.openVaultFeature.run(
      { options: runOptions },
      serviceContext,
      services
    );
    const configuredPlugins = pluginManager.getPlugins() || [];
    this.scopedLogger.debug(
      "Configured plugins",
      configuredPlugins.map((p) => ({
        path: p.path,
        pluginId: p.pluginId
      }))
    );
    if (configuredPlugins.length) {
      this.scopedLogger.debug("Installing configured plugins");
      await this.setupPluginsFeature.run(
        { page },
        serviceContext,
        services
      );
      this.scopedLogger.debug(
        `${pluginManager.getPlugins().length} plugins setup completed`
      );
    }
    this.scopedLogger.debug(
      "Creating vault context",
      pluginManager.getPlugins().map((p) => p.pluginId)
    );
    const context = await this.createVaultContextFeature.run(
      { page, plugins: pluginManager.getPlugins() },
      serviceContext,
      services
    );
    this.scopedLogger.debug("Vault context created", context.vaultName);
    const notices = await context.page.locator(".notice-container .notice").all();
    this.scopedLogger.debug("Removing notices");
    await Promise.all(notices.map((notice) => notice.click()));
    return context;
  }
  async openStarter() {
    await this.ensureInitialized();
    return this.openStarterFeature.run(
      void 0,
      this.requireServiceContext(),
      this.requireServices()
    );
  }
  getVaultOptions() {
    return this.options;
  }
};

// src/ObsidianAPI.ts
import { expect as expect2 } from "playwright/test";
import invariant2 from "tiny-invariant";
var ObsidianAPI = class {
  page;
  context;
  constructor(context) {
    invariant2(context.page, "Page context is required");
    this.page = context.page;
    this.context = context;
  }
  appState(callback, arg) {
    return this.page.evaluate(callback, arg);
  }
  // ========================================
  // Workspace State - DOMを介さない状態参照
  // ========================================
  async activeLeaf() {
    return this.appState(() => {
      const leaf = app.workspace.activeLeaf;
      if (!leaf) {
        return null;
      }
      const view = leaf.view;
      const file = view?.file ?? app.workspace.getActiveFile();
      return {
        active: true,
        viewType: typeof view?.getViewType === "function" ? view.getViewType() : null,
        filePath: file?.path ?? null,
        title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? file?.basename ?? null : file?.basename ?? null
      };
    });
  }
  async activeEditor() {
    return this.appState(() => {
      const leaf = app.workspace.activeLeaf;
      const editor = app.workspace.activeEditor?.editor;
      if (!leaf || !editor) {
        return null;
      }
      const view = leaf.view;
      const file = view?.file ?? app.workspace.getActiveFile();
      return {
        viewType: typeof view?.getViewType === "function" ? view.getViewType() : null,
        filePath: file?.path ?? null,
        content: editor.getValue() ?? ""
      };
    });
  }
  async activeTab() {
    return this.activeLeaf();
  }
  async allTabs() {
    return this.appState(() => {
      const leaves = [];
      app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
      return leaves.map((leaf) => {
        const view = leaf.view;
        const file = view?.file ?? null;
        return {
          active: leaf === app.workspace.activeLeaf,
          viewType: typeof view?.getViewType === "function" ? view.getViewType() : null,
          filePath: file?.path ?? null,
          title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? file?.basename ?? null : file?.basename ?? null
        };
      });
    });
  }
  async view(viewType) {
    return this.appState((type) => {
      const leaf = app.workspace.activeLeaf;
      const view = leaf?.view;
      if (!leaf || typeof view?.getViewType !== "function" || view.getViewType() !== type) {
        return null;
      }
      const file = view?.file ?? app.workspace.getActiveFile();
      return {
        active: true,
        viewType: view.getViewType(),
        filePath: file?.path ?? null,
        title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? file?.basename ?? null : file?.basename ?? null
      };
    }, viewType);
  }
  vaultName() {
    return this.appState(() => app.vault.getName());
  }
  async title(viewType) {
    const view = await this.view(viewType);
    return view?.title ?? null;
  }
  async allViews(viewType) {
    return this.appState((type) => {
      const leaves = [];
      app.workspace.iterateAllLeaves((leaf) => leaves.push(leaf));
      return leaves.filter((leaf) => leaf?.view?.getViewType?.() === type).map((leaf) => {
        const view = leaf.view;
        const file = view?.file ?? null;
        return {
          active: leaf === app.workspace.activeLeaf,
          viewType: view.getViewType(),
          filePath: file?.path ?? null,
          title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? file?.basename ?? null : file?.basename ?? null
        };
      });
    }, viewType);
  }
  // ========================================
  // Commands & Workspace - コマンド実行と画面操作
  // ========================================
  async command(commandId) {
    const success = await this.appState((id) => {
      if (app.commands.executeCommandById(id)) {
        return true;
      }
      if (id.includes(":")) {
        const [pluginId, ...rest] = id.split(":");
        const actualId = window.__pluginIdMapping?.get(
          pluginId
        );
        if (actualId) {
          const mappedId = [actualId, ...rest].join(":");
          return app.commands.executeCommandById(mappedId);
        }
      }
      return false;
    }, commandId);
    expect2(success).toBe(true);
  }
  async split(direction = "vertical") {
    await this.appState(
      (dir) => app.workspace.duplicateLeaf(app.workspace.activeLeaf, dir),
      direction
    );
  }
  async closeTab() {
    const closed = await this.appState((commandId) => {
      const leaf = app.workspace.activeLeaf;
      if (leaf && typeof leaf.detach === "function") {
        leaf.detach();
        return true;
      }
      return app.commands.executeCommandById(commandId);
    }, CMD_ID_CLOSE_TAB);
    expect2(closed).toBe(true);
  }
  async clickClose() {
    await this.closeTab();
  }
  async undoClose() {
    await this.command(CMD_ID_UNDO_CLOSE_TAB);
  }
  async back() {
    await this.appState(() => app.workspace.activeLeaf?.history.back());
  }
  async forward() {
    await this.appState(() => app.workspace.activeLeaf?.history.forward());
  }
  async switchToLeaf(index) {
    await this.appState((i) => {
      const leaves = app.workspace.getLeavesOfType("markdown");
      if (leaves[i]) {
        app.workspace.setActiveLeaf(leaves[i], { focus: true });
      }
    }, index);
  }
  async activeViewType() {
    return this.appState(
      () => app.workspace.activeLeaf?.view.getViewType() ?? null
    );
  }
  async openingFiles() {
    return this.appState(
      () => app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file?.path ?? "")
    );
  }
  async waitReady(timeout = 15e3) {
    await this.page.waitForFunction(
      () => !!app?.workspace && (app.workspace.layoutReady === true || !!app.workspace.activeLeaf),
      { timeout }
    );
  }
  async waitForApp(predicate, arg, timeout = 5e3) {
    await this.page.waitForFunction(predicate, arg, {
      timeout
    });
  }
  async waitForView(viewType) {
    await this.page.waitForFunction(
      (type) => app.workspace.getLeavesOfType(type).length > 0,
      viewType
    );
    return this.page.evaluateHandle(async (type) => {
      const leaf = app.workspace.getLeavesOfType(type)?.[0];
      await app.workspace.revealLeaf(leaf);
      return leaf.view;
    }, viewType);
  }
  async waitForViewType(viewType, timeout = 5e3) {
    await this.page.waitForFunction(
      (type) => app.workspace.activeLeaf?.view.getViewType() === type,
      viewType,
      { timeout }
    );
  }
  // ========================================
  // Editor - エディタ操作
  // ========================================
  async clear() {
    await this.appState(() => {
      app.workspace.activeEditor?.editor?.setValue("");
    });
  }
  async content() {
    return this.appState(
      () => app.workspace.activeEditor?.editor?.getValue()
    );
  }
  async filePath() {
    return this.appState(() => app.workspace.getActiveFile()?.path ?? null);
  }
  async tabTitle() {
    return this.appState(() => {
      const leaf = app.workspace.activeLeaf;
      const view = leaf?.view;
      const activeFile = app.workspace.getActiveFile();
      if (activeFile?.basename) {
        return activeFile.basename;
      }
      if (typeof view?.getDisplayText === "function") {
        return view.getDisplayText() ?? null;
      }
      return leaf?.tabHeaderInnerTitleEl?.textContent?.trim() ?? null;
    });
  }
  async write(content) {
    await this.appState((nextContent) => {
      app.workspace.activeEditor?.editor?.setValue(nextContent);
    }, content);
  }
  // ========================================
  // Files - ファイル操作
  // ========================================
  async exists(path10) {
    return this.appState((p) => app.vault.adapter.exists(p), path10);
  }
  async read(path10) {
    return this.appState((p) => app.vault.adapter.read(p), path10);
  }
  async save(path10, content) {
    await this.appState(([p, c]) => app.vault.adapter.write(p, c), [
      path10,
      content
    ]);
  }
  async delete(path10) {
    await this.appState((p) => app.vault.adapter.remove(p), path10);
  }
  async open(path10) {
    await this.appState(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, path10);
  }
  async waitForFile(path10, timeout = 5e3) {
    await this.page.waitForFunction(
      (p) => app.vault.adapter.exists(p),
      path10,
      {
        timeout
      }
    );
  }
  // ========================================
  // Plugins - プラグイン操作
  // ========================================
  async plugin(pluginId) {
    if (!this.context?.pluginHandleMap) {
      throw new Error("Plugin context not initialized");
    }
    return this.context.pluginHandleMap.evaluateHandle(
      (map, id) => map.get(id),
      pluginId
    );
  }
  async isPluginEnabled(pluginId) {
    return this.appState(
      (id) => !!app.plugins.enabledPlugins.has(id),
      pluginId
    );
  }
  async waitForPluginEnabled(pluginId, timeout = 8e3) {
    await this.waitForApp(
      (id) => !!app?.plugins?.enabledPlugins?.has(id),
      pluginId,
      timeout
    );
  }
  async waitForPluginDisabled(pluginId, timeout = 8e3) {
    await this.waitForApp(
      (id) => !app?.plugins?.enabledPlugins?.has(id),
      pluginId,
      timeout
    );
  }
  async pluginState(pluginId) {
    return this.appState(
      (id) => ({
        enabled: !!app?.plugins?.enabledPlugins?.has(id),
        loaded: !!app?.plugins?.plugins?.[id]?._loaded,
        registered: !!app?.plugins?.plugins?.[id]
      }),
      pluginId
    );
  }
  async rebuildPlugins(vaultOptions, getPluginHandleMapFn = getPluginHandleMap) {
    const pluginHandleMap = await getPluginHandleMapFn(
      this.page,
      (vaultOptions.plugins || []).map((p) => ({
        ...p,
        pluginId: getActualPluginId(p.path)
      }))
    );
    this.context = { ...this.context, pluginHandleMap };
    return this.context;
  }
  updateContext(context) {
    this.context = context;
  }
  // ========================================
  // Expect - アサーション
  // ========================================
  async expectViews(viewType, count) {
    expect2((await this.allViews(viewType)).length).toBe(count);
  }
  async expectTitle(viewType, title) {
    expect2(await this.title(viewType)).toBe(title);
  }
  async expectTitleContains(viewType, text) {
    expect2(await this.title(viewType)).toContain(text);
  }
  async expectActiveType(type) {
    expect2((await this.activeTab())?.viewType).toBe(type);
  }
  async expectTabs(count) {
    expect2((await this.allTabs()).length).toBe(count);
  }
  async expectExists(path10) {
    expect2(await this.exists(path10)).toBe(true);
  }
  async expectNotExists(path10) {
    expect2(await this.exists(path10)).toBe(false);
  }
  async expectContent(content) {
    const value = await this.content();
    expect2(value).toBe(content);
  }
  async expectContentContains(text) {
    const value = await this.content();
    expect2(value).toContain(text);
  }
  // ========================================
  // UI - その他のUI操作
  // ========================================
  async titleBarText() {
    return this.tabTitle();
  }
  async tabHeaderText() {
    return this.tabTitle();
  }
  async measureTime(action) {
    const start = Date.now();
    await action();
    return Date.now() - start;
  }
  async search(text, selector = 'input[type="text"]') {
    await this.page.locator(selector).fill(text);
    await this.page.waitForTimeout(300);
  }
  async clearSearch(selector = 'input[type="text"]') {
    await this.page.locator(selector).clear();
    await this.page.waitForTimeout(200);
  }
};

// src/index.ts
import { expect as expect3 } from "@playwright/test";

// src/fetchPlugin.ts
import { spawnSync } from "child_process";
import fs2 from "fs";
import { writeFile } from "fs/promises";
import path8 from "path";
var logger8 = createScopedLogger("fetchPlugin");
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
  if (r.error) throw r.error;
  if (r.status && r.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed`);
}
function parseRepoUrl(repo) {
  const httpsMatch = repo.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  throw new Error(`Unsupported repo url: ${repo}`);
}
async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}
async function fetchPlugin(repo, destArg, opts) {
  if (!repo) throw new TypeError("repo url is required");
  const cwd = process.cwd();
  const { owner, repo: repoName } = parseRepoUrl(repo);
  const dest = destArg ? path8.resolve(cwd, destArg) : path8.resolve(cwd, "myfiles", repoName);
  logger8.debug(
    `repo=${repo} owner=${owner} repoName=${repoName} dest=${dest} opts=${JSON.stringify(opts)}`
  );
  const desiredFiles = ["main.js", "manifest.json", "styles.css"];
  let chosenRelease = null;
  try {
    const latestApi = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
    logger8.debug(`checking latest release: ${latestApi}`);
    let res = await fetch(latestApi, {
      headers: { "User-Agent": "obsidian-e2e-toolkit" }
    });
    if (res.ok) {
      const rel = await res.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      logger8.debug(
        `latest release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`
      );
      if (assets.some((a) => desiredFiles.includes(a.name))) {
        chosenRelease = rel;
        logger8.info(`using latest release ${rel.tag_name}`);
      }
    } else {
      logger8.debug(`latest release fetch failed: ${res.status}`);
    }
    if (!chosenRelease) {
      const listApi = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=20`;
      logger8.debug(`listing releases: ${listApi}`);
      const listRes = await fetch(listApi, {
        headers: { "User-Agent": "obsidian-e2e-toolkit" }
      });
      if (listRes.ok) {
        const list = await listRes.json();
        for (const rel of list) {
          const assets = Array.isArray(rel.assets) ? rel.assets : [];
          logger8.debug(
            `examining release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`
          );
          if (assets.some((a) => desiredFiles.includes(a.name))) {
            chosenRelease = rel;
            logger8.info(`using release ${rel.tag_name}`);
            break;
          }
        }
      } else {
        logger8.debug(`release list fetch failed: ${listRes.status}`);
      }
    }
  } catch (err) {
    logger8.warn(`release lookup error: ${err && err.message}`);
  }
  if (chosenRelease) {
    const assets = Array.isArray(chosenRelease.assets) ? chosenRelease.assets : [];
    fs2.mkdirSync(dest, { recursive: true });
    for (const fname of desiredFiles) {
      const asset = assets.find((a) => a.name === fname);
      if (asset && asset.browser_download_url) {
        const out = path8.join(dest, fname);
        logger8.info(
          `downloading ${fname} from release ${chosenRelease.tag_name}`
        );
        try {
          await downloadToFile(asset.browser_download_url, out);
          logger8.debug(`downloaded ${fname}`);
        } catch (err) {
          logger8.warn(
            `failed to download ${fname}: ${err && err.message}`
          );
        }
      }
    }
    const written = desiredFiles.some(
      (f) => fs2.existsSync(path8.join(dest, f))
    );
    if (!written) {
      for (const a of assets) {
        if (!a.browser_download_url || !a.name) continue;
        const out = path8.join(dest, a.name);
        logger8.debug(`downloading asset ${a.name} -> ${out}`);
        try {
          await downloadToFile(a.browser_download_url, out);
          logger8.debug(`downloaded asset ${a.name}`);
        } catch (err) {
          logger8.warn(
            `failed to download asset ${a.name}: ${err && err.message}`
          );
        }
      }
    }
    try {
      const pkgJson = path8.join(dest, "package.json");
      if (fs2.existsSync(pkgJson)) {
        run("pnpm", ["install"], { cwd: dest });
        const pkg = JSON.parse(fs2.readFileSync(pkgJson, "utf8"));
        if (pkg.scripts && pkg.scripts.build) {
          run("pnpm", ["run", "build"], { cwd: dest });
        }
      }
    } catch (err) {
      logger8.error(`prepare error: ${err && err.message}`);
      throw new Error(
        `Failed to prepare plugin from release in ${dest}: ${err}`
      );
    }
    return dest;
  }
  if (!opts || !opts.fallbackToGit) {
    logger8.warn(
      `no release found and fallbackToGit is false for ${owner}/${repoName}`
    );
    throw new Error(
      `No release asset found for ${owner}/${repoName} and fallbackToGit is false`
    );
  }
  if (fs2.existsSync(dest)) {
    try {
      logger8.info(`destination exists; pulling ${dest}`);
      run("git", ["-C", dest, "pull"]);
      return dest;
    } catch (err) {
      throw new Error(`Failed to update plugin at ${dest}: ${err}`);
    }
  }
  fs2.mkdirSync(path8.dirname(dest), { recursive: true });
  try {
    logger8.info(`cloning ${repo} -> ${dest}`);
    run("git", ["clone", "--depth", "1", repo, dest]);
    try {
      const pkgJson = path8.join(dest, "package.json");
      if (fs2.existsSync(pkgJson)) {
        run("pnpm", ["install"], { cwd: dest });
        const pkg = JSON.parse(fs2.readFileSync(pkgJson, "utf8"));
        if (pkg.scripts && pkg.scripts.build) {
          run("pnpm", ["run", "build"], { cwd: dest });
        }
      }
    } catch (err) {
      throw new Error(
        `Failed to prepare plugin after clone in ${dest}: ${err}`
      );
    }
    return dest;
  } catch (err) {
    throw new Error(`Failed to clone ${repo}: ${err}`);
  }
}

// src/index.ts
var logger2 = log8.getLogger("obsidianSetup");
var test = base.extend({
  tempDir: async ({}, use) => {
    const dir = await fs3.mkdtemp(path9.join(os.tmpdir(), "obsidian-e2e-"));
    await use(dir);
    await fs3.rm(dir, { recursive: true, force: true }).catch(() => {
    });
    await fs3.rm(`${dir}-vault`, { recursive: true, force: true }).catch(() => {
    });
  },
  vaultOptions: [DEFAULT_VAULT_OPTIONS, { option: true }],
  obsidian: async ({ vaultOptions, tempDir }, use, testInfo) => {
    const paths = getResolvedPaths();
    const runId = createRunId(testInfo.title);
    const runLogger = createScopedLogger("obsidianSetup", {
      runId,
      phase: "fixture"
    });
    const launcher = new ObsidianE2ELauncher({
      paths,
      options: merge(DEFAULT_VAULT_OPTIONS, vaultOptions),
      tempUserDataDir: tempDir,
      runId
    });
    try {
      toggleLoggerBy(vaultOptions.logLevel || "warn");
      runLogger.info("Launching Obsidian and creating context");
      const context = await createObsidianContext(launcher);
      runLogger.debug("Configuring browser console logging");
      if (vaultOptions.enableBrowserConsoleLogging) {
        setupBrowserConsoleLogging(context.page, {
          scope: {
            runId,
            phase: "browser"
          },
          options: vaultOptions.browserConsoleLogging
        });
      }
      const api = new ObsidianAPI(context);
      runLogger.info("Entering test body");
      await use(api);
      runLogger.info("Test body completed");
      handleTestError(testInfo);
    } catch (err) {
      runLogger.error(
        `Error during test execution: ${err.message || err}`
      );
      if (!process.env.CI) {
      }
      throw err;
    } finally {
      runLogger.info("Cleaning up Obsidian");
      await launcher.cleanup();
      runLogger.info("Cleanup completed");
    }
  }
});
export {
  ObsidianAPI,
  expect3 as expect,
  fetchPlugin,
  logger2 as logger,
  test
};
//# sourceMappingURL=index.mjs.map