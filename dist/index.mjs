import chalk from "chalk";
import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
import { expect, expect as expect$1, test as test$1 } from "@playwright/test";
import { merge } from "es-toolkit";
import fs, { writeFile } from "fs/promises";
import os from "os";
import path from "path";
import path$1 from "node:path";
import { fileURLToPath } from "node:url";
import { findUpSync } from "find-up";
import fs$1, { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "fs";
import invariant from "tiny-invariant";
import { fileURLToPath as fileURLToPath$1 } from "url";
import { createRequire } from "module";
import { _electron, expect as expect$2 } from "playwright/test";
import { spawnSync } from "child_process";
//#region src/internal/logger.ts
const colors = {
	TRACE: chalk.magenta,
	DEBUG: chalk.cyan,
	INFO: chalk.blue,
	WARN: chalk.yellow,
	ERROR: chalk.red
};
prefix.reg(log);
prefix.apply(log, { format(level, name, timestamp) {
	const color = colors[level.toUpperCase()] || chalk.white;
	const paddedLevel = level.toUpperCase().padEnd(5, " ");
	const nameStr = name ? `[${name}]` : "";
	return `${chalk.gray(`[${timestamp}]`)} ${color(paddedLevel)} ${chalk.green(nameStr)}`;
} });
log.setDefaultLevel("warn");
/**
* Creates a new ObsidianTestSetup instance with the provided configuration
*
* @param config - Configuration object with plugin directory and optional settings
* @returns Configured ObsidianTestSetup instance ready to launch
*
* @example
* ```typescript
* import { createTestSetup } from 'obsidian-e2e';
*
* const setup = createTestSetup({
*   pluginDir: process.cwd(),
*   distDir: 'dist',
* });
*
* await setup.launch();
* const vault = await setup.openVault({
*   plugins: [{
*     path: setup.getPaths().distDir,
*     pluginId: setup.getPaths().pluginId,
*   }],
* });
* ```
*/
function formatScope(scope) {
	if (!scope) return "";
	const entries = [scope.runId ? `run=${scope.runId}` : "", scope.phase ? `phase=${scope.phase}` : ""].filter(Boolean);
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
	return `${(testTitle || "test").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "test"}-${Date.now().toString(36)}`;
}
const DEFAULT_BROWSER_CONSOLE_LOGGING_OPTIONS = {
	enabledTypes: [
		"warning",
		"warn",
		"error",
		"assert"
	],
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
	const previewLength = Math.min(options.previewLength > 0 ? options.previewLength : maxLength, maxLength);
	const normalized = text.trim();
	if (normalized.length <= maxLength) return normalized;
	return `${normalized.slice(0, previewLength)}... [${normalized.length} chars; truncated at ${maxLength}]`;
}
function shouldDemoteError(type, message, demoteErrorPatterns) {
	if (!(["error", "assert"].includes(type) || type === "pageerror")) return false;
	return demoteErrorPatterns.some((pattern) => pattern.test(message));
}
function toLogMethod(type) {
	if (["error", "assert"].includes(type)) return "error";
	if (["warning", "warn"].includes(type)) return "warn";
	if (type === "debug") return "debug";
	return "info";
}
function setupBrowserConsoleLogging(window, configOrScope, maybeOptions) {
	const { scope, options } = resolveBrowserConsoleLoggerConfig(configOrScope, maybeOptions);
	const browserLogger = createScopedLogger("BrowserConsole", scope);
	const enabledTypes = new Set(options.enabledTypes.map((type) => type.toLowerCase()));
	const ignoredMessagePatterns = options.ignoredMessagePatterns.map((pattern) => new RegExp(pattern, "i"));
	const demoteErrorPatterns = options.demoteErrorMessagePatterns.map((pattern) => new RegExp(pattern, "i"));
	window.on("console", (msg) => {
		const type = msg.type().toLowerCase();
		if (!enabledTypes.has(type)) return;
		const text = msg.text();
		if (ignoredMessagePatterns.some((pattern) => pattern.test(text))) return;
		const abbreviated = abbreviateMessage(text, options);
		browserLogger[shouldDemoteError(type, abbreviated, demoteErrorPatterns) ? "warn" : toLogMethod(type)](`[BROWSER:${type.toUpperCase()}] ${abbreviated}`);
		const location = msg.location();
		if (options.includeLocation && location.url && location.url !== "about:blank") browserLogger.debug(`[BROWSER:LOCATION] ${location.url}:${location.lineNumber}:${location.columnNumber}`);
	});
	window.on("pageerror", (error) => {
		if (!options.includePageErrors) return;
		browserLogger[shouldDemoteError("pageerror", error.message, demoteErrorPatterns) ? "warn" : "error"](`[BROWSER:PAGEERROR] ${error.message}`);
		if (error.stack) browserLogger.debug(`[BROWSER:STACK] ${error.stack}`);
	});
	window.on("requestfailed", (request) => {
		if (!options.includeRequestFailures) return;
		browserLogger.warn(`[BROWSER:REQUESTFAILED] ${request.url()}`);
		const failure = request.failure();
		if (failure) browserLogger.warn(`[BROWSER:FAILURE] ${failure.errorText}`);
	});
	window.on("response", (response) => {
		if (options.includeHttpErrors && response.status() >= options.httpErrorThreshold) browserLogger.warn(`[BROWSER:HTTP] ${response.status()} ${response.statusText()} - ${response.url()}`);
	});
}
function toggleLoggerBy(level, filter = () => true) {
	Object.values(log.getLoggers()).filter((logger) => filter(logger.name)).forEach((logger) => {
		logger.setLevel(level);
	});
	log.setLevel(level);
}
//#endregion
//#region node_modules/.pnpm/tsdown@0.22.2_typescript@6.0.3/node_modules/tsdown/esm-shims.js
const getFilename = () => fileURLToPath(import.meta.url);
const getDirname = () => path$1.dirname(getFilename());
const __dirname = /* @__PURE__ */ getDirname();
const __filename = /* @__PURE__ */ getFilename();
//#endregion
//#region src/internal/path.ts
const filename$1 = typeof __filename !== "undefined" ? __filename : fileURLToPath$1(import.meta.url);
const dirname$1 = typeof __dirname !== "undefined" ? __dirname : path.dirname(filename$1);
/**
* Resolves and validates all paths for Obsidian E2E testing
*/
function resolveConfig(config) {
	const pluginDir = path.resolve(config.pluginDir);
	if (!existsSync(pluginDir)) throw new Error(`Plugin directory not found: ${pluginDir}`);
	const manifestPath = path.join(pluginDir, "manifest.json");
	let manifest;
	if (config.manifest) manifest = config.manifest;
	else if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	else manifest = {
		id: "obsidian-e2e-toolkit-dummy-plugin",
		name: "Dummy Plugin",
		version: "1.0.0"
	};
	const pluginId = config.pluginId || manifest.id;
	if (!pluginId) throw new Error("Plugin ID not found. Please provide pluginId in config or ensure manifest.json contains an 'id' field.");
	const distDir = config.distDir ? path.resolve(config.distDir) : path.join(pluginDir, "dist");
	const defaultAssetsDir = path.join(dirname$1, "assets");
	const assetsDir = config.assetsDir ? path.resolve(config.assetsDir) : defaultAssetsDir;
	const defaultObsidianUnpackedDir = path.join(dirname$1, ".obsidian-unpacked");
	const obsidianUnpackedDir = config.obsidianUnpackedDir ? path.resolve(config.obsidianUnpackedDir) : defaultObsidianUnpackedDir;
	const appMainFile = config.appMainFile || "main.cjs";
	return {
		pluginDir,
		distDir,
		assetsDir,
		obsidianUnpackedDir,
		appMainFile,
		appMainJsPath: path.join(obsidianUnpackedDir, appMainFile),
		pluginId,
		manifest
	};
}
/**
* Creates launch options for Playwright/Electron based on resolved paths
*/
function createLaunchOptions(paths) {
	if (!existsSync(paths.appMainJsPath)) throw new Error(`Obsidian app not found at: ${paths.appMainJsPath}. Please run the setup script to unpack Obsidian assets.`);
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
//#endregion
//#region src/internal/constants.ts
const filename = typeof __filename !== "undefined" ? __filename : fileURLToPath$1(import.meta.url);
const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(filename);
const logger$7 = log.getLogger("constants");
/**
* Default configuration
* Assumes this package is installed in node_modules or used as a submodule
*/
function getDefaultConfig() {
	const toolkitPackageJsonPath = findUpSync("package.json", { cwd: dirname });
	invariant(toolkitPackageJsonPath, "Could not find package.json for obsidian-e2e-toolkit.");
	const toolkitRoot = path.dirname(toolkitPackageJsonPath);
	const manifestPath = findUpSync("manifest.json", { cwd: toolkitRoot });
	const projectRoot = manifestPath ? path.dirname(manifestPath) : toolkitRoot;
	const toolkitHome = process.env.OBSIDIAN_E2E_TOOLKIT_HOME || (existsSync(path.join(toolkitRoot, "obsidian-e2e-toolkit-assets")) ? toolkitRoot : projectRoot);
	return {
		pluginDir: projectRoot,
		distDir: path.join(projectRoot, "dist"),
		assetsDir: path.join(toolkitRoot, "assets"),
		obsidianUnpackedDir: path.join(toolkitHome, "obsidian-e2e-toolkit-assets", "obsidian-unpacked"),
		appMainFile: "main.cjs"
	};
}
let RESOLVED_PATHS;
try {
	RESOLVED_PATHS = resolveConfig(getDefaultConfig());
	logger$7.debug("Plugin Directory:", RESOLVED_PATHS.pluginDir);
	logger$7.debug("Dist Directory:", RESOLVED_PATHS.distDir);
	logger$7.debug("Toolkit Root:", dirname);
	logger$7.debug("App Main Path:", RESOLVED_PATHS.appMainJsPath);
	invariant(existsSync(dirname), `Toolkit root not found at: ${dirname}.`);
	invariant(existsSync(RESOLVED_PATHS.appMainJsPath), `Obsidian app not found at: ${RESOLVED_PATHS.appMainJsPath}. Did you run the setup script?`);
} catch (error) {
	logger$7.error("Error: Could not resolve paths. Make sure you've run the setup script.", error);
	throw error;
}
const E2E_ROOT_DIR = dirname;
RESOLVED_PATHS.pluginDir;
RESOLVED_PATHS.distDir;
RESOLVED_PATHS.pluginId;
const SANDBOX_VAULT_NAME = "Obsidian Sandbox";
RESOLVED_PATHS.appMainJsPath, { ...process.env };
const CMD_ID_CLOSE_TAB = "workspace:close";
const CMD_ID_UNDO_CLOSE_TAB = "workspace:undo-close-pane";
path.join(E2E_ROOT_DIR, "assets", "hot-reload");
/**
* Get the resolved paths (useful when you want to access the configuration)
*/
function getResolvedPaths() {
	return RESOLVED_PATHS;
}
const DEFAULT_VAULT_OPTIONS = {
	sandbox: false,
	fresh: true,
	logLevel: "warn",
	browserConsoleLogging: {
		enabledTypes: [
			"warning",
			"warn",
			"error",
			"assert"
		],
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
//#endregion
//#region src/internal/services/serviceIds.ts
const SERVICE_IDS = {
	electronManager: "electronManager",
	windowManager: "windowManager",
	storageManager: "storageManager",
	ipcBridge: "ipcBridge",
	vaultManager: "vaultManager",
	pluginManager: "pluginManager"
};
//#endregion
//#region src/internal/utils.ts
async function getPluginHandleMap(page, plugins) {
	const pluginIds = plugins.map((p) => p.pluginId).filter(Boolean);
	logger.debug("getPluginHandleMap: waiting for plugin IDs:", pluginIds);
	if (pluginIds.length === 0) {
		logger.debug("getPluginHandleMap: no plugin IDs to wait for — returning empty map");
		return page.evaluateHandle(() => /* @__PURE__ */ new Map());
	}
	try {
		await page.waitForFunction((pluginIds) => {
			const plugins = window.app?.plugins?.plugins;
			return !!plugins && pluginIds.every((id) => plugins[id]);
		}, pluginIds, { timeout: 3e4 });
	} catch (err) {
		logger.error("getPluginHandleMap: timeout waiting for plugins to load", err && err.message);
		try {
			const diagnostics = await page.evaluate((requestedPluginIds) => {
				const appPlugins = window.app?.plugins;
				const loadedPluginIds = Object.keys(appPlugins?.plugins || {});
				return {
					loadedPluginIds,
					enabledPluginIds: Array.from(appPlugins?.enabledPlugins || []),
					manifestPluginIds: Object.keys(appPlugins?.manifests || {}),
					missingPluginIds: requestedPluginIds.filter((id) => !loadedPluginIds.includes(id))
				};
			}, pluginIds);
			logger.error("getPluginHandleMap: plugin diagnostics:", diagnostics);
			throw new Error(`Timed out waiting for plugins to load. missing=${diagnostics.missingPluginIds.join(",") || "(none)"} loaded=${diagnostics.loadedPluginIds.join(",") || "(none)"} enabled=${diagnostics.enabledPluginIds.join(",") || "(none)"}`);
		} catch (e) {
			if (e instanceof Error && e.message.includes("Timed out waiting")) throw e;
			logger.error("getPluginHandleMap: failed to enumerate app.plugins.plugins", e && e.message);
		}
		throw err;
	}
	return page.evaluateHandle((plugins) => {
		const map = /* @__PURE__ */ new Map();
		const idMapping = /* @__PURE__ */ new Map();
		plugins.forEach((p) => {
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
		logger.debug(`Test finished with status: ${status}.`);
		return;
	}
	logger.error(`Test finished with status: ${status}. Pausing for debug.`);
	if (testInfo.error) {
		const separator = "=".repeat(20);
		logger.error(`\n${separator} TEST FAILED ${separator}`);
		logger.error(testInfo.error.message);
		if (testInfo.error.stack) {
			const firstNewlineIndex = testInfo.error.stack.indexOf("\n");
			const stackWithoutMessage = testInfo.error.stack.substring(firstNewlineIndex + 1);
			logger.error(stackWithoutMessage);
		}
		logger.error("=".repeat(53) + "\n");
	}
	if (!process.env.CI) logger.debug(testInfo.errors);
}
async function createObsidianContext(launcher) {
	return launcher.launch();
}
//#endregion
//#region src/internal/features/CreateVaultContextFeature.ts
var CreateVaultContextFeature = class {
	async run(input, ctx, services) {
		const electronManager = services.getValue(SERVICE_IDS.electronManager);
		const vaultName = await input.page.evaluate(() => app?.vault?.getName());
		let pluginHandleMap;
		if (!input.plugins || input.plugins.length === 0) pluginHandleMap = await input.page.evaluateHandle(() => /* @__PURE__ */ new Map());
		else pluginHandleMap = await getPluginHandleMap(input.page, input.plugins || []);
		return {
			electronApp: electronManager.getApp(),
			page: input.page,
			pluginHandleMap,
			vaultName,
			paths: ctx.paths
		};
	}
};
//#endregion
//#region src/internal/services/PageWaiter.ts
/**
* Handles waiting for various page states in Obsidian
*/
var PageWaiter = class PageWaiter {
	static async waitForPage(page, timeout = 15e3) {
		await page.waitForLoadState("domcontentloaded");
		if (PageWaiter.isStarterPage(page)) {
			await PageWaiter.waitForStarterReady(page, timeout);
			return;
		}
		await PageWaiter.waitForVaultReady(page, timeout);
	}
	static isStarterPage(page) {
		return page.url().includes("starter");
	}
	/**
	* Wait for the Obsidian vault to be ready
	* This ensures the workspace layout is initialized
	*/
	static async waitForVaultReady(page, timeout) {
		await page.waitForFunction(() => {
			const workspace = window.app?.workspace;
			return !!workspace && (workspace.layoutReady === true || !!workspace.activeLeaf);
		}, { timeout });
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
//#endregion
//#region src/internal/features/OpenStarterFeature.ts
var OpenStarterFeature = class {
	async run(_input, ctx, services) {
		const windowManager = services.getValue(SERVICE_IDS.windowManager);
		const ipcBridge = services.getValue(SERVICE_IDS.ipcBridge);
		const electronManager = services.getValue(SERVICE_IDS.electronManager);
		const page = await windowManager.executeActionAndWaitForNewWindow(async () => await ipcBridge.openStarter(), PageWaiter.waitForPage);
		await PageWaiter.waitForPage(page);
		ctx.runtime.activePage = page;
		return {
			electronApp: electronManager.getApp(),
			page
		};
	}
};
//#endregion
//#region src/internal/features/OpenVaultFeature.ts
var OpenVaultFeature = class {
	async run(input, ctx, services) {
		const result = await services.getValue(SERVICE_IDS.vaultManager).openVault(input.options);
		ctx.runtime.activePage = result.page;
		ctx.runtime.vaultPath = result.vaultPath;
		return result;
	}
};
//#endregion
//#region src/internal/features/PrepareRuntimeFeature.ts
var PrepareRuntimeFeature = class {
	async run(input, ctx, services) {
		const storageManager = services.getValue(SERVICE_IDS.storageManager);
		const windowManager = services.getValue(SERVICE_IDS.windowManager);
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
//#endregion
//#region src/internal/features/SetupPluginsFeature.ts
var SetupPluginsFeature = class {
	async run(input, _ctx, services) {
		const pluginManager = services.getValue(SERVICE_IDS.pluginManager);
		await pluginManager.installAll();
		await pluginManager.enableAll(input.page);
		await input.page.reload();
		await PageWaiter.waitForPage(input.page);
	}
};
//#endregion
//#region src/internal/services/ElectronAppManager.ts
const logger$6 = log.getLogger("ElectronAppManager");
var ElectronAppManager = class {
	paths;
	electronApp;
	tempUserDataDir;
	constructor(paths, tempUserDataDir) {
		this.paths = paths;
		this.tempUserDataDir = tempUserDataDir;
	}
	async launch() {
		this.electronApp = await this.launchElectronApp();
		return this.electronApp;
	}
	async launchElectronApp() {
		try {
			const pkgJson = createRequire(import.meta.url).resolve("electron/package.json");
			const electronRoot = path.dirname(pkgJson);
			const distDir = path.join(electronRoot, "dist");
			if (!existsSync(distDir)) {
				logger$6.error(`Electron dist not found at ${distDir}`);
				logger$6.error(`Electron root contents:`, await fs.readdir(electronRoot));
				throw new Error("Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly.");
			}
		} catch (err) {
			logger$6.error("Electron preflight check failed:", err && err.message ? err.message : err);
			throw err;
		}
		const baseLaunchOptions = createLaunchOptions(this.paths);
		const launchOptions = {
			...baseLaunchOptions,
			args: [...baseLaunchOptions.args, `--user-data-dir=${this.tempUserDataDir}`],
			env: {
				...baseLaunchOptions.env,
				PLAYWRIGHT: "true",
				CI: process.env.CI || "false"
			}
		};
		return await _electron.launch(launchOptions);
	}
	async cleanup() {
		if (this.electronApp) try {
			await this.closeAllWindows();
			await this.electronApp.close();
		} catch (error) {
			logger$6.warn("Error during cleanup:", error);
		}
		logger$6.debug("ElectronAppManager cleaned up");
	}
	async closeAllWindows() {
		const windows = this.electronApp.windows();
		await Promise.all(windows.map((win) => win.close()));
	}
	getApp() {
		if (!this.electronApp) throw new Error("ElectronApp not initialized");
		return this.electronApp;
	}
	getCurrentPage() {
		return this.electronApp?.windows()[0];
	}
	getTempUserDataDir() {
		return this.tempUserDataDir;
	}
};
//#endregion
//#region src/internal/services/ipc.ts
var IPCBridge = class {
	setup;
	constructor(setup) {
		this.setup = setup;
	}
	async send(channel, ...args) {
		await this.ensurePageLoaded();
		return (await this.setup.ensureSingleWindow()).evaluate((args) => {
			const [ch, ...restArgs] = args;
			return window.electron.ipcRenderer.sendSync(ch, ...restArgs);
		}, [channel, ...args]);
	}
	async ensurePageLoaded() {
		const page = await this.setup.ensureSingleWindow();
		await PageWaiter.waitForPage(page);
	}
	async openVault(vaultPath, forceNew = false) {
		return this.send("vault-open", vaultPath, forceNew);
	}
	async openSandbox() {
		this.send("sandbox");
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
//#endregion
//#region src/internal/services/PluginManager.ts
const logger$5 = log.getLogger("PluginManager");
var PluginManager = class {
	plugins;
	vaultPath;
	constructor(plugins, vaultPath) {
		this.plugins = plugins;
		this.vaultPath = vaultPath;
	}
	async installAll() {
		const pluginsDir = this.ensurePluginsDirectory();
		const installedIds = [];
		const installedPlugins = [];
		const failedPlugins = [];
		for (const plugin of this.getPlugins()) if (await this.installSingle(pluginsDir, plugin)) {
			installedIds.push(plugin.pluginId);
			installedPlugins.push(plugin);
		} else failedPlugins.push(`${plugin.pluginId} (${plugin.path})`);
		if (failedPlugins.length > 0) throw new Error(`Failed to install plugin fixtures: ${failedPlugins.join(", ")}. Ensure each plugin path contains manifest.json and main.js.`);
		this.plugins = installedPlugins;
		this.updateCommunityPluginsJson(installedIds);
		logger$5.debug(`Installed plugins: ${installedIds.join(", ")}`);
	}
	getPlugins() {
		return this.plugins || [];
	}
	ensurePluginsDirectory() {
		const obsidianDir = path.join(this.vaultPath, ".obsidian");
		const pluginsDir = path.join(obsidianDir, "plugins");
		if (!existsSync(obsidianDir)) mkdirSync(obsidianDir, { recursive: true });
		if (!existsSync(pluginsDir)) mkdirSync(pluginsDir, { recursive: true });
		return pluginsDir;
	}
	async installSingle(pluginsDir, plugin) {
		if (!this.validatePluginPath(plugin)) {
			logger$5.warn(`Invalid plugin path: ${plugin.path}`);
			return false;
		}
		const destDir = path.join(pluginsDir, plugin.pluginId);
		if (plugin.symlink) {
			logger$5.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
			return this.createPluginSymlink(plugin.path, destDir, plugin.pluginId);
		} else {
			logger$5.debug(`Copying files for plugin: ${plugin.pluginId}`);
			return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
		}
	}
	validatePluginPath(plugin) {
		if (!existsSync(plugin.path)) {
			logger$5.warn(`Plugin path not found: ${plugin.path}`);
			return false;
		}
		if (!existsSync(path.join(plugin.path, "manifest.json"))) {
			logger$5.warn(`manifest.json not found in: ${plugin.path}`);
			return false;
		}
		if (!existsSync(path.join(plugin.path, "main.js"))) {
			logger$5.warn(`main.js not found in: ${plugin.path}`);
			return false;
		}
		return true;
	}
	createPluginSymlink(sourcePath, destDir, pluginId) {
		if (existsSync(destDir)) {
			logger$5.debug(`Destination already exists: ${destDir}, skipping symlink`);
			return true;
		}
		try {
			symlinkSync(sourcePath, destDir, "dir");
			logger$5.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
			return true;
		} catch (error) {
			logger$5.error(`Failed to create symlink for ${pluginId}:`, error);
			return false;
		}
	}
	copyPluginFiles(sourcePath, destDir, pluginId) {
		if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
		const filesToCopy = [
			"manifest.json",
			"main.js",
			"styles.css"
		];
		for (const file of readdirSync(sourcePath)) {
			const srcFile = path.join(sourcePath, file);
			if (statSync(srcFile).isDirectory() || !filesToCopy.includes(file)) continue;
			copyFileSync(srcFile, path.join(destDir, file));
			logger$5.debug(`Copied: ${file} to ${destDir}`);
		}
		logger$5.debug(`Installed plugin: ${pluginId}`);
		return true;
	}
	updateCommunityPluginsJson(installedIds) {
		writeFileSync(path.join(this.vaultPath, ".obsidian", "community-plugins.json"), JSON.stringify(installedIds));
	}
	async enableAll(page) {
		await this.disableRestrictedMode(page);
		const pluginIds = this.plugins.map((p) => p.pluginId);
		const enabledIds = await page.evaluate(async (ids) => {
			const app = window.app;
			const enabled = [];
			for (const id of ids) {
				await app.plugins.enablePluginAndSave(id);
				enabled.push(id);
			}
			return enabled;
		}, pluginIds);
		logger$5.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
	}
	async disableRestrictedMode(page) {
		await this.waitForPluginsAPI(page);
		if (await this.isCommunityPluginsEnabled(page)) {
			logger$5.debug("Community plugins are already enabled.");
			return;
		}
		logger$5.debug("Attempting to enable community plugins...");
		await this.openCommunityPluginsSettings(page);
		await this.clickEnableButtons(page);
		await this.closeCommunityPluginsSettings(page);
		await this.verifyCommunityPluginsEnabled(page);
	}
	async waitForPluginsAPI(page) {
		await page.waitForFunction(() => {
			return window.app?.plugins?.isEnabled !== void 0;
		}, { timeout: 1e4 });
	}
	async isCommunityPluginsEnabled(page) {
		return await page.evaluate(() => {
			return window.app?.plugins?.isEnabled?.() ?? false;
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
			return (window.app.setting.activeTab?.setting?.contentEl?.querySelector("button.mod-cta"))?.textContent?.trim() || null;
		});
		const clickButton = () => page.evaluate(() => {
			(window.app.setting.activeTab?.setting?.contentEl?.querySelector("button.mod-cta"))?.click();
		});
		let buttonText = await getButtonText();
		if (buttonText === "Turn on and reload") {
			logger$5.debug("Clicking 'Turn on and reload'...");
			await clickButton();
			await page.waitForTimeout(1e3);
			buttonText = await getButtonText();
		}
		if (buttonText === "Turn on community plugins") {
			logger$5.debug("Clicking 'Turn on community plugins'...");
			await clickButton();
			await page.waitForTimeout(1e3);
		}
	}
	async closeCommunityPluginsSettings(page) {
		await page.keyboard.press("Escape");
	}
	async verifyCommunityPluginsEnabled(page) {
		expect$1(await this.isCommunityPluginsEnabled(page), "Failed to enable community plugins.").toBe(true);
	}
};
function getActualPluginId(pluginPath) {
	const manifestPath = path.join(pluginPath, "manifest.json");
	if (existsSync(manifestPath)) try {
		return JSON.parse(readFileSync(manifestPath, "utf-8")).id;
	} catch (e) {
		logger$5.warn(`Failed to parse manifest.json at ${pluginPath}`);
	}
	return "";
}
//#endregion
//#region src/internal/services/ServiceContainer.ts
var ServiceContainer = class {
	services = /* @__PURE__ */ new Map();
	register(service) {
		if (this.services.has(service.id)) throw new Error(`Service already registered: ${service.id}`);
		this.services.set(service.id, service);
		return service;
	}
	get(id) {
		const service = this.services.get(id);
		if (!service) throw new Error(`Service not found: ${id}`);
		return service;
	}
	getValue(id) {
		return this.get(id).value;
	}
	async setupAll(ctx) {
		for (const service of this.services.values()) await service.setup?.(ctx);
	}
	async disposeAll(ctx) {
		const registered = [...this.services.values()].reverse();
		for (const service of registered) await service.dispose?.(ctx);
	}
};
var ValueService = class {
	id;
	value;
	hooks;
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
//#endregion
//#region src/internal/services/StorageManager.ts
const logger$4 = log.getLogger("StorageManager");
var StorageManager = class {
	electronApp;
	constructor(electronApp) {
		this.electronApp = electronApp;
	}
	async clearAll() {
		await this.deleteUserDataFiles();
		await this.clearBrowserStorage();
	}
	async deleteUserDataFiles() {
		const userDataDir = await this.electronApp.evaluate(({ app }) => app.getPath("userData"));
		const pathsToDelete = [path.join(userDataDir, "obsidian.json"), path.join(userDataDir, SANDBOX_VAULT_NAME)];
		for (const p of pathsToDelete) {
			logger$4.debug("delete", p);
			rmSync(p, {
				force: true,
				recursive: true
			});
		}
	}
	async clearBrowserStorage() {
		const win = this.electronApp.windows()[0];
		if (!win) return;
		logger$4.debug(chalk.magenta("Clearing browser storage"));
		const message = await win.evaluate(async () => {
			const webContents = window.electron.remote.BrowserWindow.getFocusedWindow()?.webContents;
			if (!webContents) return false;
			webContents.session.flushStorageData();
			await webContents.session.clearStorageData({ storages: [
				"indexdb",
				"localstorage",
				"websql"
			] });
			await webContents.session.clearCache();
			return true;
		}) ? chalk.magenta("localStorage cleared.") : chalk.red("failed to clear localStorage");
		logger$4.debug(message);
	}
};
//#endregion
//#region src/internal/services/VaultManager.ts
const logger$3 = log.getLogger("VaultManager");
var VaultManager = class {
	ipc;
	windowManager;
	options;
	vaultPath;
	constructor(ipc, windowManager, options, vaultPath) {
		this.ipc = ipc;
		this.windowManager = windowManager;
		this.options = options;
		this.vaultPath = vaultPath;
	}
	async openVault(options) {
		if (!!(options.sandbox && !process.env.CI)) return this.openSandboxVault();
		return this.openNormalVault(options);
	}
	async openSandboxVault() {
		logger$3.debug(chalk.green("Opening sandbox vault..."));
		const page = await this.windowManager.executeActionAndWaitForNewWindow(() => this.ipc.openSandbox(), PageWaiter.waitForPage);
		const vaultPath = await this.ipc.getSandboxPath();
		logger$3.debug(chalk.green("Sandbox vault opened at:", vaultPath));
		return {
			vaultPath,
			page
		};
	}
	async openNormalVault(options) {
		logger$3.debug("Opening normal vault...");
		const vaultPath = await this.resolveVaultPath(options);
		if (options.fresh && existsSync(vaultPath)) rmSync(vaultPath, { recursive: true });
		if (!options.fresh && !existsSync(vaultPath)) {
			logger$3.debug("Creating vault directory:", vaultPath);
			mkdirSync(vaultPath, { recursive: true });
		}
		const page = await this.windowManager.executeActionAndWaitForNewWindow(async () => {
			const result = await this.ipc.openVault(vaultPath, !!options.fresh);
			if (result !== true) throw new Error(`Failed to open vault: ${result}`);
		}, PageWaiter.waitForPage);
		logger$3.debug("Normal vault opened:", vaultPath);
		return {
			vaultPath,
			page
		};
	}
	async resolveVaultPath(options = this.options) {
		if (options.name) return await this.getVaultPathByName(options.name);
		logger$3.debug("options.name not specified, create temp dir");
		const tempPath = this.vaultPath;
		logger$3.debug("temp dir created:", tempPath);
		return tempPath;
	}
	async getVaultPathByName(name) {
		return path.join(process.env.USERPROFILE || process.env.HOME || "", "ObsidianVaults", name);
	}
};
//#endregion
//#region src/internal/services/WindowManager.ts
const logger$2 = log.getLogger("WindowManager");
var WindowManager = class {
	electronApp;
	constructor(electronApp) {
		this.electronApp = electronApp;
	}
	async ensureSingleWindow() {
		logger$2.debug("ensureSingleWindow");
		const windows = this.electronApp.windows();
		logger$2.debug(`${windows.length} opened`);
		if (windows.length === 0) return await this.getFirstWindow();
		const page = windows.at(-1);
		await page.waitForLoadState("domcontentloaded");
		await this.closeAllExcept(page);
		logger$2.debug(`closed all except ${await page.title()}`);
		return page;
	}
	async getFirstWindow() {
		const page = await this.electronApp.firstWindow();
		await page.waitForLoadState("domcontentloaded");
		logger$2.debug("first window");
		return page;
	}
	async executeActionAndWaitForNewWindow(action, waitCallback) {
		const currentWindows = this.electronApp.windows();
		const windowPromise = this.electronApp.waitForEvent("window", { timeout: 1e4 });
		await action();
		const newPage = await windowPromise;
		await waitCallback(newPage);
		await this.closeOldWindows(currentWindows, newPage);
		logger$2.debug(chalk.green("New window is ready:", newPage.url()));
		return newPage;
	}
	async closeOldWindows(oldWindows, newPage) {
		for (const window of oldWindows) if (window !== newPage && !window.isClosed()) {
			logger$2.debug(chalk.yellow(`Closing old window: ${await window.title()}`));
			await window.close();
		}
	}
	async closeAllExcept(keepPage) {
		for (const window of this.electronApp.windows()) if (window !== keepPage && !window.isClosed()) {
			logger$2.debug(chalk.red(`close ${window.url()}`));
			await window.close();
		}
	}
};
//#endregion
//#region src/internal/launcher.ts
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
		if (this.initialized) return;
		const electronApp = await this.electronManager.launch();
		this.scopedLogger.debug("Electron app launched");
		const windowManager = new WindowManager(electronApp);
		const storageManager = new StorageManager(electronApp);
		const services = new ServiceContainer();
		services.register(new ValueService(SERVICE_IDS.electronManager, this.electronManager, { dispose: async () => {
			await this.electronManager.cleanup();
		} }));
		services.register(new ValueService(SERVICE_IDS.windowManager, windowManager));
		services.register(new ValueService(SERVICE_IDS.storageManager, storageManager));
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
		const { starterPage } = await this.prepareRuntimeFeature.run({ initialPage }, serviceContext, services);
		this.scopedLogger.debug("Starter page ready", starterPage.url());
		const ipcBridge = new IPCBridge({ ensureSingleWindow: windowManager.ensureSingleWindow.bind(windowManager) });
		services.register(new ValueService(SERVICE_IDS.ipcBridge, ipcBridge));
		const vaultManager = new VaultManager(ipcBridge, windowManager, this.options, this.tempVaultDir);
		services.register(new ValueService(SERVICE_IDS.vaultManager, vaultManager));
		const vaultPath = await vaultManager.resolveVaultPath();
		this.scopedLogger.debug("Vault path resolved", vaultPath);
		const pluginManager = new PluginManager(this.options.plugins.map((plugin) => ({
			...plugin,
			pluginId: getActualPluginId(plugin.path)
		})), vaultPath);
		services.register(new ValueService(SERVICE_IDS.pluginManager, pluginManager));
		serviceContext.runtime.vaultPath = vaultPath;
		serviceContext.runtime.initialized = true;
		this.services = services;
		this.serviceContext = serviceContext;
		this.initialized = true;
	}
	requireServices() {
		if (!this.services) throw new Error("Service container not initialized");
		return this.services;
	}
	requireServiceContext() {
		if (!this.serviceContext) throw new Error("Service context not initialized");
		return this.serviceContext;
	}
	async cleanup() {
		if (this.services && this.serviceContext) await this.services.disposeAll(this.serviceContext);
		else await this.electronManager.cleanup();
		this.initialized = false;
		this.services = null;
		this.serviceContext = null;
		this.scopedLogger.debug("Launcher cleanup completed");
	}
	async launch(options = DEFAULT_VAULT_OPTIONS) {
		await this.ensureInitialized();
		const services = this.requireServices();
		const serviceContext = this.requireServiceContext();
		const pluginManager = services.getValue(SERVICE_IDS.pluginManager);
		this.scopedLogger.debug("Opening vault", options);
		const runOptions = {
			...this.options,
			...options
		};
		const { page } = await this.openVaultFeature.run({ options: runOptions }, serviceContext, services);
		const configuredPlugins = pluginManager.getPlugins() || [];
		this.scopedLogger.debug("Configured plugins", configuredPlugins.map((p) => ({
			path: p.path,
			pluginId: p.pluginId
		})));
		if (configuredPlugins.length) {
			this.scopedLogger.debug("Installing configured plugins");
			await this.setupPluginsFeature.run({ page }, serviceContext, services);
			this.scopedLogger.debug(`${pluginManager.getPlugins().length} plugins setup completed`);
		}
		this.scopedLogger.debug("Creating vault context", pluginManager.getPlugins().map((p) => p.pluginId));
		const context = await this.createVaultContextFeature.run({
			page,
			plugins: pluginManager.getPlugins()
		}, serviceContext, services);
		this.scopedLogger.debug("Vault context created", context.vaultName);
		const notices = await context.page.locator(".notice-container .notice").all();
		this.scopedLogger.debug("Removing notices");
		await Promise.all(notices.map((notice) => notice.click()));
		return context;
	}
	async openStarter() {
		await this.ensureInitialized();
		return this.openStarterFeature.run(void 0, this.requireServiceContext(), this.requireServices());
	}
	getVaultOptions() {
		return this.options;
	}
};
//#endregion
//#region src/ObsidianAPI.ts
/**
* シンプルで直感的なObsidian APIクラス
*/
var ObsidianAPI = class {
	page;
	context;
	constructor(context) {
		invariant(context.page, "Page context is required");
		this.page = context.page;
		this.context = context;
	}
	appState(callback, arg) {
		return this.page.evaluate(callback, arg);
	}
	async activeLeaf() {
		return this.appState(() => {
			const leaf = app.workspace.activeLeaf;
			if (!leaf) return null;
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
			if (!leaf || !editor) return null;
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
			if (!leaf || typeof view?.getViewType !== "function" || view.getViewType() !== type) return null;
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
		return (await this.view(viewType))?.title ?? null;
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
	async command(commandId) {
		expect$2(await this.appState((id) => {
			if (app.commands.executeCommandById(id)) return true;
			if (id.includes(":")) {
				const [pluginId, ...rest] = id.split(":");
				const actualId = window.__pluginIdMapping?.get(pluginId);
				if (actualId) {
					const mappedId = [actualId, ...rest].join(":");
					return app.commands.executeCommandById(mappedId);
				}
			}
			return false;
		}, commandId)).toBe(true);
	}
	async split(direction = "vertical") {
		await this.appState((dir) => app.workspace.duplicateLeaf(app.workspace.activeLeaf, dir), direction);
	}
	async closeTab() {
		expect$2(await this.appState((commandId) => {
			const leaf = app.workspace.activeLeaf;
			if (leaf && typeof leaf.detach === "function") {
				leaf.detach();
				return true;
			}
			return app.commands.executeCommandById(commandId);
		}, CMD_ID_CLOSE_TAB)).toBe(true);
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
			if (leaves[i]) app.workspace.setActiveLeaf(leaves[i], { focus: true });
		}, index);
	}
	async activeViewType() {
		return this.appState(() => app.workspace.activeLeaf?.view.getViewType() ?? null);
	}
	async openingFiles() {
		return this.appState(() => app.workspace.getLeavesOfType("markdown").map((leaf) => leaf.view.file?.path ?? ""));
	}
	async waitReady(timeout = 15e3) {
		await this.page.waitForFunction(() => !!app?.workspace && (app.workspace.layoutReady === true || !!app.workspace.activeLeaf), { timeout });
	}
	async waitForApp(predicate, arg, timeout = 5e3) {
		await this.page.waitForFunction(predicate, arg, { timeout });
	}
	async waitForView(viewType) {
		await this.page.waitForFunction((type) => app.workspace.getLeavesOfType(type).length > 0, viewType);
		return this.page.evaluateHandle(async (type) => {
			const leaf = app.workspace.getLeavesOfType(type)?.[0];
			await app.workspace.revealLeaf(leaf);
			return leaf.view;
		}, viewType);
	}
	async waitForViewType(viewType, timeout = 5e3) {
		await this.page.waitForFunction((type) => app.workspace.activeLeaf?.view.getViewType() === type, viewType, { timeout });
	}
	async clear() {
		await this.appState(() => {
			app.workspace.activeEditor?.editor?.setValue("");
		});
	}
	async content() {
		return this.appState(() => app.workspace.activeEditor?.editor?.getValue());
	}
	async filePath() {
		return this.appState(() => app.workspace.getActiveFile()?.path ?? null);
	}
	async tabTitle() {
		return this.appState(() => {
			const leaf = app.workspace.activeLeaf;
			const view = leaf?.view;
			const activeFile = app.workspace.getActiveFile();
			if (activeFile?.basename) return activeFile.basename;
			if (typeof view?.getDisplayText === "function") return view.getDisplayText() ?? null;
			return leaf?.tabHeaderInnerTitleEl?.textContent?.trim() ?? null;
		});
	}
	async write(content) {
		await this.appState((nextContent) => {
			app.workspace.activeEditor?.editor?.setValue(nextContent);
		}, content);
	}
	async exists(path) {
		return this.appState((p) => app.vault.adapter.exists(p), path);
	}
	async read(path) {
		return this.appState((p) => app.vault.adapter.read(p), path);
	}
	async save(path, content) {
		await this.appState(([p, c]) => app.vault.adapter.write(p, c), [path, content]);
	}
	async delete(path) {
		await this.appState((p) => app.vault.adapter.remove(p), path);
	}
	async open(path) {
		await this.appState(async (p) => {
			const file = app.vault.getAbstractFileByPath(p);
			if (file) await app.workspace.getLeaf().openFile(file);
		}, path);
	}
	async waitForFile(path, timeout = 5e3) {
		await this.page.waitForFunction((p) => app.vault.adapter.exists(p), path, { timeout });
	}
	async plugin(pluginId) {
		if (!this.context?.pluginHandleMap) throw new Error("Plugin context not initialized");
		return this.context.pluginHandleMap.evaluateHandle((map, id) => map.get(id), pluginId);
	}
	async isPluginEnabled(pluginId) {
		return this.appState((id) => !!app.plugins.enabledPlugins.has(id), pluginId);
	}
	async waitForPluginEnabled(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !!app?.plugins?.enabledPlugins?.has(id), pluginId, timeout);
	}
	async waitForPluginDisabled(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !app?.plugins?.enabledPlugins?.has(id), pluginId, timeout);
	}
	async pluginState(pluginId) {
		return this.appState((id) => ({
			enabled: !!app?.plugins?.enabledPlugins?.has(id),
			loaded: !!app?.plugins?.plugins?.[id]?._loaded,
			registered: !!app?.plugins?.plugins?.[id]
		}), pluginId);
	}
	async rebuildPlugins(vaultOptions, getPluginHandleMapFn = getPluginHandleMap) {
		const pluginHandleMap = await getPluginHandleMapFn(this.page, (vaultOptions.plugins || []).map((p) => ({
			...p,
			pluginId: getActualPluginId(p.path)
		})));
		this.context = {
			...this.context,
			pluginHandleMap
		};
		return this.context;
	}
	updateContext(context) {
		this.context = context;
	}
	async expectViews(viewType, count) {
		expect$2((await this.allViews(viewType)).length).toBe(count);
	}
	async expectTitle(viewType, title) {
		expect$2(await this.title(viewType)).toBe(title);
	}
	async expectTitleContains(viewType, text) {
		expect$2(await this.title(viewType)).toContain(text);
	}
	async expectActiveType(type) {
		expect$2((await this.activeTab())?.viewType).toBe(type);
	}
	async expectTabs(count) {
		expect$2((await this.allTabs()).length).toBe(count);
	}
	async expectExists(path) {
		expect$2(await this.exists(path)).toBe(true);
	}
	async expectNotExists(path) {
		expect$2(await this.exists(path)).toBe(false);
	}
	async expectContent(content) {
		expect$2(await this.content()).toBe(content);
	}
	async expectContentContains(text) {
		expect$2(await this.content()).toContain(text);
	}
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
	async search(text, selector = "input[type=\"text\"]") {
		await this.page.locator(selector).fill(text);
		await this.page.waitForTimeout(300);
	}
	async clearSearch(selector = "input[type=\"text\"]") {
		await this.page.locator(selector).clear();
		await this.page.waitForTimeout(200);
	}
};
//#endregion
//#region src/fetchPlugin.ts
const logger$1 = createScopedLogger("fetchPlugin");
function run(cmd, args, opts = {}) {
	const r = spawnSync(cmd, args, {
		stdio: "inherit",
		cwd: opts.cwd
	});
	if (r.error) throw r.error;
	if (r.status && r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}
function parseRepoUrl(repo) {
	const httpsMatch = repo.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
	if (httpsMatch) return {
		owner: httpsMatch[1],
		repo: httpsMatch[2]
	};
	throw new Error(`Unsupported repo url: ${repo}`);
}
async function downloadToFile(url, destPath) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
	await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}
async function fetchPlugin(repo, destArg, opts) {
	if (!repo) throw new TypeError("repo url is required");
	const cwd = process.cwd();
	const { owner, repo: repoName } = parseRepoUrl(repo);
	const dest = destArg ? path.resolve(cwd, destArg) : path.resolve(cwd, "myfiles", repoName);
	logger$1.debug(`repo=${repo} owner=${owner} repoName=${repoName} dest=${dest} opts=${JSON.stringify(opts)}`);
	const desiredFiles = [
		"main.js",
		"manifest.json",
		"styles.css"
	];
	let chosenRelease = null;
	try {
		const latestApi = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
		logger$1.debug(`checking latest release: ${latestApi}`);
		let res = await fetch(latestApi, { headers: { "User-Agent": "obsidian-e2e-toolkit" } });
		if (res.ok) {
			const rel = await res.json();
			const assets = Array.isArray(rel.assets) ? rel.assets : [];
			logger$1.debug(`latest release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`);
			if (assets.some((a) => desiredFiles.includes(a.name))) {
				chosenRelease = rel;
				logger$1.info(`using latest release ${rel.tag_name}`);
			}
		} else logger$1.debug(`latest release fetch failed: ${res.status}`);
		if (!chosenRelease) {
			const listApi = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=20`;
			logger$1.debug(`listing releases: ${listApi}`);
			const listRes = await fetch(listApi, { headers: { "User-Agent": "obsidian-e2e-toolkit" } });
			if (listRes.ok) {
				const list = await listRes.json();
				for (const rel of list) {
					const assets = Array.isArray(rel.assets) ? rel.assets : [];
					logger$1.debug(`examining release tag=${rel.tag_name} assets=${assets.map((a) => a.name).join(",")}`);
					if (assets.some((a) => desiredFiles.includes(a.name))) {
						chosenRelease = rel;
						logger$1.info(`using release ${rel.tag_name}`);
						break;
					}
				}
			} else logger$1.debug(`release list fetch failed: ${listRes.status}`);
		}
	} catch (err) {
		logger$1.warn(`release lookup error: ${err && err.message}`);
	}
	if (chosenRelease) {
		const assets = Array.isArray(chosenRelease.assets) ? chosenRelease.assets : [];
		fs$1.mkdirSync(dest, { recursive: true });
		for (const fname of desiredFiles) {
			const asset = assets.find((a) => a.name === fname);
			if (asset && asset.browser_download_url) {
				const out = path.join(dest, fname);
				logger$1.info(`downloading ${fname} from release ${chosenRelease.tag_name}`);
				try {
					await downloadToFile(asset.browser_download_url, out);
					logger$1.debug(`downloaded ${fname}`);
				} catch (err) {
					logger$1.warn(`failed to download ${fname}: ${err && err.message}`);
				}
			}
		}
		if (!desiredFiles.some((f) => fs$1.existsSync(path.join(dest, f)))) for (const a of assets) {
			if (!a.browser_download_url || !a.name) continue;
			const out = path.join(dest, a.name);
			logger$1.debug(`downloading asset ${a.name} -> ${out}`);
			try {
				await downloadToFile(a.browser_download_url, out);
				logger$1.debug(`downloaded asset ${a.name}`);
			} catch (err) {
				logger$1.warn(`failed to download asset ${a.name}: ${err && err.message}`);
			}
		}
		try {
			const pkgJson = path.join(dest, "package.json");
			if (fs$1.existsSync(pkgJson)) {
				run("pnpm", ["install"], { cwd: dest });
				const pkg = JSON.parse(fs$1.readFileSync(pkgJson, "utf8"));
				if (pkg.scripts && pkg.scripts.build) run("pnpm", ["run", "build"], { cwd: dest });
			}
		} catch (err) {
			logger$1.error(`prepare error: ${err && err.message}`);
			throw new Error(`Failed to prepare plugin from release in ${dest}: ${err}`);
		}
		return dest;
	}
	if (!opts || !opts.fallbackToGit) {
		logger$1.warn(`no release found and fallbackToGit is false for ${owner}/${repoName}`);
		throw new Error(`No release asset found for ${owner}/${repoName} and fallbackToGit is false`);
	}
	if (fs$1.existsSync(dest)) try {
		logger$1.info(`destination exists; pulling ${dest}`);
		run("git", [
			"-C",
			dest,
			"pull"
		]);
		return dest;
	} catch (err) {
		throw new Error(`Failed to update plugin at ${dest}: ${err}`);
	}
	fs$1.mkdirSync(path.dirname(dest), { recursive: true });
	try {
		logger$1.info(`cloning ${repo} -> ${dest}`);
		run("git", [
			"clone",
			"--depth",
			"1",
			repo,
			dest
		]);
		try {
			const pkgJson = path.join(dest, "package.json");
			if (fs$1.existsSync(pkgJson)) {
				run("pnpm", ["install"], { cwd: dest });
				const pkg = JSON.parse(fs$1.readFileSync(pkgJson, "utf8"));
				if (pkg.scripts && pkg.scripts.build) run("pnpm", ["run", "build"], { cwd: dest });
			}
		} catch (err) {
			throw new Error(`Failed to prepare plugin after clone in ${dest}: ${err}`);
		}
		return dest;
	} catch (err) {
		throw new Error(`Failed to clone ${repo}: ${err}`);
	}
}
//#endregion
//#region src/index.ts
/**
* Main entry point for obsidian-e2e testing library
*
* This module can be used as a standalone package for Obsidian plugin E2E testing.
*
* @example
* ```typescript
* import { test, expect } from 'obsidian-e2e';
*
* test('basic test', async ({ obsidian }) => {
*   // Use obsidian API directly
*   await obsidian.createNote('test.md', 'content');
* });
* ```
*/
const logger = log.getLogger("obsidianSetup");
const test = test$1.extend({
	tempDir: async ({}, use) => {
		const dir = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
		await use(dir);
		await fs.rm(dir, {
			recursive: true,
			force: true
		}).catch(() => {});
		await fs.rm(`${dir}-vault`, {
			recursive: true,
			force: true
		}).catch(() => {});
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
			if (vaultOptions.enableBrowserConsoleLogging) setupBrowserConsoleLogging(context.page, {
				scope: {
					runId,
					phase: "browser"
				},
				options: vaultOptions.browserConsoleLogging
			});
			const api = new ObsidianAPI(context);
			runLogger.info("Entering test body");
			await use(api);
			runLogger.info("Test body completed");
			handleTestError(testInfo);
		} catch (err) {
			runLogger.error(`Error during test execution: ${err.message || err}`);
			if (!process.env.CI) {}
			throw err;
		} finally {
			runLogger.info("Cleaning up Obsidian");
			await launcher.cleanup();
			runLogger.info("Cleanup completed");
		}
	}
});
//#endregion
export { ObsidianAPI, expect, fetchPlugin, logger, test };

//# sourceMappingURL=index.mjs.map