import type { Page } from "playwright";

/**
 * Handles waiting for various page states in Obsidian
 */
export class PageWaiter {
    static waitForPage(page: Page): Promise<void> {
    if (page.url().includes("starter")) {
      return PageWaiter.waitForStarterReady(page);
    } else {
      return PageWaiter.waitForVaultReady(page);
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
        const workspace = (window as any).app?.workspace;
        if (workspace?.onLayoutReady) {
          await new Promise<void>((resolve) => {
            workspace.onLayoutReady(() => resolve());
          });
          return true;
        }
        return false;
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
