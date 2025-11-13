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
import log from "loglevel";
import { ObsidianAPI } from "./ObsidianAPI";
import { DEFAULT_VAULT_OPTIONS, getResolvedPaths } from "./internal/constants";
import { ObsidianE2ELauncher } from "./internal/launcher";
import { setupBrowserConsoleLogging } from "./internal/logger";
import type {
  TestFixtures,
  VaultOptions,
  WorkerFixtures,
} from "./internal/types";
import { createObsidianContext, handleTestError } from "./internal/utils";

export const logger = log.getLogger("obsidianSetup");

export const test = base.extend<TestFixtures, WorkerFixtures>({
  obsidian: async ({}, use, testInfo) => {
    const paths = getResolvedPaths();

    // Get vault options from test.use()
    const vaultOptions =
      // @ts-expect-error
      (testInfo.project.use?.vaultOptions as VaultOptions | undefined) ||
      DEFAULT_VAULT_OPTIONS;

    const launcher = new ObsidianE2ELauncher({ paths, options: vaultOptions });

    try {
      logger.debug("Launching Obsidian");
      await launcher.initialize();

      logger.debug("Creating Obsidian context");
      const context = await createObsidianContext(launcher);

      logger.debug("Enabling browser console logging");
      setupBrowserConsoleLogging(context.page);

      const api = new ObsidianAPI(context);

      logger.debug("Entering test");
      await use(api);
      logger.debug("Test completed");

      handleTestError(testInfo);
    } catch (err: any) {
      logger.error(`Error during test execution: ${err.message || err}`);
      if (!process.env.CI) {
        // Uncomment for debugging: await launcher.getCurrentPage()?.pause();
      }
      throw err;
    } finally {
      logger.debug("Cleaning up Obsidian");
      await launcher.cleanup();
      logger.debug("Cleanup completed");
    }
  },
});

// ===================================================================
// Public API
// ===================================================================

export { expect } from "@playwright/test";
export { ObsidianAPI } from "./ObsidianAPI";
export type { VaultOptions } from "./internal/types";
