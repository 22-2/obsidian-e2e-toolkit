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
import { ObsidianAPI } from "./ObsidianAPI";
import { DEFAULT_VAULT_OPTIONS, getResolvedPaths } from "./internal/constants";
import { ObsidianE2ELauncher } from "./internal/launcher";
import {
  createRunId,
  createScopedLogger,
  setupBrowserConsoleLogging,
  toggleLoggerBy,
} from "./internal/logger";
import type { TestFixtures, WorkerFixtures } from "./internal/types";
import { createObsidianContext, handleTestError } from "./internal/utils";
import { merge } from "es-toolkit";

export const logger = log.getLogger("obsidianSetup");

export const test = base.extend<TestFixtures, WorkerFixtures>({
  tempDir: async ({}, use) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
    await use(dir);
    // Clean up both user data dir and vault dir
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    await fs.rm(`${dir}-vault`, { recursive: true, force: true }).catch(() => {});
  },
  vaultOptions: [DEFAULT_VAULT_OPTIONS, { option: true }],
  obsidian: async ({ vaultOptions, tempDir }, use, testInfo) => {
    const paths = getResolvedPaths();
    const runId = createRunId(testInfo.title);
    const runLogger = createScopedLogger("obsidianSetup", {
      runId,
      phase: "fixture",
    });

    const launcher = new ObsidianE2ELauncher({
      paths,
      options: merge(DEFAULT_VAULT_OPTIONS, vaultOptions),
      tempUserDataDir: tempDir,
      runId,
    });

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
    } catch (err: any) {
      runLogger.error(`Error during test execution: ${err.message || err}`);
      if (!process.env.CI) {
        // Uncomment for debugging: await launcher.getCurrentPage()?.pause();
      }
      throw err;
    } finally {
      runLogger.info("Cleaning up Obsidian");
      await launcher.cleanup();
      runLogger.info("Cleanup completed");
    }
  },
});

// ===================================================================
// Public API
// ===================================================================

export { expect } from "@playwright/test";
export { ObsidianAPI } from "./ObsidianAPI";
export type { VaultOptions } from "./internal/types";
export { fetchPlugin } from "./fetchPlugin";
