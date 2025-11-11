// E:\Desktop\coding\templates\obsidian-e2e-toolkit\src\index.ts
import { ObsidianAPI } from "./ObsidianAPI";
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
import { getResolvedPaths } from "./helpers/constants";
import { ObsidianTestLauncher } from "./helpers/launcher";
import type {
  TestFixtures,
  VaultOptions,
  WorkerFixtures,
} from "./helpers/types";
import {
  createObsidianContext,
  handleTestError,
  setupBrowserConsoleLogging,
} from "./helpers/utils";

export const logger = log.getLogger("obsidianSetup");

// ===================================================================
// Playwright Test Fixtures
// ===================================================================

// Default vault options
const DEFAULT_VAULT_OPTIONS: VaultOptions = {
  useSandbox: false,
  showLoggerOnNode: true,
  plugins: [],
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  obsidian: async ({}, use, testInfo) => {
    const paths = getResolvedPaths();
    const launcher = new ObsidianTestLauncher(paths);

    // Get vault options from test.use() or use defaults
    const vaultOptions: VaultOptions = {
      ...DEFAULT_VAULT_OPTIONS,
      ...(testInfo.project.use as { vaultOptions?: VaultOptions })
        ?.vaultOptions,
    };

    try {
      logger.debug("Launching Obsidian");
      await launcher.launch();

      logger.debug("Creating Obsidian context");
      const context = await createObsidianContext(launcher, vaultOptions);

      if (vaultOptions.showLoggerOnNode) {
        logger.debug("Enabling browser console logging");
        setupBrowserConsoleLogging(context.page);
      }

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
export type { VaultOptions } from "./helpers/types";

// Helper to configure vault options for tests
export function configureVault(options: VaultOptions) {
  return { vaultOptions: options };
}
