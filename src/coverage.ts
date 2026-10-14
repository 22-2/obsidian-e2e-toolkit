import { readdir, readFile, rm } from "node:fs/promises";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "acorn";
import { convert } from "ast-v8-to-istanbul";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";
import type { FullResult, Reporter } from "@playwright/test/reporter";
import { isTargetScript } from "./internal/coverage/targets";
import { mergeIstanbulCoverage } from "./internal/coverage/merge";
import type { CoverageReportOptions, CoverageReporterOptions, CoverageTarget, CoverageSummary, RawCoverage } from "./internal/coverage/types";

export type { CoverageOptions, CoverageReportOptions, CoverageReporterOptions, CoverageSummary, CoverageTotals } from "./internal/coverage/types";

export interface MergeCoverageReportOptions extends CoverageReportOptions {
    /** Istanbul coverage-final.json files, including Vitest's JSON reporter. */
    inputFiles: readonly string[];
}

function writeReport(coverageMap: libCoverage.CoverageMap, options: CoverageReportOptions, sourceContents?: Map<string, string>): CoverageSummary {
    const context = libReport.createContext({
        dir: path.resolve(options.outputDir ?? "coverage/e2e"), coverageMap,
        sourceFinder: (filename) => sourceContents?.get(filename) ?? readFileSync(filename, "utf8"),
    });
    for (const reporter of options.reporters ?? ["text", "html", "lcov", "json"]) {
        reports.create(reporter === "lcov" ? "lcovonly" : reporter).execute(context);
    }
    return coverageMap.getCoverageSummary().toJSON();
}

export async function mergeCoverageReports(options: MergeCoverageReportOptions): Promise<CoverageSummary> {
    if (!options.inputFiles.length) throw new Error("Coverage merge requires at least one input file.");
    const inputs: libCoverage.CoverageMapData[] = [];
    for (const filename of options.inputFiles) {
        inputs.push(JSON.parse(await readFile(path.resolve(filename), "utf8")) as libCoverage.CoverageMapData);
    }
    const coverageMap = mergeIstanbulCoverage(inputs);
    return writeReport(coverageMap, { ...options, outputDir: options.outputDir ?? "coverage/combined" });
}

export async function resetCoverageOutput(outputDir = "coverage/e2e"): Promise<void> {
    // Delete only toolkit-owned raw results, leaving other output files intact.
    const directory = path.resolve(outputDir, "raw");
    if (path.dirname(directory) !== path.resolve(outputDir)) throw new Error("Invalid coverage output directory.");
    await rm(directory, { recursive: true, force: true });
}

function isProjectSource(filename: string, target: CoverageTarget): boolean {
    const relative = path.relative(target.root, filename).replaceAll("\\", "/");
    return relative !== ".." && !relative.startsWith("../") && !path.isAbsolute(relative) &&
        !/(^|\/)(node_modules|tests?|__tests__|__mocks__)(\/|$)/.test(relative) &&
        !/\.(test|spec)\.[cm]?[jt]sx?$/.test(relative) && !/\.d\.[cm]?ts$/.test(relative);
}

export async function generateCoverageReport(options: CoverageReportOptions = {}): Promise<CoverageSummary> {
    const outputDir = path.resolve(options.outputDir ?? "coverage/e2e");
    const rawDirectory = path.join(outputDir, "raw");
    let filenames: string[];
    try {
        filenames = (await readdir(rawDirectory)).filter((name) => name.endsWith(".json"));
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`No coverage results in ${rawDirectory}. Enable coverageOptions on the toolkit test fixture.`);
        throw error;
    }
    if (!filenames.length) throw new Error(`No coverage results in ${rawDirectory}.`);
    const coverageMap = libCoverage.createCoverageMap({});
    const baselineTargets = new Set<string>();
    const sourceContents = new Map<string, string>();
    for (const filename of filenames) {
        const raw = JSON.parse(await readFile(path.join(rawDirectory, filename), "utf8")) as RawCoverage;
        if (raw.version !== 1 || !Array.isArray(raw.targets) || !Array.isArray(raw.entries)) throw new Error(`Invalid coverage result: ${filename}`);
        for (const target of raw.targets) {
            target.sourceMap.sources.forEach((filename, index) => {
                const content = target.sourceMap.sourcesContent[index];
                if (content !== null) sourceContents.set(filename, content);
            });
            const remap = async (functions: RawCoverage["entries"][number]["functions"], wrapperLength = 0) => {
                const converted = await convert({
                    code: target.code,
                    // The converter marks visited nodes, so parse a new AST for each remap.
                    ast: parse(target.code, { ecmaVersion: "latest", sourceType: "module", locations: true, allowReturnOutsideFunction: true }),
                    sourceMap: target.sourceMap,
                    wrapperLength,
                    coverage: { url: pathToFileURL(path.join(target.root, "main.js")).href, functions },
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
    return writeReport(coverageMap, { ...options, outputDir }, sourceContents);
}

export class CoverageReporter implements Reporter {
    constructor(private readonly options: CoverageReporterOptions = {}) {}

    onBegin(): void {
        // Playwright does not await onBegin; finish cleanup before workers start.
        if (this.options.enabled !== false && this.options.clean !== false) {
            rmSync(path.resolve(this.options.outputDir ?? "coverage/e2e", "raw"), { recursive: true, force: true });
        }
    }

    async onEnd(result: FullResult): Promise<void | { status: FullResult["status"] }> {
        if (this.options.enabled === false) return;
        try {
            await generateCoverageReport(this.options);
        } catch (error) {
            console.error(error);
            // A missing report must not turn an already failing run into success.
            return { status: result.status === "passed" ? "failed" : result.status };
        }
    }

    printsToStdio(): boolean { return this.options.enabled !== false; }
}

export default CoverageReporter;
