Object.defineProperties(exports, {
	__esModule: { value: true },
	[Symbol.toStringTag]: { value: "Module" }
});
const require_targets = require("./targets-DUrff_Wl.cjs");
let node_path = require("node:path");
node_path = require_targets.__toESM(node_path, 1);
let node_fs_promises = require("node:fs/promises");
let node_url = require("node:url");
let node_fs = require("node:fs");
let acorn = require("acorn");
let ast_v8_to_istanbul = require("ast-v8-to-istanbul");
let istanbul_lib_coverage = require("istanbul-lib-coverage");
istanbul_lib_coverage = require_targets.__toESM(istanbul_lib_coverage, 1);
let istanbul_lib_report = require("istanbul-lib-report");
istanbul_lib_report = require_targets.__toESM(istanbul_lib_report, 1);
let istanbul_reports = require("istanbul-reports");
istanbul_reports = require_targets.__toESM(istanbul_reports, 1);
//#region src/internal/coverage/merge.ts
function locationKey(location) {
	return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}
/** Preserve source locations when different compilers emit different coverage maps. */
function mergeIstanbulCoverage(inputs) {
	const files = /* @__PURE__ */ new Map();
	for (const input of inputs) {
		const inputMap = istanbul_lib_coverage.default.createCoverageMap(input);
		for (const filename of inputMap.files()) {
			const source = inputMap.fileCoverageFor(filename).data;
			const filenameKey = node_path.default.resolve(source.path);
			const target = files.get(filenameKey) ?? istanbul_lib_coverage.default.createFileCoverage(filenameKey).data;
			files.set(filenameKey, target);
			const statements = new Map(Object.entries(target.statementMap).map(([id, location]) => [locationKey(location), id]));
			for (const [sourceId, location] of Object.entries(source.statementMap)) {
				const key = locationKey(location);
				let id = statements.get(key);
				if (id === void 0) {
					id = String(statements.size);
					statements.set(key, id);
					target.statementMap[id] = location;
					target.s[id] = 0;
				}
				target.s[id] += source.s[sourceId];
			}
			const functions = new Map(Object.entries(target.fnMap).map(([id, fn]) => [locationKey(fn.loc), id]));
			for (const [sourceId, fn] of Object.entries(source.fnMap)) {
				const key = locationKey(fn.loc);
				let id = functions.get(key);
				if (id === void 0) {
					id = String(functions.size);
					functions.set(key, id);
					target.fnMap[id] = fn;
					target.f[id] = 0;
				}
				target.f[id] += source.f[sourceId];
			}
			const branchKey = (branch) => JSON.stringify([branch.type, branch.locations.map(locationKey)]);
			const branches = new Map(Object.entries(target.branchMap).map(([id, branch]) => [branchKey(branch), id]));
			for (const [sourceId, branch] of Object.entries(source.branchMap)) {
				const key = branchKey(branch);
				let id = branches.get(key);
				if (id === void 0) {
					id = String(branches.size);
					branches.set(key, id);
					target.branchMap[id] = branch;
					target.b[id] = branch.locations.map(() => 0);
				}
				branch.locations.forEach((_, index) => {
					target.b[id][index] += source.b[sourceId][index];
				});
				if (source.bT?.[sourceId]) {
					target.bT ??= {};
					target.bT[id] ??= branch.locations.map(() => 0);
					branch.locations.forEach((_, index) => {
						target.bT[id][index] += source.bT[sourceId][index];
					});
				}
			}
		}
	}
	return istanbul_lib_coverage.default.createCoverageMap(Object.fromEntries(files));
}
//#endregion
//#region src/coverage.ts
function writeReport(coverageMap, options, sourceContents) {
	const context = istanbul_lib_report.default.createContext({
		dir: node_path.default.resolve(options.outputDir ?? "coverage/e2e"),
		coverageMap,
		sourceFinder: (filename) => sourceContents?.get(filename) ?? (0, node_fs.readFileSync)(filename, "utf8")
	});
	for (const reporter of options.reporters ?? [
		"text",
		"html",
		"lcov",
		"json"
	]) istanbul_reports.default.create(reporter === "lcov" ? "lcovonly" : reporter).execute(context);
	return coverageMap.getCoverageSummary().toJSON();
}
async function mergeCoverageReports(options) {
	if (!options.inputFiles.length) throw new Error("Coverage merge requires at least one input file.");
	const inputs = [];
	for (const filename of options.inputFiles) inputs.push(JSON.parse(await (0, node_fs_promises.readFile)(node_path.default.resolve(filename), "utf8")));
	return writeReport(mergeIstanbulCoverage(inputs), {
		...options,
		outputDir: options.outputDir ?? "coverage/combined"
	});
}
async function resetCoverageOutput(outputDir = "coverage/e2e") {
	const directory = node_path.default.resolve(outputDir, "raw");
	if (node_path.default.dirname(directory) !== node_path.default.resolve(outputDir)) throw new Error("Invalid coverage output directory.");
	await (0, node_fs_promises.rm)(directory, {
		recursive: true,
		force: true
	});
}
function isProjectSource(filename, target) {
	const resolveRealPath = (value) => {
		try {
			return node_fs.realpathSync.native(value);
		} catch {
			return node_path.default.resolve(value);
		}
	};
	const relative = node_path.default.relative(resolveRealPath(target.root), resolveRealPath(filename)).replaceAll("\\", "/");
	return relative !== ".." && !relative.startsWith("../") && !node_path.default.isAbsolute(relative) && !/(^|\/)(node_modules|tests?|__tests__|__mocks__)(\/|$)/.test(relative) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(relative) && !/\.d\.[cm]?ts$/.test(relative);
}
async function generateCoverageReport(options = {}) {
	const outputDir = node_path.default.resolve(options.outputDir ?? "coverage/e2e");
	const rawDirectory = node_path.default.join(outputDir, "raw");
	let filenames;
	try {
		filenames = (await (0, node_fs_promises.readdir)(rawDirectory)).filter((name) => name.endsWith(".json"));
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(`No coverage results in ${rawDirectory}. Enable coverageOptions on the toolkit test fixture.`);
		throw error;
	}
	if (!filenames.length) throw new Error(`No coverage results in ${rawDirectory}.`);
	const coverageMap = istanbul_lib_coverage.default.createCoverageMap({});
	const baselineTargets = /* @__PURE__ */ new Set();
	const sourceContents = /* @__PURE__ */ new Map();
	for (const filename of filenames) {
		const raw = JSON.parse(await (0, node_fs_promises.readFile)(node_path.default.join(rawDirectory, filename), "utf8"));
		if (raw.version !== 1 || !Array.isArray(raw.targets) || !Array.isArray(raw.entries)) throw new Error(`Invalid coverage result: ${filename}`);
		for (const target of raw.targets) {
			target.sourceMap.sources.forEach((filename, index) => {
				const content = target.sourceMap.sourcesContent[index];
				if (content !== null) sourceContents.set(filename, content);
			});
			const remap = async (functions, wrapperLength = 0) => {
				const converted = await (0, ast_v8_to_istanbul.convert)({
					code: target.code,
					ast: (0, acorn.parse)(target.code, {
						ecmaVersion: "latest",
						sourceType: "module",
						locations: true,
						allowReturnOutsideFunction: true
					}),
					sourceMap: target.sourceMap,
					wrapperLength,
					coverage: {
						url: (0, node_url.pathToFileURL)(node_path.default.join(target.root, "main.js")).href,
						functions
					}
				});
				const map = istanbul_lib_coverage.default.createCoverageMap(converted);
				map.filter((source) => isProjectSource(source, target));
				coverageMap.merge(map);
			};
			const key = JSON.stringify(target);
			if (!baselineTargets.has(key)) {
				await remap([]);
				baselineTargets.add(key);
			}
			for (const entry of raw.entries.filter((entry) => require_targets.isTargetScript(entry.url, target))) {
				const offset = entry.source?.indexOf(target.code) ?? -1;
				if (offset < 0) throw new Error(`Coverage source does not match the captured bundle: ${entry.url}`);
				await remap(entry.functions, offset);
			}
		}
	}
	return writeReport(coverageMap, {
		...options,
		outputDir
	}, sourceContents);
}
var CoverageReporter = class {
	options;
	constructor(options = {}) {
		this.options = options;
	}
	onBegin() {
		if (this.options.enabled !== false && this.options.clean !== false) (0, node_fs.rmSync)(node_path.default.resolve(this.options.outputDir ?? "coverage/e2e", "raw"), {
			recursive: true,
			force: true
		});
	}
	async onEnd(result) {
		if (this.options.enabled === false) return;
		try {
			await generateCoverageReport(this.options);
		} catch (error) {
			console.error(error);
			return { status: result.status === "passed" ? "failed" : result.status };
		}
	}
	printsToStdio() {
		return this.options.enabled !== false;
	}
};
//#endregion
exports.CoverageReporter = CoverageReporter;
exports.default = CoverageReporter;
exports.generateCoverageReport = generateCoverageReport;
exports.mergeCoverageReports = mergeCoverageReports;
exports.resetCoverageOutput = resetCoverageOutput;

//# sourceMappingURL=coverage.cjs.map