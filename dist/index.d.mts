import log from "loglevel";
import { expect } from "@playwright/test";
import { ElectronApplication, JSHandle, Page } from "playwright";

//#region src/internal/path.d.ts
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
//#endregion
//#region src/internal/utils.d.ts
declare function getPluginHandleMap(page: Page, plugins: {
  pluginId: string;
  path: string;
}[]): Promise<PluginHandleMap>;
//#endregion
//#region src/ObsidianAPI.d.ts
interface ItemView {
  [key: string]: any;
}
interface WorkspaceLeafState {
  active: boolean;
  viewType: string | null;
  filePath: string | null;
  title: string | null;
}
interface WorkspaceEditorState {
  viewType: string | null;
  filePath: string | null;
  content: string;
}
/**
 * シンプルで直感的なObsidian APIクラス
 */
declare class ObsidianAPI {
  page: Page;
  private context;
  constructor(context: ObsidianPageTextContext);
  private appState;
  activeLeaf(): Promise<WorkspaceLeafState | null>;
  activeEditor(): Promise<WorkspaceEditorState | null>;
  activeTab(): Promise<WorkspaceLeafState | null>;
  allTabs(): Promise<WorkspaceLeafState[]>;
  view(viewType: string): Promise<WorkspaceLeafState | null>;
  vaultName(): Promise<string>;
  title(viewType: string): Promise<string | null>;
  allViews(viewType: string): Promise<WorkspaceLeafState[]>;
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
  waitReady(timeout?: number): Promise<void>;
  waitForApp<Arg = undefined>(predicate: (arg: Arg) => boolean, arg?: Arg, timeout?: number): Promise<void>;
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
  waitForPluginEnabled(pluginId: string, timeout?: number): Promise<void>;
  waitForPluginDisabled(pluginId: string, timeout?: number): Promise<void>;
  pluginState(pluginId: string): Promise<{
    enabled: boolean;
    loaded: boolean;
    registered: boolean;
  }>;
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
//#endregion
//#region src/internal/types.d.ts
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
interface BrowserConsoleLoggingOptions {
  /** Console message types to capture from Playwright's page "console" event. */
  enabledTypes?: string[];
  /** Hard limit for a single logged message length before truncation is applied. */
  maxMessageLength?: number;
  /** Number of characters to keep in the visible preview when truncating. */
  previewLength?: number;
  /** Case-insensitive regex patterns; matching messages are skipped entirely. */
  ignoredMessagePatterns?: string[];
  /** Case-insensitive regex patterns; matching browser errors are downgraded to warn. */
  demoteErrorMessagePatterns?: string[];
  /** Whether to include source URL/line/column for browser console entries. */
  includeLocation?: boolean;
  /** Whether to forward page-level runtime errors (pageerror event). */
  includePageErrors?: boolean;
  /** Whether to forward failed network requests (requestfailed event). */
  includeRequestFailures?: boolean;
  /** Whether to log HTTP responses whose status meets the configured threshold. */
  includeHttpErrors?: boolean;
  /** Minimum status code treated as HTTP error for browser response logging. */
  httpErrorThreshold?: number;
}
interface VaultOptions {
  /** Vault directory name. If omitted, a temporary vault directory is created. */
  name?: string;
  /** Open Obsidian in sandbox mode (typically disabled in CI). */
  sandbox?: boolean;
  /** Start from a clean vault state for each test run. */
  fresh?: boolean;
  /** Global toolkit logger level for the current test run. */
  logLevel?: log.LogLevelDesc;
  /** Enable forwarding browser-side console logs into toolkit logger. */
  enableBrowserConsoleLogging?: boolean;
  /** Fine-grained browser console logging behavior (filtering/truncation/threshold). */
  browserConsoleLogging?: BrowserConsoleLoggingOptions;
  /** Plugin fixtures to install into the test vault. */
  plugins: TestPlugin[];
}
interface TestPlugin {
  path: string;
  symlink?: boolean;
}
type TestFixtures = {
  obsidian: ObsidianAPI;
  vaultOptions: Partial<VaultOptions>;
  tempDir: string;
};
//#endregion
//#region src/fetchPlugin.d.ts
declare function fetchPlugin(repo: string, destArg?: string, opts?: {
  fallbackToGit?: boolean;
}): Promise<string>;
//#endregion
//#region src/index.d.ts
declare const logger: log.Logger;
declare const test: import("playwright/test").TestType<import("playwright/test").PlaywrightTestArgs & import("playwright/test").PlaywrightTestOptions & TestFixtures, import("playwright/test").PlaywrightWorkerArgs & import("playwright/test").PlaywrightWorkerOptions>;
//#endregion
export { ObsidianAPI, type VaultOptions, expect, fetchPlugin, logger, test };
//# sourceMappingURL=index.d.mts.map