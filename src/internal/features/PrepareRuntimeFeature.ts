import type { Page } from "playwright";
import type { ServiceContext } from "../services/IService";
import { PageWaiter } from "../services/PageWaiter";
import type { ServiceContainer } from "../services/ServiceContainer";
import { SERVICE_IDS } from "../services/serviceIds";
import type { StorageManager } from "../services/StorageManager";
import type { WindowManager } from "../services/WindowManager";
import type { IFeature } from "./IFeature";

export class PrepareRuntimeFeature implements IFeature<
    { initialPage: Page },
    { starterPage: Page }
> {
    async run(
        input: { initialPage: Page },
        ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<{ starterPage: Page }> {
        const storageManager = services.getValue<StorageManager>(
            SERVICE_IDS.storageManager,
        );
        const windowManager = services.getValue<WindowManager>(
            SERVICE_IDS.windowManager,
        );

        await input.initialPage.evaluate(() => {
            (window as any).playwright = true;
        });
        await PageWaiter.waitForPage(input.initialPage);

        await storageManager.clearAll();
        await input.initialPage.evaluate(() => {
            localStorage.setItem("language", "en");
        });
        await input.initialPage.reload({ waitUntil: "domcontentloaded" });

        const starterPage = await windowManager.ensureSingleWindow();
        await PageWaiter.waitForPage(starterPage);

        ctx.runtime.activePage = starterPage;
        return { starterPage };
    }
}
