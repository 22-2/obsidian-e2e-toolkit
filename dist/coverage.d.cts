import { a as CoverageTotals, i as CoverageSummary, n as CoverageReportOptions, r as CoverageReporterOptions, t as CoverageOptions } from "./types-DsGkhM3S.cjs";
import { FullResult, Reporter } from "@playwright/test/reporter";
//#region src/coverage.d.ts
export interface MergeCoverageReportOptions extends CoverageReportOptions {
  /** Istanbul coverage-final.json files, including Vitest's JSON reporter. */
  inputFiles: readonly string[];
}
export declare function mergeCoverageReports(options: MergeCoverageReportOptions): Promise<CoverageSummary>;
export declare function resetCoverageOutput(outputDir?: string): Promise<void>;
export declare function generateCoverageReport(options?: CoverageReportOptions): Promise<CoverageSummary>;
export declare class CoverageReporter implements Reporter {
  private readonly options;
  constructor(options?: CoverageReporterOptions);
  onBegin(): void;
  onEnd(result: FullResult): Promise<void | {
    status: FullResult["status"];
  }>;
  printsToStdio(): boolean;
}
//#endregion
export { type CoverageOptions, type CoverageReportOptions, CoverageReporter as default, type CoverageReporterOptions, type CoverageSummary, type CoverageTotals };
//# sourceMappingURL=coverage.d.cts.map