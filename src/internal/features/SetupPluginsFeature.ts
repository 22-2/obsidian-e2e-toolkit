import type { Page } from "playwright";
import type { ServiceContext } from "../services/IService";
import { PageWaiter } from "../services/PageWaiter";
import type { PluginManager } from "../services/PluginManager";
import type { ServiceContainer } from "../services/ServiceContainer";
import { SERVICE_IDS } from "../services/serviceIds";
import type { IFeature } from "./IFeature";

export class SetupPluginsFeature implements IFeature<{ page: Page }, void> {
    async run(
        input: { page: Page },
        _ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<void> {
        const pluginManager = services.getValue<PluginManager>(
            SERVICE_IDS.pluginManager,
        );

        await pluginManager.installAll();
        await pluginManager.enableAll(input.page);
        await input.page.reload();
        await PageWaiter.waitForPage(input.page);
        // 意図: vault のレイアウト完了後もプラグインと CSS のロードは続くため、
        // テストへ制御を渡す前に fixture の準備完了を確認する。
        await pluginManager.waitForReady(input.page);
    }
}
