"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ObsidianAPI: () => ObsidianAPI,
  expect: () => import_test5.expect,
  fetchPlugin: () => fetchPlugin,
  logger: () => logger2,
  test: () => test
});
module.exports = __toCommonJS(index_exports);

// node_modules/.pnpm/tsup@8.5.1_typescript@5.9.3/node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/internal/logger.ts
var import_chalk = __toESM(require("chalk"), 1);
var import_loglevel = __toESM(require("loglevel"), 1);
var import_loglevel_plugin_prefix = __toESM(require("loglevel-plugin-prefix"), 1);
var colors = {
  TRACE: import_chalk.default.magenta,
  DEBUG: import_chalk.default.cyan,
  INFO: import_chalk.default.blue,
  WARN: import_chalk.default.yellow,
  ERROR: import_chalk.default.red
};
import_loglevel_plugin_prefix.default.reg(import_loglevel.default);
import_loglevel_plugin_prefix.default.apply(import_loglevel.default, {
  format(level, name, timestamp) {
    const color = colors[level.toUpperCase()] || import_chalk.default.white;
    const nameStr = name ? `[${name}]` : "";
    return `${import_chalk.default.gray(`[${timestamp}]`)} ${color(level)} ${import_chalk.default.green(
      nameStr
    )}`;
  }
});
import_loglevel.default.setDefaultLevel("trace");
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
  Object.values(import_loglevel.default.getLoggers()).filter((logger9) => filter(logger9.name)).forEach((logger9) => {
    logger9.setLevel(level);
  });
  console.log("log level changed ->", level);
  import_loglevel.default.setLevel(level);
}

// src/index.ts
var import_test4 = require("@playwright/test");
var import_promises3 = __toESM(require("fs/promises"), 1);
var import_loglevel9 = __toESM(require("loglevel"), 1);
var import_os = __toESM(require("os"), 1);
var import_path10 = __toESM(require("path"), 1);

// src/ObsidianAPI.ts
var import_test2 = require("playwright/test");
var import_tiny_invariant2 = __toESM(require("tiny-invariant"), 1);

// src/internal/constants.ts
var import_find_up = require("find-up");
var import_fs2 = require("fs");
var import_loglevel2 = __toESM(require("loglevel"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_tiny_invariant = __toESM(require("tiny-invariant"), 1);
var import_url2 = require("url");

// src/internal/path.ts
var import_fs = require("fs");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var filename = typeof __filename !== "undefined" ? __filename : (0, import_url.fileURLToPath)(importMetaUrl);
var dirname = typeof __dirname !== "undefined" ? __dirname : import_path.default.dirname(filename);
function resolveConfig(config) {
  const pluginDir = import_path.default.resolve(config.pluginDir);
  if (!(0, import_fs.existsSync)(pluginDir)) {
    throw new Error(`Plugin directory not found: ${pluginDir}`);
  }
  const manifestPath = import_path.default.join(pluginDir, "manifest.json");
  let manifest;
  if (config.manifest) {
    manifest = config.manifest;
  } else if ((0, import_fs.existsSync)(manifestPath)) {
    manifest = JSON.parse((0, import_fs.readFileSync)(manifestPath, "utf-8"));
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
  const distDir = config.distDir ? import_path.default.resolve(config.distDir) : import_path.default.join(pluginDir, "dist");
  const defaultAssetsDir = import_path.default.join(dirname, "assets");
  const assetsDir = config.assetsDir ? import_path.default.resolve(config.assetsDir) : defaultAssetsDir;
  const defaultObsidianUnpackedDir = import_path.default.join(
    dirname,
    ".obsidian-unpacked"
  );
  const obsidianUnpackedDir = config.obsidianUnpackedDir ? import_path.default.resolve(config.obsidianUnpackedDir) : defaultObsidianUnpackedDir;
  const appMainFile = config.appMainFile || "main.cjs";
  const appMainJsPath = import_path.default.join(obsidianUnpackedDir, appMainFile);
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
  if (!(0, import_fs.existsSync)(paths.appMainJsPath)) {
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
var filename2 = typeof __filename !== "undefined" ? __filename : (0, import_url2.fileURLToPath)(importMetaUrl);
var dirname2 = typeof __dirname !== "undefined" ? __dirname : import_path2.default.dirname(filename2);
var logger = import_loglevel2.default.getLogger("constants");
function getDefaultConfig() {
  const toolkitPackageJsonPath = (0, import_find_up.findUpSync)("package.json", { cwd: dirname2 });
  (0, import_tiny_invariant.default)(
    toolkitPackageJsonPath,
    "Could not find package.json for obsidian-e2e-toolkit."
  );
  const toolkitRoot = import_path2.default.dirname(toolkitPackageJsonPath);
  const manifestPath = (0, import_find_up.findUpSync)("manifest.json", { cwd: toolkitRoot });
  const projectRoot = manifestPath ? import_path2.default.dirname(manifestPath) : toolkitRoot;
  const toolkitHome = process.env.OBSIDIAN_E2E_TOOLKIT_HOME || ((0, import_fs2.existsSync)(import_path2.default.join(toolkitRoot, "obsidian-e2e-toolkit-assets")) ? toolkitRoot : projectRoot);
  return {
    pluginDir: projectRoot,
    distDir: import_path2.default.join(projectRoot, "dist"),
    assetsDir: import_path2.default.join(toolkitRoot, "assets"),
    obsidianUnpackedDir: import_path2.default.join(
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
  (0, import_tiny_invariant.default)((0, import_fs2.existsSync)(dirname2), `Toolkit root not found at: ${dirname2}.`);
  (0, import_tiny_invariant.default)(
    (0, import_fs2.existsSync)(RESOLVED_PATHS.appMainJsPath),
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
  path: import_path2.default.join(E2E_ROOT_DIR, "assets", "hot-reload"),
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
        const plugins2 = window.app?.plugins?.plugins;
        return !!plugins2 && pluginIds2.every((id) => plugins2[id]);
      },
      pluginIds,
      { timeout: 3e4 }
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

// src/internal/managers/PluginManager.ts
var import_test = require("@playwright/test");
var import_fs3 = require("fs");
var import_loglevel3 = __toESM(require("loglevel"), 1);
var import_path4 = __toESM(require("path"), 1);
var logger3 = import_loglevel3.default.getLogger("PluginManager");
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
    logger3.debug(`Installed plugins: ${installedIds.join(", ")}`);
  }
  getPlugins() {
    return this.plugins || [];
  }
  ensurePluginsDirectory() {
    const obsidianDir = import_path4.default.join(this.vaultPath, ".obsidian");
    const pluginsDir = import_path4.default.join(obsidianDir, "plugins");
    if (!(0, import_fs3.existsSync)(obsidianDir)) {
      (0, import_fs3.mkdirSync)(obsidianDir, { recursive: true });
    }
    if (!(0, import_fs3.existsSync)(pluginsDir)) {
      (0, import_fs3.mkdirSync)(pluginsDir, { recursive: true });
    }
    return pluginsDir;
  }
  async installSingle(pluginsDir, plugin) {
    if (!this.validatePluginPath(plugin)) {
      logger3.warn(`Invalid plugin path: ${plugin.path}`);
      return false;
    }
    const destDir = import_path4.default.join(pluginsDir, plugin.pluginId);
    if (plugin.symlink) {
      logger3.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
      return this.createPluginSymlink(plugin.path, destDir, plugin.pluginId);
    } else {
      logger3.debug(`Copying files for plugin: ${plugin.pluginId}`);
      return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
    }
  }
  validatePluginPath(plugin) {
    if (!(0, import_fs3.existsSync)(plugin.path)) {
      console.warn(`Plugin path not found: ${plugin.path}`);
      return false;
    }
    if (!(0, import_fs3.existsSync)(import_path4.default.join(plugin.path, "manifest.json"))) {
      console.warn(`manifest.json not found in: ${plugin.path}`);
      return false;
    }
    return true;
  }
  createPluginSymlink(sourcePath, destDir, pluginId) {
    if ((0, import_fs3.existsSync)(destDir)) {
      logger3.debug(`Destination already exists: ${destDir}, skipping symlink`);
      return true;
    }
    try {
      (0, import_fs3.symlinkSync)(sourcePath, destDir, "dir");
      logger3.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
      return true;
    } catch (error) {
      console.error(`Failed to create symlink for ${pluginId}:`, error);
      return false;
    }
  }
  copyPluginFiles(sourcePath, destDir, pluginId) {
    if (!(0, import_fs3.existsSync)(destDir)) {
      (0, import_fs3.mkdirSync)(destDir, { recursive: true });
    }
    const filesToCopy = ["manifest.json", "main.js", "styles.css"];
    for (const file of (0, import_fs3.readdirSync)(sourcePath)) {
      const srcFile = import_path4.default.join(sourcePath, file);
      const stat = (0, import_fs3.statSync)(srcFile);
      if (stat.isDirectory() || !filesToCopy.includes(file)) {
        continue;
      }
      const destFile = import_path4.default.join(destDir, file);
      (0, import_fs3.copyFileSync)(srcFile, destFile);
      logger3.debug(`Copied: ${file} to ${destDir}`);
    }
    logger3.debug(`Installed plugin: ${pluginId}`);
    return true;
  }
  updateCommunityPluginsJson(installedIds) {
    const pluginsJsonPath = import_path4.default.join(
      this.vaultPath,
      ".obsidian",
      "community-plugins.json"
    );
    (0, import_fs3.writeFileSync)(pluginsJsonPath, JSON.stringify(installedIds));
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
    logger3.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
  }
  async disableRestrictedMode(page) {
    await this.waitForPluginsAPI(page);
    if (await this.isCommunityPluginsEnabled(page)) {
      logger3.debug("Community plugins are already enabled.");
      return;
    }
    logger3.debug("Attempting to enable community plugins...");
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
      logger3.debug("Clicking 'Turn on and reload'...");
      await clickButton();
      await page.waitForTimeout(1e3);
      buttonText = await getButtonText();
    }
    if (buttonText === "Turn on community plugins") {
      logger3.debug("Clicking 'Turn on community plugins'...");
      await clickButton();
      await page.waitForTimeout(1e3);
    }
  }
  async closeCommunityPluginsSettings(page) {
    await page.keyboard.press("Escape");
  }
  async verifyCommunityPluginsEnabled(page) {
    const isEnabled = await this.isCommunityPluginsEnabled(page);
    (0, import_test.expect)(isEnabled, "Failed to enable community plugins.").toBe(true);
  }
};
function getActualPluginId(pluginPath) {
  const manifestPath = import_path4.default.join(pluginPath, "manifest.json");
  if ((0, import_fs3.existsSync)(manifestPath)) {
    try {
      const manifest = JSON.parse((0, import_fs3.readFileSync)(manifestPath, "utf-8"));
      return manifest.id;
    } catch (e) {
      logger3.warn(`Failed to parse manifest.json at ${pluginPath}`);
    }
  }
  return "";
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
    (0, import_tiny_invariant2.default)(context.page, "Page context is required");
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
      if (app.commands.executeCommandById(id)) {
        return true;
      }
      if (id.includes(":")) {
        const [pluginId, ...rest] = id.split(":");
        const actualId = window.__pluginIdMapping?.get(pluginId);
        if (actualId) {
          const mappedId = [actualId, ...rest].join(":");
          return app.commands.executeCommandById(mappedId);
        }
      }
      return false;
    }, commandId);
    (0, import_test2.expect)(success).toBe(true);
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
    await (0, import_test2.expect)(closeBtn).toBeVisible();
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
    await this.page.waitForFunction(() => app?.workspace?.layoutReady);
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
  async exists(path9) {
    return this.page.evaluate((p) => app.vault.adapter.exists(p), path9);
  }
  async read(path9) {
    return this.page.evaluate((p) => app.vault.adapter.read(p), path9);
  }
  async save(path9, content) {
    await this.page.evaluate(([p, c]) => app.vault.adapter.write(p, c), [
      path9,
      content
    ]);
  }
  async delete(path9) {
    await this.page.evaluate((p) => app.vault.adapter.remove(p), path9);
  }
  async open(path9) {
    await this.page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (file) {
        await app.workspace.getLeaf().openFile(file);
      }
    }, path9);
  }
  async waitForFile(path9, timeout = 5e3) {
    await this.page.waitForFunction((p) => app.vault.adapter.exists(p), path9, {
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
      (vaultOptions.plugins || []).map((p) => ({ ...p, pluginId: getActualPluginId(p.path) }))
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
    await (0, import_test2.expect)(this.allViews(viewType)).toHaveCount(count);
  }
  async expectTitle(viewType, title) {
    await (0, import_test2.expect)(this.title(viewType)).toHaveText(title);
  }
  async expectTitleContains(viewType, text) {
    await (0, import_test2.expect)(this.title(viewType)).toContainText(text);
  }
  async expectActiveType(type) {
    await (0, import_test2.expect)(this.activeTab).toHaveAttribute("data-type", type);
  }
  async expectTabs(count) {
    await (0, import_test2.expect)(this.allTabs).toHaveCount(count);
  }
  async expectExists(path9) {
    (0, import_test2.expect)(await this.exists(path9)).toBe(true);
  }
  async expectNotExists(path9) {
    (0, import_test2.expect)(await this.exists(path9)).toBe(false);
  }
  async expectContent(content) {
    await (0, import_test2.expect)(this.activeEditor).toHaveText(content);
  }
  async expectContentContains(text) {
    await (0, import_test2.expect)(this.activeEditor).toContainText(text);
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
var import_chalk5 = __toESM(require("chalk"), 1);
var import_loglevel8 = __toESM(require("loglevel"), 1);

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
        const workspace = window.app?.workspace;
        if (workspace?.onLayoutReady) {
          await new Promise((resolve) => {
            workspace.onLayoutReady(() => resolve());
          });
          return true;
        }
        return false;
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
var import_promises = __toESM(require("fs/promises"), 1);
var import_loglevel4 = __toESM(require("loglevel"), 1);
var import_path5 = __toESM(require("path"), 1);
var import_test3 = require("playwright/test");
var import_module = require("module");
var import_fs4 = require("fs");
var logger4 = import_loglevel4.default.getLogger("ElectronAppManager");
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
      const req = (0, import_module.createRequire)(importMetaUrl);
      const pkgJson = req.resolve("electron/package.json");
      const electronRoot = import_path5.default.dirname(pkgJson);
      const distDir = import_path5.default.join(electronRoot, "dist");
      if (!(0, import_fs4.existsSync)(distDir)) {
        logger4.error(`Electron dist not found at ${distDir}`);
        logger4.error(`Electron root contents:`, await import_promises.default.readdir(electronRoot));
        throw new Error(
          "Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly."
        );
      }
    } catch (err) {
      logger4.error("Electron preflight check failed:", err && err.message ? err.message : err);
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
    return await import_test3._electron.launch(launchOptions);
  }
  async cleanup() {
    if (this.electronApp) {
      try {
        await this.closeAllWindows();
        await this.electronApp.close();
      } catch (error) {
        logger4.warn("Error during cleanup:", error);
      }
    }
    logger4.debug("ElectronAppManager cleaned up");
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

// src/internal/managers/StorageManager.ts
var import_chalk2 = __toESM(require("chalk"), 1);
var import_fs5 = require("fs");
var import_loglevel5 = __toESM(require("loglevel"), 1);
var import_path7 = __toESM(require("path"), 1);
var logger5 = import_loglevel5.default.getLogger("StorageManager");
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
      import_path7.default.join(userDataDir, "obsidian.json"),
      import_path7.default.join(userDataDir, SANDBOX_VAULT_NAME)
    ];
    for (const p of pathsToDelete) {
      logger5.debug("delete", p);
      (0, import_fs5.rmSync)(p, { force: true, recursive: true });
    }
  }
  async clearBrowserStorage() {
    const win = this.electronApp.windows()[0];
    if (!win) return;
    logger5.log(import_chalk2.default.magenta("clearing..."));
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
    const message = success ? import_chalk2.default.magenta("localStorage cleared.") : import_chalk2.default.red("failed to clear localStorage");
    logger5.log(message);
  }
};

// src/internal/managers/VaultManager.ts
var import_chalk3 = __toESM(require("chalk"), 1);
var import_fs6 = require("fs");
var import_loglevel6 = __toESM(require("loglevel"), 1);
var import_path8 = __toESM(require("path"), 1);
var logger6 = import_loglevel6.default.getLogger("VaultManager");
var VaultManager = class {
  constructor(ipc, options, vaultPath) {
    this.ipc = ipc;
    this.options = options;
    this.vaultPath = vaultPath;
  }
  async openSandboxVault(executeAction) {
    logger6.debug(import_chalk3.default.green("Opening sandbox vault..."));
    const page = await executeAction(
      () => this.ipc.openSandbox(),
      PageWaiter.waitForPage
    );
    const vaultPath = await this.ipc.getSandboxPath();
    logger6.debug(import_chalk3.default.green("Sandbox vault opened at:", vaultPath));
    return { vaultPath, page };
  }
  async openNormalVault(executeAction) {
    logger6.debug("Opening normal vault...");
    const vaultPath = await this.resolveVaultPath();
    if (this.options.fresh && (0, import_fs6.existsSync)(vaultPath)) {
      (0, import_fs6.rmSync)(vaultPath, { recursive: true });
    }
    if (!this.options.fresh && !(0, import_fs6.existsSync)(vaultPath)) {
      logger6.debug("Creating vault directory:", vaultPath);
      (0, import_fs6.mkdirSync)(vaultPath, { recursive: true });
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
    return import_path8.default.join(
      process.env.USERPROFILE || process.env.HOME || "",
      "ObsidianVaults",
      name
    );
  }
};

// src/internal/managers/WindowManager.ts
var import_chalk4 = __toESM(require("chalk"), 1);
var import_loglevel7 = __toESM(require("loglevel"), 1);
var logger7 = import_loglevel7.default.getLogger("WindowManager");
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
    logger7.debug(import_chalk4.default.green("New window is ready:", newPage.url()));
    return newPage;
  }
  async closeOldWindows(oldWindows, newPage) {
    for (const window2 of oldWindows) {
      if (window2 !== newPage && !window2.isClosed()) {
        logger7.debug(
          import_chalk4.default.yellow(`Closing old window: ${await window2.title()}`)
        );
        await window2.close();
      }
    }
  }
  async closeAllExcept(keepPage) {
    for (const window2 of this.electronApp.windows()) {
      if (window2 !== keepPage && !window2.isClosed()) {
        logger7.debug(import_chalk4.default.red(`close ${window2.url()}`));
        await window2.close();
      }
    }
  }
};

// src/internal/launcher.ts
var logger8 = import_loglevel8.default.getLogger("ObsidianTestLauncher");
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
      this.options.plugins.map((plugin) => ({
        ...plugin,
        pluginId: getActualPluginId(plugin.path)
      })),
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
    logger8.debug(import_chalk5.default.blue("Reloading vault to apply plugin changes..."));
    await page.reload();
    await PageWaiter.waitForPage(page);
    logger8.debug(import_chalk5.default.blue("Vault reloaded."));
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
var import_es_toolkit = require("es-toolkit");
var import_test5 = require("@playwright/test");

// src/fetchPlugin.ts
var import_child_process = require("child_process");
var import_path9 = __toESM(require("path"), 1);
var import_fs7 = __toESM(require("fs"), 1);
var import_promises2 = require("fs/promises");
function run(cmd, args, opts = {}) {
  const r = (0, import_child_process.spawnSync)(cmd, args, { stdio: "inherit", cwd: opts.cwd });
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
  await (0, import_promises2.writeFile)(destPath, buffer);
}
async function fetchPlugin(repo, destArg, opts) {
  if (!repo) throw new TypeError("repo url is required");
  const cwd = process.cwd();
  const { owner, repo: repoName } = parseRepoUrl(repo);
  const dest = destArg ? import_path9.default.resolve(cwd, destArg) : import_path9.default.resolve(cwd, "myfiles", repoName);
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
    import_fs7.default.mkdirSync(dest, { recursive: true });
    for (const fname of desiredFiles) {
      const asset = assets.find((a) => a.name === fname);
      if (asset && asset.browser_download_url) {
        const out = import_path9.default.join(dest, fname);
        console.log(`[fetchPlugin] downloading ${asset.browser_download_url} -> ${out}`);
        try {
          await downloadToFile(asset.browser_download_url, out);
          console.log(`[fetchPlugin] downloaded ${fname}`);
        } catch (err) {
          console.log(`[fetchPlugin] failed to download ${fname}: ${err && err.message}`);
        }
      }
    }
    const written = desiredFiles.some((f) => import_fs7.default.existsSync(import_path9.default.join(dest, f)));
    if (!written) {
      for (const a of assets) {
        if (!a.browser_download_url || !a.name) continue;
        const out = import_path9.default.join(dest, a.name);
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
      const pkgJson = import_path9.default.join(dest, "package.json");
      if (import_fs7.default.existsSync(pkgJson)) {
        run("pnpm", ["install"], { cwd: dest });
        const pkg = JSON.parse(import_fs7.default.readFileSync(pkgJson, "utf8"));
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
  if (import_fs7.default.existsSync(dest)) {
    try {
      console.log(`[fetchPlugin] destination exists; pulling: ${dest}`);
      run("git", ["-C", dest, "pull"]);
      return dest;
    } catch (err) {
      throw new Error(`Failed to update plugin at ${dest}: ${err}`);
    }
  }
  import_fs7.default.mkdirSync(import_path9.default.dirname(dest), { recursive: true });
  try {
    console.log(`[fetchPlugin] cloning ${repo} -> ${dest}`);
    run("git", ["clone", "--depth", "1", repo, dest]);
    try {
      const pkgJson = import_path9.default.join(dest, "package.json");
      if (import_fs7.default.existsSync(pkgJson)) {
        run("pnpm", ["install"], { cwd: dest });
        const pkg = JSON.parse(import_fs7.default.readFileSync(pkgJson, "utf8"));
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
var logger2 = import_loglevel9.default.getLogger("obsidianSetup");
var test = import_test4.test.extend({
  tempDir: async ({}, use) => {
    const dir = await import_promises3.default.mkdtemp(import_path10.default.join(import_os.default.tmpdir(), "obsidian-e2e-"));
    await use(dir);
    await import_promises3.default.rm(dir, { recursive: true, force: true }).catch(() => {
    });
    await import_promises3.default.rm(`${dir}-vault`, { recursive: true, force: true }).catch(() => {
    });
  },
  vaultOptions: [DEFAULT_VAULT_OPTIONS, { option: true }],
  obsidian: async ({ vaultOptions, tempDir }, use, testInfo) => {
    const paths = getResolvedPaths();
    const launcher = new ObsidianE2ELauncher({
      paths,
      options: (0, import_es_toolkit.merge)(DEFAULT_VAULT_OPTIONS, vaultOptions),
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ObsidianAPI,
  expect,
  fetchPlugin,
  logger,
  test
});
//# sourceMappingURL=index.cjs.map