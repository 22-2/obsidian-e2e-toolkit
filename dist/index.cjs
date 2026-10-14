Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const require_targets = require("./targets-DUrff_Wl.cjs");
let chalk = require("chalk");
chalk = require_targets.__toESM(chalk, 1);
let loglevel = require("loglevel");
loglevel = require_targets.__toESM(loglevel, 1);
let _playwright_test = require("@playwright/test");
let fs_promises = require("fs/promises");
fs_promises = require_targets.__toESM(fs_promises, 1);
let os = require("os");
os = require_targets.__toESM(os, 1);
let path = require("path");
path = require_targets.__toESM(path, 1);
let find_up = require("find-up");
let fs = require("fs");
let tiny_invariant = require("tiny-invariant");
tiny_invariant = require_targets.__toESM(tiny_invariant, 1);
let url = require("url");
let es_toolkit = require("es-toolkit");
let child_process = require("child_process");
let events = require("events");
let module$1 = require("module");
let playwright_test = require("playwright/test");
let node_child_process = require("node:child_process");
let node_path = require("node:path");
node_path = require_targets.__toESM(node_path, 1);
let node_util = require("node:util");
let node_crypto = require("node:crypto");
let node_fs_promises = require("node:fs/promises");
let node_url = require("node:url");
//#region src/internal/path.ts
const filename$1 = typeof __filename !== "undefined" ? __filename : (0, url.fileURLToPath)(require("url").pathToFileURL(__filename).href);
const dirname$1 = typeof __dirname !== "undefined" ? __dirname : path.default.dirname(filename$1);
/**
* Resolves and validates all paths for Obsidian E2E testing
*/
function resolveConfig(config) {
	const pluginDir = path.default.resolve(config.pluginDir);
	if (!(0, fs.existsSync)(pluginDir)) throw new Error(`Plugin directory not found: ${pluginDir}`);
	const manifestPath = path.default.join(pluginDir, "manifest.json");
	let manifest;
	if (config.manifest) manifest = config.manifest;
	else if ((0, fs.existsSync)(manifestPath)) manifest = JSON.parse((0, fs.readFileSync)(manifestPath, "utf-8"));
	else manifest = {
		id: "obsidian-e2e-toolkit-dummy-plugin",
		name: "Dummy Plugin",
		version: "1.0.0"
	};
	const pluginId = config.pluginId || manifest.id;
	if (!pluginId) throw new Error("Plugin ID not found. Please provide pluginId in config or ensure manifest.json contains an 'id' field.");
	const distDir = config.distDir ? path.default.resolve(config.distDir) : path.default.join(pluginDir, "dist");
	const defaultAssetsDir = path.default.join(dirname$1, "assets");
	const assetsDir = config.assetsDir ? path.default.resolve(config.assetsDir) : defaultAssetsDir;
	const defaultObsidianUnpackedDir = path.default.join(dirname$1, ".obsidian-unpacked");
	const obsidianUnpackedDir = config.obsidianUnpackedDir ? path.default.resolve(config.obsidianUnpackedDir) : defaultObsidianUnpackedDir;
	const appMainFile = config.appMainFile || "main.cjs";
	return {
		pluginDir,
		distDir,
		assetsDir,
		obsidianUnpackedDir,
		appMainFile,
		appMainJsPath: path.default.join(obsidianUnpackedDir, appMainFile),
		pluginId,
		manifest
	};
}
/**
* Creates launch options for Playwright/Electron based on resolved paths
*/
function createLaunchOptions(paths) {
	if (!(0, fs.existsSync)(paths.appMainJsPath)) throw new Error(`Obsidian app not found at: ${paths.appMainJsPath}. Please run the setup script to unpack Obsidian assets.`);
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
//#region src/internal/vaultOptions.ts
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
	obsidianCli: "auto",
	plugins: []
};
/**
* Builds the options for one test from the shared defaults.
*
* `merge` mutates its target and merges arrays by index, so merging straight into
* DEFAULT_VAULT_OPTIONS let a longer `plugins` list leak its tail into every later
* test in the same worker. `toMerged` works on a deep clone of the defaults instead.
*/
function resolveVaultOptions(vaultOptions) {
	return (0, es_toolkit.toMerged)(DEFAULT_VAULT_OPTIONS, vaultOptions);
}
//#endregion
//#region src/internal/constants.ts
const filename = typeof __filename !== "undefined" ? __filename : (0, url.fileURLToPath)(require("url").pathToFileURL(__filename).href);
const dirname = typeof __dirname !== "undefined" ? __dirname : path.default.dirname(filename);
const logger$9 = loglevel.default.getLogger("constants");
/**
* Default configuration
* Assumes this package is installed in node_modules or used as a submodule
*/
function getDefaultConfig() {
	const toolkitPackageJsonPath = (0, find_up.findUpSync)("package.json", { cwd: dirname });
	(0, tiny_invariant.default)(toolkitPackageJsonPath, "Could not find package.json for obsidian-e2e-toolkit.");
	const toolkitRoot = path.default.dirname(toolkitPackageJsonPath);
	const manifestPath = (0, find_up.findUpSync)("manifest.json", { cwd: toolkitRoot });
	const projectRoot = manifestPath ? path.default.dirname(manifestPath) : toolkitRoot;
	const toolkitHome = process.env.OBSIDIAN_E2E_TOOLKIT_HOME || ((0, fs.existsSync)(path.default.join(toolkitRoot, "obsidian-e2e-toolkit-assets")) ? toolkitRoot : projectRoot);
	return {
		pluginDir: projectRoot,
		distDir: path.default.join(projectRoot, "dist"),
		assetsDir: path.default.join(toolkitRoot, "assets"),
		obsidianUnpackedDir: path.default.join(toolkitHome, "obsidian-e2e-toolkit-assets", "obsidian-unpacked"),
		appMainFile: "main.cjs"
	};
}
let RESOLVED_PATHS;
try {
	RESOLVED_PATHS = resolveConfig(getDefaultConfig());
	logger$9.debug("Plugin Directory:", RESOLVED_PATHS.pluginDir);
	logger$9.debug("Dist Directory:", RESOLVED_PATHS.distDir);
	logger$9.debug("Toolkit Root:", dirname);
	logger$9.debug("App Main Path:", RESOLVED_PATHS.appMainJsPath);
	(0, tiny_invariant.default)((0, fs.existsSync)(dirname), `Toolkit root not found at: ${dirname}.`);
	(0, tiny_invariant.default)((0, fs.existsSync)(RESOLVED_PATHS.appMainJsPath), `Obsidian app not found at: ${RESOLVED_PATHS.appMainJsPath}. Did you run the setup script?`);
} catch (error) {
	logger$9.error("Error: Could not resolve paths. Make sure you've run the setup script.", error);
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
path.default.join(E2E_ROOT_DIR, "assets", "hot-reload");
/**
* Get the resolved paths (useful when you want to access the configuration)
*/
function getResolvedPaths() {
	return RESOLVED_PATHS;
}
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
			paths: ctx.paths,
			coverage: ctx.runtime.coverage
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
	* vault の layoutReady が true になるまで待つ。window.app を通して読むため、グローバル app が無い場面でも ReferenceError にならない。
	* activeLeaf の有無は見ない。
	*/
	static async waitForVaultReady(page, timeout) {
		await page.waitForFunction(() => {
			const workspace = window.app?.workspace;
			return !!workspace && workspace.layoutReady === true;
		}, void 0, { timeout });
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
	async run(input, ctx, services) {
		const pluginManager = services.getValue(SERVICE_IDS.pluginManager);
		await pluginManager.installAll();
		await pluginManager.enableAll(input.page);
		await ctx.runtime.coverage?.checkpoint(input.page);
		await input.page.reload();
		await PageWaiter.waitForPage(input.page);
		await pluginManager.waitForReady(input.page);
	}
};
//#endregion
//#region src/internal/services/electronMainLogging.ts
function getElectronMainLogPath(tempUserDataDir) {
	return path.default.join(tempUserDataDir, "electron-main.log");
}
/** 起動前から監視し、Playwright の接続前と切断後のログも転送する。 */
function forwardElectronMainLogs(logPath, logger) {
	let offset = 0;
	const flush = () => {
		let contents;
		try {
			contents = (0, fs.readFileSync)(logPath, "utf8");
		} catch (error) {
			if (error.code !== "ENOENT") logger.warn(`Could not read Electron main log: ${String(error)}`);
			return;
		}
		if (contents.length < offset) offset = 0;
		const end = contents.lastIndexOf("\n") + 1;
		if (end <= offset) return;
		const lines = contents.slice(offset, end).split("\n").filter(Boolean);
		offset = end;
		for (const line of lines) try {
			const entry = JSON.parse(line);
			logger[entry.level](`[ELECTRON:MAIN:${entry.level.toUpperCase()}] ${entry.timestamp} ${entry.message}`);
		} catch (error) {
			logger.warn(`Could not forward Electron main log: ${String(error)}`);
		}
	};
	(0, fs.watchFile)(logPath, {
		interval: 100,
		persistent: false
	}, flush);
	flush();
	return () => {
		(0, fs.unwatchFile)(logPath, flush);
		flush();
	};
}
//#endregion
//#region src/internal/services/electronBootstrap.ts
async function createElectronBootstrap(appMainJsPath, tempUserDataDir) {
	const appDir = path.default.dirname(appMainJsPath);
	const packagePath = path.default.join(appDir, "package.json");
	const appPackage = (0, fs.existsSync)(packagePath) ? JSON.parse(await fs_promises.default.readFile(packagePath, "utf8")) : {
		name: "obsidian-e2e",
		version: "0.0.0"
	};
	const bootstrapDir = path.default.join(tempUserDataDir, "electron-bootstrap");
	await fs_promises.default.mkdir(bootstrapDir, { recursive: true });
	await fs_promises.default.writeFile(path.default.join(bootstrapDir, "package.json"), JSON.stringify({
		...appPackage,
		type: "commonjs",
		main: "bootstrap.cjs"
	}), "utf8");
	await fs_promises.default.writeFile(path.default.join(bootstrapDir, "bootstrap.cjs"), `const { app } = require("electron");
const { appendFileSync } = require("node:fs");
const { format } = require("node:util");
const logPath = ${JSON.stringify(getElectronMainLogPath(tempUserDataDir))};

// アプリ読み込み前から同期保存し、起動失敗や終了直前の例外も残す。
function record(level, ...args) {
    const entry = { timestamp: new Date().toISOString(), level, message: format(...args) };
    try {
        appendFileSync(logPath, JSON.stringify(entry) + "\\n", "utf8");
    } catch (error) {
        process.stderr.write("Could not write Electron main log: " + String(error) + "\\n");
        process.stderr.write(entry.message + "\\n");
    }
}

for (const [method, level] of Object.entries({ log: "info", info: "info", debug: "debug", warn: "warn", error: "error" })) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        record(level, ...args);
        original(...args);
    };
}
process.on("uncaughtExceptionMonitor", (error, origin) => {
    record("error", origin + ":", error);
});
process.on("warning", (warning) => {
    record("warn", warning);
});
record("info", "Starting Obsidian", { main: ${JSON.stringify(appMainJsPath)}, versions: process.versions });

// Obsidian は app:// の要求で frame.origin を参照するが、フレームは省略・破棄されることがある。
// 元の検証を維持しつつ、検証できない要求だけを拒否する。HTTP 等の要求には介入しない。
app.on("session-created", (session) => {
    const webRequest = session.webRequest;
    const original = webRequest.onBeforeRequest.bind(webRequest);
    webRequest.onBeforeRequest = (...args) => {
        const listener = args.at(-1);
        if (typeof listener !== "function") return original(...args);
        args[args.length - 1] = (details, callback) => {
            if (details.url.startsWith("app://") && !details.frame) {
                record("warn", "Cancelled app:// request without a frame", {
                    url: details.url,
                    method: details.method,
                    resourceType: details.resourceType,
                    webContentsId: details.webContentsId,
                });
                callback({ cancel: true });
                return;
            }
            return listener(details, callback);
        };
        return original(...args);
    };
});

// 起動直後の登録も防ぎ、通常の Obsidian の URL 関連付けを保護する。
for (const method of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient"]) {
    const original = app[method].bind(app);
    app[method] = (protocol, ...args) => {
        if (typeof protocol === "string" && protocol.toLowerCase() === "obsidian") {
            return false;
        }
        return original(protocol, ...args);
    };
}

// アセットと起動引数の解決先は元のアプリを維持する。
app.setAppPath(${JSON.stringify(appDir)});
process.argv[1] = ${JSON.stringify(appMainJsPath)};
require(${JSON.stringify(appMainJsPath)});
`, "utf8");
	return bootstrapDir;
}
//#endregion
//#region src/internal/electronEnv.ts
/**
* Electron が通常のアプリではなく Node として起動してしまう環境変数を取り除いたコピーを返す。
* 親プロセスに設定されていると Obsidian が起動できず、テストが始まる前に失敗するため、起動前に必ず外す。
* Windows の環境変数名は大文字小文字を区別しないので、比較も大文字小文字を無視する。
*/
const RUN_AS_NODE = "ELECTRON_RUN_AS_NODE";
function withoutElectronRunAsNode(env) {
	const copy = {};
	for (const [key, value] of Object.entries(env)) {
		if (key.toUpperCase() === RUN_AS_NODE) continue;
		copy[key] = value;
	}
	return copy;
}
//#endregion
//#region src/internal/services/ElectronAppManager.ts
const logger$8 = loglevel.default.getLogger("ElectronAppManager");
const CLOSE_TIMEOUT_MS = 15e3;
const KILL_EXIT_TIMEOUT_MS = 5e3;
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
			const pkgJson = (0, module$1.createRequire)(require("url").pathToFileURL(__filename).href).resolve("electron/package.json");
			const electronRoot = path.default.dirname(pkgJson);
			const distDir = path.default.join(electronRoot, "dist");
			if (!(0, fs.existsSync)(distDir)) {
				logger$8.error(`Electron dist not found at ${distDir}`);
				logger$8.error(`Electron root contents:`, await fs_promises.default.readdir(electronRoot));
				throw new Error("Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly.");
			}
		} catch (err) {
			logger$8.error("Electron preflight check failed:", err && err.message ? err.message : err);
			throw err;
		}
		const baseLaunchOptions = createLaunchOptions(this.paths);
		const bootstrapDir = await createElectronBootstrap(this.paths.appMainJsPath, this.tempUserDataDir);
		const launchOptions = {
			...baseLaunchOptions,
			args: [
				bootstrapDir,
				...baseLaunchOptions.args.slice(1),
				`--user-data-dir=${this.tempUserDataDir}`
			],
			env: {
				...withoutElectronRunAsNode(baseLaunchOptions.env),
				PLAYWRIGHT: "true",
				CI: process.env.CI || "false"
			}
		};
		return await playwright_test._electron.launch(launchOptions);
	}
	async cleanup() {
		if (this.electronApp) {
			if (!await this.closeWithin(this.electronApp, CLOSE_TIMEOUT_MS)) await this.forceKill(this.electronApp);
		}
		logger$8.debug("ElectronAppManager cleaned up");
	}
	/** @returns false when the app did not finish closing within `timeoutMs`. */
	async closeWithin(app, timeoutMs) {
		let timer;
		const timedOut = new Promise((resolve) => {
			timer = setTimeout(() => resolve(false), timeoutMs);
		});
		try {
			return await Promise.race([this.closeGracefully(app).then(() => true), timedOut]);
		} finally {
			clearTimeout(timer);
		}
	}
	async closeGracefully(app) {
		try {
			await Promise.all(app.windows().map((win) => win.close()));
			await app.close();
		} catch (error) {
			logger$8.warn("Error during cleanup:", error);
		}
	}
	async forceKill(app) {
		const child = app.process();
		logger$8.warn(`Obsidian did not close within ${CLOSE_TIMEOUT_MS}ms. Killing process ${child.pid}.`);
		if (child.exitCode !== null || child.signalCode !== null) return;
		const closed = (0, events.once)(child, "close");
		if (process.platform === "win32") (0, child_process.spawnSync)("taskkill", [
			"/pid",
			String(child.pid),
			"/T",
			"/F"
		], { windowsHide: true });
		else try {
			process.kill(-child.pid, "SIGKILL");
		} catch (error) {
			logger$8.warn("Failed to kill Obsidian process group:", error);
		}
		let timer;
		await Promise.race([closed, new Promise((resolve) => {
			timer = setTimeout(resolve, KILL_EXIT_TIMEOUT_MS);
		})]);
		clearTimeout(timer);
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
//#region src/internal/services/ObsidianCli.ts
const execFileAsync = (0, node_util.promisify)(node_child_process.execFile);
const CLI_TIMEOUT_MS = 5e3;
const CLI_MAX_BUFFER = 1048576;
const logger$7 = loglevel.default.getLogger("ObsidianCli");
/**
* Runs the official Obsidian CLI only when it can be proven to target the test vault.
*
* The Playwright fixture still owns the isolated Electron process. This adapter is
* intentionally best-effort in auto mode because CI runners normally do not have
* the desktop Obsidian CLI installed.
*/
var ObsidianCli = class {
	mode;
	executable;
	available;
	constructor(mode = "auto", executable = process.env.OBSIDIAN_CLI_PATH || "obsidian") {
		this.mode = mode;
		this.executable = executable;
	}
	isRequired() {
		return this.mode === "required";
	}
	async tryEnablePlugins(vaultPath, vaultName, pluginIds) {
		if (this.mode === "off") return false;
		if (!vaultName) return this.fallback("The Playwright app did not provide a vault name.");
		if (!await this.isAvailable()) return this.fallback("Obsidian CLI is not available on PATH.");
		const target = `vault=${vaultName}`;
		let cliVaultPath;
		try {
			cliVaultPath = this.normalizeOutput(await this.run([
				target,
				"vault",
				"info=path"
			]));
		} catch (error) {
			return this.fallback(`Could not resolve the CLI target vault: ${this.describeError(error)}`);
		}
		if (!this.pathsMatch(vaultPath, cliVaultPath)) return this.fallback(`CLI target mismatch. Expected ${vaultPath}, received ${cliVaultPath}.`);
		try {
			await this.run([
				target,
				"plugins:restrict",
				"off"
			]);
			for (const pluginId of pluginIds) await this.run([
				target,
				"plugin:enable",
				`id=${pluginId}`,
				"filter=community"
			]);
			logger$7.debug(`Enabled plugins through Obsidian CLI: ${pluginIds.join(", ")}`);
			return true;
		} catch (error) {
			return this.fallback(`CLI plugin setup failed: ${this.describeError(error)}`);
		}
	}
	async isAvailable() {
		if (this.available !== void 0) return this.available;
		try {
			await this.run(["version"]);
			this.available = true;
		} catch (error) {
			this.available = false;
			logger$7.debug(`Obsidian CLI is unavailable: ${this.describeError(error)}`);
		}
		return this.available;
	}
	async run(args) {
		const result = await execFileAsync(this.executable, args, {
			timeout: CLI_TIMEOUT_MS,
			maxBuffer: CLI_MAX_BUFFER,
			windowsHide: true
		});
		return String(result.stdout ?? "");
	}
	fallback(reason) {
		if (this.mode === "required") throw new Error(`Obsidian CLI is required but cannot be used: ${reason}`);
		logger$7.debug(`${reason} Falling back to Playwright.`);
		return false;
	}
	normalizeOutput(output) {
		return (output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1) || "").replace(/^=>\s*/, "");
	}
	pathsMatch(expected, actual) {
		const normalizePath = (value) => {
			return node_path.default.normalize(node_path.default.resolve(value)).replace(/[\\/]$/, "");
		};
		const expectedPath = normalizePath(expected);
		const actualPath = normalizePath(actual);
		if (process.platform === "win32") return expectedPath.toLowerCase() === actualPath.toLowerCase();
		return expectedPath === actualPath;
	}
	describeError(error) {
		const commandError = error;
		return commandError.stderr?.trim() || commandError.message || String(error);
	}
};
//#endregion
//#region src/internal/services/PluginManager.ts
const logger$6 = loglevel.default.getLogger("PluginManager");
var PluginManager = class {
	plugins;
	vaultPath;
	constructor(plugins, vaultPath, cliMode = "auto") {
		this.plugins = plugins;
		this.vaultPath = vaultPath;
		this.obsidianCli = new ObsidianCli(cliMode);
	}
	obsidianCli;
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
		logger$6.debug(`Installed plugins: ${installedIds.join(", ")}`);
	}
	getPlugins() {
		return this.plugins || [];
	}
	ensurePluginsDirectory() {
		const obsidianDir = path.default.join(this.vaultPath, ".obsidian");
		const pluginsDir = path.default.join(obsidianDir, "plugins");
		if (!(0, fs.existsSync)(obsidianDir)) (0, fs.mkdirSync)(obsidianDir, { recursive: true });
		if (!(0, fs.existsSync)(pluginsDir)) (0, fs.mkdirSync)(pluginsDir, { recursive: true });
		return pluginsDir;
	}
	async installSingle(pluginsDir, plugin) {
		if (!this.validatePluginPath(plugin)) {
			logger$6.warn(`Invalid plugin path: ${plugin.path}`);
			return false;
		}
		const destDir = path.default.join(pluginsDir, plugin.pluginId);
		if (plugin.symlink) {
			if (plugin.data) logger$6.warn(`Ignoring "data" for symlinked plugin ${plugin.pluginId} to avoid modifying its source directory`);
			logger$6.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
			return this.createPluginSymlink(plugin.path, destDir, plugin.pluginId);
		} else {
			logger$6.debug(`Copying files for plugin: ${plugin.pluginId}`);
			const copied = this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
			if (copied && plugin.data) (0, fs.writeFileSync)(path.default.join(destDir, "data.json"), JSON.stringify(plugin.data, null, 2));
			return copied;
		}
	}
	validatePluginPath(plugin) {
		if (!(0, fs.existsSync)(plugin.path)) {
			logger$6.warn(`Plugin path not found: ${plugin.path}`);
			return false;
		}
		if (!(0, fs.existsSync)(path.default.join(plugin.path, "manifest.json"))) {
			logger$6.warn(`manifest.json not found in: ${plugin.path}`);
			return false;
		}
		if (!(0, fs.existsSync)(path.default.join(plugin.path, "main.js"))) {
			logger$6.warn(`main.js not found in: ${plugin.path}`);
			return false;
		}
		return true;
	}
	createPluginSymlink(sourcePath, destDir, pluginId) {
		if ((0, fs.existsSync)(destDir)) {
			logger$6.debug(`Destination already exists: ${destDir}, skipping symlink`);
			return true;
		}
		try {
			(0, fs.symlinkSync)(sourcePath, destDir, "dir");
			logger$6.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
			return true;
		} catch (error) {
			logger$6.error(`Failed to create symlink for ${pluginId}:`, error);
			return false;
		}
	}
	copyPluginFiles(sourcePath, destDir, pluginId) {
		if (!(0, fs.existsSync)(destDir)) (0, fs.mkdirSync)(destDir, { recursive: true });
		const filesToCopy = [
			"manifest.json",
			"main.js",
			"styles.css"
		];
		for (const file of (0, fs.readdirSync)(sourcePath)) {
			const srcFile = path.default.join(sourcePath, file);
			if ((0, fs.statSync)(srcFile).isDirectory() || !filesToCopy.includes(file)) continue;
			const destFile = path.default.join(destDir, file);
			(0, fs.copyFileSync)(srcFile, destFile);
			logger$6.debug(`Copied: ${file} to ${destDir}`);
		}
		logger$6.debug(`Installed plugin: ${pluginId}`);
		return true;
	}
	updateCommunityPluginsJson(installedIds) {
		const pluginsJsonPath = path.default.join(this.vaultPath, ".obsidian", "community-plugins.json");
		(0, fs.writeFileSync)(pluginsJsonPath, JSON.stringify(installedIds));
	}
	async enableAll(page) {
		const pluginIds = this.plugins.map((p) => p.pluginId);
		const vaultName = await page.evaluate(() => {
			return window.app?.vault?.getName?.() || "";
		});
		if (await this.obsidianCli.tryEnablePlugins(this.vaultPath, vaultName, pluginIds)) {
			let allEnabled = false;
			try {
				await page.waitForFunction((ids) => {
					const app = window.app;
					return ids.every((id) => app?.plugins?.enabledPlugins?.has(id));
				}, pluginIds, { timeout: 5e3 });
				allEnabled = true;
			} catch (error) {
				logger$6.warn("Obsidian CLI completed, but plugin state could not be observed in Playwright:", error);
			}
			if (allEnabled) return;
			if (this.obsidianCli.isRequired()) throw new Error("Obsidian CLI completed, but the Playwright app did not observe all plugins.");
			logger$6.warn("Obsidian CLI completed, but the Playwright app did not observe all plugins. Falling back to Playwright.");
		}
		await this.disableRestrictedMode(page);
		const enabledIds = await page.evaluate(async (ids) => {
			const app = window.app;
			const enabled = [];
			for (const id of ids) {
				await app.plugins.enablePluginAndSave(id);
				enabled.push(id);
			}
			return enabled;
		}, pluginIds);
		logger$6.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
	}
	async waitForReady(page, timeout = 3e4) {
		await waitForPluginFixtures(page, {
			pluginsDir: path.default.join(this.vaultPath, ".obsidian", "plugins"),
			pluginIds: this.plugins.map(({ pluginId }) => pluginId)
		}, timeout);
	}
	async disableRestrictedMode(page) {
		await this.waitForPluginsAPI(page);
		if (await this.isCommunityPluginsEnabled(page)) {
			logger$6.debug("Community plugins are already enabled.");
			return;
		}
		logger$6.debug("Enabling community plugins without opening settings...");
		if (await page.evaluate(() => {
			const app = window.app;
			const appId = app?.appId;
			if (typeof appId !== "string" || appId.length === 0) return false;
			localStorage.setItem(`enable-plugin-${appId}`, "true");
			return app.plugins.isEnabled?.() === true;
		})) return;
		logger$6.debug("Falling back to the community plugins settings UI...");
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
			logger$6.debug("Clicking 'Turn on and reload'...");
			await clickButton();
			await page.waitForTimeout(1e3);
			buttonText = await getButtonText();
		}
		if (buttonText === "Turn on community plugins") {
			logger$6.debug("Clicking 'Turn on community plugins'...");
			await clickButton();
			await page.waitForTimeout(1e3);
		}
	}
	async closeCommunityPluginsSettings(page) {
		await page.keyboard.press("Escape");
	}
	async verifyCommunityPluginsEnabled(page) {
		const isEnabled = await this.isCommunityPluginsEnabled(page);
		(0, _playwright_test.expect)(isEnabled, "Failed to enable community plugins.").toBe(true);
	}
};
/**
* 指定した plugin が読み込まれ、styles.css が適用されるまで待つ。
* 対象は呼び出し側が決める。起動時は導入した全 fixture、再読込時は再読込の直前に読み込まれていた plugin を渡す。
*/
async function waitForPluginFixtures(page, expectation, timeout = 3e4) {
	const fixtures = expectation.pluginIds.map((pluginId) => {
		const cssPath = path.default.join(expectation.pluginsDir, pluginId, "styles.css");
		return {
			pluginId,
			css: (0, fs.existsSync)(cssPath) ? (0, fs.readFileSync)(cssPath, "utf8").trim() : ""
		};
	});
	if (fixtures.length === 0) return;
	try {
		await page.waitForFunction((ids) => ids.every((id) => window.app?.plugins?.plugins?.[id]?._loaded === true), fixtures.map(({ pluginId }) => pluginId), { timeout });
		const restored = await page.evaluate(async ({ fixtures, timeout }) => {
			const restored = [];
			for (const { pluginId, css } of fixtures) {
				if (!css) continue;
				if (Array.from(document.styleSheets).some((sheet) => !sheet.disabled && sheet.ownerNode?.textContent?.trim() === css)) continue;
				const plugin = window.app.plugins.plugins[pluginId];
				if (typeof plugin.loadCSS !== "function") throw new Error(`Plugin ${pluginId} has styles.css but loadCSS() is unavailable`);
				let deadline;
				try {
					await Promise.race([plugin.loadCSS(), new Promise((_, reject) => {
						deadline = setTimeout(() => reject(/* @__PURE__ */ new Error(`Timed out loading styles.css for ${pluginId}`)), timeout);
					})]);
				} finally {
					clearTimeout(deadline);
				}
				restored.push(pluginId);
			}
			return restored;
		}, {
			fixtures,
			timeout
		});
		if (restored.length) logger$6.warn(`Restored missing plugin styles after reload: ${restored.join(", ")}`);
		await page.waitForFunction((fixtures) => fixtures.every(({ css }) => !css || Array.from(document.styleSheets).some((sheet) => !sheet.disabled && sheet.ownerNode?.textContent?.trim() === css)), fixtures, { timeout });
	} catch (error) {
		const state = await describeFixtureState(page, fixtures);
		throw new Error(`Plugin fixtures are not ready after reload: ${fixtures.map(({ pluginId }) => pluginId).join(", ")}.${state} Check plugin loading and styles.css application.`, { cause: error });
	}
}
/** 失敗時の説明に、読み込まれなかった plugin と CSS が欠落した plugin を載せる。取得できなければその理由を載せる。 */
async function describeFixtureState(page, fixtures) {
	try {
		const states = await page.evaluate((items) => {
			const sheets = Array.from(document.styleSheets);
			return items.map(({ pluginId, css }) => ({
				pluginId,
				loaded: window.app?.plugins?.plugins?.[pluginId]?._loaded === true,
				cssApplied: !css || sheets.some((sheet) => !sheet.disabled && sheet.ownerNode?.textContent?.trim() === css)
			}));
		}, fixtures);
		const notLoaded = states.filter((state) => !state.loaded).map((state) => state.pluginId);
		const cssMissing = states.filter((state) => state.loaded && !state.cssApplied).map((state) => state.pluginId);
		return ` Not loaded: [${notLoaded.join(", ")}]. styles.css not applied: [${cssMissing.join(", ")}].`;
	} catch (diagnosticError) {
		return ` (State unavailable: ${String(diagnosticError)}.)`;
	}
}
function getActualPluginId(pluginPath) {
	const manifestPath = path.default.join(pluginPath, "manifest.json");
	if ((0, fs.existsSync)(manifestPath)) try {
		return JSON.parse((0, fs.readFileSync)(manifestPath, "utf-8")).id;
	} catch (e) {
		logger$6.warn(`Failed to parse manifest.json at ${pluginPath}`);
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
const logger$5 = loglevel.default.getLogger("StorageManager");
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
		const pathsToDelete = [path.default.join(userDataDir, "obsidian.json"), path.default.join(userDataDir, SANDBOX_VAULT_NAME)];
		for (const p of pathsToDelete) {
			logger$5.debug("delete", p);
			(0, fs.rmSync)(p, {
				force: true,
				recursive: true
			});
		}
	}
	async clearBrowserStorage() {
		const win = this.electronApp.windows()[0];
		if (!win) return;
		logger$5.debug(chalk.default.magenta("Clearing browser storage"));
		const message = await win.evaluate(async () => {
			const webContents = window.electron.remote.BrowserWindow.getFocusedWindow()?.webContents;
			if (!webContents) return false;
			webContents.session.flushStorageData();
			await webContents.session.clearStorageData({ storages: ["indexdb", "localstorage"] });
			await webContents.session.clearCache();
			return true;
		}) ? chalk.default.magenta("localStorage cleared.") : chalk.default.red("failed to clear localStorage");
		logger$5.debug(message);
	}
};
//#endregion
//#region src/internal/services/VaultManager.ts
const logger$4 = loglevel.default.getLogger("VaultManager");
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
		logger$4.debug(chalk.default.green("Opening sandbox vault..."));
		const page = await this.windowManager.executeActionAndWaitForNewWindow(() => this.ipc.openSandbox(), PageWaiter.waitForPage);
		const vaultPath = await this.ipc.getSandboxPath();
		logger$4.debug(chalk.default.green("Sandbox vault opened at:", vaultPath));
		return {
			vaultPath,
			page
		};
	}
	async openNormalVault(options) {
		logger$4.debug("Opening normal vault...");
		const vaultPath = await this.resolveVaultPath(options);
		if (options.fresh && (0, fs.existsSync)(vaultPath)) (0, fs.rmSync)(vaultPath, { recursive: true });
		if (!options.fresh && !(0, fs.existsSync)(vaultPath)) {
			logger$4.debug("Creating vault directory:", vaultPath);
			(0, fs.mkdirSync)(vaultPath, { recursive: true });
		}
		const page = await this.windowManager.executeActionAndWaitForNewWindow(async () => {
			const result = await this.ipc.openVault(vaultPath, !!options.fresh);
			if (result !== true) throw new Error(`Failed to open vault: ${result}`);
		}, PageWaiter.waitForPage);
		logger$4.debug("Normal vault opened:", vaultPath);
		return {
			vaultPath,
			page
		};
	}
	async resolveVaultPath(options = this.options) {
		if (options.name) return await this.getVaultPathByName(options.name);
		logger$4.debug("options.name not specified, create temp dir");
		const tempPath = this.vaultPath;
		logger$4.debug("temp dir created:", tempPath);
		return tempPath;
	}
	async getVaultPathByName(name) {
		return path.default.join(process.env.USERPROFILE || process.env.HOME || "", "ObsidianVaults", name);
	}
};
//#endregion
//#region src/internal/services/WindowManager.ts
const logger$3 = loglevel.default.getLogger("WindowManager");
var WindowManager = class {
	electronApp;
	coverage;
	constructor(electronApp, coverage) {
		this.electronApp = electronApp;
		this.coverage = coverage;
	}
	async ensureSingleWindow() {
		logger$3.debug("ensureSingleWindow");
		const windows = this.electronApp.windows();
		logger$3.debug(`${windows.length} opened`);
		if (windows.length === 0) return await this.getFirstWindow();
		const page = windows.at(-1);
		await page.waitForLoadState("domcontentloaded");
		await this.closeAllExcept(page);
		logger$3.debug(`closed all except ${await page.title()}`);
		return page;
	}
	async getFirstWindow() {
		const page = await this.electronApp.firstWindow();
		await page.waitForLoadState("domcontentloaded");
		logger$3.debug("first window");
		return page;
	}
	async executeActionAndWaitForNewWindow(action, waitCallback) {
		const currentWindows = this.electronApp.windows();
		const windowPromise = this.electronApp.waitForEvent("window", { timeout: 1e4 });
		await action();
		const newPage = await windowPromise;
		await waitCallback(newPage);
		await this.closeOldWindows(currentWindows, newPage);
		logger$3.debug(chalk.default.green("New window is ready:", newPage.url()));
		return newPage;
	}
	async closeOldWindows(oldWindows, newPage) {
		for (const window of oldWindows) if (window !== newPage && !window.isClosed()) {
			logger$3.debug(chalk.default.yellow(`Closing old window: ${await window.title()}`));
			await this.coverage?.collect(window);
			await window.close();
		}
	}
	async closeAllExcept(keepPage) {
		for (const window of this.electronApp.windows()) if (window !== keepPage && !window.isClosed()) {
			logger$3.debug(chalk.default.red(`close ${window.url()}`));
			await this.coverage?.collect(window);
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
	coverage;
	constructor({ paths, options, tempUserDataDir, runId, coverage }) {
		this.paths = paths;
		this.options = options;
		this.coverage = coverage;
		this.tempVaultDir = `${tempUserDataDir}-vault`;
		this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
		this.scopedLogger = require_targets.createScopedLogger("ObsidianTestLauncher", {
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
		const windowManager = new WindowManager(electronApp, this.coverage);
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
				electronApp,
				coverage: this.coverage
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
		})), vaultPath, this.options.obsidianCli);
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
		await this.coverage?.start(page);
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
//#region src/internal/runtime/config.ts
/** root の内側にある相対パスだけを解決する。絶対パスや root の外へ出る指定は例外にする。 */
function resolveInside(root, relativePath) {
	if (node_path.default.isAbsolute(relativePath) || node_path.default.win32.isAbsolute(relativePath)) throw new Error(`Config path must be relative to the config directory: ${relativePath}`);
	const resolved = node_path.default.resolve(root, relativePath);
	if (!isStrictlyInside(root, resolved)) throw new Error(`Config path escapes the config directory: ${relativePath}`);
	return resolved;
}
function isStrictlyInside(root, candidate) {
	const relative = node_path.default.relative(root, candidate);
	if (relative === "" || node_path.default.isAbsolute(relative)) return false;
	return relative !== ".." && !relative.startsWith(`..${node_path.default.sep}`);
}
/** JSON を読む。symlink を解決した実体が root の外にあれば拒否する。 */
async function readJsonInside(root, relativePath) {
	const target = resolveInside(root, relativePath);
	const realRoot = await (0, node_fs_promises.realpath)(root);
	let realTarget;
	try {
		realTarget = await (0, node_fs_promises.realpath)(target);
	} catch (error) {
		throw new Error(`Config file cannot be read: ${target}`, { cause: error });
	}
	if (!isStrictlyInside(realRoot, realTarget)) throw new Error(`Config file resolves outside the config directory: ${target}`);
	return JSON.parse(await (0, node_fs_promises.readFile)(realTarget, "utf8"));
}
//#endregion
//#region src/internal/runtime/reload.ts
/**
* 再読込後の plugin ハンドルを作り直す。ids のうち、いま存在する plugin だけを含める。
* 存在しない plugin を待つことはしない（無効化された plugin や遅延読み込みの plugin を含むため）。
*/
async function refreshPluginHandleMap(page, pluginIds) {
	return await page.evaluateHandle((ids) => {
		const map = /* @__PURE__ */ new Map();
		const plugins = app.plugins.plugins;
		for (const id of ids) {
			const plugin = plugins[id];
			if (plugin) map.set(id, plugin);
		}
		return map;
	}, [...pluginIds]);
}
//#endregion
//#region src/internal/runtime/reloadInterceptor.ts
const INVALIDATED_MESSAGE = "The app:reload interceptor is no longer active because the Obsidian window was reloaded. Call interceptReload() again after the reload.";
function installReloadInterceptor(token) {
	const host = window;
	if (host["__obsidianE2EReloadInterceptor"]) throw new Error("app:reload is already intercepted on this window. Call restore() on the existing interceptor first.");
	const commands = app.commands;
	const original = commands.executeCommandById;
	const requests = [];
	const interceptor = function(...args) {
		if (args[0] !== "app:reload") return original.apply(this, args);
		requests.push({ enabledPluginIds: [...app.plugins.enabledPlugins].sort() });
		return true;
	};
	commands.executeCommandById = interceptor;
	host["__obsidianE2EReloadInterceptor"] = {
		token,
		original,
		interceptor,
		requests
	};
}
function readReloadInterceptor(token) {
	const state = window["__obsidianE2EReloadInterceptor"];
	if (!state || state.token !== token) return { active: false };
	return {
		active: true,
		requests: state.requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] }))
	};
}
function restoreReloadInterceptor(token) {
	const host = window;
	const state = host["__obsidianE2EReloadInterceptor"];
	if (!state || state.token !== token) return { restored: false };
	if (app.commands.executeCommandById !== state.interceptor) throw new Error("app.commands.executeCommandById was replaced after interception. Refusing to overwrite it.");
	app.commands.executeCommandById = state.original;
	delete host["__obsidianE2EReloadInterceptor"];
	return {
		restored: true,
		requests: state.requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] }))
	};
}
/** Node 側で差し替えの状態を持つ。renderer 側の状態は token で照合する。 */
var ReloadInterceptorSession = class {
	page;
	token;
	status = "active";
	restoredRequests = [];
	constructor(page, token) {
		this.page = page;
		this.token = token;
	}
	async requested() {
		return (await this.requests()).length > 0;
	}
	async requests() {
		if (this.status === "restored") return copyRequests(this.restoredRequests);
		if (this.status === "invalidated") throw new Error(INVALIDATED_MESSAGE);
		const reading = await this.page.evaluate(readReloadInterceptor, this.token);
		if (!reading.active) {
			this.status = "invalidated";
			throw new Error(INVALIDATED_MESSAGE);
		}
		return reading.requests;
	}
	async restore() {
		if (this.status !== "active") return;
		const result = await this.page.evaluate(restoreReloadInterceptor, this.token);
		if (!result.restored) {
			this.status = "invalidated";
			return;
		}
		this.restoredRequests = result.requests;
		this.status = "restored";
	}
	/** ページが再読込されて差し替えが消えたことを記録する。renderer には触れない。 */
	invalidate() {
		if (this.status === "active") this.status = "invalidated";
	}
};
function copyRequests(requests) {
	return requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] }));
}
//#endregion
//#region src/internal/runtime/presentation.ts
/** emulateMobile が付け替えるクラス。付与前にこれらをすべて外す。 */
const MANAGED_MOBILE_CLASSES = [
	"is-mobile",
	"is-phone",
	"is-tablet",
	"is-android",
	"is-ios"
];
function mobileClassNames(kind, platform) {
	return [
		"is-mobile",
		kind === "phone" ? "is-phone" : "is-tablet",
		`is-${platform}`
	];
}
//#endregion
//#region src/internal/runtime/settings.ts
/** 設定ウィンドウ（または vault 画面の設定モーダル）の左メニューに出る見出しのマーカー。 */
const SETTINGS_WINDOW_MARKER = ".vertical-tab-header";
/**
* 設定画面の項目名（.setting-item-name）のうち、表示文字列が完全一致する可視の最初の要素。
* 左メニューには限定しない。プラグインの最初の設定ページ内の項目（Modes、General など）も対象にする。
* ヘッダーや説明文の同名テキストは .setting-item-name の外なので、対象から外れる。
*/
function settingItemNamed(page, name) {
	const exact = new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`);
	return page.locator(".setting-item-name").filter({ hasText: exact }).filter({ visible: true }).first();
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const POLL_INTERVAL_MS = 100;
/**
* 開いているウィンドウを一定間隔で再列挙し、locate が返す要素のうち可視なものが 1 つ以上ある最初の page を返す。
* 先頭の要素だけは見ない。先頭が hidden で 2 個目が visible の場合も一致とする。
* 待機中に開いたウィンドウも対象になる。リスナーは登録しないので、解除漏れは起きない。
*/
async function findVisiblePage(listPages, locate, options = {}) {
	const timeout = options.timeout ?? 1e4;
	const found = await pollUntil(() => firstVisiblePage(listPages(), locate), timeout);
	if (found) return found;
	const windows = openPages(listPages());
	const details = await describeMatches(windows, locate);
	throw new Error(`findPage: ${options.description ?? "the target element"} was not visible in any of ${windows.length} window(s) within ${timeout}ms. Windows: [${details}]`);
}
/** locate が返す要素のうち可視なものが、開いているどのウィンドウにも無くなるまで待つ。 */
async function waitUntilNoVisiblePage(listPages, locate, options = {}) {
	const timeout = options.timeout ?? 1e4;
	if (await pollUntil(async () => await firstVisiblePage(listPages(), locate) ? void 0 : true, timeout)) return;
	const windows = openPages(listPages());
	throw new Error(`waitForNoPage: ${options.description ?? "the target element"} is still visible after ${timeout}ms. Windows: [${describePages(windows)}]`);
}
/** check が undefined 以外を返すまで待つ。期限までに値が出なければ undefined を返す。 */
async function pollUntil(check, timeout) {
	const deadline = Date.now() + timeout;
	for (;;) {
		const value = await check();
		if (value !== void 0) return value;
		const remaining = deadline - Date.now();
		if (remaining <= 0) return;
		await delay(Math.min(POLL_INTERVAL_MS, remaining));
	}
}
async function firstVisiblePage(pages, locate) {
	for (const page of openPages(pages)) if (await hasVisibleMatch(page, locate)) return page;
}
async function hasVisibleMatch(page, locate) {
	try {
		return await locate(page).filter({ visible: true }).count() > 0;
	} catch (error) {
		if (page.isClosed()) return false;
		throw error;
	}
}
function openPages(pages) {
	return pages.filter((page) => !page.isClosed());
}
function describePages(pages) {
	return pages.map((page) => page.url() || "(no url)").join(", ");
}
/**
* 各 window の一致数（全体と可視）を返す。hidden だけで一致している等の原因を見分けるため。
* 診断の途中で閉じた page は一覧から外す。診断自体の失敗は行に記録するだけで、呼び出し元の timeout エラーを置き換えない。
*/
async function describeMatches(pages, locate) {
	const parts = [];
	for (const page of pages) {
		const line = await describeMatch(page, locate);
		if (line !== void 0) parts.push(line);
	}
	return parts.join(", ");
}
async function describeMatch(page, locate) {
	const url = page.url() || "(no url)";
	if (page.isClosed()) return;
	try {
		const total = await locate(page).count();
		const visible = await locate(page).filter({ visible: true }).count();
		return url + " (matches: " + total + ", visible: " + visible + ")";
	} catch (error) {
		if (page.isClosed()) return;
		const reason = error instanceof Error ? error.message : String(error);
		return url + " (match count failed: " + reason + ")";
	}
}
function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
//#endregion
//#region src/ObsidianAPI.ts
/**
* シンプルで直感的なObsidian APIクラス
*/
var ObsidianAPI = class {
	page;
	context;
	reloadInterceptors = /* @__PURE__ */ new Set();
	constructor(context) {
		(0, tiny_invariant.default)(context.page, "Page context is required");
		this.page = context.page;
		this.context = context;
	}
	/**
	* Playwright's handle to the Electron main process.
	* Use it for things the renderer cannot do, such as `electronApp.evaluate(({ BrowserWindow }) => ...)`
	* to blur or focus a window.
	*/
	get electronApp() {
		return this.context.electronApp;
	}
	/**
	* Run a function inside the Obsidian renderer, where the global `app` is available.
	* Prefer this over `page.evaluate` + `(window as any).app`.
	*/
	evaluateApp(callback, arg) {
		return this.appState(callback, arg);
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
			const found = /* @__PURE__ */ new Set();
			app.workspace.iterateAllLeaves((leaf) => found.add(leaf));
			for (const type of Object.keys(app.viewRegistry?.viewByType ?? {})) for (const leaf of app.workspace.getLeavesOfType(type)) found.add(leaf);
			return [...found].map((leaf) => {
				const view = leaf.view;
				const state = leaf.getViewState?.();
				const filePath = view?.file?.path ?? state?.state?.file ?? null;
				const basename = filePath ? (filePath.split("/").pop() ?? "").replace(/\.[^.]+$/, "") : null;
				return {
					active: leaf === app.workspace.activeLeaf,
					viewType: typeof view?.getViewType === "function" ? view.getViewType() : state?.type ?? null,
					filePath,
					title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? basename : leaf.getDisplayText?.() ?? basename
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
			const found = /* @__PURE__ */ new Set();
			app.workspace.iterateAllLeaves((leaf) => found.add(leaf));
			for (const type of Object.keys(app.viewRegistry?.viewByType ?? {})) for (const leaf of app.workspace.getLeavesOfType(type)) found.add(leaf);
			return [...found].filter((leaf) => (leaf?.view?.getViewType?.() ?? leaf?.getViewState?.()?.type) === type).map((leaf) => {
				const view = leaf.view;
				const state = leaf.getViewState?.();
				const filePath = view?.file?.path ?? state?.state?.file ?? null;
				const basename = filePath ? (filePath.split("/").pop() ?? "").replace(/\.[^.]+$/, "") : null;
				return {
					active: leaf === app.workspace.activeLeaf,
					viewType: type,
					filePath,
					title: typeof view?.getDisplayText === "function" ? view.getDisplayText() ?? basename : leaf.getDisplayText?.() ?? basename
				};
			});
		}, viewType);
	}
	/** コマンドを実行し、実行されなければ失敗させる。 */
	async command(commandId) {
		(0, playwright_test.expect)(await this.tryCommand(commandId)).toBe(true);
	}
	async split(direction = "vertical") {
		await this.appState((dir) => app.workspace.duplicateLeaf(app.workspace.activeLeaf, dir), direction);
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
		(0, playwright_test.expect)(closed).toBe(true);
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
		await PageWaiter.waitForVaultReady(this.page, timeout);
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
	/** Create a note through the vault API (creates parent folders, updates the metadata cache). */
	async createNote(path, content = "") {
		await this.appState(async ([p, c]) => {
			const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
			if (dir && !await app.vault.adapter.exists(dir)) await app.vault.createFolder(dir);
			const existing = app.vault.getAbstractFileByPath(p);
			if (existing) await app.vault.modify(existing, c);
			else await app.vault.create(p, c);
		}, [path, content]);
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
	/** Read the plugin's persisted data (data.json) via `plugin.loadData()`. */
	async pluginData(pluginId) {
		return this.appState(async (id) => {
			const plugin = app.plugins.plugins[id];
			if (!plugin) throw new Error(`Plugin not loaded: ${id}`);
			return await plugin.loadData() ?? null;
		}, pluginId);
	}
	/** Shallow-merge `patch` into the plugin's persisted data via `plugin.saveData()`. */
	async setPluginData(pluginId, patch) {
		await this.appState(async ([id, data]) => {
			const plugin = app.plugins.plugins[id];
			if (!plugin) throw new Error(`Plugin not loaded: ${id}`);
			const current = await plugin.loadData() ?? {};
			await plugin.saveData({
				...current,
				...data
			});
		}, [pluginId, patch]);
	}
	/** Read the startup-enabled setting, independently of the plugin's load state. */
	async isPluginEnabled(pluginId) {
		return this.appState((id) => !!app.plugins.enabledPlugins.has(id), pluginId);
	}
	/** Wait for the startup-enabled setting; use `waitForPluginLoaded` for runtime state. */
	async waitForPluginEnabled(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !!app?.plugins?.enabledPlugins?.has(id), pluginId, timeout);
	}
	/** Wait for the startup-disabled setting; use `waitForPluginUnloaded` for runtime state. */
	async waitForPluginDisabled(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !app?.plugins?.enabledPlugins?.has(id), pluginId, timeout);
	}
	/** Read the actual load state, independently of the startup-enabled setting. */
	async isPluginLoaded(pluginId) {
		return this.appState((id) => !!app.plugins.plugins[id]?._loaded, pluginId);
	}
	/** Wait until the plugin is loaded, regardless of its startup-enabled setting. */
	async waitForPluginLoaded(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !!app?.plugins?.plugins?.[id]?._loaded, pluginId, timeout);
	}
	/** Wait until the plugin is unloaded, regardless of its startup-enabled setting. */
	async waitForPluginUnloaded(pluginId, timeout = 8e3) {
		await this.waitForApp((id) => !app?.plugins?.plugins?.[id]?._loaded, pluginId, timeout);
	}
	async pluginState(pluginId) {
		return this.appState((id) => ({
			enabled: !!app?.plugins?.enabledPlugins?.has(id),
			loaded: !!app?.plugins?.plugins?.[id]?._loaded,
			registered: !!app?.plugins?.plugins?.[id]
		}), pluginId);
	}
	/**
	* Unload and reload a plugin so it re-reads its data.json (e.g. after `setPluginData`).
	* The handle returned by `plugin(id)` is refreshed to the new plugin instance.
	*/
	async reloadPlugin(pluginId) {
		await this.appState(async (id) => {
			await app.plugins.disablePlugin(id);
			await app.plugins.enablePlugin(id);
		}, pluginId);
		await this.waitForPluginLoaded(pluginId);
		await this.context?.pluginHandleMap?.evaluate((map, id) => {
			const plugin = window.app?.plugins?.plugins?.[id];
			if (plugin) map.set(id, plugin);
		}, pluginId);
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
	/**
	* 設定ウィンドウを開いて tab を選び、その Page を返す。既に開いていれば同じウィンドウを返す。
	* subPage を渡すと、設定画面の項目名（.setting-item-name）のうち表示文字列が完全一致する可視の要素をクリックする。
	*/
	async openSettings(tabId, options = {}) {
		const timeout = options.timeout ?? 1e4;
		await this.appState((id) => {
			const setting = app.setting;
			setting.open();
			setting.openTabById(id);
		}, tabId);
		const settingsPage = await findVisiblePage(() => this.page.context().pages(), (page) => page.locator(SETTINGS_WINDOW_MARKER), {
			timeout,
			description: "settings window for tab \"" + tabId + "\""
		});
		if (options.subPage !== void 0) await settingItemNamed(settingsPage, options.subPage).click({ timeout });
		return settingsPage;
	}
	/** 設定ウィンドウを閉じ、設定画面が見えなくなるまで待つ。 */
	async closeSettings(options = {}) {
		const timeout = options.timeout ?? 1e4;
		await this.appState(() => app.setting.close());
		await waitUntilNoVisiblePage(() => this.page.context().pages(), (page) => page.locator(SETTINGS_WINDOW_MARKER), {
			timeout,
			description: "settings window"
		});
	}
	/**
	* 開いているどのウィンドウでも、locate が返す要素のうち可視なものが 1 つ以上になるまで待ち、そのウィンドウの Page を返す。
	* 待機中に開いたウィンドウも対象になる。timeout のエラーには各ウィンドウの一致数を載せる。
	*/
	findPage(locate, options = {}) {
		return findVisiblePage(() => this.page.context().pages(), locate, options);
	}
	/**
	* レイアウトを保存してからページを再読込し、plugin の読み込みと CSS 適用を待つ。
	* 待つ対象は、再読込の直前に読み込まれていた plugin（expectLoaded を渡すとその ID）。
	* plugin の有効化・無効化は行わない。
	*/
	async reload(options = {}) {
		const timeout = options.timeout ?? 3e4;
		if (options.saveLayout ?? true) await this.appState(() => app.workspace.saveLayout());
		const configuredIds = await this.context.pluginHandleMap.evaluate((map) => [...map.keys()]);
		const expectedIds = options.expectLoaded ?? await this.appState(() => Object.keys(app.plugins.plugins).filter((id) => app.plugins.plugins[id]?._loaded === true));
		const pluginsDir = node_path.default.join(await this.vaultPath(), await this.configDir(), "plugins");
		await this.context.coverage?.checkpoint(this.page);
		this.invalidateReloadInterceptors();
		await this.page.reload({
			waitUntil: "domcontentloaded",
			timeout
		});
		await PageWaiter.waitForPage(this.page, timeout);
		await waitForPluginFixtures(this.page, {
			pluginsDir,
			pluginIds: expectedIds
		}, timeout);
		this.context = {
			...this.context,
			pluginHandleMap: await refreshPluginHandleMap(this.page, configuredIds)
		};
	}
	/**
	* app:reload だけを差し替えて呼び出しを記録する。他のコマンドは本当に実行される（this・引数・戻り値を保つ）。
	* 同じページで有効な差し替えは 1 つだけ。テスト終了時に fixture が自動で戻す。
	*/
	async interceptReload() {
		const session = new ReloadInterceptorSession(this.page, (0, node_crypto.randomUUID)());
		await this.page.evaluate(installReloadInterceptor, session.token);
		this.reloadInterceptors.add(session);
		return session;
	}
	/** fixture の終了処理から呼ばれる。残っている差し替えを元に戻す。 */
	async restoreReloadInterceptors() {
		const sessions = [...this.reloadInterceptors];
		this.reloadInterceptors.clear();
		for (const session of sessions) if (this.page.isClosed()) session.invalidate();
		else await session.restore();
	}
	invalidateReloadInterceptors() {
		for (const session of this.reloadInterceptors) session.invalidate();
		this.reloadInterceptors.clear();
	}
	/** vault のディスク上の絶対パス。 */
	vaultPath() {
		return this.appState(() => {
			const adapter = app.vault.adapter;
			if (typeof adapter.getBasePath !== "function") throw new Error("The vault adapter does not provide getBasePath(); the vault path is unavailable.");
			return adapter.getBasePath();
		});
	}
	/** 設定ディレクトリ名（通常は .obsidian）。 */
	configDir() {
		return this.appState(() => app.vault.configDir);
	}
	/** 設定ディレクトリ配下の JSON を読む。file は相対パスのみ。vault の外へ出る指定は拒否する。 */
	async readConfig(file) {
		return readJsonInside(node_path.default.join(await this.vaultPath(), await this.configDir()), file);
	}
	/** community-plugins.json に載っている有効な plugin の ID 一覧。 */
	async enabledPluginsOnDisk() {
		const ids = await this.readConfig("community-plugins.json");
		if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) throw new Error("community-plugins.json must contain a JSON array of plugin IDs.");
		return ids;
	}
	/** 読み込まれた plugin の settings を読む（読み取り専用）。 */
	async pluginSettings(pluginId) {
		return await this.appState((id) => {
			const plugin = app.plugins.plugins[id];
			if (!plugin || plugin._loaded !== true) throw new Error("Plugin is not loaded: " + id);
			if (plugin.settings === void 0) throw new Error("Plugin has no settings property: " + id);
			return plugin.settings;
		}, pluginId);
	}
	/** settings に patch を浅くマージし、plugin の saveSettings() で保存する。UI の再描画は行わない。 */
	async updatePluginSettings(pluginId, patch) {
		await this.appState(async ([id, values]) => {
			const plugin = app.plugins.plugins[id];
			if (!plugin || plugin._loaded !== true) throw new Error("Plugin is not loaded: " + id);
			if (typeof plugin.saveSettings !== "function") throw new Error("Plugin has no saveSettings(): " + id);
			const settings = plugin.settings;
			if (!settings || typeof settings !== "object") throw new Error("Plugin settings are not an object: " + id);
			Object.assign(settings, values);
			await plugin.saveSettings();
		}, [pluginId, patch]);
	}
	/**
	* plugin インスタンスを渡して fn を renderer 内で実行する。fn は (plugin, arg) を受け取る。
	* fn はシリアライズされて実行されるため、外側の変数を参照しないこと。
	*/
	async evaluatePlugin(pluginId, fn, arg) {
		const handle = await this.page.evaluateHandle((id) => {
			const plugin = app.plugins.plugins[id];
			if (!plugin || plugin._loaded !== true) throw new Error("Plugin is not loaded: " + id);
			return plugin;
		}, pluginId);
		try {
			const run = fn;
			return await handle.evaluate(run, arg);
		} finally {
			await handle.dispose();
		}
	}
	/** 左右のサイドバーを閉じる。 */
	async collapseSidebars() {
		await this.appState(() => {
			app.workspace.leftSplit.collapse();
			app.workspace.rightSplit.collapse();
		});
	}
	/** 指定の view type を開いて前面に出す。newLeaf が true なら新しいタブ、既定はアクティブ leaf を使う。 */
	async openView(viewType, state = {}, options = {}) {
		await this.appState(async ([type, viewState, newLeaf]) => {
			const leaf = app.workspace.getLeaf(newLeaf);
			await leaf.setViewState({
				type,
				state: viewState,
				active: true
			});
			await app.workspace.revealLeaf(leaf);
			await leaf.loadIfDeferred();
			app.workspace.setActiveLeaf(leaf, { focus: true });
		}, [
			viewType,
			state,
			options.newLeaf === true
		]);
	}
	/** 指定 view type の先頭 leaf を前面に出し、遅延読み込みなら描画させる。無ければ例外。 */
	async revealView(viewType) {
		await this.appState(async (type) => {
			const leaf = app.workspace.getLeavesOfType(type)[0];
			if (!leaf) throw new Error("No leaf of view type: " + type);
			await app.workspace.revealLeaf(leaf);
			await leaf.loadIfDeferred();
			app.workspace.setActiveLeaf(leaf, { focus: true });
		}, viewType);
	}
	/** 開いている leaf を 1 行ずつ整形する。失敗メッセージに載せる用途。 */
	async describeLeaves() {
		const tabs = await this.allTabs();
		if (tabs.length === 0) return "(no leaves)";
		return tabs.map((tab) => (tab.active ? "*" : "-") + " type=" + (tab.viewType ?? "-") + " file=" + (tab.filePath ?? "-") + " title=" + (tab.title ?? "-")).join("\n");
	}
	/** body のテーマクラスを切り替える。設定ファイルは変えない。 */
	async setTheme(theme, page = this.page) {
		await page.evaluate((next) => {
			document.body.classList.remove("theme-dark", "theme-light");
			document.body.classList.add("theme-" + next);
		}, theme);
	}
	/**
	* CSS クラスだけでモバイル表示を再現する。viewport と Platform.isMobile は変わらない。
	* 既定の platform は android（lazy の既存の撮影が使う is-android を維持するため）。
	*/
	async emulateMobile(kind, page = this.page, options = {}) {
		const classes = mobileClassNames(kind, options.platform ?? "android");
		await page.evaluate(({ managed, next }) => {
			document.body.classList.remove(...managed);
			document.body.classList.add(...next);
		}, {
			managed: [...MANAGED_MOBILE_CLASSES],
			next: classes
		});
	}
	/** 無限でない実行中のアニメーションが終わるまで待つ。無限のアニメーション（ローディング等）は待たない。 */
	async waitForAnimations(page = this.page, options = {}) {
		await page.waitForFunction(() => document.getAnimations().every((animation) => {
			if (animation.playState !== "running") return true;
			return animation.effect?.getTiming().iterations === Infinity;
		}), void 0, { timeout: options.timeout ?? 1e4 });
	}
	/** コマンドが登録されているか。pluginId:name の形式では ID マッピングも試す。 */
	async hasCommand(commandId) {
		return this.appState((id) => {
			const commands = app.commands;
			if (commands.findCommand(id)) return true;
			if (!id.includes(":")) return false;
			const [pluginId, ...rest] = id.split(":");
			const actualId = window.__pluginIdMapping?.get(pluginId);
			return actualId !== void 0 && Boolean(commands.findCommand([actualId, ...rest].join(":")));
		}, commandId);
	}
	/** 接頭辞に一致する command ID の一覧。 */
	async findCommands(prefix) {
		return this.appState((p) => {
			const commands = app.commands.commands;
			return Object.keys(commands).filter((id) => id.startsWith(p));
		}, prefix);
	}
	/**
	* コマンドを実行し、実行されたかを返す。ID が無い・実行されなかった場合は false。
	* コマンド内で投げられた例外は隠さず、そのまま呼び出し元へ伝える。
	*/
	async tryCommand(commandId) {
		return this.appState((id) => {
			if (app.commands.executeCommandById(id)) return true;
			if (!id.includes(":")) return false;
			const [pluginId, ...rest] = id.split(":");
			const actualId = window.__pluginIdMapping?.get(pluginId);
			if (actualId === void 0) return false;
			return app.commands.executeCommandById([actualId, ...rest].join(":"));
		}, commandId);
	}
	async expectViews(viewType, count) {
		(0, playwright_test.expect)((await this.allViews(viewType)).length).toBe(count);
	}
	async expectTitle(viewType, title) {
		(0, playwright_test.expect)(await this.title(viewType)).toBe(title);
	}
	async expectTitleContains(viewType, text) {
		(0, playwright_test.expect)(await this.title(viewType)).toContain(text);
	}
	async expectActiveType(type) {
		(0, playwright_test.expect)((await this.activeTab())?.viewType).toBe(type);
	}
	async expectTabs(count) {
		(0, playwright_test.expect)((await this.allTabs()).length).toBe(count);
	}
	async expectExists(path) {
		(0, playwright_test.expect)(await this.exists(path)).toBe(true);
	}
	async expectNotExists(path) {
		(0, playwright_test.expect)(await this.exists(path)).toBe(false);
	}
	async expectContent(content) {
		const value = await this.content();
		(0, playwright_test.expect)(value).toBe(content);
	}
	async expectContentContains(text) {
		const value = await this.content();
		(0, playwright_test.expect)(value).toContain(text);
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
//#region src/internal/coverage/collector.ts
var PluginCoverageCollector = class PluginCoverageCollector {
	targets;
	outputDir;
	pages = /* @__PURE__ */ new Map();
	entries = [];
	constructor(targets, outputDir) {
		this.targets = targets;
		this.outputDir = outputDir;
	}
	static async create(options, fallbackPaths) {
		const paths = [...new Set((options.pluginPaths ?? fallbackPaths).map((value) => node_path.default.resolve(value)))];
		if (!paths.length) throw new Error("Coverage requires pluginPaths or vaultOptions.plugins.");
		const targets = await Promise.all(paths.map(require_targets.readCoverageTarget));
		if (new Set(targets.map((target) => target.pluginId)).size !== targets.length) throw new Error("Coverage pluginPaths contain duplicate plugin ids.");
		return new PluginCoverageCollector(targets, node_path.default.resolve(options.outputDir ?? "coverage/e2e"));
	}
	async start(page) {
		let started = this.pages.get(page);
		if (!started) {
			started = page.coverage.startJSCoverage({
				resetOnNavigation: false,
				reportAnonymousScripts: false
			});
			this.pages.set(page, started);
		}
		await started;
	}
	async collect(page) {
		const started = this.pages.get(page);
		if (!started) return;
		await started;
		if (page.isClosed()) throw new Error("Obsidian window closed before plugin coverage could be collected.");
		const entries = await page.coverage.stopJSCoverage();
		this.entries.push(...entries.filter((entry) => this.targets.some((target) => require_targets.isTargetScript(entry.url, target))));
		this.pages.delete(page);
	}
	async checkpoint(page) {
		await this.collect(page);
		await this.start(page);
	}
	async save(testId) {
		await Promise.all([...this.pages.keys()].map((page) => this.collect(page)));
		const directory = node_path.default.join(this.outputDir, "raw");
		await (0, node_fs_promises.mkdir)(directory, { recursive: true });
		const filename = node_path.default.join(directory, `${(0, node_crypto.randomUUID)()}.json`);
		const raw = {
			version: 1,
			testId,
			targets: this.targets,
			entries: this.entries
		};
		await (0, node_fs_promises.writeFile)(filename, JSON.stringify(raw));
		return filename;
	}
};
//#endregion
//#region src/fetchPlugin.ts
const logger$2 = require_targets.createScopedLogger("fetchPlugin");
const GITHUB_API_ORIGIN = "https://api.github.com";
const USER_AGENT = "obsidian-e2e-toolkit";
const REQUIRED_FILES = ["main.js", "manifest.json"];
const OPTIONAL_FILES = ["styles.css"];
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+/-]*$/;
const SAFE_PNPM_ARGUMENT = /^[A-Za-z0-9._:=-]+$/;
const PNPM_ENTRY = /[\\/]pnpm(\.[cm]?js)?$/i;
const REPO_PATTERNS = [
	/^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
	/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
	/^([^/:@\s]+)\/([^/:@\s]+?)(?:\.git)?$/
];
const TOKEN_VARIABLES = ["GITHUB_TOKEN", "GH_TOKEN"];
function normalizePluginSource(source) {
	if (typeof source === "string") return { repo: source };
	if (!source || typeof source.repo !== "string" || source.repo.length === 0) throw new TypeError("plugin source must be a repo string or an object with a repo field");
	if (source.tag === void 0) return { repo: source.repo };
	if (typeof source.tag !== "string" || source.tag.length === 0) throw new TypeError("plugin source tag must be a non-empty string");
	return {
		repo: source.repo,
		tag: source.tag
	};
}
function isValidName(value) {
	return NAME_PATTERN.test(value) && !value.startsWith("-") && value !== "." && value !== "..";
}
function parseGitHubRepo(repo) {
	if (typeof repo !== "string" || repo.trim() === "") throw new TypeError("repo url is required");
	const trimmed = repo.trim();
	for (const pattern of REPO_PATTERNS) {
		const match = pattern.exec(trimmed);
		if (!match) continue;
		const owner = match[1];
		const name = match[2];
		if (!isValidName(owner) || !isValidName(name)) break;
		return {
			owner,
			name
		};
	}
	throw new Error("Unsupported repo url: " + repo);
}
function repoFullName(repo) {
	return repo.owner + "/" + repo.name;
}
function apiRepoUrl(repo) {
	return GITHUB_API_ORIGIN + "/repos/" + repo.owner + "/" + repo.name;
}
function cloneUrl(repo) {
	return "https://github.com/" + repo.owner + "/" + repo.name + ".git";
}
function normalizeTag(tag) {
	if (tag === void 0) return void 0;
	if (!TAG_PATTERN.test(tag)) throw new TypeError("invalid release tag: " + JSON.stringify(tag));
	return tag;
}
function getGitHubToken(env = process.env) {
	return env.GITHUB_TOKEN || env.GH_TOKEN || void 0;
}
function authorizationHeaders(url, token) {
	if (!token || new URL(url).origin !== GITHUB_API_ORIGIN) return {};
	return { Authorization: "Bearer " + token };
}
async function fetchGitHubApi(url) {
	const headers = {
		Accept: "application/vnd.github+json",
		"User-Agent": USER_AGENT,
		...authorizationHeaders(url, getGitHubToken())
	};
	return fetch(url, { headers });
}
async function readRelease(url) {
	const response = await fetchGitHubApi(url);
	if (response.status === 404) return null;
	if (!response.ok) throw new Error("GitHub release lookup failed (" + response.status + "): " + url);
	return await response.json();
}
async function readReleaseList(url) {
	const response = await fetchGitHubApi(url);
	if (!response.ok) throw new Error("GitHub release list failed (" + response.status + "): " + url);
	const body = await response.json();
	return Array.isArray(body) ? body : [];
}
function toUsableRelease(release) {
	if (!release || typeof release.tag_name !== "string") return null;
	const assets = release.assets ?? [];
	return REQUIRED_FILES.every((name) => assets.some((asset) => asset.name === name && typeof asset.browser_download_url === "string")) ? {
		tag_name: release.tag_name,
		assets
	} : null;
}
async function lookupRelease(repo, tag) {
	const base = apiRepoUrl(repo);
	if (tag !== void 0) return toUsableRelease(await readRelease(base + "/releases/tags/" + encodeURIComponent(tag)));
	const latest = toUsableRelease(await readRelease(base + "/releases/latest"));
	if (latest) return latest;
	const releases = await readReleaseList(base + "/releases?per_page=20");
	for (const release of releases) {
		if (release.draft === true) continue;
		const usable = toUsableRelease(release);
		if (usable) return usable;
	}
	return null;
}
async function downloadAsset(url, target, name) {
	const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
	if (!response.ok) throw new Error("failed to download " + name + " (" + response.status + ")");
	await (0, node_fs_promises.writeFile)(target, Buffer.from(await response.arrayBuffer()));
}
async function downloadReleaseFiles(release, dir) {
	for (const name of REQUIRED_FILES.concat(OPTIONAL_FILES)) {
		const asset = release.assets.find((entry) => entry.name === name);
		if (!asset || typeof asset.browser_download_url !== "string") continue;
		await downloadAsset(asset.browser_download_url, node_path.default.join(dir, name), name);
	}
}
async function isNonEmptyFile(file) {
	try {
		const info = await (0, node_fs_promises.lstat)(file);
		return info.isFile() && info.size > 0;
	} catch {
		return false;
	}
}
async function assertRequiredFiles(dir) {
	const missing = [];
	for (const name of REQUIRED_FILES) if (!await isNonEmptyFile(node_path.default.join(dir, name))) missing.push(name);
	if (missing.length > 0) throw new Error("missing required files: " + missing.join(", "));
	await require_targets.readManifestIdentity(node_path.default.join(dir, "manifest.json"));
}
async function hasRequiredFiles(dir) {
	try {
		await assertRequiredFiles(dir);
		return true;
	} catch {
		return false;
	}
}
function isSameRepository(markerRepo, repo) {
	try {
		const other = parseGitHubRepo(markerRepo);
		return other.owner.toLowerCase() === repo.owner.toLowerCase() && other.name.toLowerCase() === repo.name.toLowerCase();
	} catch {
		return false;
	}
}
async function isReusableCopy(dir, repo, tag, resolvedTag) {
	const marker = await require_targets.readSourceMarker(dir);
	if (!marker || !isSameRepository(marker.repo, repo)) return false;
	if (!await hasRequiredFiles(dir)) return false;
	if (marker.kind === "legacy-lazy") return tag !== void 0 && marker.tag === tag;
	if (resolvedTag === null || marker.resolvedTag !== resolvedTag) return false;
	return marker.tag === (tag ?? null);
}
async function reuseCopy(dir, repo, tag) {
	if ((await require_targets.readSourceMarker(dir))?.kind === "legacy-lazy" && tag !== void 0) {
		await require_targets.writeSourceMarker(dir, {
			repo: repoFullName(repo),
			tag,
			resolvedTag: tag,
			method: "adopted-legacy"
		});
		logger$2.info("adopted legacy cache for " + repoFullName(repo) + "@" + tag);
	}
	logger$2.info("reusing cached plugin at " + dir);
	return dir;
}
async function assertReplaceable$1(dest) {
	if ((await require_targets.inspectDestination(dest)).state !== "populated") return;
	if (await require_targets.readSourceMarker(dest)) return;
	throw new Error("refusing to replace " + dest + ": it is not empty and has no toolkit or legacy cache marker. Move or delete it, then run again.");
}
async function stageAndPromote(dest, populate) {
	await (0, node_fs_promises.mkdir)(node_path.default.dirname(dest), { recursive: true });
	const staging = require_targets.tempSiblingPath(dest, "staging");
	try {
		await populate(staging);
		await require_targets.promoteDirectory(staging, dest);
	} catch (error) {
		await require_targets.removeTempDirectory(staging, dest, "staging");
		throw error;
	}
}
async function installFromRelease(release, repo, tag, dest) {
	await stageAndPromote(dest, async (staging) => {
		await (0, node_fs_promises.mkdir)(staging);
		await downloadReleaseFiles(release, staging);
		await assertRequiredFiles(staging);
		await require_targets.writeSourceMarker(staging, {
			repo: repoFullName(repo),
			tag: tag ?? null,
			resolvedTag: release.tag_name,
			method: "release"
		});
	});
}
async function installFromGit(repo, tag, dest) {
	await stageAndPromote(dest, async (staging) => {
		runCommand({
			command: "git",
			args: buildCloneArgs(cloneUrl(repo), staging, tag),
			shell: false
		}, node_path.default.dirname(staging), "git clone " + repoFullName(repo));
		await buildCheckout(staging);
		await assertRequiredFiles(staging);
		await require_targets.writeSourceMarker(staging, {
			repo: repoFullName(repo),
			tag: tag ?? null,
			resolvedTag: tag ?? null,
			method: "git"
		});
	});
}
async function buildCheckout(dir) {
	const packageJsonPath = node_path.default.join(dir, "package.json");
	if (!await isNonEmptyFile(packageJsonPath)) return;
	runCommand(resolvePnpmInvocation(["install", "--ignore-workspace"]), dir, "pnpm install");
	const pkg = JSON.parse(await (0, node_fs_promises.readFile)(packageJsonPath, "utf8"));
	if (typeof (require_targets.isRecord(pkg) && require_targets.isRecord(pkg.scripts) ? pkg.scripts : {}).build === "string") runCommand(resolvePnpmInvocation(["run", "build"]), dir, "pnpm run build");
}
/**
* pnpm を起動するコマンドを決める。
* npm_execpath が pnpm の entry なら node で直接起動し、shell は使わない。
* Windows の pnpm は .cmd の shim なので shell 経由にする。その場合は引数を先に検証する。
*/
function resolvePnpmInvocation(args, env = process.env, platform = process.platform) {
	for (const arg of args) if (!SAFE_PNPM_ARGUMENT.test(arg)) throw new TypeError("unsafe pnpm argument: " + JSON.stringify(arg));
	const entry = env.npm_execpath;
	if (entry && PNPM_ENTRY.test(entry)) return {
		command: process.execPath,
		args: [entry, ...args],
		shell: false
	};
	return {
		command: "pnpm",
		args: [...args],
		shell: platform === "win32"
	};
}
function buildCloneArgs(url, target, tag) {
	return [
		"clone",
		"--depth",
		"1",
		...tag === void 0 ? [] : ["--branch", tag],
		"--",
		url,
		target
	];
}
function childEnvironment(env) {
	const copy = { ...env };
	for (const name of TOKEN_VARIABLES) delete copy[name];
	return copy;
}
function runCommand(spec, cwd, label) {
	const result = (0, node_child_process.spawnSync)(spec.command, spec.args, {
		cwd,
		shell: spec.shell,
		encoding: "utf8",
		env: childEnvironment(process.env),
		windowsHide: true,
		maxBuffer: 67108864
	});
	if (result.error) throw new Error(label + " could not start: " + result.error.message);
	if (result.status === 0) return;
	const reason = result.status === null ? "terminated by " + (result.signal ?? "a signal") : "exit code " + result.status;
	const output = (String(result.stdout) + "\n" + String(result.stderr)).trim().slice(-2e3);
	throw new Error(label + " failed (" + reason + ")" + (output ? ":\n" + output : ""));
}
function resolveDestination(destArg, name) {
	const dest = destArg ? node_path.default.resolve(process.cwd(), destArg) : node_path.default.resolve(process.cwd(), "myfiles", name);
	require_targets.assertUsableDirectory(dest);
	return dest;
}
function describeTag(tag) {
	return tag === void 0 ? "" : " at " + tag;
}
/**
* GitHub の plugin repo を dest に取得して、main.js と manifest.json が揃った状態で返す。
* 検証に通らない取得は成功にしない。既存の dest は、空、または toolkit / 旧 lazy の marker を持つ場合だけ置き換える。
*/
async function fetchPlugin(repo, destArg, opts) {
	const parsed = parseGitHubRepo(repo);
	const tag = normalizeTag(opts?.tag);
	const dest = resolveDestination(destArg, parsed.name);
	const useCache = opts?.cache ?? true;
	const fallbackToGit = opts?.fallbackToGit ?? false;
	logger$2.debug("repo=" + repoFullName(parsed) + " tag=" + (tag ?? "latest") + " dest=" + dest + " cache=" + useCache + " fallbackToGit=" + fallbackToGit);
	await assertReplaceable$1(dest);
	if (tag !== void 0 && useCache && await isReusableCopy(dest, parsed, tag, tag)) return reuseCopy(dest, parsed, tag);
	let usable = null;
	try {
		usable = await lookupRelease(parsed, tag);
	} catch (error) {
		if (!fallbackToGit) throw error;
		logger$2.warn("release lookup failed for " + repoFullName(parsed) + "; falling back to git: " + require_targets.errorMessage(error));
	}
	if (usable) {
		if (useCache && await isReusableCopy(dest, parsed, tag, usable.tag_name)) return reuseCopy(dest, parsed, tag);
		try {
			await installFromRelease(usable, parsed, tag, dest);
			return dest;
		} catch (error) {
			if (!fallbackToGit) throw error;
			logger$2.warn("release install failed for " + repoFullName(parsed) + "; falling back to git: " + require_targets.errorMessage(error));
		}
	} else if (!fallbackToGit) throw new Error("No usable release for " + repoFullName(parsed) + describeTag(tag) + " (main.js and manifest.json are required). Set fallbackToGit to clone the source.");
	await installFromGit(parsed, tag, dest);
	return dest;
}
//#endregion
//#region src/config.ts
const DEFAULT_USE = {
	trace: "on-first-retry",
	screenshot: "only-on-failure"
};
const DEFAULT_EXPECT = { timeout: 5e3 };
function definedEntries(value) {
	if (value === void 0) return {};
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
/**
* Playwright の設定に Obsidian E2E 向けの既定値を加える。
* 利用者が明示した値（undefined を除く）は既定値より優先する。
* 何度重ねて呼んでも利用者の値は消えない。Linux でも例外にしない。
*/
function defineObsidianConfig(overrides = {}) {
	const { use, expect, ...rest } = overrides;
	return {
		...definedEntries(rest),
		use: {
			...DEFAULT_USE,
			...definedEntries(use)
		},
		expect: {
			...DEFAULT_EXPECT,
			...definedEntries(expect)
		}
	};
}
//#endregion
//#region src/internal/sourceMap.ts
const SOURCE_MAP_COMMENT = /^(\/\/[#@] sourceMappingURL=)([^\r\n]+)$/m;
const INLINE_SOURCE_MAP = /^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:/i;
const WINDOWS_DRIVE_PATH = /^[a-z]:[\\/]/i;
const SOURCE_MAP_FILE = "main.js.map";
function findSourceMapReference(bundle) {
	const match = SOURCE_MAP_COMMENT.exec(bundle);
	return match === null ? null : match[2].trim();
}
function replaceSourceMapReference(bundle, reference) {
	const match = SOURCE_MAP_COMMENT.exec(bundle);
	if (match === null) return bundle.trimEnd() + "\n//# sourceMappingURL=" + reference + "\n";
	return bundle.slice(0, match.index) + match[1] + reference + bundle.slice(match.index + match[0].length);
}
function decodeInlineSourceMap(reference) {
	const match = INLINE_SOURCE_MAP.exec(reference);
	return match === null ? null : Buffer.from(match[1], "base64").toString("utf8");
}
function encodeInlineSourceMap(json) {
	return "data:application/json;base64," + Buffer.from(json, "utf8").toString("base64");
}
function parseSourceMap(text, label) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error("source map is not valid JSON (" + label + "): " + (error instanceof Error ? error.message : String(error)));
	}
	if (!require_targets.isRecord(parsed) || parsed.version !== 3 || !Array.isArray(parsed.sources) || typeof parsed.mappings !== "string") throw new Error("invalid source map (version 3 with sources and mappings is required): " + label);
	return parsed;
}
function rebaseSource(source, baseDir, sourceRoot, label) {
	if (typeof source !== "string") throw new Error("source map sources must be strings: " + label);
	if (source.startsWith("file:")) return source;
	if (node_path.default.isAbsolute(source) || WINDOWS_DRIVE_PATH.test(source)) return (0, node_url.pathToFileURL)(node_path.default.resolve(source)).href;
	if (URL_SCHEME.test(source)) throw new Error("unsupported source map source " + JSON.stringify(source) + ": " + label);
	return (0, node_url.pathToFileURL)(node_path.default.resolve(baseDir, sourceRoot, source)).href;
}
/**
* sources を、map を生成した場所（baseDir）基準の絶対 file URL に書き換える。
* コピー先の場所を基準に解釈されると、プロジェクトの source が coverage から外れるため必須の処理。
*/
function rebaseSourceMap(text, baseDir, label) {
	const map = parseSourceMap(text, label);
	const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
	map.sources = map.sources.map((source) => rebaseSource(source, baseDir, sourceRoot, label));
	delete map.sourceRoot;
	return JSON.stringify(map);
}
async function exists(file) {
	try {
		await (0, node_fs_promises.access)(file);
		return true;
	} catch {
		return false;
	}
}
async function readStagedMap(dir, reference) {
	if (reference !== "main.js.map") throw new Error("prepared main.js must reference main.js.map but references " + reference);
	const file = node_path.default.join(dir, SOURCE_MAP_FILE);
	if (!await exists(file)) throw new Error("prepared main.js references a missing main.js.map");
	return (0, node_fs_promises.readFile)(file, "utf8");
}
/**
* 準備済み dir の source map を検査する。sources は file: の絶対 URL で、
* sourcesContent が無い source は実ファイルが存在する必要がある。
*/
async function assertSourceMapResolvable(dir) {
	const reference = findSourceMapReference(await (0, node_fs_promises.readFile)(node_path.default.join(dir, "main.js"), "utf8"));
	if (reference === null) return;
	const map = parseSourceMap(decodeInlineSourceMap(reference) ?? await readStagedMap(dir, reference), "prepared main.js");
	const contents = Array.isArray(map.sourcesContent) ? map.sourcesContent : [];
	for (const [index, source] of map.sources.entries()) {
		if (typeof source !== "string" || !source.startsWith("file:")) throw new Error("prepared source map must use absolute file: sources, found " + String(source));
		if (typeof contents[index] === "string") continue;
		const file = (0, node_url.fileURLToPath)(source);
		if (!await exists(file)) throw new Error("prepared source map references a missing source: " + file);
	}
}
//#endregion
//#region src/preparePlugin.ts
const LEGACY_PREPARED_FILES = [
	"main.js",
	"manifest.json",
	"styles.css",
	"main.js.map"
];
function resolveInput(input) {
	const resolved = {
		manifest: node_path.default.resolve(input.manifest),
		main: node_path.default.resolve(input.main)
	};
	if (input.styles !== void 0) resolved.styles = node_path.default.resolve(input.styles);
	if (input.sourceMap !== void 0) resolved.sourceMap = node_path.default.resolve(input.sourceMap);
	return resolved;
}
async function assertFile(file, label, requireContent) {
	let info;
	try {
		info = await (0, node_fs_promises.stat)(file);
	} catch {
		throw new Error(label + " file not found: " + file);
	}
	if (!info.isFile()) throw new Error(label + " is not a file: " + file);
	if (requireContent && info.size === 0) throw new Error(label + " is empty: " + file);
}
function sidecarBundle(bundle, mapText, mapBase, label) {
	return {
		main: replaceSourceMapReference(bundle, SOURCE_MAP_FILE),
		sourceMap: rebaseSourceMap(mapText, mapBase, label)
	};
}
async function prepareBundle(resolved) {
	const bundle = await (0, node_fs_promises.readFile)(resolved.main, "utf8");
	if (resolved.sourceMap !== void 0) return sidecarBundle(bundle, await (0, node_fs_promises.readFile)(resolved.sourceMap, "utf8"), node_path.default.dirname(resolved.sourceMap), resolved.sourceMap);
	const reference = findSourceMapReference(bundle);
	if (reference === null) return { main: bundle };
	const inline = decodeInlineSourceMap(reference);
	if (inline !== null) return { main: replaceSourceMapReference(bundle, encodeInlineSourceMap(rebaseSourceMap(inline, node_path.default.dirname(resolved.main), resolved.main))) };
	const mapFile = node_path.default.resolve(node_path.default.dirname(resolved.main), reference);
	let mapText;
	try {
		mapText = await (0, node_fs_promises.readFile)(mapFile, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(resolved.main + " references a source map that does not exist: " + mapFile + ". Pass sourceMap or rebuild with sourcemap enabled.");
		throw error;
	}
	return sidecarBundle(bundle, mapText, node_path.default.dirname(mapFile), mapFile);
}
async function listUnknownEntries(dir, entries) {
	const unknown = [];
	for (const name of entries) {
		const info = await (0, node_fs_promises.lstat)(node_path.default.join(dir, name));
		if (!LEGACY_PREPARED_FILES.includes(name) || !info.isFile()) unknown.push(name);
	}
	return unknown;
}
async function assertReplaceable(target) {
	const inspection = await require_targets.inspectDestination(target);
	if (inspection.state !== "populated") return;
	if (await require_targets.readPreparedPluginMarker(target) !== null) return;
	const unknown = await listUnknownEntries(target, inspection.entries);
	if (unknown.length > 0) throw new Error("refusing to replace " + target + ": it has no toolkit marker and contains files toolkit did not create (" + unknown.join(", ") + ")");
}
async function writePreparedMarker(dir, id, projectRoot, files) {
	const record = {
		owner: require_targets.TOOLKIT_MARKER_OWNER,
		version: 1,
		kind: "prepared-plugin",
		id,
		projectRoot,
		files,
		preparedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	await (0, node_fs_promises.writeFile)(node_path.default.join(dir, require_targets.PREPARED_PLUGIN_MARKER), JSON.stringify(record, null, 4) + "\n", "utf8");
}
/**
* 分散したビルド成果物を1つの plugin dir にまとめる。
* source map は元の場所基準の絶対 file URL に書き換え、必須ファイルと source の解決可否を
* staging 上で検査してから dest を置き換える。
*/
async function preparePlugin(input, dest) {
	const resolved = resolveInput(input);
	const manifest = await require_targets.readManifestIdentity(resolved.manifest);
	await assertFile(resolved.main, "main", true);
	if (resolved.styles !== void 0) await assertFile(resolved.styles, "styles", false);
	if (resolved.sourceMap !== void 0) await assertFile(resolved.sourceMap, "sourceMap", true);
	const target = node_path.default.resolve(dest);
	require_targets.assertUsableDirectory(target);
	for (const source of [
		resolved.manifest,
		resolved.main,
		resolved.styles,
		resolved.sourceMap
	]) if (source !== void 0 && require_targets.isSameOrInside(source, target)) throw new Error("refusing to prepare into " + target + " because it contains the source file " + source);
	await assertReplaceable(target);
	const bundle = await prepareBundle(resolved);
	const projectRoot = node_path.default.dirname(resolved.manifest);
	await (0, node_fs_promises.mkdir)(node_path.default.dirname(target), { recursive: true });
	const staging = require_targets.tempSiblingPath(target, "staging");
	try {
		await (0, node_fs_promises.mkdir)(staging);
		await (0, node_fs_promises.copyFile)(resolved.manifest, node_path.default.join(staging, "manifest.json"));
		await (0, node_fs_promises.writeFile)(node_path.default.join(staging, "main.js"), bundle.main, "utf8");
		const files = ["manifest.json", "main.js"];
		if (bundle.sourceMap !== void 0) {
			await (0, node_fs_promises.writeFile)(node_path.default.join(staging, SOURCE_MAP_FILE), bundle.sourceMap, "utf8");
			files.push(SOURCE_MAP_FILE);
		}
		if (resolved.styles !== void 0) {
			await (0, node_fs_promises.copyFile)(resolved.styles, node_path.default.join(staging, "styles.css"));
			files.push("styles.css");
		}
		await assertSourceMapResolvable(staging);
		await writePreparedMarker(staging, manifest.id, projectRoot, files);
		await require_targets.promoteDirectory(staging, target);
	} catch (error) {
		await require_targets.removeTempDirectory(staging, target, "staging");
		throw error;
	}
	return target;
}
//#endregion
//#region src/preparePlugins.ts
const logger$1 = require_targets.createScopedLogger("preparePlugins");
const FOLDER_NAME = /^[A-Za-z0-9._-]+$/;
function assertFolderName(pluginId) {
	if (!FOLDER_NAME.test(pluginId) || pluginId === "." || pluginId === "..") throw new TypeError("plugin key must be a folder name: " + JSON.stringify(pluginId));
}
/**
* sources の各 plugin を baseDir/destDir/<key> に取得して配置する。
* 1件でも失敗したら、すべての失敗を1つのエラーにまとめて投げる。
* key は配置先の folder 名であり、manifest.id と一致させる必要はない。
*/
async function preparePlugins(sources, baseDir, opts = {}) {
	const root = node_path.default.resolve(baseDir);
	const destRoot = node_path.default.resolve(root, opts.destDir ?? "myfiles");
	if (destRoot === root || !require_targets.isSameOrInside(destRoot, root)) throw new Error("destDir must be a directory inside baseDir: " + destRoot);
	const prepared = {};
	const failures = [];
	for (const [pluginId, value] of Object.entries(sources)) try {
		assertFolderName(pluginId);
		const source = normalizePluginSource(value);
		const fallbackToGit = opts.fallbackToGit ?? source.tag !== void 0;
		logger$1.info("preparing " + pluginId + " from " + source.repo + (source.tag ? "@" + source.tag : ""));
		prepared[pluginId] = await fetchPlugin(source.repo, node_path.default.join(destRoot, pluginId), {
			tag: source.tag,
			cache: opts.cache,
			fallbackToGit
		});
	} catch (error) {
		failures.push("- " + pluginId + ": " + require_targets.errorMessage(error));
	}
	if (failures.length > 0) throw new Error("Failed to prepare external plugins:\n" + failures.join("\n"));
	return prepared;
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
const logger = loglevel.default.getLogger("obsidianSetup");
/** Attach a screenshot and the visible DOM of the Obsidian window to a failed test. */
async function attachFailureArtifacts(testInfo, page) {
	if (!page || testInfo.status === "passed" || testInfo.status === "skipped") return;
	try {
		await testInfo.attach("obsidian-screenshot", {
			body: await page.screenshot(),
			contentType: "image/png"
		});
		await testInfo.attach("obsidian-dom", {
			body: await page.content(),
			contentType: "text/html"
		});
	} catch (err) {
		logger.warn(`Could not capture failure artifacts: ${err?.message ?? err}`);
	}
}
const test = _playwright_test.test.extend({
	tempDir: async ({}, use) => {
		const dir = await fs_promises.default.mkdtemp(path.default.join(os.default.tmpdir(), "obsidian-e2e-"));
		await use(dir);
		await fs_promises.default.rm(dir, {
			recursive: true,
			force: true
		}).catch(() => {});
		await fs_promises.default.rm(`${dir}-vault`, {
			recursive: true,
			force: true
		}).catch(() => {});
	},
	vaultOptions: [DEFAULT_VAULT_OPTIONS, { option: true }],
	coverageOptions: [{ enabled: false }, { option: true }],
	page: async ({ obsidian }, use) => {
		await use(obsidian.page);
	},
	obsidian: async ({ vaultOptions, coverageOptions, tempDir }, use, testInfo) => {
		const paths = getResolvedPaths();
		const runId = require_targets.createRunId(testInfo.title);
		const runLogger = require_targets.createScopedLogger("obsidianSetup", {
			runId,
			phase: "fixture"
		});
		const options = resolveVaultOptions(vaultOptions);
		const coverage = coverageOptions.enabled ? await PluginCoverageCollector.create(coverageOptions, options.plugins.map((plugin) => plugin.path)) : void 0;
		const launcher = new ObsidianE2ELauncher({
			paths,
			options,
			coverage,
			tempUserDataDir: tempDir,
			runId
		});
		const mainLogPath = getElectronMainLogPath(tempDir);
		const stopMainLogging = forwardElectronMainLogs(mainLogPath, require_targets.createScopedLogger("ElectronMain", {
			runId,
			phase: "main"
		}));
		let api;
		try {
			require_targets.toggleLoggerBy(vaultOptions.logLevel || "warn");
			runLogger.info("Launching Obsidian and creating context");
			const context = await createObsidianContext(launcher);
			runLogger.debug("Configuring browser console logging");
			if (vaultOptions.enableBrowserConsoleLogging) require_targets.setupBrowserConsoleLogging(context.page, {
				scope: {
					runId,
					phase: "browser"
				},
				options: vaultOptions.browserConsoleLogging
			});
			api = new ObsidianAPI(context);
			runLogger.info("Entering test body");
			await use(api);
			runLogger.info("Test body completed");
			handleTestError(testInfo);
			await attachFailureArtifacts(testInfo, context.page);
		} catch (err) {
			runLogger.error(`Error during test execution: ${err.message || err}`);
			if (!process.env.CI) {}
			throw err;
		} finally {
			runLogger.info("Cleaning up Obsidian");
			try {
				try {
					try {
						await api?.restoreReloadInterceptors();
					} finally {
						if (coverage) {
							const coveragePath = await coverage.save(testInfo.testId);
							await testInfo.attach("obsidian-plugin-coverage", {
								path: coveragePath,
								contentType: "application/json"
							});
						}
					}
				} finally {
					await launcher.cleanup();
					runLogger.info("Cleanup completed");
				}
			} finally {
				stopMainLogging();
				try {
					await testInfo.attach("obsidian-electron-main-log", {
						path: mainLogPath,
						contentType: "application/x-ndjson"
					});
				} catch (error) {
					if (error.code !== "ENOENT") runLogger.warn(`Could not attach Electron main log: ${String(error)}`);
				}
			}
		}
	}
});
//#endregion
exports.ObsidianAPI = ObsidianAPI;
exports.defineObsidianConfig = defineObsidianConfig;
Object.defineProperty(exports, "expect", {
	enumerable: true,
	get: function() {
		return _playwright_test.expect;
	}
});
exports.fetchPlugin = fetchPlugin;
exports.logger = logger;
exports.preparePlugin = preparePlugin;
exports.preparePlugins = preparePlugins;
exports.test = test;

//# sourceMappingURL=index.cjs.map