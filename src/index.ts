// setup logging as early as possible
import "./internal/logger";

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

import { test as base } from "@playwright/test";
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import { DEFAULT_VAULT_OPTIONS, getResolvedPaths } from "./internal/constants";
import { ObsidianE2ELauncher } from "./internal/launcher";
import {
    createRunId,
    createScopedLogger,
    setupBrowserConsoleLogging,
    toggleLoggerBy,
} from "./internal/logger";
import {
    forwardElectronMainLogs,
    getElectronMainLogPath,
} from "./internal/services/electronMainLogging";
import type { TestFixtures, WorkerFixtures } from "./internal/types";
import { createObsidianContext, handleTestError } from "./internal/utils";
import { resolveVaultOptions } from "./internal/vaultOptions";
import { ObsidianAPI } from "./ObsidianAPI";

export const logger = log.getLogger("obsidianSetup");

/** Attach a screenshot and the visible DOM of the Obsidian window to a failed test. */
async function attachFailureArtifacts(
    testInfo: import("@playwright/test").TestInfo,
    page: import("@playwright/test").Page | undefined,
): Promise<void> {
    if (!page || testInfo.status === "passed" || testInfo.status === "skipped") {
        return;
    }
    try {
        await testInfo.attach("obsidian-screenshot", {
            body: await page.screenshot(),
            contentType: "image/png",
        });
        await testInfo.attach("obsidian-dom", {
            body: await page.content(),
            contentType: "text/html",
        });
    } catch (err: any) {
        logger.warn(`Could not capture failure artifacts: ${err?.message ?? err}`);
    }
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
    tempDir: async ({}, use) => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
        await use(dir);
        // Clean up both user data dir and vault dir
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        await fs
            .rm(`${dir}-vault`, { recursive: true, force: true })
            .catch(() => {});
    },
    vaultOptions: [DEFAULT_VAULT_OPTIONS, { option: true }],
    // 意図: Playwright 標準の別ページではなく、fixture が準備した Obsidian の
    // vault レンダラーを page として渡し、操作先の取り違えを防ぐ。
    page: async ({ obsidian }, use) => {
        await use(obsidian.page);
    },
    obsidian: async ({ vaultOptions, tempDir }, use, testInfo) => {
        const paths = getResolvedPaths();
        const runId = createRunId(testInfo.title);
        const runLogger = createScopedLogger("obsidianSetup", {
            runId,
            phase: "fixture",
        });

        const launcher = new ObsidianE2ELauncher({
            paths,
            options: resolveVaultOptions(vaultOptions),
            tempUserDataDir: tempDir,
            runId,
        });
        const mainLogPath = getElectronMainLogPath(tempDir);
        const stopMainLogging = forwardElectronMainLogs(
            mainLogPath,
            createScopedLogger("ElectronMain", { runId, phase: "main" }),
        );

        try {
            toggleLoggerBy(vaultOptions.logLevel || "warn");
            runLogger.info("Launching Obsidian and creating context");
            const context = await createObsidianContext(launcher);

            runLogger.debug("Configuring browser console logging");
            if (vaultOptions.enableBrowserConsoleLogging) {
                setupBrowserConsoleLogging(context.page, {
                    scope: {
                        runId,
                        phase: "browser",
                    },
                    options: vaultOptions.browserConsoleLogging,
                });
            }

            const api = new ObsidianAPI(context);

            runLogger.info("Entering test body");
            await use(api);
            runLogger.info("Test body completed");

            handleTestError(testInfo);
            await attachFailureArtifacts(testInfo, context.page);
        } catch (err: any) {
            runLogger.error(
                `Error during test execution: ${err.message || err}`,
            );
            if (!process.env.CI) {
                // Uncomment for debugging: await launcher.getCurrentPage()?.pause();
            }
            throw err;
        } finally {
            runLogger.info("Cleaning up Obsidian");
            try {
                await launcher.cleanup();
                runLogger.info("Cleanup completed");
            } finally {
                // 終了処理のログまで転送・添付してから、一時ディレクトリを削除する。
                stopMainLogging();
                try {
                    await testInfo.attach("obsidian-electron-main-log", {
                        path: mainLogPath,
                        contentType: "application/x-ndjson",
                    });
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                        runLogger.warn(`Could not attach Electron main log: ${String(error)}`);
                    }
                }
            }
        }
    },
});

// ===================================================================
// Public API
// ===================================================================

export { expect } from "@playwright/test";
export { fetchPlugin } from "./fetchPlugin";
export type { ObsidianCliMode, VaultOptions } from "./internal/types";
export { ObsidianAPI } from "./ObsidianAPI";
