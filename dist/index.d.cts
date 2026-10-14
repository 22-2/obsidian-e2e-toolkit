import { t as CoverageOptions } from "./types-DsGkhM3S.cjs";
import { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import log from "loglevel";
import { PlaywrightTestConfig, expect } from "@playwright/test";
//#region src/internal/runtime/reloadInterceptor.d.ts
interface ReloadRequest {
  /** app:reload を受けた時点の app.plugins.enabledPlugins を昇順に複製したもの。 */
  enabledPluginIds: string[];
}
interface ReloadInterceptor {
  /** 1 回でも app:reload が要求されたら true。 */
  requested(): Promise<boolean>;
  /** 要求ごとのスナップショット。呼び出し順。 */
  requests(): Promise<ReloadRequest[]>;
  /** 差し替えを元に戻す。2 回目以降は no-op。restore 後も requests() は restore 時点の記録を返す。 */
  restore(): Promise<void>;
}
//#endregion
//#region src/internal/runtime/presentation.d.ts
type MobileKind = "phone" | "tablet";
type MobilePlatform = "android" | "ios";
//#endregion
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
//#region src/internal/coverage/collector.d.ts
declare class PluginCoverageCollector {
  private readonly targets;
  private readonly outputDir;
  private readonly pages;
  private readonly entries;
  private constructor();
  static create(options: CoverageOptions, fallbackPaths: readonly string[]): Promise<PluginCoverageCollector>;
  start(page: Page): Promise<void>;
  collect(page: Page): Promise<void>;
  checkpoint(page: Page): Promise<void>;
  save(testId: string): Promise<string>;
}
//#endregion
//#region src/internal/utils.d.ts
declare function getPluginHandleMap(page: Page, plugins: {
  pluginId: string;
  path: string;
}[]): Promise<PluginHandleMap>;
//#endregion
//#region src/ObsidianAPI.d.ts
interface ReloadOptions {
  /** 再読込の前にレイアウトを保存する。既定 true。 */
  saveLayout?: boolean;
  /** 再読込と plugin 準備の待ち時間（ms）。既定 30000。 */
  timeout?: number;
  /** 待つ plugin の ID。省略時は再読込の直前に読み込まれていた plugin。空配列なら待たない。 */
  expectLoaded?: string[];
}
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
export declare class ObsidianAPI {
  page: Page;
  private context;
  private readonly reloadInterceptors;
  constructor(context: ObsidianPageTextContext);
  /**
   * Playwright's handle to the Electron main process.
   * Use it for things the renderer cannot do, such as `electronApp.evaluate(({ BrowserWindow }) => ...)`
   * to blur or focus a window.
   */
  get electronApp(): ElectronApplication;
  /**
   * Run a function inside the Obsidian renderer, where the global `app` is available.
   * Prefer this over `page.evaluate` + `(window as any).app`.
   */
  evaluateApp<T, Arg = undefined>(callback: (arg: Arg) => T | Promise<T>, arg?: Arg): Promise<T>;
  private appState;
  activeLeaf(): Promise<WorkspaceLeafState | null>;
  activeEditor(): Promise<WorkspaceEditorState | null>;
  activeTab(): Promise<WorkspaceLeafState | null>;
  allTabs(): Promise<WorkspaceLeafState[]>;
  view(viewType: string): Promise<WorkspaceLeafState | null>;
  vaultName(): Promise<string>;
  title(viewType: string): Promise<string | null>;
  allViews(viewType: string): Promise<WorkspaceLeafState[]>;
  /** コマンドを実行し、実行されなければ失敗させる。 */
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
  /** Create a note through the vault API (creates parent folders, updates the metadata cache). */
  createNote(path: string, content?: string): Promise<void>;
  delete(path: string): Promise<void>;
  open(path: string): Promise<void>;
  waitForFile(path: string, timeout?: number): Promise<void>;
  plugin<T = any>(pluginId: string): Promise<JSHandle<T>>;
  /** Read the plugin's persisted data (data.json) via `plugin.loadData()`. */
  pluginData<T = Record<string, any>>(pluginId: string): Promise<T | null>;
  /** Shallow-merge `patch` into the plugin's persisted data via `plugin.saveData()`. */
  setPluginData(pluginId: string, patch: Record<string, unknown>): Promise<void>;
  /** Read the startup-enabled setting, independently of the plugin's load state. */
  isPluginEnabled(pluginId: string): Promise<boolean>;
  /** Wait for the startup-enabled setting; use `waitForPluginLoaded` for runtime state. */
  waitForPluginEnabled(pluginId: string, timeout?: number): Promise<void>;
  /** Wait for the startup-disabled setting; use `waitForPluginUnloaded` for runtime state. */
  waitForPluginDisabled(pluginId: string, timeout?: number): Promise<void>;
  /** Read the actual load state, independently of the startup-enabled setting. */
  isPluginLoaded(pluginId: string): Promise<boolean>;
  /** Wait until the plugin is loaded, regardless of its startup-enabled setting. */
  waitForPluginLoaded(pluginId: string, timeout?: number): Promise<void>;
  /** Wait until the plugin is unloaded, regardless of its startup-enabled setting. */
  waitForPluginUnloaded(pluginId: string, timeout?: number): Promise<void>;
  pluginState(pluginId: string): Promise<{
    enabled: boolean;
    loaded: boolean;
    registered: boolean;
  }>;
  /**
   * Unload and reload a plugin so it re-reads its data.json (e.g. after `setPluginData`).
   * The handle returned by `plugin(id)` is refreshed to the new plugin instance.
   */
  reloadPlugin(pluginId: string): Promise<void>;
  rebuildPlugins(vaultOptions: VaultOptions, getPluginHandleMapFn?: typeof getPluginHandleMap): Promise<ObsidianPageTextContext>;
  updateContext(context: ObsidianPageTextContext): void;
  /**
   * 設定ウィンドウを開いて tab を選び、その Page を返す。既に開いていれば同じウィンドウを返す。
   * subPage を渡すと、設定画面の項目名（.setting-item-name）のうち表示文字列が完全一致する可視の要素をクリックする。
   */
  openSettings(tabId: string, options?: {
    subPage?: string;
    timeout?: number;
  }): Promise<Page>;
  /** 設定ウィンドウを閉じ、設定画面が見えなくなるまで待つ。 */
  closeSettings(options?: {
    timeout?: number;
  }): Promise<void>;
  /**
   * 開いているどのウィンドウでも、locate が返す要素のうち可視なものが 1 つ以上になるまで待ち、そのウィンドウの Page を返す。
   * 待機中に開いたウィンドウも対象になる。timeout のエラーには各ウィンドウの一致数を載せる。
   */
  findPage(locate: (page: Page) => Locator, options?: {
    timeout?: number;
    description?: string;
  }): Promise<Page>;
  /**
   * レイアウトを保存してからページを再読込し、plugin の読み込みと CSS 適用を待つ。
   * 待つ対象は、再読込の直前に読み込まれていた plugin（expectLoaded を渡すとその ID）。
   * plugin の有効化・無効化は行わない。
   */
  reload(options?: ReloadOptions): Promise<void>;
  /**
   * app:reload だけを差し替えて呼び出しを記録する。他のコマンドは本当に実行される（this・引数・戻り値を保つ）。
   * 同じページで有効な差し替えは 1 つだけ。テスト終了時に fixture が自動で戻す。
   */
  interceptReload(): Promise<ReloadInterceptor>;
  /** fixture の終了処理から呼ばれる。残っている差し替えを元に戻す。 */
  restoreReloadInterceptors(): Promise<void>;
  private invalidateReloadInterceptors;
  /** vault のディスク上の絶対パス。 */
  vaultPath(): Promise<string>;
  /** 設定ディレクトリ名（通常は .obsidian）。 */
  configDir(): Promise<string>;
  /** 設定ディレクトリ配下の JSON を読む。file は相対パスのみ。vault の外へ出る指定は拒否する。 */
  readConfig<T = unknown>(file: string): Promise<T>;
  /** community-plugins.json に載っている有効な plugin の ID 一覧。 */
  enabledPluginsOnDisk(): Promise<string[]>;
  /** 読み込まれた plugin の settings を読む（読み取り専用）。 */
  pluginSettings<T = Record<string, unknown>>(pluginId: string): Promise<T>;
  /** settings に patch を浅くマージし、plugin の saveSettings() で保存する。UI の再描画は行わない。 */
  updatePluginSettings(pluginId: string, patch: Record<string, unknown>): Promise<void>;
  /**
   * plugin インスタンスを渡して fn を renderer 内で実行する。fn は (plugin, arg) を受け取る。
   * fn はシリアライズされて実行されるため、外側の変数を参照しないこと。
   */
  evaluatePlugin<T, P = unknown, Arg = undefined>(pluginId: string, fn: (plugin: P, arg: Arg) => T | Promise<T>, arg?: Arg): Promise<T>;
  /** 左右のサイドバーを閉じる。 */
  collapseSidebars(): Promise<void>;
  /** 指定の view type を開いて前面に出す。newLeaf が true なら新しいタブ、既定はアクティブ leaf を使う。 */
  openView(viewType: string, state?: Record<string, unknown>, options?: {
    newLeaf?: boolean;
  }): Promise<void>;
  /** 指定 view type の先頭 leaf を前面に出し、遅延読み込みなら描画させる。無ければ例外。 */
  revealView(viewType: string): Promise<void>;
  /** 開いている leaf を 1 行ずつ整形する。失敗メッセージに載せる用途。 */
  describeLeaves(): Promise<string>;
  /** body のテーマクラスを切り替える。設定ファイルは変えない。 */
  setTheme(theme: "dark" | "light", page?: Page): Promise<void>;
  /**
   * CSS クラスだけでモバイル表示を再現する。viewport と Platform.isMobile は変わらない。
   * 既定の platform は android（lazy の既存の撮影が使う is-android を維持するため）。
   */
  emulateMobile(kind: MobileKind, page?: Page, options?: {
    platform?: MobilePlatform;
  }): Promise<void>;
  /** 無限でない実行中のアニメーションが終わるまで待つ。無限のアニメーション（ローディング等）は待たない。 */
  waitForAnimations(page?: Page, options?: {
    timeout?: number;
  }): Promise<void>;
  /** コマンドが登録されているか。pluginId:name の形式では ID マッピングも試す。 */
  hasCommand(commandId: string): Promise<boolean>;
  /** 接頭辞に一致する command ID の一覧。 */
  findCommands(prefix: string): Promise<string[]>;
  /**
   * コマンドを実行し、実行されたかを返す。ID が無い・実行されなかった場合は false。
   * コマンド内で投げられた例外は隠さず、そのまま呼び出し元へ伝える。
   */
  tryCommand(commandId: string): Promise<boolean>;
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
  /** coverage 有効時だけ入る。reload 前の checkpoint に使う。外部から組み立てた context では省略できる。 */
  coverage?: PluginCoverageCollector;
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
  /** Use the official Obsidian CLI when it targets the same vault. */
  obsidianCli?: ObsidianCliMode;
  /** Plugin fixtures to install into the test vault. */
  plugins: readonly TestPlugin[];
}
type ObsidianCliMode = "off" | "auto" | "required";
interface TestPlugin {
  path: string;
  symlink?: boolean;
  /** Initial contents of the plugin's data.json (written on install; ignored for symlinked plugins). */
  data?: Record<string, unknown>;
}
type TestFixtures = {
  obsidian: ObsidianAPI;
  vaultOptions: Partial<VaultOptions>;
  coverageOptions: CoverageOptions;
  tempDir: string;
};
//#endregion
//#region src/fetchPlugin.d.ts
type PluginSource = string | {
  repo: string;
  tag?: string;
};
interface FetchPluginOptions {
  /** この release tag だけを取得する。省略すると latest を使う。 */
  tag?: string;
  /** marker と必須ファイルが一致する取得結果を再利用する。既定 true。latest は毎回 API で確認する。 */
  cache?: boolean;
  /** リリースが使えない時、または取得に失敗した時に git clone する。既定 false。 */
  fallbackToGit?: boolean;
}
/**
 * GitHub の plugin repo を dest に取得して、main.js と manifest.json が揃った状態で返す。
 * 検証に通らない取得は成功にしない。既存の dest は、空、または toolkit / 旧 lazy の marker を持つ場合だけ置き換える。
 */
export declare function fetchPlugin(repo: string, destArg?: string, opts?: FetchPluginOptions): Promise<string>;
//#endregion
//#region src/config.d.ts
/**
 * Playwright の設定に Obsidian E2E 向けの既定値を加える。
 * 利用者が明示した値（undefined を除く）は既定値より優先する。
 * 何度重ねて呼んでも利用者の値は消えない。Linux でも例外にしない。
 */
export declare function defineObsidianConfig(overrides?: PlaywrightTestConfig): PlaywrightTestConfig;
//#endregion
//#region src/preparePlugin.d.ts
interface PreparePluginInput {
  /** manifest.json の path。id と version は空でない文字列が必要。親 folder を元のプロジェクト root として記録する。 */
  manifest: string;
  /** ビルド済みの main.js の path。空ファイルは拒否する。 */
  main: string;
  /** styles.css の path（省略可）。 */
  styles?: string;
  /** main.js.map の path（省略可）。省略時は main.js の sourceMappingURL（inline か外部ファイル）を使う。 */
  sourceMap?: string;
}
/**
 * 分散したビルド成果物を1つの plugin dir にまとめる。
 * source map は元の場所基準の絶対 file URL に書き換え、必須ファイルと source の解決可否を
 * staging 上で検査してから dest を置き換える。
 */
export declare function preparePlugin(input: PreparePluginInput, dest: string): Promise<string>;
//#endregion
//#region src/preparePlugins.d.ts
interface PreparePluginsOptions {
  /** 既存の取得結果を再利用する。既定 true。 */
  cache?: boolean;
  /** リリースが使えない時に git clone する。省略時は tag 指定の source だけ true（既存 lazy の挙動）。 */
  fallbackToGit?: boolean;
  /** baseDir からの配置先。既定 "myfiles"。 */
  destDir?: string;
}
/**
 * sources の各 plugin を baseDir/destDir/<key> に取得して配置する。
 * 1件でも失敗したら、すべての失敗を1つのエラーにまとめて投げる。
 * key は配置先の folder 名であり、manifest.id と一致させる必要はない。
 */
export declare function preparePlugins(sources: Record<string, PluginSource>, baseDir: string, opts?: PreparePluginsOptions): Promise<Record<string, string>>;
//#endregion
//#region src/index.d.ts
export declare const logger: log.Logger;
export declare const test: import("playwright/test").TestType<import("playwright/test").PlaywrightTestArgs & import("playwright/test").PlaywrightTestOptions & TestFixtures, import("playwright/test").PlaywrightWorkerArgs & import("playwright/test").PlaywrightWorkerOptions>;
//#endregion
export { type CoverageOptions, type FetchPluginOptions, type ObsidianCliMode, type PluginSource, type PreparePluginInput, type PreparePluginsOptions, type ReloadInterceptor, type ReloadOptions, type ReloadRequest, type VaultOptions, expect };
//# sourceMappingURL=index.d.cts.map