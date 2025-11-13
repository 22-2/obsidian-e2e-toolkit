// ===================================================================
// 4. PluginManager.ts - プラグインの管理
// ===================================================================
import { expect } from "@playwright/test";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import log from "loglevel";
import path from "path";
import type { Page } from "playwright";
import type { PluginConfig } from "../types";

const logger = log.getLogger("PluginManager");

export class PluginManager {
  constructor(private plugins: PluginConfig[], private vaultPath: string) {}

  async installAll(): Promise<void> {
    const pluginsDir = this.ensurePluginsDirectory();
    const installedIds: string[] = [];

    for (const plugin of this.plugins) {
      if (await this.installSingle(pluginsDir, plugin)) {
        installedIds.push(plugin.pluginId);
      }
    }

    this.updateCommunityPluginsJson(installedIds);
    logger.debug(`Installed plugins: ${installedIds.join(", ")}`);
  }

  private ensurePluginsDirectory(): string {
    const obsidianDir = path.join(this.vaultPath, ".obsidian");
    const pluginsDir = path.join(obsidianDir, "plugins");

    if (!existsSync(obsidianDir)) {
      mkdirSync(obsidianDir, { recursive: true });
    }

    if (!existsSync(pluginsDir)) {
      mkdirSync(pluginsDir, { recursive: true });
    }

    return pluginsDir;
  }

  private async installSingle(
    pluginsDir: string,
    plugin: PluginConfig
  ): Promise<boolean> {
    if (!this.validatePluginPath(plugin)) {
      logger.warn(`Invalid plugin path: ${plugin.path}`);
      return false;
    }

    const destDir = path.join(pluginsDir, plugin.pluginId);

    if (plugin.useSymlink) {
      logger.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
      return this.createPluginSymlink(plugin.path, destDir, plugin.pluginId);
    } else {
      logger.debug(`Copying files for plugin: ${plugin.pluginId}`);
      return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
    }
  }

  private validatePluginPath(plugin: PluginConfig): boolean {
    if (!existsSync(plugin.path)) {
      console.warn(`Plugin path not found: ${plugin.path}`);
      return false;
    }

    if (!existsSync(path.join(plugin.path, "manifest.json"))) {
      console.warn(`manifest.json not found in: ${plugin.path}`);
      return false;
    }

    return true;
  }

  private createPluginSymlink(
    sourcePath: string,
    destDir: string,
    pluginId: string
  ): boolean {
    if (existsSync(destDir)) {
      logger.debug(`Destination already exists: ${destDir}, skipping symlink`);
      return true;
    }

    try {
      symlinkSync(sourcePath, destDir, "dir");
      logger.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
      return true;
    } catch (error) {
      console.error(`Failed to create symlink for ${pluginId}:`, error);
      return false;
    }
  }

  private copyPluginFiles(
    sourcePath: string,
    destDir: string,
    pluginId: string
  ): boolean {
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }

    const filesToCopy = ["manifest.json", "main.js", "styles.css"];

    for (const file of readdirSync(sourcePath)) {
      const srcFile = path.join(sourcePath, file);
      const stat = statSync(srcFile);

      if (stat.isDirectory() || !filesToCopy.includes(file)) {
        continue;
      }

      const destFile = path.join(destDir, file);
      copyFileSync(srcFile, destFile);
      logger.debug(`Copied: ${file} to ${destDir}`);
    }

    logger.debug(`Installed plugin: ${pluginId}`);
    return true;
  }

  private updateCommunityPluginsJson(installedIds: string[]): void {
    const pluginsJsonPath = path.join(
      this.vaultPath,
      ".obsidian",
      "community-plugins.json"
    );
    writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
  }

  async enableAll(page: Page, pluginIds: string[]): Promise<void> {
    await this.disableRestrictedMode(page);

    const enabledIds = await page.evaluate(async (ids) => {
      const app = (window as any).app;
      const enabled: string[] = [];

      for (const id of ids) {
        await app.plugins.enablePluginAndSave(id);
        enabled.push(id);
      }

      return enabled;
    }, pluginIds);

    logger.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
  }

  private async disableRestrictedMode(page: Page): Promise<void> {
    await this.waitForPluginsAPI(page);

    if (await this.isCommunityPluginsEnabled(page)) {
      logger.debug("Community plugins are already enabled.");
      return;
    }

    logger.debug("Attempting to enable community plugins...");
    await this.openCommunityPluginsSettings(page);
    await this.clickEnableButtons(page);
    await this.closeCommunityPluginsSettings(page);
    await this.verifyCommunityPluginsEnabled(page);
  }

  private async waitForPluginsAPI(page: Page): Promise<void> {
    await page.waitForFunction(
      () => {
        const app = (window as any).app;
        return app?.plugins?.isEnabled !== undefined;
      },
      { timeout: 10000 }
    );
  }

  private async isCommunityPluginsEnabled(page: Page): Promise<boolean> {
    return await page.evaluate(() => {
      const app = (window as any).app;
      return app?.plugins?.isEnabled?.() ?? false;
    });
  }

  private async openCommunityPluginsSettings(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).app.setting.open();
      (window as any).app.setting.openTabById("community-plugins");
    });
  }

  private async clickEnableButtons(page: Page): Promise<void> {
    const getButtonText = () =>
      page.evaluate(() => {
        const button = (
          window as any
        ).app.setting.activeTab?.setting?.contentEl?.querySelector(
          "button.mod-cta"
        ) as HTMLElement | null;
        return button?.textContent?.trim() || null;
      });

    const clickButton = () =>
      page.evaluate(() => {
        const button = (
          window as any
        ).app.setting.activeTab?.setting?.contentEl?.querySelector(
          "button.mod-cta"
        ) as HTMLElement | null;
        button?.click();
      });

    let buttonText = await getButtonText();

    if (buttonText === "Turn on and reload") {
      logger.debug("Clicking 'Turn on and reload'...");
      await clickButton();
      await page.waitForTimeout(1000);
      buttonText = await getButtonText();
    }

    if (buttonText === "Turn on community plugins") {
      logger.debug("Clicking 'Turn on community plugins'...");
      await clickButton();
      await page.waitForTimeout(1000);
    }
  }

  private async closeCommunityPluginsSettings(page: Page): Promise<void> {
    await page.keyboard.press("Escape");
  }

  private async verifyCommunityPluginsEnabled(page: Page): Promise<void> {
    const isEnabled = await this.isCommunityPluginsEnabled(page);
    expect(isEnabled, "Failed to enable community plugins.").toBe(true);
  }
}
