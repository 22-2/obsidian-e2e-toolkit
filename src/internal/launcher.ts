import { expect } from "@playwright/test";
import chalk from "chalk";
import type { WebContents } from "electron";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "fs";
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright/test";
import invariant from "tiny-invariant";
import { DEFAULT_VAULT_OPTIONS, SANDBOX_VAULT_NAME } from "./constants";
import { IPCBridge } from "./ipc";
import type { ResolvedPaths } from "./path";
import { createLaunchOptions } from "./path";
import type {
  ObsidianPageTextContext,
  PluginConfig,
  TestContext,
} from "./types";
import { type VaultOptions } from "./types";
import { getPluginHandleMap } from "./utils";

const logger = log.getLogger("ObsidianTestLauncher");

export interface LauncherConfig {
  paths: ResolvedPaths;
  options: VaultOptions;
}

export class ObsidianE2ELauncher {
  private electronApp?: ElectronApplication;
  private tempUserDataDir?: string;
  private ipc?: IPCBridge;
  private paths: ResolvedPaths;
  private options: VaultOptions;

  constructor({ paths, options }: LauncherConfig) {
    this.paths = paths;
    this.options = options;
  }

  // ===================================================================
  // Initialization & Cleanup
  // ===================================================================

  async initialize(): Promise<void> {
    await this.createTempUserDataDir();
    this.electronApp = await this.launchElectronApp();

    const initialPage = await this.electronApp.waitForEvent("window");
    await this.initializePlaywrightMode(initialPage);
    await this.waitForPage(initialPage);

    logger.debug("starter ready");

    await this.clearData();
    await initialPage.reload({ waitUntil: "domcontentloaded" });

    const currentPage = await this.ensureSingleWindow();
    await this.waitForStarterReady(currentPage);
    logger.debug("init start page");

    this.ipc = new IPCBridge(this);
  }

  private async createTempUserDataDir(): Promise<void> {
    this.tempUserDataDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "obsidian-e2e-")
    );
    logger.debug(`Using temporary user data dir: ${this.tempUserDataDir}`);
  }

  private async launchElectronApp(): Promise<ElectronApplication> {
    const baseLaunchOptions = createLaunchOptions(this.paths);
    const launchOptions = {
      ...baseLaunchOptions,
      args: [
        ...baseLaunchOptions.args,
        `--user-data-dir=${this.tempUserDataDir}`,
      ],
      env: {
        ...baseLaunchOptions.env,
        PLAYWRIGHT: "true",
        CI: process.env.CI || "false",
      },
    };

    return await electron.launch(launchOptions);
  }

  private async initializePlaywrightMode(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).playwright = true;
    });
    logger.debug("enable obsidian debug mode");
  }

  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.closeAllWindows();
      await this.electronApp.close();
    }

    if (this.tempUserDataDir) {
      await this.removeTempUserDataDir();
    }

    logger.debug("[ObsidianTestSetup] cleaned All");
  }

  private async closeAllWindows(): Promise<void> {
    const windows = this.electronApp!.windows();
    await Promise.all(windows.map((win) => win.close()));
  }

  private async removeTempUserDataDir(): Promise<void> {
    logger.debug(`Removing temp user data dir: ${this.tempUserDataDir}`);
    await fs.rm(this.tempUserDataDir!, { recursive: true, force: true });
  }

  getCurrentPage(): Page | undefined {
    return this.electronApp?.windows()[0];
  }

  getElectronApp(): ElectronApplication {
    if (!this.electronApp) {
      throw new Error("ElectronApp not initialized");
    }
    return this.electronApp;
  }

  getPaths(): ResolvedPaths {
    return this.paths;
  }

  getVaultOptions(): VaultOptions {
    return this.options;
  }

  getPlugins(): PluginConfig[] {
    return this.options.plugins || [];
  }

  // ===================================================================
  // Vault Operations
  // ===================================================================

  async launch(
    options: VaultOptions = DEFAULT_VAULT_OPTIONS
  ): Promise<ObsidianPageTextContext> {
    this.validateInitialization();

    logger.debug("open vault", options);

    const shouldUseSandbox = options.sandbox && !process.env.CI;
    const { page } = shouldUseSandbox
      ? await this.openSandboxVault()
      : await this.openNormalVault(options);

    if (this.getPlugins()?.length) {
      logger.debug("Installing plugins...");
      await this.setupPlugins();
      logger.debug(`${this.getPlugins().length} Plugins setup completed.`);
    }

    const context = await this.createVaultContext(page, options.plugins);

    // Remove all notices
    const notices = await context.page
      .locator(".notice-container .notice")
      .all();

    logger.debug("remove all notices");
    await Promise.all(notices.map((notice: any) => notice.click()));
    return context;
  }

  private validateInitialization(): void {
    if (!this.electronApp || !this.ipc) {
      throw new Error("Setup not initialized. Call launch() first.");
    }
  }

  private async openSandboxVault(): Promise<{ vaultPath: string; page: Page }> {
    logger.debug(chalk.green("Opening sandbox vault..."));

    const page = await this.executeActionAndWaitForNewWindow(
      () => this.ipc!.openSandbox(),
      this.waitForVaultReady
    );

    const vaultPath = await this.ipc!.getSandboxPath();
    logger.debug(chalk.green("Sandbox vault opened at:", vaultPath));

    return { vaultPath, page };
  }

  private async openNormalVault(
    options: VaultOptions
  ): Promise<{ vaultPath: string; page: Page }> {
    logger.debug("Opening normal vault...");

    const vaultPath = await this.resolveVaultPath(options);

    if (options.fresh && existsSync(vaultPath)) {
      rmSync(vaultPath, { recursive: true });
    }

    const page = await this.executeActionAndWaitForNewWindow(async () => {
      const result = await this.ipc!.openVault(vaultPath, options.fresh);
      if (result !== true) {
        throw new Error(`Failed to open vault: ${result}`);
      }
    }, this.waitForVaultReady);

    logger.debug("Normal vault opened:", vaultPath);

    return { vaultPath, page };
  }

  private async resolveVaultPath(options: VaultOptions): Promise<string> {
    if (options.name) {
      return await this.getVaultPath();
    }

    logger.debug(
      "options.name and options.path not specified, create temp dir"
    );
    const tempPath = await fs.mkdtemp(path.join(os.tmpdir(), "obsidian-e2e-"));
    logger.debug("temp dir created:", tempPath);
    return tempPath;
  }

  public async setupPlugins(): Promise<void> {
    const page = this.getCurrentPage();
    invariant(page, "No active page to setup plugins");
    logger.debug("Installing plugins...");
    await this.installPlugins();
    logger.debug("Plugins installed.");

    logger.debug("Enabling plugins...");
    await this.enablePlugins(
      page,
      this.getPlugins().map((p) => p.pluginId)
    );
    logger.debug("Plugins enabled.");

    logger.debug(chalk.blue("Reloading vault to apply plugin changes..."));
    await page.reload();
    await this.waitForVaultReady(page);
    logger.debug(chalk.blue("Vault reloaded."));
  }

  private async createVaultContext(
    page: Page,
    plugins?: PluginConfig[]
  ): Promise<ObsidianPageTextContext> {
    const vaultName = await page.evaluate(() => app?.vault?.getName());
    logger.debug("Vault name:", vaultName);

    const pluginHandleMap = await getPluginHandleMap(page, plugins || []);

    return {
      electronApp: this.electronApp!,
      page,
      pluginHandleMap,
      vaultName,
      paths: this.paths,
    };
  }

  async openStarter(): Promise<TestContext> {
    this.validateInitialization();

    const page = await this.executeActionAndWaitForNewWindow(
      async () => await this.ipc!.openStarter(),
      this.waitForStarterReady
    );

    await this.waitForStarterReady(page);

    return {
      electronApp: this.electronApp!,
      page,
    };
  }

  // ===================================================================
  // Plugin Management
  // ===================================================================

  private async installPlugins(): Promise<void> {
    const vaultPath = await this.getVaultPath();
    const pluginsDir = this.ensurePluginsDirectory(vaultPath);
    const installedIds: string[] = [];

    for (const plugin of this.getPlugins()) {
      if (await this.installSinglePlugin(pluginsDir, plugin)) {
        installedIds.push(plugin.pluginId);
      }
    }

    this.updateCommunityPluginsJson(vaultPath, installedIds);
    logger.debug(`Installed plugins: ${installedIds.join(", ")}`);
  }

  private ensurePluginsDirectory(vaultPath: string): string {
    const obsidianDir = path.join(vaultPath, ".obsidian");
    const pluginsDir = path.join(obsidianDir, "plugins");

    if (!existsSync(obsidianDir)) {
      mkdirSync(obsidianDir, { recursive: true });
    }

    if (!existsSync(pluginsDir)) {
      mkdirSync(pluginsDir, { recursive: true });
    }

    return pluginsDir;
  }

  private async installSinglePlugin(
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

  private updateCommunityPluginsJson(
    vaultPath: string,
    installedIds: string[]
  ): void {
    const pluginsJsonPath = path.join(
      vaultPath,
      ".obsidian",
      "community-plugins.json"
    );
    writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
  }

  private async enablePlugins(page: Page, pluginIds: string[]): Promise<void> {
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

  // ===================================================================
  // Page Management
  // ===================================================================

  async ensureSingleWindow(): Promise<Page> {
    if (!this.electronApp) {
      throw new Error("ElectronApp not initialized");
    }

    logger.debug("ensureSingleWindow");
    const windows = this.electronApp.windows();
    logger.debug(`${windows.length} opened`);

    if (windows.length === 0) {
      return await this.getFirstWindow();
    }

    const page = windows.at(-1)!;
    await this.waitForPageByUrl(page);
    await this.closeAllExcept(page);

    logger.debug(`closed all except ${await page.title()}`);
    return page;
  }

  private async getFirstWindow(): Promise<Page> {
    const page = await this.electronApp!.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    logger.debug("first window");
    return page;
  }

  private async waitForPageByUrl(page: Page): Promise<void> {
    if (page.url().includes("starter")) {
      await this.waitForStarterReady(page);
    } else {
      await this.waitForVaultReady(page);
    }
  }

  async executeActionAndWaitForNewWindow(
    action: () => Promise<void>,
    wait: (page: Page) => Promise<void> = this.waitForPage.bind(this)
  ): Promise<Page> {
    if (!this.electronApp) {
      throw new Error("ElectronApp not initialized");
    }

    const currentWindows = this.electronApp.windows();
    const windowPromise = this.electronApp.waitForEvent("window", {
      timeout: 10000,
    });

    await action();

    const newPage = await windowPromise;
    await wait(newPage);
    await this.closeOldWindows(currentWindows, newPage);

    logger.debug(chalk.green("New window is ready:", newPage.url()));
    return newPage;
  }

  private async closeOldWindows(
    oldWindows: Page[],
    newPage: Page
  ): Promise<void> {
    for (const window of oldWindows) {
      if (window !== newPage && !window.isClosed()) {
        logger.debug(
          chalk.yellow(`Closing old window: ${await window.title()}`)
        );
        await window.close();
      }
    }
  }

  private async closeAllExcept(keepPage: Page): Promise<void> {
    if (!this.electronApp) return;

    for (const window of this.electronApp.windows()) {
      if (window !== keepPage && !window.isClosed()) {
        logger.debug(chalk.red(`close ${window.url()}`));
        await window.close();
      }
    }
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

  waitForPage(page: Page): Promise<void> {
    if (page.url().includes("starter")) {
      return this.waitForStarterReady(page);
    } else {
      return this.waitForVaultReady(page);
    }
  }

  // ===================================================================
  // Utilities
  // ===================================================================

  private async clearData(): Promise<void> {
    if (!this.electronApp) return;

    await this.deleteUserDataFiles();
    await this.clearBrowserStorage();
  }

  private async deleteUserDataFiles(): Promise<void> {
    const userDataDir = await this.electronApp!.evaluate(({ app }) =>
      app.getPath("userData")
    );

    const pathsToDelete = [
      path.join(userDataDir, "obsidian.json"),
      path.join(userDataDir, SANDBOX_VAULT_NAME),
    ];

    for (const p of pathsToDelete) {
      logger.debug("delete", p);
      rmSync(p, { force: true, recursive: true });
    }
  }

  private async clearBrowserStorage(): Promise<void> {
    const win = this.electronApp!.windows()[0];
    if (!win) return;

    logger.log(chalk.magenta("clearing..."));

    const success = await win.evaluate(async () => {
      const webContents = (
        window as any
      ).electron.remote.BrowserWindow.getFocusedWindow()
        ?.webContents as WebContents;

      if (!webContents) return false;

      webContents.session.flushStorageData();
      await webContents.session.clearStorageData({
        storages: ["indexdb", "localstorage", "websql"],
      });
      await webContents.session.clearCache();
      return true;
    });

    const message = success
      ? chalk.magenta("localStorage cleared.")
      : chalk.red("failed to clear localStorage");

    logger.log(message);
  }

  private async getUserDataPath(): Promise<string> {
    const page = await this.ensureSingleWindow();
    const userDataDir = await page.evaluate(() => {
      const app = (window as any).app;
      if (app?.vault?.adapter?.basePath) {
        return app.vault.adapter.basePath;
      }
      throw new Error("failed to get user data path");
    });
    return path.dirname(userDataDir);
  }

  private async getVaultPath(): Promise<string> {
    const name = this.options.name;
    invariant(name, "Vault name is not specified in options");
    const userDataDir = await this.getUserDataPath();
    logger.debug("userDataDir", userDataDir);

    if (userDataDir) {
      return path.join(userDataDir, name);
    }

    return path.join(
      process.env.USERPROFILE || process.env.HOME || "",
      "ObsidianVaults",
      name
    );
  }
}
