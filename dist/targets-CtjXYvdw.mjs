import chalk from "chalk";
import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { lstat, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
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
	Object.values(log.getLoggers()).filter((logger) => filter(logger.name)).forEach((logger) => {
		logger.setLevel(level);
	});
	log.setLevel(level);
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
		text = await readFile(file, "utf8");
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
	const toolkit = await readJsonIfExists(path.join(dir, TOOLKIT_SOURCE_MARKER));
	if (isRecord(toolkit) && toolkit.owner === "obsidian-e2e-toolkit" && typeof toolkit.repo === "string") return {
		kind: "toolkit",
		repo: toolkit.repo,
		tag: nullableString(toolkit.tag),
		resolvedTag: nullableString(toolkit.resolvedTag)
	};
	const legacy = await readJsonIfExists(path.join(dir, LEGACY_LAZY_SOURCE_MARKER));
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
	await writeFile(path.join(dir, TOOLKIT_SOURCE_MARKER), JSON.stringify(record, null, 4) + "\n", "utf8");
}
function isNonEmptyString(value) {
	return typeof value === "string" && value.length > 0;
}
async function readManifestIdentity(file) {
	let parsed;
	try {
		parsed = JSON.parse(await readFile(file, "utf8"));
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
	const file = path.join(dir, PREPARED_PLUGIN_MARKER);
	let text;
	try {
		text = await readFile(file, "utf8");
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
	if (!(record.owner === "obsidian-e2e-toolkit" && record.kind === "prepared-plugin") || !isNonEmptyString(id) || !isNonEmptyString(projectRoot) || !path.isAbsolute(projectRoot)) throw new Error("invalid prepared plugin marker (requires id and an absolute projectRoot): " + file);
	return {
		id,
		projectRoot,
		files: Array.isArray(record.files) ? record.files.filter((name) => typeof name === "string") : []
	};
}
function isSameOrInside(child, parent) {
	const relative = path.relative(parent, child);
	if (relative === "") return true;
	return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
function assertUsableDirectory(dest) {
	if (path.dirname(dest) === dest || path.basename(dest) === "") throw new Error("refusing to use a filesystem root as a plugin directory: " + dest);
}
function tempSiblingPath(dest, label) {
	return path.join(path.dirname(dest), path.basename(dest) + "." + label + "-" + randomBytes(6).toString("hex"));
}
async function lstatIfExists(file) {
	try {
		return await lstat(file);
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
	const entries = await readdir(dest);
	return {
		state: entries.length === 0 ? "empty" : "populated",
		entries
	};
}
async function removeTempDirectory(temp, dest, label) {
	const prefix = path.basename(dest) + "." + label + "-";
	if (path.dirname(temp) !== path.dirname(dest) || !path.basename(temp).startsWith(prefix)) throw new Error("refusing to remove an unexpected path: " + temp);
	await rm(temp, {
		recursive: true,
		force: true
	});
}
async function promoteDirectory(staging, dest) {
	const hadDestination = await lstatIfExists(dest) !== null;
	const backup = tempSiblingPath(dest, "previous");
	if (hadDestination) await rename(dest, backup);
	try {
		await rename(staging, dest);
	} catch (error) {
		if (hadDestination) await rename(backup, dest).catch((restoreError) => {
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
		await stat(prepared.projectRoot);
	} catch {
		throw new Error("Prepared plugin project folder is missing: " + prepared.projectRoot);
	}
	return prepared.projectRoot;
}
async function readCoverageTarget(pluginPath) {
	const root = path.resolve(pluginPath);
	const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
	if (typeof manifest.id !== "string" || !manifest.id) throw new Error(`Coverage plugin manifest is missing its id: ${root}`);
	const coverageRoot = await resolveCoverageRoot(root, manifest.id);
	const bundle = await readFile(path.join(root, "main.js"), "utf8");
	const mapMatch = bundle.match(/^\/\/[#@] sourceMappingURL=([^\r\n]+)$/m);
	const reference = mapMatch?.[1].trim() ?? "main.js.map";
	const inline = reference.match(/^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/);
	const mapPath = inline ? path.join(root, "main.js") : path.resolve(root, reference);
	let rawMap;
	try {
		rawMap = inline ? Buffer.from(inline[1], "base64").toString("utf8") : await readFile(mapPath, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(`Coverage requires a source map for ${manifest.id}. Build main.js with sourcemap: "inline" or "external".`);
		throw error;
	}
	const sourceMap = JSON.parse(rawMap);
	if (sourceMap.version !== 3 || !Array.isArray(sourceMap.sources) || typeof sourceMap.mappings !== "string") throw new Error(`Invalid source map for ${manifest.id}`);
	sourceMap.sources = sourceMap.sources.map((source) => source.startsWith("file:") ? fileURLToPath(source) : path.resolve(path.dirname(mapPath), sourceMap.sourceRoot ?? "", source));
	sourceMap.sourcesContent = await Promise.all(sourceMap.sources.map((source, index) => sourceMap.sourcesContent?.[index] ?? readFile(source, "utf8")));
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
export { createRunId as _, assertUsableDirectory as a, toggleLoggerBy as b, isRecord as c, readManifestIdentity as d, readPreparedPluginMarker as f, writeSourceMarker as g, tempSiblingPath as h, TOOLKIT_MARKER_OWNER as i, isSameOrInside as l, removeTempDirectory as m, readCoverageTarget as n, errorMessage as o, readSourceMarker as p, PREPARED_PLUGIN_MARKER as r, inspectDestination as s, isTargetScript as t, promoteDirectory as u, createScopedLogger as v, setupBrowserConsoleLogging as y };

//# sourceMappingURL=targets-CtjXYvdw.mjs.map