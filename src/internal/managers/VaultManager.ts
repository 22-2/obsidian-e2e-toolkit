// ===================================================================
// 3. VaultManager.ts - Vaultの管理
// ===================================================================
import chalk from "chalk";
import { existsSync, rmSync } from "fs";
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { Page } from "playwright";
import type { IPCBridge } from "../ipc";
import type { VaultOptions } from "../types";

const logger = log.getLogger("VaultManager");

export class VaultManager {
  constructor(private ipc: IPCBridge, private options: VaultOptions) {}

  async openSandboxVault(
    executeAction: (
      action: () => Promise<void>,
      wait: (page: Page) => Promise<void>
    ) => Promise<Page>
  ): Promise<{ vaultPath: string; page: Page }> {
    logger.debug(chalk.green("Opening sandbox vault..."));

    const page = await executeAction(
      () => this.ipc.openSandbox(),
      this.waitForVaultReady
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

    const page = await executeAction(async () => {
      const result = await this.ipc.openVault(vaultPath, this.options.fresh);
      if (result !== true) {
        throw new Error(`Failed to open vault: ${result}`);
      }
    }, this.waitForVaultReady);

    logger.debug("Normal vault opened:", vaultPath);

    return { vaultPath, page };
  }

  private async resolveVaultPath(): Promise<string> {
    if (this.options.name) {
      return await this.getVaultPathByName(this.options.name);
    }

    logger.debug(
      "options.name and options.path not specified, create temp dir"
    );
    const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
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

  async waitForVaultReady(page: Page): Promise<void> {
    await page.waitForLoadState("domcontentloaded");

    await page.waitForFunction(
      async () => {
        if ((window as any).app?.workspace?.onLayoutReady) {
          return await new Promise<void>((resolve) => {
            return app.workspace.onLayoutReady(() => resolve(undefined));
          });
        }
      },
      { timeout: 10000 }
    );
  }

  async waitForStarterReady(page: Page): Promise<void> {
    await page.waitForSelector(".mod-change-language", {
      state: "visible",
    });
  }
}
