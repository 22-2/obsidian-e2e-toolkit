import * as playwright_test from 'playwright/test';
import log from 'loglevel';
import { Page, Locator, JSHandle, ElectronApplication } from 'playwright';
export { expect } from '@playwright/test';

/**
 * Resolved paths for Obsidian E2E testing
 */
interface ResolvedPaths {
    pluginDir: string;
    distDir: string;
    assetsDir: string;
    obsidianUnpackedDir: string;
    appMainFile: string;
    appMainJsPath: string;
    pluginId: string;
    manifest: {
        id: string;
        name: string;
        version: string;
        [key: string]: any;
    };
}

declare function getPluginHandleMap(page: Page, plugins: {
    pluginId: string;
    path: string;
}[]): Promise<PluginHandleMap>;

interface ItemView {
    [key: string]: any;
}
/**
 * シンプルで直感的なObsidian APIクラス
 */
declare class ObsidianAPI {
    page: Page;
    private context;
    private readonly sel;
    constructor(context: ObsidianPageTextContext);
    get activeLeaf(): Locator;
    get activeEditor(): Locator;
    get activeTab(): Locator;
    get allTabs(): Locator;
    view(viewType: string): Locator;
    vaultName(): Promise<string>;
    title(viewType: string): Locator;
    allViews(viewType: string): Locator;
    command(commandId: string): Promise<void>;
    split(direction?: "vertical" | "horizontal"): Promise<void>;
    closeTab(): Promise<void>;
    clickClose(): Promise<void>;
    undoClose(): Promise<void>;
    back(): Promise<void>;
    forward(): Promise<void>;
    switchToLeaf(index: number): Promise<void>;
    activeViewType(): Promise<string | null>;
    openingFiles(): Promise<string[]>;
    waitReady(): Promise<void>;
    waitForView<T extends ItemView>(viewType: string): Promise<JSHandle<T>>;
    waitForViewType(viewType: string, timeout?: number): Promise<void>;
    clear(): Promise<void>;
    content(): Promise<string | undefined>;
    filePath(): Promise<string | null>;
    tabTitle(): Promise<string | null>;
    write(content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
    save(path: string, content: string): Promise<void>;
    delete(path: string): Promise<void>;
    open(path: string): Promise<void>;
    waitForFile(path: string, timeout?: number): Promise<void>;
    plugin<T = any>(pluginId: string): Promise<JSHandle<T>>;
    isPluginEnabled(pluginId: string): Promise<boolean>;
    rebuildPlugins(vaultOptions: VaultOptions, getPluginHandleMapFn?: typeof getPluginHandleMap): Promise<ObsidianPageTextContext>;
    updateContext(context: ObsidianPageTextContext): void;
    expectViews(viewType: string, count: number): Promise<void>;
    expectTitle(viewType: string, title: string): Promise<void>;
    expectTitleContains(viewType: string, text: string): Promise<void>;
    expectActiveType(type: string): Promise<void>;
    expectTabs(count: number): Promise<void>;
    expectExists(path: string): Promise<void>;
    expectNotExists(path: string): Promise<void>;
    expectContent(content: string): Promise<void>;
    expectContentContains(text: string): Promise<void>;
    titleBarText(): Promise<string | null>;
    tabHeaderText(): Promise<string | null>;
    measureTime(action: () => Promise<void>): Promise<number>;
    search(text: string, selector?: string): Promise<void>;
    clearSearch(selector?: string): Promise<void>;
}

interface Plugin {
    [key: string]: any;
}
type PluginHandleMap = JSHandle<Map<string, Plugin>>;
interface TestContext {
    electronApp: ElectronApplication;
    page: Page;
    vaultName?: string;
}
interface ObsidianPageTextContext extends TestContext {
    pluginHandleMap: PluginHandleMap;
    paths: ResolvedPaths;
}
interface VaultOptions {
    name?: string;
    sandbox?: boolean;
    fresh?: boolean;
    logLevel?: log.LogLevelDesc;
    enableBrowserConsoleLogging?: boolean;
    plugins: TestPlugin[];
}
interface TestPlugin {
    path: string;
    pluginId: string;
    symlink?: boolean;
}
type TestFixtures = {
    obsidian: ObsidianAPI;
    vaultOptions: Partial<VaultOptions>;
    tempDir: string;
};

declare function fetchPlugin(repo: string, destArg?: string, opts?: {
    fallbackToGit?: boolean;
}): Promise<string>;

declare const logger: log.Logger;
declare const test: playwright_test.TestType<playwright_test.PlaywrightTestArgs & playwright_test.PlaywrightTestOptions & TestFixtures, playwright_test.PlaywrightWorkerArgs & playwright_test.PlaywrightWorkerOptions>;

export { ObsidianAPI, type VaultOptions, fetchPlugin, logger, test };
