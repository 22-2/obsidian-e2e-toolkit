import type { Page } from "playwright";
import { logger } from "..";
import { ObsidianTestLauncher } from "./launcher";
import type { Plugin, PluginHandleMap } from "./types";

export async function getPluginHandleMap(
  page: Page,
  plugins: { pluginId: string; path: string }[]
): Promise<PluginHandleMap> {
  // Wait for plugins to be loaded
  await page.waitForFunction(
    (pluginIds) => {
      const app = (globalThis as any).app;
      if (!app?.plugins) return false;
      return pluginIds.every((id: string) => app.plugins.getPlugin(id));
    },
    plugins.map((p) => p.pluginId),
    { timeout: 10000 }
  );

  return page.evaluateHandle((plugins) => {
    const map = new Map<string, Plugin>();
    plugins.forEach((p) => {
      const plugin = (globalThis as any).app?.plugins.getPlugin(p.pluginId);
      if (plugin) {
        map.set(p.pluginId, plugin);
      }
    });
    return map;
  }, plugins);
}
// ===================================================================
// Test Setup Factory
// ===================================================================
/**
 * Creates a new ObsidianTestSetup instance with the provided configuration
 *
 * @param config - Configuration object with plugin directory and optional settings
 * @returns Configured ObsidianTestSetup instance ready to launch
 *
 * @example
 * ```typescript
 * import { createTestSetup } from 'obsidian-e2e';
 *
 * const setup = createTestSetup({
 *   pluginDir: process.cwd(),
 *   distDir: 'dist',
 * });
 *
 * await setup.launch();
 * const vault = await setup.openVault({
 *   plugins: [{
 *     path: setup.getPaths().distDir,
 *     pluginId: setup.getPaths().pluginId,
 *   }],
 * });
 * ```
 */
// import { resolveConfig } from "./config";
// export function createTestSetup(
//   config: import("./config").ObsidianE2EConfig
// ): ObsidianTestLauncher {
//   const paths = resolveConfig(config);
//   return new ObsidianTestLauncher(paths);
// }
// ===================================================================
// Console Logging Helpers
// ===================================================================
export function setupBrowserConsoleLogging(window: any): void {
  window.on("console", (msg: any) => {
    const type = msg.type();
    const text = msg.text();

    if (text.length > 500) {
      console.log(
        `🖥️ BROWSER [${type.toUpperCase()}]: [長文のため省略: ${
          text.length
        }文字]`
      );
      return;
    }

    console.log(
      `🖥️ BROWSER [${type.toUpperCase()}]: ${text.substring(0, 100)}`
    );

    const location = msg.location();
    if (location.url && location.url !== "about:blank") {
      console.log(
        `   📍 Location: ${location.url}:${location.lineNumber}:${location.columnNumber}`
      );
    }
  });

  window.on("pageerror", (error: Error) => {
    console.log(`🖥️ PAGE ERROR: ${error.message}`);
    if (error.stack) {
      console.log(`   📚 Stack: ${error.stack}`);
    }
  });

  window.on("requestfailed", (request: any) => {
    console.log(`🖥️ REQUEST FAILED: ${request.url()}`);
    const failure = request.failure();
    if (failure) {
      console.log(`   ❌ Failure: ${failure.errorText}`);
    }
  });

  window.on("response", (response: any) => {
    if (!response.ok()) {
      console.log(
        `🖥️ HTTP ERROR: ${response.status()} ${response.statusText()} - ${response.url()}`
      );
    }
  });
} // ===================================================================
// Test Error Handling
// ===================================================================
export function handleTestError(testInfo: any): void {
  const status = testInfo.status;

  if (status === "passed" || status === "skipped") {
    logger.debug(`Test finished with status: ${status}.`);
    return;
  }

  logger.error(`Test finished with status: ${status}. Pausing for debug.`);

  if (testInfo.error) {
    const separator = "=".repeat(20);
    console.error(`\n${separator} TEST FAILED ${separator}`);
    console.error(testInfo.error.message);

    if (testInfo.error.stack) {
      const firstNewlineIndex = testInfo.error.stack.indexOf("\n");
      const stackWithoutMessage = testInfo.error.stack.substring(
        firstNewlineIndex + 1
      );
      console.error(stackWithoutMessage);
    }

    console.error("=".repeat(53) + "\n");
  }

  if (!process.env.CI) {
    logger.debug(testInfo.errors);
  }
}
// ===================================================================
// Vault Setup Helpers
// ===================================================================
export async function createObsidianContext(
  obsidianSetup: ObsidianTestLauncher,
  vaultOptions: any
): Promise<any> {
  logger.debug("vaultOptions", vaultOptions);

  const context = vaultOptions.useSandbox
    ? await obsidianSetup.openSandbox(vaultOptions)
    : await obsidianSetup.openVault(vaultOptions);

  // Remove all notices
  const notices = await context.page.locator(".notice-container .notice").all();
  logger.debug("remove all notices");
  await Promise.all(notices.map((notice: any) => notice.click()));

  return context;
}
