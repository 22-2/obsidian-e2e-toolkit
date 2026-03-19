// ===================================================================
// 6. ObsidianE2ELauncher.ts - メインのオーケストレーター
// ===================================================================
import chalk from "chalk";
import log from "loglevel";
import type { Page } from "playwright";
import { DEFAULT_VAULT_OPTIONS } from "./constants";
import { IPCBridge } from "./ipc";
import { createScopedLogger } from "./logger";
import { ElectronAppManager } from "./managers/ElectronAppManager";
import { PluginManager, getActualPluginId } from "./managers/PluginManager";
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
  runId?: string;
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
  private scopedLogger;

  constructor({ paths, options, tempUserDataDir, runId }: LauncherConfig) {
    this.paths = paths;
    this.options = options;
    this.tempUserDataDir = tempUserDataDir;
    this.tempVaultDir = `${tempUserDataDir}-vault`;
    this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
    this.scopedLogger = createScopedLogger("ObsidianTestLauncher", {
      runId,
      phase: "launcher",
    });
  }

  async initialize(): Promise<void> {
    const electronApp = await this.electronManager.launch();
    this.scopedLogger.debug("Electron app launched");

    this.windowManager = new WindowManager(electronApp);
    this.storageManager = new StorageManager(electronApp);

    const initialPage = await electronApp.waitForEvent("window");
    this.scopedLogger.debug("Initial window event received");

    await this.initializePlaywrightMode(initialPage);
    await PageWaiter.waitForPage(initialPage);

    this.scopedLogger.debug("Initial page ready; clearing storage and reloading");

    await this.storageManager.clearAll();
    await initialPage.evaluate(() => {
      localStorage.setItem("language", "en");
    });
    this.scopedLogger.debug("Storage cleared");
    await initialPage.reload({ waitUntil: "domcontentloaded" });
    this.scopedLogger.debug("Initial page reloaded");

    const currentPage = await this.windowManager.ensureSingleWindow();
    await PageWaiter.waitForPage(currentPage);
    this.scopedLogger.debug("Starter page ready");

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
    this.scopedLogger.debug("Vault path resolved", this.vaultPath);
    this.pluginManager = new PluginManager(
      this.options.plugins.map((plugin) => ({
        ...plugin,
        pluginId: getActualPluginId(plugin.path),
      })),
      this.vaultPath
    );
  }

  private async initializePlaywrightMode(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).playwright = true;
    });
    this.scopedLogger.debug("Enabled Playwright marker in renderer");
  }

  async cleanup(): Promise<void> {
    await this.electronManager.cleanup();
    this.scopedLogger.debug("Launcher cleanup completed");
  }

  async launch(
    options: VaultOptions = DEFAULT_VAULT_OPTIONS
  ): Promise<ObsidianPageTextContext> {
    this.validateInitialization();

    this.scopedLogger.info("Opening vault", options);

    const shouldUseSandbox = options.sandbox && !process.env.CI;
    const executeAction =
      this.windowManager!.executeActionAndWaitForNewWindow.bind(
        this.windowManager
      );

    const { page } = shouldUseSandbox
      ? await this.vaultManager!.openSandboxVault(executeAction)
      : await this.vaultManager!.openNormalVault(executeAction);

    const configuredPlugins = this.pluginManager.getPlugins() || [];
    this.scopedLogger.debug(
      "Configured plugins",
      configuredPlugins.map((p) => ({ path: p.path, pluginId: p.pluginId }))
    );
    if (configuredPlugins.length) {
      this.scopedLogger.info("Installing configured plugins");
      await this.setupPlugins(page);
      this.scopedLogger.info(
        `${this.pluginManager.getPlugins().length} plugins setup completed`
      );
    }

    this.scopedLogger.debug(
      "Creating vault context",
      this.pluginManager.getPlugins().map((p) => p.pluginId)
    );
    const context = await this.createVaultContext(page, this.pluginManager.getPlugins());
    this.scopedLogger.info("Vault context created", context.vaultName);

    // Remove all notices
    const notices = await context.page
      .locator(".notice-container .notice")
      .all();

    this.scopedLogger.debug("Removing notices");
    await Promise.all(notices.map((notice: any) => notice.click()));
    return context;
  }

  private validateInitialization(): void {
    if (!this.windowManager || !this.vaultManager || !this.ipc) {
      throw new Error("Setup not initialized. Call initialize() first.");
    }
  }

  private async setupPlugins(page: Page): Promise<void> {
    this.scopedLogger.debug("Installing plugins");
    await this.pluginManager.installAll();
    this.scopedLogger.debug("Plugins installed");

    this.scopedLogger.debug("Enabling plugins");
    await this.pluginManager.enableAll(page);
    this.scopedLogger.debug("Plugins enabled");

    this.scopedLogger.debug(chalk.blue("Reloading vault to apply plugin changes"));
    await page.reload();
    await PageWaiter.waitForPage(page);
    this.scopedLogger.debug(chalk.blue("Vault reloaded"));
  }

  private async createVaultContext(
    page: Page,
    plugins?: PluginConfig[]
  ): Promise<ObsidianPageTextContext> {
    const vaultName = await page.evaluate(() => app?.vault?.getName());
    this.scopedLogger.debug("Vault name", vaultName);

    let pluginHandleMap;
    if (!plugins || plugins.length === 0) {
      this.scopedLogger.warn("No plugins configured; skipping plugin wait");
      pluginHandleMap = await page.evaluateHandle(() => new Map());
    } else {
      pluginHandleMap = await getPluginHandleMap(page, plugins || []);
    }

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
      PageWaiter.waitForPage
    );

    await PageWaiter.waitForPage(page);

    return {
      electronApp: this.electronManager.getApp(),
      page,
    };
  }

  getVaultOptions(): VaultOptions {
    return this.options;
  }
}
