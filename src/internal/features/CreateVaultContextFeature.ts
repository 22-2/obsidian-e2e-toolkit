import type { ObsidianPageTextContext, PluginConfig } from "../types";
import { getPluginHandleMap } from "../utils";
import type { ElectronAppManager } from "../managers/ElectronAppManager";
import type { ServiceContainer } from "../services/ServiceContainer";
import type { ServiceContext } from "../services/IService";
import { SERVICE_IDS } from "../services/serviceIds";
import type { IFeature } from "./IFeature";
import type { Page } from "playwright";

export class CreateVaultContextFeature
  implements IFeature<{ page: Page; plugins?: PluginConfig[] }, ObsidianPageTextContext>
{
  async run(
    input: { page: Page; plugins?: PluginConfig[] },
    ctx: ServiceContext,
    services: ServiceContainer
  ): Promise<ObsidianPageTextContext> {
    const electronManager = services.getValue<ElectronAppManager>(
      SERVICE_IDS.electronManager
    );
    const vaultName = await input.page.evaluate(() => app?.vault?.getName());

    let pluginHandleMap;
    if (!input.plugins || input.plugins.length === 0) {
      pluginHandleMap = await input.page.evaluateHandle(() => new Map());
    } else {
      pluginHandleMap = await getPluginHandleMap(input.page, input.plugins || []);
    }

    return {
      electronApp: electronManager.getApp(),
      page: input.page,
      pluginHandleMap,
      vaultName,
      paths: ctx.paths,
    };
  }
}
