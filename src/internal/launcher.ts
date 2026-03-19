// ===================================================================
// 6. ObsidianE2ELauncher.ts - メインのオーケストレーター
// ===================================================================
import { DEFAULT_VAULT_OPTIONS } from "./constants";
import { CreateVaultContextFeature } from "./features/CreateVaultContextFeature";
import { OpenStarterFeature } from "./features/OpenStarterFeature";
import { OpenVaultFeature } from "./features/OpenVaultFeature";
import { PrepareRuntimeFeature } from "./features/PrepareRuntimeFeature";
import { SetupPluginsFeature } from "./features/SetupPluginsFeature";
import { createScopedLogger } from "./logger";
import type { ResolvedPaths } from "./path";
import { ElectronAppManager } from "./services/ElectronAppManager";
import { IPCBridge } from "./services/ipc";
import type { ServiceContext } from "./services/IService";
import { getActualPluginId, PluginManager } from "./services/PluginManager";
import { ServiceContainer, ValueService } from "./services/ServiceContainer";
import { SERVICE_IDS } from "./services/serviceIds";
import { StorageManager } from "./services/StorageManager";
import { VaultManager } from "./services/VaultManager";
import { WindowManager } from "./services/WindowManager";
import type { TestContext, VaultOptions } from "./types";

export interface LauncherConfig {
    paths: ResolvedPaths;
    options: VaultOptions;
    tempUserDataDir: string;
    runId?: string;
}

export class ObsidianE2ELauncher {
    private electronManager: ElectronAppManager;
    private services: ServiceContainer | null = null;
    private serviceContext: ServiceContext | null = null;

    private readonly prepareRuntimeFeature = new PrepareRuntimeFeature();
    private readonly openVaultFeature = new OpenVaultFeature();
    private readonly setupPluginsFeature = new SetupPluginsFeature();
    private readonly createVaultContextFeature =
        new CreateVaultContextFeature();
    private readonly openStarterFeature = new OpenStarterFeature();

    private paths: ResolvedPaths;
    private options: VaultOptions;
    private tempVaultDir: string;
    private initialized = false;
    private scopedLogger;

    constructor({ paths, options, tempUserDataDir, runId }: LauncherConfig) {
        this.paths = paths;
        this.options = options;
        this.tempVaultDir = `${tempUserDataDir}-vault`;
        this.electronManager = new ElectronAppManager(paths, tempUserDataDir);
        this.scopedLogger = createScopedLogger("ObsidianTestLauncher", {
            runId,
            phase: "launcher",
        });
    }

    /**
     * Optional explicit bootstrap.
     * launch() and openStarter() call this lazily, so callers usually do not need this.
     */
    async initialize(): Promise<void> {
        await this.ensureInitialized();
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initialized) {
            return;
        }

        const electronApp = await this.electronManager.launch();
        this.scopedLogger.debug("Electron app launched");

        const windowManager = new WindowManager(electronApp);
        const storageManager = new StorageManager(electronApp);

        const services = new ServiceContainer();
        services.register(
            new ValueService(
                SERVICE_IDS.electronManager,
                this.electronManager,
                {
                    dispose: async () => {
                        await this.electronManager.cleanup();
                    },
                },
            ),
        );
        services.register(
            new ValueService(SERVICE_IDS.windowManager, windowManager),
        );
        services.register(
            new ValueService(SERVICE_IDS.storageManager, storageManager),
        );

        const serviceContext: ServiceContext = {
            paths: this.paths,
            options: this.options,
            tempVaultDir: this.tempVaultDir,
            runtime: {
                initialized: false,
                electronApp,
            },
            logger: this.scopedLogger,
        };

        await services.setupAll(serviceContext);

        const initialPage = await electronApp.waitForEvent("window");
        this.scopedLogger.debug("Initial window event received");

        const { starterPage } = await this.prepareRuntimeFeature.run(
            { initialPage },
            serviceContext,
            services,
        );
        this.scopedLogger.debug("Starter page ready", starterPage.url());

        const ipcBridge = new IPCBridge({
            ensureSingleWindow:
                windowManager.ensureSingleWindow.bind(windowManager),
        });
        services.register(new ValueService(SERVICE_IDS.ipcBridge, ipcBridge));

        const vaultManager = new VaultManager(
            ipcBridge,
            windowManager,
            this.options,
            this.tempVaultDir,
        );
        services.register(
            new ValueService(SERVICE_IDS.vaultManager, vaultManager),
        );

        const vaultPath = await vaultManager.resolveVaultPath();
        this.scopedLogger.debug("Vault path resolved", vaultPath);

        const pluginManager = new PluginManager(
            this.options.plugins.map((plugin) => ({
                ...plugin,
                pluginId: getActualPluginId(plugin.path),
            })),
            vaultPath,
        );
        services.register(
            new ValueService(SERVICE_IDS.pluginManager, pluginManager),
        );

        serviceContext.runtime.vaultPath = vaultPath;
        serviceContext.runtime.initialized = true;

        this.services = services;
        this.serviceContext = serviceContext;
        this.initialized = true;
    }

    private requireServices(): ServiceContainer {
        if (!this.services) {
            throw new Error("Service container not initialized");
        }

        return this.services;
    }

    private requireServiceContext(): ServiceContext {
        if (!this.serviceContext) {
            throw new Error("Service context not initialized");
        }

        return this.serviceContext;
    }

    async cleanup(): Promise<void> {
        if (this.services && this.serviceContext) {
            await this.services.disposeAll(this.serviceContext);
        } else {
            await this.electronManager.cleanup();
        }

        this.initialized = false;
        this.services = null;
        this.serviceContext = null;
        this.scopedLogger.debug("Launcher cleanup completed");
    }

    async launch(options: VaultOptions = DEFAULT_VAULT_OPTIONS) {
        await this.ensureInitialized();

        const services = this.requireServices();
        const serviceContext = this.requireServiceContext();
        const pluginManager = services.getValue<PluginManager>(
            SERVICE_IDS.pluginManager,
        );

        this.scopedLogger.debug("Opening vault", options);

        const runOptions: VaultOptions = {
            ...this.options,
            ...options,
        };

        const { page } = await this.openVaultFeature.run(
            { options: runOptions },
            serviceContext,
            services,
        );

        const configuredPlugins = pluginManager.getPlugins() || [];
        this.scopedLogger.debug(
            "Configured plugins",
            configuredPlugins.map((p) => ({
                path: p.path,
                pluginId: p.pluginId,
            })),
        );
        if (configuredPlugins.length) {
            this.scopedLogger.debug("Installing configured plugins");
            await this.setupPluginsFeature.run(
                { page },
                serviceContext,
                services,
            );
            this.scopedLogger.debug(
                `${pluginManager.getPlugins().length} plugins setup completed`,
            );
        }

        this.scopedLogger.debug(
            "Creating vault context",
            pluginManager.getPlugins().map((p) => p.pluginId),
        );
        const context = await this.createVaultContextFeature.run(
            { page, plugins: pluginManager.getPlugins() },
            serviceContext,
            services,
        );
        this.scopedLogger.debug("Vault context created", context.vaultName);

        // Remove all notices
        const notices = await context.page
            .locator(".notice-container .notice")
            .all();

        this.scopedLogger.debug("Removing notices");
        await Promise.all(notices.map((notice: any) => notice.click()));
        return context;
    }

    async openStarter(): Promise<TestContext> {
        await this.ensureInitialized();
        return this.openStarterFeature.run(
            undefined,
            this.requireServiceContext(),
            this.requireServices(),
        );
    }

    getVaultOptions(): VaultOptions {
        return this.options;
    }
}
