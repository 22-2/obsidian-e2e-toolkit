import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { Page } from "playwright";
import { isTargetScript, readCoverageTarget } from "./targets";
import type { CoverageEntry, CoverageOptions, CoverageTarget, RawCoverage } from "./types";

export class PluginCoverageCollector {
    private readonly pages = new Map<Page, Promise<void>>();
    private readonly entries: CoverageEntry[] = [];

    private constructor(private readonly targets: CoverageTarget[], private readonly outputDir: string) {}

    static async create(options: CoverageOptions, fallbackPaths: readonly string[]): Promise<PluginCoverageCollector> {
        const paths = [...new Set((options.pluginPaths ?? fallbackPaths).map((value) => path.resolve(value)))];
        if (!paths.length) throw new Error("Coverage requires pluginPaths or vaultOptions.plugins.");
        const targets = await Promise.all(paths.map(readCoverageTarget));
        if (new Set(targets.map((target) => target.pluginId)).size !== targets.length) {
            throw new Error("Coverage pluginPaths contain duplicate plugin ids.");
        }
        return new PluginCoverageCollector(targets, path.resolve(options.outputDir ?? "coverage/e2e"));
    }

    async start(page: Page): Promise<void> {
        let started = this.pages.get(page);
        if (!started) {
            started = page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: false });
            this.pages.set(page, started);
        }
        await started;
    }

    async collect(page: Page): Promise<void> {
        const started = this.pages.get(page);
        if (!started) return;
        await started;
        if (page.isClosed()) throw new Error("Obsidian window closed before plugin coverage could be collected.");
        const entries = await page.coverage.stopJSCoverage();
        this.entries.push(...entries.filter((entry) => this.targets.some((target) => isTargetScript(entry.url, target))));
        this.pages.delete(page);
    }

    async checkpoint(page: Page): Promise<void> {
        await this.collect(page);
        await this.start(page);
    }

    async save(testId: string): Promise<string> {
        await Promise.all([...this.pages.keys()].map((page) => this.collect(page)));
        const directory = path.join(this.outputDir, "raw");
        await mkdir(directory, { recursive: true });
        // Each test/retry owns a file; workers never append to shared JSON.
        const filename = path.join(directory, `${randomUUID()}.json`);
        const raw: RawCoverage & { testId: string } = { version: 1, testId, targets: this.targets, entries: this.entries };
        await writeFile(filename, JSON.stringify(raw));
        return filename;
    }
}
