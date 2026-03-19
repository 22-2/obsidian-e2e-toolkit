import type { ElectronAppManager } from "../services/ElectronAppManager";
import type { IPCBridge } from "../services/ipc";
import type { ServiceContext } from "../services/IService";
import { PageWaiter } from "../services/PageWaiter";
import type { ServiceContainer } from "../services/ServiceContainer";
import { SERVICE_IDS } from "../services/serviceIds";
import type { WindowManager } from "../services/WindowManager";
import type { TestContext } from "../types";
import type { IFeature } from "./IFeature";

export class OpenStarterFeature implements IFeature<void, TestContext> {
    async run(
        _input: void,
        ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<TestContext> {
        const windowManager = services.getValue<WindowManager>(
            SERVICE_IDS.windowManager,
        );
        const ipcBridge = services.getValue<IPCBridge>(SERVICE_IDS.ipcBridge);
        const electronManager = services.getValue<ElectronAppManager>(
            SERVICE_IDS.electronManager,
        );

        const page = await windowManager.executeActionAndWaitForNewWindow(
            async () => await ipcBridge.openStarter(),
            PageWaiter.waitForPage,
        );

        await PageWaiter.waitForPage(page);
        ctx.runtime.activePage = page;

        return {
            electronApp: electronManager.getApp(),
            page,
        };
    }
}
