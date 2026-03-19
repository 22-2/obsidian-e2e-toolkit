import type { Page } from "playwright";

/**
 * Handles waiting for various page states in Obsidian
 */
export class PageWaiter {
    static async waitForPage(page: Page, timeout = 15000): Promise<void> {
        await page.waitForLoadState("domcontentloaded");

        if (PageWaiter.isStarterPage(page)) {
            await PageWaiter.waitForStarterReady(page, timeout);
            return;
        }

        await PageWaiter.waitForVaultReady(page, timeout);
    }

    static isStarterPage(page: Page): boolean {
        return page.url().includes("starter");
    }

    /**
     * Wait for the Obsidian vault to be ready
     * This ensures the workspace layout is initialized
     */
    private static async waitForVaultReady(
        page: Page,
        timeout: number,
    ): Promise<void> {
        await page.waitForFunction(
            () => {
                const workspace = (window as any).app?.workspace;
                return (
                    !!workspace &&
                    (workspace.layoutReady === true || !!workspace.activeLeaf)
                );
            },
            { timeout },
        );
    }

    /**
     * Wait for the Obsidian starter (welcome) page to be ready
     * This page appears when no vault is open
     */
    private static async waitForStarterReady(
        page: Page,
        timeout: number,
    ): Promise<void> {
        await page.waitForSelector(".mod-change-language", {
            state: "visible",
            timeout,
        });
    }
}
