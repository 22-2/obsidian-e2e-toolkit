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
import type { VaultOptions } from "../types";

const logger = log.getLogger("VaultManager");

export class VaultManager {
  constructor(
    private ipc: IPCBridge,
    private options: VaultOptions,
    private vaultPath: string
  ) {}

  async openSandboxVault(
    executeAction: (
      action: () => Promise<void>,
      wait: (page: Page) => Promise<void>
    ) => Promise<Page>
  ): Promise<{ vaultPath: string; page: Page }> {
    logger.debug(chalk.green("Opening sandbox vault..."));

    const page = await executeAction(
      () => this.ipc.openSandbox(),
      PageWaiter.waitForPage
    );

    const vaultPath = await this.ipc.getSandboxPath();
    logger.debug(chalk.green("Sandbox vault opened at:", vaultPath));

    return { vaultPath, page };
  }

  async openNormalVault(
    executeAction: (
      action: () => Promise<void>,
      wait: (page: Page) => Promise<void>
    ) => Promise<Page>
  ): Promise<{ vaultPath: string; page: Page }> {
    logger.debug("Opening normal vault...");

    const vaultPath = await this.resolveVaultPath();

    if (this.options.fresh && existsSync(vaultPath)) {
      rmSync(vaultPath, { recursive: true });
    }

    // Ensure vault directory exists if not fresh
    if (!this.options.fresh && !existsSync(vaultPath)) {
      logger.debug("Creating vault directory:", vaultPath);
      mkdirSync(vaultPath, { recursive: true });
    }

    const page = await executeAction(async () => {
      const result = await this.ipc.openVault(vaultPath, this.options.fresh);
      if (result !== true) {
        throw new Error(`Failed to open vault: ${result}`);
      }
    }, PageWaiter.waitForPage);

    logger.debug("Normal vault opened:", vaultPath);

    return { vaultPath, page };
  }

  async resolveVaultPath(): Promise<string> {
    if (this.options.name) {
      return await this.getVaultPathByName(this.options.name);
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
      name
    );
  }
}
