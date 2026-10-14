import { Page } from "playwright";
//#region src/internal/coverage/types.d.ts
interface CoverageOptions {
  enabled?: boolean;
  /** Folders containing the measured plugins' manifest.json and main.js. */
  pluginPaths?: readonly string[];
  /** Shared by all workers and the coverage reporter. Defaults to coverage/e2e. */
  outputDir?: string;
}
interface CoverageReportOptions {
  outputDir?: string;
  reporters?: readonly ("text" | "html" | "lcov" | "json")[];
}
interface CoverageReporterOptions extends CoverageReportOptions {
  enabled?: boolean;
  /** Disable when appending multiple Playwright invocations to one report. */
  clean?: boolean;
}
interface CoverageTotals {
  total: number;
  covered: number;
  skipped: number;
  pct: number | "Unknown";
}
interface CoverageSummary {
  lines: CoverageTotals;
  statements: CoverageTotals;
  functions: CoverageTotals;
  branches: CoverageTotals;
}
//#endregion
export { CoverageTotals as a, CoverageSummary as i, CoverageReportOptions as n, CoverageReporterOptions as r, CoverageOptions as t };
//# sourceMappingURL=types-DsGkhM3S.d.cts.map