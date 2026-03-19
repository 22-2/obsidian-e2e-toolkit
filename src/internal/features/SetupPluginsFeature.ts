import { PageWaiter } from "../PageWaiter";
import type { Page } from "playwright";
import type { PluginManager } from "../managers/PluginManager";
import type { ServiceContainer } from "../services/ServiceContainer";
import type { ServiceContext } from "../services/IService";
import { SERVICE_IDS } from "../services/serviceIds";
import type { IFeature } from "./IFeature";

export class SetupPluginsFeature
  implements IFeature<{ page: Page }, void>
{
  async run(
    input: { page: Page },
    _ctx: ServiceContext,
    services: ServiceContainer
  ): Promise<void> {
    const pluginManager = services.getValue<PluginManager>(SERVICE_IDS.pluginManager);

    await pluginManager.installAll();
    await pluginManager.enableAll(input.page);
    await input.page.reload();
    await PageWaiter.waitForPage(input.page);
  }
}
