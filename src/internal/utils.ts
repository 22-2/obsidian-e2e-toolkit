import type { Page } from "playwright";
import { logger } from "..";
import { ObsidianE2ELauncher } from "./launcher";
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
  launcher: ObsidianE2ELauncher
): Promise<any> {
  const vaultOptions = launcher.getVaultOptions();
  return launcher.launch(vaultOptions);
}
