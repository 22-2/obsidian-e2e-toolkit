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
     * vault の layoutReady が true になるまで待つ。window.app を通して読むため、グローバル app が無い場面でも ReferenceError にならない。
     * activeLeaf の有無は見ない。
     */
    static async waitForVaultReady(
        page: Page,
        timeout: number,
    ): Promise<void> {
        await page.waitForFunction(
            () => {
                const workspace = (window as any).app?.workspace;
                // 意図: activeLeaf は layout の完了前にも存在しうるため、layoutReady だけを準備完了の条件にする。
                return !!workspace && workspace.layoutReady === true;
            },
            // 意図: 第2引数はブラウザー関数への引数なので、待機設定は第3引数へ渡す。
            undefined,
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
