import { ObsidianAPI } from "./ObsidianAPI";
/**
 * Main entry point for obsidian-e2e testing library
 *
 * This module can be used as a standalone package for Obsidian plugin E2E testing.
 *
 * @example
 * ```typescript
 * import { createTestSetup, resolveConfig } from 'obsidian-e2e';
 *
 * const paths = resolveConfig({
 *   pluginDir: '/path/to/your/plugin',
 * });
 *
 * const setup = createTestSetup(paths);
 * await setup.launch();
 * ```
 */

import { test as base } from "@playwright/test";
import log from "loglevel";
import { getResolvedPaths } from "./helpers/constants";
import { ObsidianTestLauncher } from "./helpers/launcher";
import type { TestFixtures, WorkerFixtures } from "./helpers/types";
import {
  createObsidianContext,
  handleTestError,
  setupBrowserConsoleLogging,
} from "./helpers/utils";

export const logger = log.getLogger("obsidianSetup");

// ===================================================================
// Playwright Test Fixtures
// ===================================================================

export const test = base.extend<TestFixtures, WorkerFixtures>({
  obsOptions: async ({}, use) => {
    await use({
      useSandbox: false,
      showLoggerOnNode: true,
      plugins: [],
    });
  },

  obsLauncher: async ({}, use, testInfo) => {
    const paths = getResolvedPaths();
    const setup = new ObsidianTestLauncher(paths);

    try {
      logger.debug("launch");
      await setup.launch();
      logger.debug("done");
      logger.debug("enter tests");

      await use(setup);

      handleTestError(testInfo);
    } catch (err: any) {
      logger.error(`Error during fixture setup: ${err.message || err}`);
      if (!process.env.CI) {
        // await setup.getCurrentPage()?.pause();
      }
      throw err;
    } finally {
      logger.debug("clean up app");
      await setup.cleanup();
      logger.debug("ok");
    }
  },

  obsidian: async ({ obsLauncher, obsOptions }, use) => {
    const context = await createObsidianContext(obsLauncher, obsOptions);

    if (obsOptions.showLoggerOnNode) {
      logger.debug("enable browser console");
      setupBrowserConsoleLogging(context.page);
    }

    logger.debug("enter test");
    await use(new ObsidianAPI(context));
    logger.debug("done");
  },
});

// === PUBLIC API (MINIMAL) ===
// Only expose the ergonomics that most consumers need:
// - ObsidianPageObject
// - test (playwright test instance with preconfigured fixtures)
// - expect (from @playwright/test)

export { expect } from "@playwright/test";
export { ObsidianAPI } from "./ObsidianAPI";
