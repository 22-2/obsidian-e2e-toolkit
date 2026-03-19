import type { Page } from "playwright";
import type { ServiceContext } from "../services/IService";
import type { ServiceContainer } from "../services/ServiceContainer";
import { SERVICE_IDS } from "../services/serviceIds";
import type { VaultManager } from "../services/VaultManager";
import type { VaultOptions } from "../types";
import type { IFeature } from "./IFeature";

export class OpenVaultFeature implements IFeature<
    { options: VaultOptions },
    { page: Page; vaultPath: string }
> {
    async run(
        input: { options: VaultOptions },
        ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<{ page: Page; vaultPath: string }> {
        const vaultManager = services.getValue<VaultManager>(
            SERVICE_IDS.vaultManager,
        );
        const result = await vaultManager.openVault(input.options);

        ctx.runtime.activePage = result.page;
        ctx.runtime.vaultPath = result.vaultPath;

        return result;
    }
}
