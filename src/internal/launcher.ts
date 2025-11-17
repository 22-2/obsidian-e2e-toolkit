// ===================================================================
// 6. ObsidianE2ELauncher.ts - メインのオーケストレーター
// ===================================================================
import chalk from "chalk";
import log from "loglevel";
import type { Page } from "playwright";
import { DEFAULT_VAULT_OPTIONS } from "./constants";
import { IPCBridge } from "./ipc";
import { ElectronAppManager } from "./managers/ElectronAppManager";
import { PluginManager } from "./managers/PluginManager";
import { StorageManager } from "./managers/StorageManager";
import { VaultManager } from "./managers/VaultManager";
import { WindowManager } from "./managers/WindowManager";
import { PageWaiter } from "./PageWaiter";
import type { ResolvedPaths } from "./path";
import type {
  ObsidianPageTextContext,
  PluginConfig,
  TestContext,
  VaultOptions,
} from "./types";
import { getPluginHandleMap } from "./utils";

const logger = log.getLogger("ObsidianTestLauncher");

export interface LauncherConfig {
  paths: ResolvedPaths;
  options: VaultOptions;
  tempUserDataDir: string;
}

export class ObsidianE2ELauncher {
  private electronManager: ElectronAppManager;
  private windowManager!: WindowManager;
  private vaultManager!: VaultManager;
  private storageManager!: StorageManager;
  private pluginManager!: PluginManager;
  private ipc!: IPCBridge;
  private paths: ResolvedPaths;
  private options: VaultOptions;
  private tempUserDataDir: string;
  private tempVaultDir: string;
  private vaultPath: string | null = null;

  constructor({ paths, options, tempUserDataDir }: LauncherConfig) {
    this.paths = paths;
    this.options = options;
    this.tempUserDataDir = tempUserDataDir;
    this.tempVaultDir = `${tempUserDataDir}-vault`;
    this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
  }

  async initialize(): Promise<void> {
    const electronApp = await this.electronManager.launch();

    this.windowManager = new WindowManager(electronApp);
    this.storageManager = new StorageManager(electronApp);

    const initialPage = await electronApp.waitForEvent("window");
    await this.initializePlaywrightMode(initialPage);
    await PageWaiter.waitForStarterReady(initialPage);

    logger.debug("starter ready");

    await this.storageManager.clearAll();
    await initialPage.reload({ waitUntil: "domcontentloaded" });

    const currentPage = await this.windowManager.ensureSingleWindow();
    await PageWaiter.waitForPage(currentPage);
    logger.debug("init start page");

    this.ipc = new IPCBridge({
      ensureSingleWindow: this.windowManager.ensureSingleWindow.bind(
        this.windowManager
      ),
    });
    this.vaultManager = new VaultManager(
      this.ipc,
      this.options,
      this.tempVaultDir
    );

    // Resolve vault path once and store it
    this.vaultPath = await this.vaultManager.resolveVaultPath();
    this.pluginManager = new PluginManager(
      this.options.plugins,
      this.vaultPath
    );
  }

  private async initializePlaywrightMode(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).playwright = true;
    });
    logger.debug("enable obsidian debug mode");
  }

  async cleanup(): Promise<void> {
    await this.electronManager.cleanup();
    logger.debug("[ObsidianTestSetup] cleaned All");
  }

  async launch(
    options: VaultOptions = DEFAULT_VAULT_OPTIONS
  ): Promise<ObsidianPageTextContext> {
    this.validateInitialization();

    logger.debug("open vault", options);

    const shouldUseSandbox = options.sandbox && !process.env.CI;
    const executeAction =
      this.windowManager!.executeActionAndWaitForNewWindow.bind(
        this.windowManager
      );

    const { page } = shouldUseSandbox
      ? await this.vaultManager!.openSandboxVault(executeAction)
      : await this.vaultManager!.openNormalVault(executeAction);

    if (this.pluginManager.getPlugins()?.length) {
      logger.debug("Installing plugins...");
      await this.setupPlugins(page);
      logger.debug(
        `${this.pluginManager.getPlugins().length} Plugins setup completed.`
      );
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
    if (!this.windowManager || !this.vaultManager || !this.ipc) {
      throw new Error("Setup not initialized. Call initialize() first.");
    }
  }

  private async setupPlugins(page: Page): Promise<void> {
    logger.debug("Installing plugins...");
    await this.pluginManager.installAll();
    logger.debug("Plugins installed.");

    logger.debug("Enabling plugins...");
    await this.pluginManager.enableAll(page);
    logger.debug("Plugins enabled.");

    logger.debug(chalk.blue("Reloading vault to apply plugin changes..."));
    await page.reload();
    await PageWaiter.waitForVaultReady(page);
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
      electronApp: this.electronManager.getApp(),
      page,
      pluginHandleMap,
      vaultName,
      paths: this.paths,
    };
  }

  async openStarter(): Promise<TestContext> {
    this.validateInitialization();

    const page = await this.windowManager!.executeActionAndWaitForNewWindow(
      async () => await this.ipc!.openStarter(),
      PageWaiter.waitForStarterReady
    );

    await PageWaiter.waitForStarterReady(page);

    return {
      electronApp: this.electronManager.getApp(),
      page,
    };
  }

  getVaultOptions(): VaultOptions {
    return this.options;
  }
}
