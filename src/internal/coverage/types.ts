import type { Page } from "playwright";

export interface CoverageOptions {
    enabled?: boolean;
    /** Folders containing the measured plugins' manifest.json and main.js. */
    pluginPaths?: readonly string[];
    /** Shared by all workers and the coverage reporter. Defaults to .e2e/coverage/e2e. */
    outputDir?: string;
}

export interface CoverageReportOptions {
    outputDir?: string;
    reporters?: readonly ("text" | "html" | "lcov" | "json")[];
}

export interface CoverageReporterOptions extends CoverageReportOptions {
    enabled?: boolean;
    /** Disable when appending multiple Playwright invocations to one report. */
    clean?: boolean;
}

export interface CoverageTotals {
    total: number;
    covered: number;
    skipped: number;
    pct: number | "Unknown";
}

export interface CoverageSummary {
    lines: CoverageTotals;
    statements: CoverageTotals;
    functions: CoverageTotals;
    branches: CoverageTotals;
}

export type CoverageEntry = Awaited<ReturnType<Page["coverage"]["stopJSCoverage"]>>[number];

export interface CoverageSourceMap {
    version: number;
    sources: string[];
    sourcesContent: (string | null)[];
    names: string[];
    mappings: string;
}

export interface CoverageTarget {
    pluginId: string;
    root: string;
    code: string;
    sourceMap: CoverageSourceMap;
}

export interface RawCoverage {
    version: 1;
    targets: CoverageTarget[];
    entries: CoverageEntry[];
}

