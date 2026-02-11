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
    const nameStr = name ? `[${name}]` : "";
    return `${chalk.gray(`[${timestamp}]`)} ${color(level)} ${chalk.green(
      nameStr
    )}`;
  }
});
log.setDefaultLevel("trace");
console.log("\u2705 Log level set to 'trace' with prefix plugin.");
function setupBrowserConsoleLogging(window2) {
  window2.on("console", (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (text.length > 500) {
      console.log(
        `\u{1F5A5}\uFE0F BROWSER [${type.toUpperCase()}]: [\u9577\u6587\u306E\u305F\u3081\u7701\u7565: ${text.length}\u6587\u5B57]`
      );
      return;
    }
    console.log(
      `\u{1F5A5}\uFE0F BROWSER [${type.toUpperCase()}]: ${text.substring(0, 100)}`
    );
    const location = msg.location();
    if (location.url && location.url !== "about:blank") {
      console.log(
        `   \u{1F4CD} Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`
      );
    }
  });
  window2.on("pageerror", (error) => {
    console.log(`\u{1F5A5}\uFE0F PAGE ERROR: ${error.message}`);
    if (error.stack) {
      console.log(`   \u{1F4DA} Stack: ${error.stack}`);
    }
  });
  window2.on("requestfailed", (request) => {
    console.log(`\u{1F5A5}\uFE0F REQUEST FAILED: ${request.url()}`);
    const failure = request.failure();
    if (failure) {
      console.log(`   \u274C Failure: ${failure.errorText}`);
    }
  });
  window2.on("response", (response) => {
    if (!response.ok()) {
      console.log(
        `\u{1F5A5}\uFE0F HTTP ERROR: ${response.status()} ${response.statusText()} - ${response.url()}`
      );
    }
  });
}
function toggleLoggerBy(level, filter = () => true) {
  Object.values(log.getLoggers()).filter((logger9) => filter(logger9.name)).forEach((logger9) => {
    logger9.setLevel(level);
  });
  console.log("log level changed ->", level);
  log.setLevel(level);
}

// src/index.ts
import { test as base } from "@playwright/test";
import fs3 from "fs/promises";
import log9 from "loglevel";
import os from "os";
import path9 from "path";

// src/ObsidianAPI.ts
import { expect } from "playwright/test";
import invariant2 from "tiny-invariant";

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
  const defaultObsidianUnpackedDir = path2.join(
    dirname,
    ".obsidian-unpacked"
  );
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
  const toolkitHome = process.env.OBSIDIAN_E2E_TOOLKIT_HOME || projectRoot;
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
  logger.log("Plugin Directory:", RESOLVED_PATHS.pluginDir);
  logger.log("Dist Directory:", RESOLVED_PATHS.distDir);
  logger.log("Toolkit Root:", dirname2);
  logger.log("App Main Path:", RESOLVED_PATHS.appMainJsPath);
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
  plugins: [
    {
      path: DIST_DIR,
      pluginId: PLUGIN_ID,
      symlink: false
    }
  ]
};

// src/internal/utils.ts
async function getPluginHandleMap(page, plugins) {
  const pluginIds = plugins.map((p) => p.pluginId).filter(Boolean);
  logger2.warn("getPluginHandleMap: waiting for plugin IDs:", pluginIds);
  console.warn("[getPluginHandleMap] waiting for plugin IDs:", pluginIds);
  if (pluginIds.length === 0) {
    logger2.warn("getPluginHandleMap: no plugin IDs to wait for \u2014 returning empty map");
    console.warn("[getPluginHandleMap] no plugin IDs to wait for \u2014 returning empty map");
    return page.evaluateHandle(() => /* @__PURE__ */ new Map());
  }
  try {
    await page.waitForFunction(
      (pluginIds2) => {
        return pluginIds2.every((id) => app.plugins.plugins[id]);
      },
      pluginIds,
      { timeout: 1e4 }
    );
  } catch (err) {
    logger2.error("getPluginHandleMap: timeout waiting for plugins to load", err && err.message);
    console.error("[getPluginHandleMap] timeout waiting for plugins to load", err && err.message);
    try {
      const available = await page.evaluate(() => Object.keys(window.app?.plugins?.plugins || {}));
      logger2.error("getPluginHandleMap: available app.plugins.plugins keys:", available);
      console.error("[getPluginHandleMap] available app.plugins.plugins keys:", available);
    } catch (e) {
      logger2.error("getPluginHandleMap: failed to enumerate app.plugins.plugins", e && e.message);
      console.error("[getPluginHandleMap] failed to enumerate app.plugins.plugins", e && e.message);
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
    console.error(`
${separator} TEST FAILED ${separator}`);
    console.error(testInfo.error.message);
    if (testInfo.error.stack) {
      const firstNewlineIndex = testInfo.error.stack.indexOf("\n");
      const stackWithoutMessage = testInfo.error.stack.substring(
        firstNewlineIndex + 1
      );
      console.error(stackWithoutMessage);
    }
    console.error("=".repeat(53) + "\n");
  }
  if (!process.env.CI) {
    logger2.debug(testInfo.errors);
  }
}
async function createObsidianContext(launcher) {
  const vaultOptions = launcher.getVaultOptions();
  return launcher.launch(vaultOptions);
}

// src/ObsidianAPI.ts
var ObsidianAPI = class {
  page;
  context;
  // よく使うセレクタ
  sel = {
    activeLeaf: ".workspace-leaf.mod-active",
    activeTab: ".workspace-tab-header.mod-active.is-active",
    activeEditor: ".cm-content",
    tabContainer: ".mod-root .workspace-tab-header-container-inner"
  };
  constructor(context) {
    invariant2(context.page, "Page context is required");
    this.page = context.page;
    this.context = context;
  }
  // ========================================
  // Locators - よく使うロケーター
  // ========================================
  get activeLeaf() {
    return this.page.locator(this.sel.activeLeaf);
  }
  get activeEditor() {
    return this.page.locator(`${this.sel.activeLeaf} ${this.sel.activeEditor}`);
  }
  get activeTab() {
    return this.page.locator(this.sel.activeTab);
  }
  get allTabs() {
    return this.page.locator(this.sel.tabContainer);
  }
  view(viewType) {
    return this.page.locator(
      `${this.sel.activeLeaf} > .workspace-leaf-content[data-type="${viewType}"]`
    );
  }
  vaultName() {
    return this.page.evaluate(() => app.vault.getName());
  }
  title(viewType) {
    return this.page.locator(`${this.sel.activeTab}[data-type="${viewType}"]`);
  }
  allViews(viewType) {
    return this.page.locator(
      `.workspace-leaf > .workspace-leaf-content[data-type="${viewType}"]`
    );
  }
  // ========================================
  // Commands & Workspace - コマンド実行と画面操作
  // ========================================
  async command(commandId) {
    const success = await this.page.evaluate((id) => {
      if (globalThis.app.commands.executeCommandById(id)) {
        return true;
      }
      if (id.includes(":")) {
        const [pluginId, ...rest] = id.split(":");
        const actualId = window.__pluginIdMapping?.get(pluginId);
        if (actualId) {
          const mappedId = [actualId, ...rest].join(":");
          return globalThis.app.commands.executeCommandById(mappedId);
        }
      }
      return false;
    }, commandId);
    expect(success).toBe(true);
  }
  async split(direction = "vertical") {
    await this.page.evaluate(
      (dir) => app.workspace.duplicateLeaf(app.workspace.activeLeaf, dir),
      direction
    );
  }
  async closeTab() {
    await this.activeLeaf.focus();
    await this.command(CMD_ID_CLOSE_TAB);
  }
  async clickClose() {
    const closeBtn = this.page.locator(
      `${this.sel.activeTab} .workspace-tab-header-inner-close-button`
    );
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
  }
  async undoClose() {
    await this.command(CMD_ID_UNDO_CLOSE_TAB);
  }
  async back() {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.back());
  }
  async forward() {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.forward());
  }
  async switchToLeaf(index) {
    await this.page.evaluate((i) => {
      const leaves = app.workspace.getLeavesOfType("markdown");
      if (leaves[i]) {
        app.workspace.setActiveLeaf(leaves[i], { focus: true });
      }
    }, index);
  }
  async activeViewType() {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.view.getViewType() ?? null
    );
  }
  async openingFiles() {
    return this.page.evaluate(
      () => app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file?.path ?? "")
    );
  }
  async waitReady() {
    await this.page.waitForFunction(() => app.workspace.layoutReady);
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
    await this.activeEditor.focus();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.press("Backspace");
  }
  async content() {
    return this.page.evaluate(
      () => app.workspace.activeEditor?.editor?.getValue()
    );
  }
  async filePath() {
    return this.page.evaluate(
      () => app.workspace.getActiveFile()?.path ?? null
    );
  }
  async tabTitle() {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.tabHeaderInnerTitleEl.textContent ?? null
    );
  }
  async write(content) {
    await this.activeEditor.focus();
    await this.activeEditor.fill(content);
  }
  // ========================================
  // Files - ファイル操作
  // ========================================
  async exists(path10) {
    return this.page.evaluate((p) => app.vault.adapter.exists(p), path10);
  }
  async read(path10) {
    return this.page.evaluate((p) => app.vault.adapter.read(p), path10);
  }
  async save(path10, content) {
    await this.page.evaluate(([p, c]) => app.vault.adapter.write(p, c), [
      path10,
      content
    ]);
  }
  async delete(path10) {
    await this.page.evaluate((p) => app.vault.adapter.remove(p), path10);
  }
  async open(path10) {
    await this.page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, path10);
  }
  async waitForFile(path10, timeout = 5e3) {
    await this.page.waitForFunction((p) => app.vault.adapter.exists(p), path10, {
      timeout
    });
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
    return this.page.evaluate(
      (id) => !!app.plugins.enabledPlugins.has(id),
      pluginId
    );
  }
  async rebuildPlugins(vaultOptions, getPluginHandleMapFn = getPluginHandleMap) {
    const pluginHandleMap = await getPluginHandleMapFn(
      this.page,
      vaultOptions.plugins || []
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
    await expect(this.allViews(viewType)).toHaveCount(count);
  }
  async expectTitle(viewType, title) {
    await expect(this.title(viewType)).toHaveText(title);
  }
  async expectTitleContains(viewType, text) {
    await expect(this.title(viewType)).toContainText(text);
  }
  async expectActiveType(type) {
    await expect(this.activeTab).toHaveAttribute("data-type", type);
  }
  async expectTabs(count) {
    await expect(this.allTabs).toHaveCount(count);
  }
  async expectExists(path10) {
    expect(await this.exists(path10)).toBe(true);
  }
  async expectNotExists(path10) {
    expect(await this.exists(path10)).toBe(false);
  }
  async expectContent(content) {
    await expect(this.activeEditor).toHaveText(content);
  }
  async expectContentContains(text) {
    await expect(this.activeEditor).toContainText(text);
  }
  // ========================================
  // UI - その他のUI操作
  // ========================================
  async titleBarText() {
    return await this.page.locator(".workspace-leaf.mod-active .view-header-title").textContent();
  }
  async tabHeaderText() {
    return await this.page.locator(".workspace-tab-header.mod-active .workspace-tab-header-inner").textContent();
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

// src/internal/launcher.ts
import chalk5 from "chalk";
import log8 from "loglevel";

// src/internal/PageWaiter.ts
var PageWaiter = class _PageWaiter {
  static waitForPage(page) {
    if (page.url().includes("starter")) {
      return _PageWaiter.waitForStarterReady(page);
    } else {
      return _PageWaiter.waitForVaultReady(page);
    }
  }
  /**
   * Wait for the Obsidian vault to be ready
   * This ensures the workspace layout is initialized
   */
  static async waitForVaultReady(page) {
    await page.waitForLoadState("domcontentloaded");
    await page.waitForFunction(
      async () => {
        if (window.app?.workspace?.onLayoutReady) {
          return await new Promise((resolve) => {
            return app.workspace.onLayoutReady(() => resolve(void 0));
          });
        }
      },
      { timeout: 1e4 }
    );
  }
  /**
   * Wait for the Obsidian starter (welcome) page to be ready
   * This page appears when no vault is open
   */
  static async waitForStarterReady(page) {
    await page.waitForSelector(".mod-change-language", {
      state: "visible"
    });
  }
};

// src/internal/ipc.ts
var IPCBridge = class {
  constructor(setup) {
    this.setup = setup;
  }
  async send(channel, ...args) {
    await this.ensurePageLoaded();
    return (await this.setup.ensureSingleWindow()).evaluate(
      (args2) => {
        const [ch, ...restArgs] = args2;
        return window.electron.ipcRenderer.sendSync(ch, ...restArgs);
      },
      [channel, ...args]
    );
  }
  async ensurePageLoaded() {
    const page = await this.setup.ensureSingleWindow();
    await page.waitForLoadState("domcontentloaded");
    const isStarter = page.url().includes("starter");
    if (!isStarter) {
      return PageWaiter.waitForPage(page);
    }
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

// src/internal/managers/ElectronAppManager.ts
import fs from "fs/promises";
import log3 from "loglevel";
import path4 from "path";
import { _electron as electron } from "playwright/test";
import { createRequire } from "module";
import { existsSync as existsSync3 } from "fs";
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
        logger3.error(`Electron root contents:`, await fs.readdir(electronRoot));
        throw new Error(
          "Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly."
        );
      }
    } catch (err) {
      logger3.error("Electron preflight check failed:", err && err.message ? err.message : err);
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

// src/internal/managers/PluginManager.ts
import { expect as expect2 } from "@playwright/test";
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
    const actualId = this.getActualPluginId(plugin.path);
    if (actualId && actualId !== plugin.pluginId) {
      logger4.info(
        `Plugin ID mismatch for ${plugin.path}: expected ${plugin.pluginId}, found ${actualId}. Using ${actualId}.`
      );
      plugin.originalId = plugin.pluginId;
      plugin.pluginId = actualId;
    }
    const destDir = path5.join(pluginsDir, plugin.pluginId);
    if (plugin.symlink) {
      logger4.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
      return this.createPluginSymlink(plugin.path, destDir, plugin.pluginId);
    } else {
      logger4.debug(`Copying files for plugin: ${plugin.pluginId}`);
      return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
    }
  }
  getActualPluginId(pluginPath) {
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
  validatePluginPath(plugin) {
    if (!existsSync4(plugin.path)) {
      console.warn(`Plugin path not found: ${plugin.path}`);
      return false;
    }
    if (!existsSync4(path5.join(plugin.path, "manifest.json"))) {
      console.warn(`manifest.json not found in: ${plugin.path}`);
      return false;
    }
    return true;
  }
  createPluginSymlink(sourcePath, destDir, pluginId) {
    if (existsSync4(destDir)) {
      logger4.debug(`Destination already exists: ${destDir}, skipping symlink`);
      return true;
    }
    try {
      symlinkSync(sourcePath, destDir, "dir");
      logger4.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
      return true;
    } catch (error) {
      console.error(`Failed to create symlink for ${pluginId}:`, error);
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
    expect2(isEnabled, "Failed to enable community plugins.").toBe(true);
  }
};

// src/internal/managers/StorageManager.ts
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
    logger5.log(chalk2.magenta("clearing..."));
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
    logger5.log(message);
  }
};

// src/internal/managers/VaultManager.ts
import chalk3 from "chalk";
import { existsSync as existsSync5, mkdirSync as mkdirSync2, rmSync as rmSync2 } from "fs";
import log6 from "loglevel";
import path7 from "path";
var logger6 = log6.getLogger("VaultManager");
var VaultManager = class {
  constructor(ipc, options, vaultPath) {
    this.ipc = ipc;
    this.options = options;
    this.vaultPath = vaultPath;
  }
  async openSandboxVault(executeAction) {
    logger6.debug(chalk3.green("Opening sandbox vault..."));
    const page = await executeAction(
      () => this.ipc.openSandbox(),
      PageWaiter.waitForPage
    );
    const vaultPath = await this.ipc.getSandboxPath();
    logger6.debug(chalk3.green("Sandbox vault opened at:", vaultPath));
    return { vaultPath, page };
  }
  async openNormalVault(executeAction) {
    logger6.debug("Opening normal vault...");
    const vaultPath = await this.resolveVaultPath();
    if (this.options.fresh && existsSync5(vaultPath)) {
      rmSync2(vaultPath, { recursive: true });
    }
    if (!this.options.fresh && !existsSync5(vaultPath)) {
      logger6.debug("Creating vault directory:", vaultPath);
      mkdirSync2(vaultPath, { recursive: true });
    }
    const page = await executeAction(async () => {
      const result = await this.ipc.openVault(vaultPath, this.options.fresh);
      if (result !== true) {
        throw new Error(`Failed to open vault: ${result}`);
      }
    }, PageWaiter.waitForPage);
    logger6.debug("Normal vault opened:", vaultPath);
    return { vaultPath, page };
  }
  async resolveVaultPath() {
    if (this.options.name) {
      return await this.getVaultPathByName(this.options.name);
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

// src/internal/managers/WindowManager.ts
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
var logger8 = log8.getLogger("ObsidianTestLauncher");
var ObsidianE2ELauncher = class {
  electronManager;
  windowManager;
  vaultManager;
  storageManager;
  pluginManager;
  ipc;
  paths;
  options;
  tempUserDataDir;
  tempVaultDir;
  vaultPath = null;
  constructor({ paths, options, tempUserDataDir }) {
    this.paths = paths;
    this.options = options;
    this.tempUserDataDir = tempUserDataDir;
    this.tempVaultDir = `${tempUserDataDir}-vault`;
    this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
  }
  async initialize() {
    const electronApp = await this.electronManager.launch();
    logger8.debug("Electron app launched");
    this.windowManager = new WindowManager(electronApp);
    this.storageManager = new StorageManager(electronApp);
    const initialPage = await electronApp.waitForEvent("window");
    logger8.debug("initial window event received");
    await this.initializePlaywrightMode(initialPage);
    await PageWaiter.waitForPage(initialPage);
    logger8.debug("initial page ready; clearing storage and reloading");
    logger8.debug("starter ready");
    await this.storageManager.clearAll();
    logger8.debug("storage cleared");
    await initialPage.reload({ waitUntil: "domcontentloaded" });
    logger8.debug("initial page reloaded");
    const currentPage = await this.windowManager.ensureSingleWindow();
    await PageWaiter.waitForPage(currentPage);
    logger8.debug("init start page");
    this.ipc = new IPCBridge({
      ensureSingleWindow: this.windowManager.ensureSingleWindow.bind(
        this.windowManager
      )
    });
    this.vaultManager = new VaultManager(
      this.ipc,
      this.options,
      this.tempVaultDir
    );
    this.vaultPath = await this.vaultManager.resolveVaultPath();
    logger8.debug("vaultPath resolved:", this.vaultPath);
    this.pluginManager = new PluginManager(
      this.options.plugins,
      this.vaultPath
    );
  }
  async initializePlaywrightMode(page) {
    await page.evaluate(() => {
      window.playwright = true;
    });
    logger8.debug("enable obsidian debug mode");
  }
  async cleanup() {
    await this.electronManager.cleanup();
    logger8.debug("[ObsidianTestSetup] cleaned All");
  }
  async launch(options = DEFAULT_VAULT_OPTIONS) {
    this.validateInitialization();
    logger8.debug("open vault", options);
    const shouldUseSandbox = options.sandbox && !process.env.CI;
    const executeAction = this.windowManager.executeActionAndWaitForNewWindow.bind(
      this.windowManager
    );
    const { page } = shouldUseSandbox ? await this.vaultManager.openSandboxVault(executeAction) : await this.vaultManager.openNormalVault(executeAction);
    const configuredPlugins = this.pluginManager.getPlugins() || [];
    logger8.debug("configured plugins:", configuredPlugins.map((p) => ({ path: p.path, pluginId: p.pluginId })));
    if (configuredPlugins.length) {
      logger8.debug("Installing plugins...");
      await this.setupPlugins(page);
      logger8.debug(`${this.pluginManager.getPlugins().length} Plugins setup completed.`);
    }
    logger8.debug("creating vault context with plugins:", this.pluginManager.getPlugins().map((p) => p.pluginId));
    const context = await this.createVaultContext(page, this.pluginManager.getPlugins());
    logger8.debug("vault context created; vaultName:", context.vaultName);
    const notices = await context.page.locator(".notice-container .notice").all();
    logger8.debug("remove all notices");
    await Promise.all(notices.map((notice) => notice.click()));
    return context;
  }
  validateInitialization() {
    if (!this.windowManager || !this.vaultManager || !this.ipc) {
      throw new Error("Setup not initialized. Call initialize() first.");
    }
  }
  async setupPlugins(page) {
    logger8.debug("Installing plugins...");
    await this.pluginManager.installAll();
    logger8.debug("Plugins installed.");
    logger8.debug("Enabling plugins...");
    await this.pluginManager.enableAll(page);
    logger8.debug("Plugins enabled.");
    logger8.debug(chalk5.blue("Reloading vault to apply plugin changes..."));
    await page.reload();
    await PageWaiter.waitForPage(page);
    logger8.debug(chalk5.blue("Vault reloaded."));
  }
  async createVaultContext(page, plugins) {
    const vaultName = await page.evaluate(() => app?.vault?.getName());
    logger8.debug("Vault name:", vaultName);
    let pluginHandleMap;
    if (!plugins || plugins.length === 0) {
      logger8.warn("createVaultContext: no plugins configured \u2014 skipping wait");
      pluginHandleMap = await page.evaluateHandle(() => /* @__PURE__ */ new Map());
    } else {
      pluginHandleMap = await getPluginHandleMap(page, plugins || []);
    }
    return {
      electronApp: this.electronManager.getApp(),
      page,
      pluginHandleMap,
      vaultName,
      paths: this.paths
    };
  }
  async openStarter() {
    this.validateInitialization();
    const page = await this.windowManager.executeActionAndWaitForNewWindow(
      async () => await this.ipc.openStarter(),
      PageWaiter.waitForPage
    );
    await PageWaiter.waitForPage(page);
    return {
      electronApp: this.electronManager.getApp(),
      page
    };
  }
  getVaultOptions() {
    return this.options;
  }
};

// src/index.ts
import { merge } from "es-toolkit";
import { expect as expect3 } from "@playwright/test";

// src/fetchPlugin.ts
import { spawnSync } from "child_process";
import path8 from "path";
import fs2 from "fs";
import { writeFile } from "fs/promises";
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
  if (r.error) throw r.error;
  if (r.status && r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
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
  console.log(`[fetchPlugin] repo=${repo} owner=${owner} repoName=${repoName} dest=${dest} opts=${JSON.stringify(opts)}`);
  const desiredFiles = ["main.js", "manifest.json", "styles.css"];
  let chosenRelease = null;
  try {
    const latestApi = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
    console.log(`[fetchPlugin] checking latest release: ${latestApi}`);
    let res = await fetch(latestApi, { headers: { "User-Agent": "obsidian-e2e-toolkit" } });
    if (res.ok) {
      const rel = await res.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      console.log(`[fetchPlugin] latest release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`);
      if (assets.some((a) => desiredFiles.includes(a.name))) {
        chosenRelease = rel;
        console.log(`[fetchPlugin] chosenRelease set to latest tag=${rel.tag_name}`);
      }
    } else {
      console.log(`[fetchPlugin] latest release fetch failed: ${res.status}`);
    }
    if (!chosenRelease) {
      const listApi = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=20`;
      console.log(`[fetchPlugin] listing releases: ${listApi}`);
      const listRes = await fetch(listApi, { headers: { "User-Agent": "obsidian-e2e-toolkit" } });
      if (listRes.ok) {
        const list = await listRes.json();
        for (const rel of list) {
          const assets = Array.isArray(rel.assets) ? rel.assets : [];
          console.log(`[fetchPlugin] examine release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`);
          if (assets.some((a) => desiredFiles.includes(a.name))) {
            chosenRelease = rel;
            console.log(`[fetchPlugin] chosenRelease set to tag=${rel.tag_name}`);
            break;
          }
        }
      } else {
        console.log(`[fetchPlugin] release list fetch failed: ${listRes.status}`);
      }
    }
  } catch (err) {
    console.log(`[fetchPlugin] release lookup error: ${err && err.message}`);
  }
  if (chosenRelease) {
    const assets = Array.isArray(chosenRelease.assets) ? chosenRelease.assets : [];
    fs2.mkdirSync(dest, { recursive: true });
    for (const fname of desiredFiles) {
      const asset = assets.find((a) => a.name === fname);
      if (asset && asset.browser_download_url) {
        const out = path8.join(dest, fname);
        console.log(`[fetchPlugin] downloading ${asset.browser_download_url} -> ${out}`);
        try {
          await downloadToFile(asset.browser_download_url, out);
          console.log(`[fetchPlugin] downloaded ${fname}`);
        } catch (err) {
          console.log(`[fetchPlugin] failed to download ${fname}: ${err && err.message}`);
        }
      }
    }
    const written = desiredFiles.some((f) => fs2.existsSync(path8.join(dest, f)));
    if (!written) {
      for (const a of assets) {
        if (!a.browser_download_url || !a.name) continue;
        const out = path8.join(dest, a.name);
        console.log(`[fetchPlugin] downloading asset ${a.browser_download_url} -> ${out}`);
        try {
          await downloadToFile(a.browser_download_url, out);
          console.log(`[fetchPlugin] downloaded asset ${a.name}`);
        } catch (err) {
          console.log(`[fetchPlugin] failed to download asset ${a.name}: ${err && err.message}`);
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
      console.log(`[fetchPlugin] prepare error: ${err && err.message}`);
      throw new Error(`Failed to prepare plugin from release in ${dest}: ${err}`);
    }
    return dest;
  }
  if (!opts || !opts.fallbackToGit) {
    console.log(`[fetchPlugin] no release found and fallbackToGit is false for ${owner}/${repoName}`);
    throw new Error(`No release asset found for ${owner}/${repoName} and fallbackToGit is false`);
  }
  if (fs2.existsSync(dest)) {
    try {
      console.log(`[fetchPlugin] destination exists; pulling: ${dest}`);
      run("git", ["-C", dest, "pull"]);
      return dest;
    } catch (err) {
      throw new Error(`Failed to update plugin at ${dest}: ${err}`);
    }
  }
  fs2.mkdirSync(path8.dirname(dest), { recursive: true });
  try {
    console.log(`[fetchPlugin] cloning ${repo} -> ${dest}`);
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
      throw new Error(`Failed to prepare plugin after clone in ${dest}: ${err}`);
    }
    return dest;
  } catch (err) {
    throw new Error(`Failed to clone ${repo}: ${err}`);
  }
}

// src/index.ts
var logger2 = log9.getLogger("obsidianSetup");
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
    const launcher = new ObsidianE2ELauncher({
      paths,
      options: merge(DEFAULT_VAULT_OPTIONS, vaultOptions),
      tempUserDataDir: tempDir
    });
    try {
      toggleLoggerBy(vaultOptions.logLevel || "warn");
      logger2.debug("Launching Obsidian");
      await launcher.initialize();
      logger2.debug("Creating Obsidian context");
      const context = await createObsidianContext(launcher);
      logger2.debug("Enabling browser console logging");
      if (vaultOptions.enableBrowserConsoleLogging) {
        setupBrowserConsoleLogging(context.page);
      }
      const api = new ObsidianAPI(context);
      logger2.debug("Entering test");
      await use(api);
      logger2.debug("Test completed");
      handleTestError(testInfo);
    } catch (err) {
      logger2.error(`Error during test execution: ${err.message || err}`);
      if (!process.env.CI) {
      }
      throw err;
    } finally {
      logger2.debug("Cleaning up Obsidian");
      await launcher.cleanup();
      logger2.debug("Cleanup completed");
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