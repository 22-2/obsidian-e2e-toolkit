// ===================================================================
// 2. WindowManager.ts - ウィンドウの管理
// ===================================================================
import chalk from "chalk";
import log from "loglevel";
import type { ElectronApplication, Page } from "playwright";

const logger = log.getLogger("WindowManager");

export class WindowManager {
    constructor(private electronApp: ElectronApplication) {}

    async ensureSingleWindow(): Promise<Page> {
        logger.debug("ensureSingleWindow");
        const windows = this.electronApp.windows();
        logger.debug(`${windows.length} opened`);

        if (windows.length === 0) {
            return await this.getFirstWindow();
        }

        const page = windows.at(-1)!;
        await page.waitForLoadState("domcontentloaded");
        await this.closeAllExcept(page);

        logger.debug(`closed all except ${await page.title()}`);
        return page;
    }

    private async getFirstWindow(): Promise<Page> {
        const page = await this.electronApp.firstWindow();
        await page.waitForLoadState("domcontentloaded");
        logger.debug("first window");
        return page;
    }

    async executeActionAndWaitForNewWindow(
        action: () => Promise<void>,
        waitCallback: (page: Page) => Promise<void>,
    ): Promise<Page> {
        const currentWindows = this.electronApp.windows();
        const windowPromise = this.electronApp.waitForEvent("window", {
            timeout: 10000,
        });

        await action();

        const newPage = await windowPromise;
        await waitCallback(newPage);
        await this.closeOldWindows(currentWindows, newPage);

        logger.debug(chalk.green("New window is ready:", newPage.url()));
        return newPage;
    }

    private async closeOldWindows(
        oldWindows: Page[],
        newPage: Page,
    ): Promise<void> {
        for (const window of oldWindows) {
            if (window !== newPage && !window.isClosed()) {
                logger.debug(
                    chalk.yellow(`Closing old window: ${await window.title()}`),
                );
                await window.close();
            }
        }
    }

    private async closeAllExcept(keepPage: Page): Promise<void> {
        for (const window of this.electronApp.windows()) {
            if (window !== keepPage && !window.isClosed()) {
                logger.debug(chalk.red(`close ${window.url()}`));
                await window.close();
            }
        }
    }
}
