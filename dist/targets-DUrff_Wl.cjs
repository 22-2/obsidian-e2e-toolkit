//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
let chalk = require("chalk");
chalk = __toESM(chalk, 1);
let loglevel = require("loglevel");
loglevel = __toESM(loglevel, 1);
let loglevel_plugin_prefix = require("loglevel-plugin-prefix");
loglevel_plugin_prefix = __toESM(loglevel_plugin_prefix, 1);
let node_path = require("node:path");
node_path = __toESM(node_path, 1);
let node_crypto = require("node:crypto");
let node_fs_promises = require("node:fs/promises");
let node_url = require("node:url");
//#region src/internal/logger.ts
const colors = {
	TRACE: chalk.default.magenta,
	DEBUG: chalk.default.cyan,
	INFO: chalk.default.blue,
	WARN: chalk.default.yellow,
	ERROR: chalk.default.red
};
loglevel_plugin_prefix.default.reg(loglevel.default);
loglevel_plugin_prefix.default.apply(loglevel.default, { format(level, name, timestamp) {
	const color = colors[level.toUpperCase()] || chalk.default.white;
	const paddedLevel = level.toUpperCase().padEnd(5, " ");
	const nameStr = name ? `[${name}]` : "";
	return `${chalk.default.gray(`[${timestamp}]`)} ${color(paddedLevel)} ${chalk.default.green(nameStr)}`;
} });
loglevel.default.setDefaultLevel("warn");
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
	const scoped = loglevel.default.getLogger(name);
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
		const method = shouldDemoteError(type, abbreviated, demoteErrorPatterns) ? "warn" : toLogMethod(type);
		browserLogger[method](`[BROWSER:${type.toUpperCase()}] ${abbreviated}`);
		const location = msg.location();
		if (options.includeLocation && location.url && location.url !== "about:blank") browserLogger.debug(`[BROWSER:LOCATION] ${location.url}:${location.lineNumber}:${location.columnNumber}`);
	});
	window.on("pageerror", (error) => {
		if (!options.includePageErrors) return;
		const method = shouldDemoteError("pageerror", error.message, demoteErrorPatterns) ? "warn" : "error";
		browserLogger[method](`[BROWSER:PAGEERROR] ${error.message}`);
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
	Object.values(loglevel.default.getLoggers()).filter((logger) => filter(logger.name)).forEach((logger) => {
		logger.setLevel(level);
	});
	loglevel.default.setLevel(level);
}
//#endregion
//#region src/internal/pluginDirectory.ts
const logger = createScopedLogger("pluginDirectory");
const TOOLKIT_MARKER_OWNER = "obsidian-e2e-toolkit";
const TOOLKIT_SOURCE_MARKER = ".obsidian-e2e-plugin-source.json";
const PREPARED_PLUGIN_MARKER = ".obsidian-e2e-prepared-plugin.json";
const LEGACY_LAZY_SOURCE_MARKER = ".lazy-plugin-source.json";
const MARKER_VERSION = 1;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
function isNotFound(error) {
	return error.code === "ENOENT";
}
function nullableString(value) {
	return typeof value === "string" ? value : null;
}
async function readJsonIfExists(file) {
	let text;
	try {
		text = await (0, node_fs_promises.readFile)(file, "utf8");
	} catch (error) {
		if (isNotFound(error)) return void 0;
		throw error;
	}
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
async function readSourceMarker(dir) {
	const toolkit = await readJsonIfExists(node_path.default.join(dir, TOOLKIT_SOURCE_MARKER));
	if (isRecord(toolkit) && toolkit.owner === "obsidian-e2e-toolkit" && typeof toolkit.repo === "string") return {
		kind: "toolkit",
		repo: toolkit.repo,
		tag: nullableString(toolkit.tag),
		resolvedTag: nullableString(toolkit.resolvedTag)
	};
	const legacy = await readJsonIfExists(node_path.default.join(dir, LEGACY_LAZY_SOURCE_MARKER));
	if (isRecord(legacy) && typeof legacy.repo === "string") return {
		kind: "legacy-lazy",
		repo: legacy.repo,
		tag: nullableString(legacy.tag)
	};
	return null;
}
async function writeSourceMarker(dir, input) {
	const record = {
		owner: TOOLKIT_MARKER_OWNER,
		version: MARKER_VERSION,
		repo: input.repo,
		tag: input.tag,
		resolvedTag: input.resolvedTag,
		method: input.method,
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	await (0, node_fs_promises.writeFile)(node_path.default.join(dir, TOOLKIT_SOURCE_MARKER), JSON.stringify(record, null, 4) + "\n", "utf8");
}
function isNonEmptyString(value) {
	return typeof value === "string" && value.length > 0;
}
async function readManifestIdentity(file) {
	let parsed;
	try {
		parsed = JSON.parse(await (0, node_fs_promises.readFile)(file, "utf8"));
	} catch (error) {
		throw new Error("manifest.json is not readable JSON (" + file + "): " + errorMessage(error));
	}
	const record = isRecord(parsed) ? parsed : {};
	const id = record.id;
	const version = record.version;
	if (!isNonEmptyString(id) || !isNonEmptyString(version)) throw new Error("manifest.json must contain string id and version: " + file);
	return {
		id,
		version
	};
}
async function readPreparedPluginMarker(dir) {
	const file = node_path.default.join(dir, PREPARED_PLUGIN_MARKER);
	let text;
	try {
		text = await (0, node_fs_promises.readFile)(file, "utf8");
	} catch (error) {
		if (isNotFound(error)) return null;
		throw error;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error("prepared plugin marker is not valid JSON: " + file);
	}
	const record = isRecord(parsed) ? parsed : {};
	const id = record.id;
	const projectRoot = record.projectRoot;
	if (!(record.owner === "obsidian-e2e-toolkit" && record.kind === "prepared-plugin") || !isNonEmptyString(id) || !isNonEmptyString(projectRoot) || !node_path.default.isAbsolute(projectRoot)) throw new Error("invalid prepared plugin marker (requires id and an absolute projectRoot): " + file);
	return {
		id,
		projectRoot,
		files: Array.isArray(record.files) ? record.files.filter((name) => typeof name === "string") : []
	};
}
function isSameOrInside(child, parent) {
	const relative = node_path.default.relative(parent, child);
	if (relative === "") return true;
	return relative !== ".." && !relative.startsWith(".." + node_path.default.sep) && !node_path.default.isAbsolute(relative);
}
function assertUsableDirectory(dest) {
	if (node_path.default.dirname(dest) === dest || node_path.default.basename(dest) === "") throw new Error("refusing to use a filesystem root as a plugin directory: " + dest);
}
function tempSiblingPath(dest, label) {
	return node_path.default.join(node_path.default.dirname(dest), node_path.default.basename(dest) + "." + label + "-" + (0, node_crypto.randomBytes)(6).toString("hex"));
}
async function lstatIfExists(file) {
	try {
		return await (0, node_fs_promises.lstat)(file);
	} catch (error) {
		if (isNotFound(error)) return null;
		throw error;
	}
}
async function inspectDestination(dest) {
	const info = await lstatIfExists(dest);
	if (info === null) return {
		state: "absent",
		entries: []
	};
	if (info.isSymbolicLink()) throw new Error("refusing to replace a symbolic link: " + dest);
	if (!info.isDirectory()) throw new Error("destination exists and is not a directory: " + dest);
	const entries = await (0, node_fs_promises.readdir)(dest);
	return {
		state: entries.length === 0 ? "empty" : "populated",
		entries
	};
}
async function removeTempDirectory(temp, dest, label) {
	const prefix = node_path.default.basename(dest) + "." + label + "-";
	if (node_path.default.dirname(temp) !== node_path.default.dirname(dest) || !node_path.default.basename(temp).startsWith(prefix)) throw new Error("refusing to remove an unexpected path: " + temp);
	await (0, node_fs_promises.rm)(temp, {
		recursive: true,
		force: true
	});
}
async function promoteDirectory(staging, dest) {
	const hadDestination = await lstatIfExists(dest) !== null;
	const backup = tempSiblingPath(dest, "previous");
	if (hadDestination) await (0, node_fs_promises.rename)(dest, backup);
	try {
		await (0, node_fs_promises.rename)(staging, dest);
	} catch (error) {
		if (hadDestination) await (0, node_fs_promises.rename)(backup, dest).catch((restoreError) => {
			logger.error("could not restore " + dest + " from " + backup + ": " + errorMessage(restoreError));
		});
		throw error;
	}
	if (hadDestination) await removeTempDirectory(backup, dest, "previous").catch((cleanupError) => {
		logger.warn("could not remove previous copy " + backup + ": " + errorMessage(cleanupError));
	});
}
//#endregion
//#region src/internal/coverage/targets.ts
async function resolveCoverageRoot(stagedRoot, pluginId) {
	const prepared = await readPreparedPluginMarker(stagedRoot);
	if (prepared === null) return stagedRoot;
	if (prepared.id !== pluginId) throw new Error("Prepared plugin marker id " + prepared.id + " does not match manifest id " + pluginId + ": " + stagedRoot);
	try {
		await (0, node_fs_promises.stat)(prepared.projectRoot);
	} catch {
		throw new Error("Prepared plugin project folder is missing: " + prepared.projectRoot);
	}
	return prepared.projectRoot;
}
async function readCoverageTarget(pluginPath) {
	const root = node_path.default.resolve(pluginPath);
	const manifest = JSON.parse(await (0, node_fs_promises.readFile)(node_path.default.join(root, "manifest.json"), "utf8"));
	if (typeof manifest.id !== "string" || !manifest.id) throw new Error(`Coverage plugin manifest is missing its id: ${root}`);
	const coverageRoot = await resolveCoverageRoot(root, manifest.id);
	const bundle = await (0, node_fs_promises.readFile)(node_path.default.join(root, "main.js"), "utf8");
	const mapMatch = bundle.match(/^\/\/[#@] sourceMappingURL=([^\r\n]+)$/m);
	const reference = mapMatch?.[1].trim() ?? "main.js.map";
	const inline = reference.match(/^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/);
	const mapPath = inline ? node_path.default.join(root, "main.js") : node_path.default.resolve(root, reference);
	let rawMap;
	try {
		rawMap = inline ? Buffer.from(inline[1], "base64").toString("utf8") : await (0, node_fs_promises.readFile)(mapPath, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(`Coverage requires a source map for ${manifest.id}. Build main.js with sourcemap: "inline" or "external".`);
		throw error;
	}
	const sourceMap = JSON.parse(rawMap);
	if (sourceMap.version !== 3 || !Array.isArray(sourceMap.sources) || typeof sourceMap.mappings !== "string") throw new Error(`Invalid source map for ${manifest.id}`);
	sourceMap.sources = sourceMap.sources.map((source) => source.startsWith("file:") ? (0, node_url.fileURLToPath)(source) : node_path.default.resolve(node_path.default.dirname(mapPath), sourceMap.sourceRoot ?? "", source));
	sourceMap.sourcesContent = await Promise.all(sourceMap.sources.map((source, index) => sourceMap.sourcesContent?.[index] ?? (0, node_fs_promises.readFile)(source, "utf8")));
	delete sourceMap.sourceRoot;
	return {
		pluginId: manifest.id,
		root: coverageRoot,
		code: (mapMatch ? bundle.replace(mapMatch[0], "") : bundle).trimEnd(),
		sourceMap
	};
}
function isTargetScript(url, target) {
	return url === `plugin:${target.pluginId}` || url.replaceAll("\\", "/").endsWith(`/plugins/${target.pluginId}/main.js`);
}
//#endregion
Object.defineProperty(exports, "PREPARED_PLUGIN_MARKER", {
	enumerable: true,
	get: function() {
		return PREPARED_PLUGIN_MARKER;
	}
});
Object.defineProperty(exports, "TOOLKIT_MARKER_OWNER", {
	enumerable: true,
	get: function() {
		return TOOLKIT_MARKER_OWNER;
	}
});
Object.defineProperty(exports, "__toESM", {
	enumerable: true,
	get: function() {
		return __toESM;
	}
});
Object.defineProperty(exports, "assertUsableDirectory", {
	enumerable: true,
	get: function() {
		return assertUsableDirectory;
	}
});
Object.defineProperty(exports, "createRunId", {
	enumerable: true,
	get: function() {
		return createRunId;
	}
});
Object.defineProperty(exports, "createScopedLogger", {
	enumerable: true,
	get: function() {
		return createScopedLogger;
	}
});
Object.defineProperty(exports, "errorMessage", {
	enumerable: true,
	get: function() {
		return errorMessage;
	}
});
Object.defineProperty(exports, "inspectDestination", {
	enumerable: true,
	get: function() {
		return inspectDestination;
	}
});
Object.defineProperty(exports, "isRecord", {
	enumerable: true,
	get: function() {
		return isRecord;
	}
});
Object.defineProperty(exports, "isSameOrInside", {
	enumerable: true,
	get: function() {
		return isSameOrInside;
	}
});
Object.defineProperty(exports, "isTargetScript", {
	enumerable: true,
	get: function() {
		return isTargetScript;
	}
});
Object.defineProperty(exports, "promoteDirectory", {
	enumerable: true,
	get: function() {
		return promoteDirectory;
	}
});
Object.defineProperty(exports, "readCoverageTarget", {
	enumerable: true,
	get: function() {
		return readCoverageTarget;
	}
});
Object.defineProperty(exports, "readManifestIdentity", {
	enumerable: true,
	get: function() {
		return readManifestIdentity;
	}
});
Object.defineProperty(exports, "readPreparedPluginMarker", {
	enumerable: true,
	get: function() {
		return readPreparedPluginMarker;
	}
});
Object.defineProperty(exports, "readSourceMarker", {
	enumerable: true,
	get: function() {
		return readSourceMarker;
	}
});
Object.defineProperty(exports, "removeTempDirectory", {
	enumerable: true,
	get: function() {
		return removeTempDirectory;
	}
});
Object.defineProperty(exports, "setupBrowserConsoleLogging", {
	enumerable: true,
	get: function() {
		return setupBrowserConsoleLogging;
	}
});
Object.defineProperty(exports, "tempSiblingPath", {
	enumerable: true,
	get: function() {
		return tempSiblingPath;
	}
});
Object.defineProperty(exports, "toggleLoggerBy", {
	enumerable: true,
	get: function() {
		return toggleLoggerBy;
	}
});
Object.defineProperty(exports, "writeSourceMarker", {
	enumerable: true,
	get: function() {
		return writeSourceMarker;
	}
});

//# sourceMappingURL=targets-DUrff_Wl.cjs.map