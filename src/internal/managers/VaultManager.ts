// ===================================================================
// 3. VaultManager.ts - Vaultの管理
// ===================================================================
import chalk from "chalk";
import { existsSync, mkdirSync, rmSync } from "fs";
import log from "loglevel";
import path from "path";
import type { Page } from "playwright";
import { PageWaiter } from "../PageWaiter";
import type { IPCBridge } from "../ipc";
import type { WindowManager } from "./WindowManager";
import type { VaultOptions } from "../types";

const logger = log.getLogger("VaultManager");

export class VaultManager {
    constructor(
        private ipc: IPCBridge,
        private windowManager: WindowManager,
        private options: VaultOptions,
        private vaultPath: string,
    ) {}

    async openVault(
        options: VaultOptions,
    ): Promise<{ vaultPath: string; page: Page }> {
        const useSandbox = !!(options.sandbox && !process.env.CI);
        if (useSandbox) {
            return this.openSandboxVault();
        }

        return this.openNormalVault(options);
    }

    async openSandboxVault(): Promise<{ vaultPath: string; page: Page }> {
        logger.debug(chalk.green("Opening sandbox vault..."));

        const page = await this.windowManager.executeActionAndWaitForNewWindow(
            () => this.ipc.openSandbox(),
            PageWaiter.waitForPage,
        );

        const vaultPath = await this.ipc.getSandboxPath();
        logger.debug(chalk.green("Sandbox vault opened at:", vaultPath));

        return { vaultPath, page };
    }

    async openNormalVault(
        options: VaultOptions,
    ): Promise<{ vaultPath: string; page: Page }> {
        logger.debug("Opening normal vault...");

        const vaultPath = await this.resolveVaultPath(options);

        if (options.fresh && existsSync(vaultPath)) {
            rmSync(vaultPath, { recursive: true });
        }

        // Ensure vault directory exists if not fresh
        if (!options.fresh && !existsSync(vaultPath)) {
            logger.debug("Creating vault directory:", vaultPath);
            mkdirSync(vaultPath, { recursive: true });
        }

        const page = await this.windowManager.executeActionAndWaitForNewWindow(
            async () => {
                const result = await this.ipc.openVault(
                    vaultPath,
                    !!options.fresh,
                );
                if (result !== true) {
                    throw new Error(`Failed to open vault: ${result}`);
                }
            },
            PageWaiter.waitForPage,
        );

        logger.debug("Normal vault opened:", vaultPath);

        return { vaultPath, page };
    }

    async resolveVaultPath(
        options: VaultOptions = this.options,
    ): Promise<string> {
        if (options.name) {
            return await this.getVaultPathByName(options.name);
        }

        logger.debug("options.name not specified, create temp dir");
        const tempPath = this.vaultPath;
        logger.debug("temp dir created:", tempPath);
        return tempPath;
    }

    private async getVaultPathByName(name: string): Promise<string> {
        // Implementation depends on getUserDataPath
        return path.join(
            process.env.USERPROFILE || process.env.HOME || "",
            "ObsidianVaults",
            name,
        );
    }
}
