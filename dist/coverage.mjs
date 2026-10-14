import { t as isTargetScript } from "./targets-CtjXYvdw.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, realpathSync, rmSync } from "node:fs";
import { readFile, readdir, rm } from "node:fs/promises";
import { parse } from "acorn";
import { convert } from "ast-v8-to-istanbul";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
//#region src/internal/coverage/merge.ts
function locationKey(location) {
	return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}
/** Preserve source locations when different compilers emit different coverage maps. */
function mergeIstanbulCoverage(inputs) {
	const files = /* @__PURE__ */ new Map();
	for (const input of inputs) {
		const inputMap = libCoverage.createCoverageMap(input);
		for (const filename of inputMap.files()) {
			const source = inputMap.fileCoverageFor(filename).data;
			const filenameKey = path.resolve(source.path);
			const target = files.get(filenameKey) ?? libCoverage.createFileCoverage(filenameKey).data;
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
	return libCoverage.createCoverageMap(Object.fromEntries(files));
}
//#endregion
//#region src/coverage.ts
function writeReport(coverageMap, options, sourceContents) {
	const context = libReport.createContext({
		dir: path.resolve(options.outputDir ?? "coverage/e2e"),
		coverageMap,
		sourceFinder: (filename) => sourceContents?.get(filename) ?? readFileSync(filename, "utf8")
	});
	for (const reporter of options.reporters ?? [
		"text",
		"html",
		"lcov",
		"json"
	]) reports.create(reporter === "lcov" ? "lcovonly" : reporter).execute(context);
	return coverageMap.getCoverageSummary().toJSON();
}
async function mergeCoverageReports(options) {
	if (!options.inputFiles.length) throw new Error("Coverage merge requires at least one input file.");
	const inputs = [];
	for (const filename of options.inputFiles) inputs.push(JSON.parse(await readFile(path.resolve(filename), "utf8")));
	return writeReport(mergeIstanbulCoverage(inputs), {
		...options,
		outputDir: options.outputDir ?? "coverage/combined"
	});
}
async function resetCoverageOutput(outputDir = "coverage/e2e") {
	const directory = path.resolve(outputDir, "raw");
	if (path.dirname(directory) !== path.resolve(outputDir)) throw new Error("Invalid coverage output directory.");
	await rm(directory, {
		recursive: true,
		force: true
	});
}
function isProjectSource(filename, target) {
	const resolveRealPath = (value) => {
		try {
			return realpathSync.native(value);
		} catch {
			return path.resolve(value);
		}
	};
	const relative = path.relative(resolveRealPath(target.root), resolveRealPath(filename)).replaceAll("\\", "/");
	return relative !== ".." && !relative.startsWith("../") && !path.isAbsolute(relative) && !/(^|\/)(node_modules|tests?|__tests__|__mocks__)(\/|$)/.test(relative) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(relative) && !/\.d\.[cm]?ts$/.test(relative);
}
async function generateCoverageReport(options = {}) {
	const outputDir = path.resolve(options.outputDir ?? "coverage/e2e");
	const rawDirectory = path.join(outputDir, "raw");
	let filenames;
	try {
		filenames = (await readdir(rawDirectory)).filter((name) => name.endsWith(".json"));
	} catch (error) {
		if (error.code === "ENOENT") throw new Error(`No coverage results in ${rawDirectory}. Enable coverageOptions on the toolkit test fixture.`);
		throw error;
	}
	if (!filenames.length) throw new Error(`No coverage results in ${rawDirectory}.`);
	const coverageMap = libCoverage.createCoverageMap({});
	const baselineTargets = /* @__PURE__ */ new Set();
	const sourceContents = /* @__PURE__ */ new Map();
	for (const filename of filenames) {
		const raw = JSON.parse(await readFile(path.join(rawDirectory, filename), "utf8"));
		if (raw.version !== 1 || !Array.isArray(raw.targets) || !Array.isArray(raw.entries)) throw new Error(`Invalid coverage result: ${filename}`);
		for (const target of raw.targets) {
			target.sourceMap.sources.forEach((filename, index) => {
				const content = target.sourceMap.sourcesContent[index];
				if (content !== null) sourceContents.set(filename, content);
			});
			const remap = async (functions, wrapperLength = 0) => {
				const converted = await convert({
					code: target.code,
					ast: parse(target.code, {
						ecmaVersion: "latest",
						sourceType: "module",
						locations: true,
						allowReturnOutsideFunction: true
					}),
					sourceMap: target.sourceMap,
					wrapperLength,
					coverage: {
						url: pathToFileURL(path.join(target.root, "main.js")).href,
						functions
					}
				});
				const map = libCoverage.createCoverageMap(converted);
				map.filter((source) => isProjectSource(source, target));
				coverageMap.merge(map);
			};
			const key = JSON.stringify(target);
			if (!baselineTargets.has(key)) {
				await remap([]);
				baselineTargets.add(key);
			}
			for (const entry of raw.entries.filter((entry) => isTargetScript(entry.url, target))) {
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
		if (this.options.enabled !== false && this.options.clean !== false) rmSync(path.resolve(this.options.outputDir ?? "coverage/e2e", "raw"), {
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
export { CoverageReporter, CoverageReporter as default, generateCoverageReport, mergeCoverageReports, resetCoverageOutput };

//# sourceMappingURL=coverage.mjs.map