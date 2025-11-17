import type { Page } from "playwright";

/**
 * Handles waiting for various page states in Obsidian
 */
export class PageWaiter {
    static waitForPage(page: Page): Promise<void> {
    if (page.url().includes("starter")) {
      return this.waitForStarterReady(page);
    } else {
      return this.waitForVaultReady(page);
    }
  }

  /**
   * Wait for the Obsidian vault to be ready
   * This ensures the workspace layout is initialized
   */
  private static async waitForVaultReady(page: Page): Promise<void> {
    await page.waitForLoadState("domcontentloaded");

    await page.waitForFunction(
      async () => {
        if ((window as any).app?.workspace?.onLayoutReady) {
          return await new Promise<void>((resolve) => {
            return app.workspace.onLayoutReady(() => resolve(undefined));
          });
        }
      },
      { timeout: 10000 }
    );
  }

  /**
   * Wait for the Obsidian starter (welcome) page to be ready
   * This page appears when no vault is open
   */
  private static async waitForStarterReady(page: Page): Promise<void> {
    await page.waitForSelector(".mod-change-language", {
      state: "visible",
    });
  }
}
