import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ElectronApplication, JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import invariant from "tiny-invariant";
import { CMD_ID_CLOSE_TAB, CMD_ID_UNDO_CLOSE_TAB } from "./internal/constants";
import { readJsonInside } from "./internal/runtime/config";
import { refreshPluginHandleMap } from "./internal/runtime/reload";
import { ReloadInterceptorSession, installReloadInterceptor, type ReloadInterceptor } from "./internal/runtime/reloadInterceptor";
import { MANAGED_MOBILE_CLASSES, mobileClassNames, type MobileKind, type MobilePlatform } from "./internal/runtime/presentation";
import { SETTINGS_WINDOW_MARKER, settingItemNamed } from "./internal/runtime/settings";
import { findVisiblePage, waitUntilNoVisiblePage } from "./internal/runtime/windowSearch";
import { PageWaiter } from "./internal/services/PageWaiter";
import { getActualPluginId, waitForPluginFixtures } from "./internal/services/PluginManager";
import type { ObsidianPageTextContext, VaultOptions } from "./internal/types";
import { getPluginHandleMap } from "./internal/utils";

export type { ReloadInterceptor, ReloadRequest } from "./internal/runtime/reloadInterceptor";

interface SettingHost {
    setting: { open(): void; openTabById(id: string): void; close(): void };
}

interface WorkspaceSaver {
    saveLayout(): Promise<void>;
}

interface CommandIndexHost {
    findCommand(id: string): unknown;
    commands: Record<string, unknown>;
}

interface PluginIdMappingHost {
    __pluginIdMapping?: Map<string, string>;
}

export interface ReloadOptions {
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
export class ObsidianAPI {
    public page: Page;
    private context: ObsidianPageTextContext;
    private readonly reloadInterceptors = new Set<ReloadInterceptorSession>();

    constructor(context: ObsidianPageTextContext) {
        invariant(context.page, "Page context is required");
        this.page = context.page;
        this.context = context;
    }

    /**
     * Playwright's handle to the Electron main process.
     * Use it for things the renderer cannot do, such as `electronApp.evaluate(({ BrowserWindow }) => ...)`
     * to blur or focus a window.
     */
    get electronApp(): ElectronApplication {
        return this.context.electronApp;
    }

    /**
     * Run a function inside the Obsidian renderer, where the global `app` is available.
     * Prefer this over `page.evaluate` + `(window as any).app`.
     */
    evaluateApp<T, Arg = undefined>(
        callback: (arg: Arg) => T | Promise<T>,
        arg?: Arg,
    ): Promise<T> {
        return this.appState(callback, arg);
    }

    private appState<T, Arg = undefined>(
        callback: (arg: Arg) => T | Promise<T>,
        arg?: Arg,
    ): Promise<T> {
        return this.page.evaluate(callback as any, arg as any);
    }

    // ========================================
    // Workspace State - DOMを介さない状態参照
    // ========================================

    async activeLeaf(): Promise<WorkspaceLeafState | null> {
        return this.appState(() => {
            const leaf = app.workspace.activeLeaf as any;
            if (!leaf) {
                return null;
            }

            const view = leaf.view as any;
            const file = view?.file ?? app.workspace.getActiveFile();
            return {
                active: true,
                viewType:
                    typeof view?.getViewType === "function"
                        ? view.getViewType()
                        : null,
                filePath: file?.path ?? null,
                title:
                    typeof view?.getDisplayText === "function"
                        ? (view.getDisplayText() ?? file?.basename ?? null)
                        : (file?.basename ?? null),
            } satisfies WorkspaceLeafState;
        });
    }

    async activeEditor(): Promise<WorkspaceEditorState | null> {
        return this.appState(() => {
            const leaf = app.workspace.activeLeaf as any;
            const editor = app.workspace.activeEditor?.editor;
            if (!leaf || !editor) {
                return null;
            }

            const view = leaf.view as any;
            const file = view?.file ?? app.workspace.getActiveFile();
            return {
                viewType:
                    typeof view?.getViewType === "function"
                        ? view.getViewType()
                        : null,
                filePath: file?.path ?? null,
                content: editor.getValue() ?? "",
            } satisfies WorkspaceEditorState;
        });
    }

    async activeTab(): Promise<WorkspaceLeafState | null> {
        return this.activeLeaf();
    }

    async allTabs(): Promise<WorkspaceLeafState[]> {
        return this.appState(() => {
            // `iterateAllLeaves` can miss tabs opened in the background on Obsidian 1.14.4
            // (`getLeaf("tab").openFile(file, { active: false })`), so merge in `getLeavesOfType`.
            const found = new Set<any>();
            app.workspace.iterateAllLeaves((leaf: any) => found.add(leaf));
            for (const type of Object.keys(
                (app as any).viewRegistry?.viewByType ?? {},
            )) {
                for (const leaf of app.workspace.getLeavesOfType(type)) {
                    found.add(leaf);
                }
            }
            const leaves: any[] = [...found];

            return leaves.map((leaf) => {
                // Background tabs may be deferred views (no `view.file`), so fall back to the saved view state.
                const view = leaf.view as any;
                const state = leaf.getViewState?.() as any;
                const filePath: string | null =
                    view?.file?.path ?? state?.state?.file ?? null;
                const basename = filePath
                    ? (filePath.split("/").pop() ?? "").replace(/\.[^.]+$/, "")
                    : null;
                return {
                    active: leaf === app.workspace.activeLeaf,
                    viewType:
                        typeof view?.getViewType === "function"
                            ? view.getViewType()
                            : (state?.type ?? null),
                    filePath,
                    title:
                        typeof view?.getDisplayText === "function"
                            ? (view.getDisplayText() ?? basename)
                            : (leaf.getDisplayText?.() ?? basename),
                } satisfies WorkspaceLeafState;
            });
        });
    }

    async view(viewType: string): Promise<WorkspaceLeafState | null> {
        return this.appState((type: string) => {
            const leaf = app.workspace.activeLeaf as any;
            const view = leaf?.view as any;
            if (
                !leaf ||
                typeof view?.getViewType !== "function" ||
                view.getViewType() !== type
            ) {
                return null;
            }

            const file = view?.file ?? app.workspace.getActiveFile();
            return {
                active: true,
                viewType: view.getViewType(),
                filePath: file?.path ?? null,
                title:
                    typeof view?.getDisplayText === "function"
                        ? (view.getDisplayText() ?? file?.basename ?? null)
                        : (file?.basename ?? null),
            } satisfies WorkspaceLeafState;
        }, viewType);
    }

    vaultName(): Promise<string> {
        return this.appState(() => app.vault.getName());
    }

    async title(viewType: string): Promise<string | null> {
        const view = await this.view(viewType);
        return view?.title ?? null;
    }

    async allViews(viewType: string): Promise<WorkspaceLeafState[]> {
        return this.appState((type: string) => {
            // `iterateAllLeaves` can miss tabs opened in the background on Obsidian 1.14.4
            // (`getLeaf("tab").openFile(file, { active: false })`), so merge in `getLeavesOfType`.
            const found = new Set<any>();
            app.workspace.iterateAllLeaves((leaf: any) => found.add(leaf));
            for (const type of Object.keys(
                (app as any).viewRegistry?.viewByType ?? {},
            )) {
                for (const leaf of app.workspace.getLeavesOfType(type)) {
                    found.add(leaf);
                }
            }
            const leaves: any[] = [...found];

            return leaves
                .filter(
                    (leaf) =>
                        (leaf?.view?.getViewType?.() ??
                            leaf?.getViewState?.()?.type) === type,
                )
                .map((leaf) => {
                    // Background tabs may be deferred views (no `view.file`), so fall back to the saved view state.
                    const view = leaf.view as any;
                    const state = leaf.getViewState?.() as any;
                    const filePath: string | null =
                        view?.file?.path ?? state?.state?.file ?? null;
                    const basename = filePath
                        ? (filePath.split("/").pop() ?? "").replace(
                              /\.[^.]+$/,
                              "",
                          )
                        : null;
                    return {
                        active: leaf === app.workspace.activeLeaf,
                        viewType: type,
                        filePath,
                        title:
                            typeof view?.getDisplayText === "function"
                                ? (view.getDisplayText() ?? basename)
                                : (leaf.getDisplayText?.() ?? basename),
                    } satisfies WorkspaceLeafState;
                });
        }, viewType);
    }

    // ========================================
    // Commands & Workspace - コマンド実行と画面操作
    // ========================================

    /** コマンドを実行し、実行されなければ失敗させる。 */
    async command(commandId: string): Promise<void> {
        expect(await this.tryCommand(commandId)).toBe(true);
    }

    async split(
        direction: "vertical" | "horizontal" = "vertical",
    ): Promise<void> {
        await this.appState(
            (dir) =>
                app.workspace.duplicateLeaf(app.workspace.activeLeaf!, dir),
            direction,
        );
    }

    async closeTab(): Promise<void> {
        const closed = await this.appState((commandId: string) => {
            const leaf = app.workspace.activeLeaf as any;
            if (leaf && typeof leaf.detach === "function") {
                leaf.detach();
                return true;
            }

            return app.commands.executeCommandById(commandId);
        }, CMD_ID_CLOSE_TAB);

        expect(closed).toBe(true);
    }

    async clickClose(): Promise<void> {
        await this.closeTab();
    }

    async undoClose(): Promise<void> {
        await this.command(CMD_ID_UNDO_CLOSE_TAB);
    }

    async back(): Promise<void> {
        await this.appState(() => app.workspace.activeLeaf?.history.back());
    }

    async forward(): Promise<void> {
        await this.appState(() => app.workspace.activeLeaf?.history.forward());
    }

    async switchToLeaf(index: number): Promise<void> {
        await this.appState((i: number) => {
            const leaves = app.workspace.getLeavesOfType("markdown");
            if (leaves[i]) {
                app.workspace.setActiveLeaf(leaves[i], { focus: true });
            }
        }, index);
    }

    async activeViewType(): Promise<string | null> {
        return this.appState(
            () => app.workspace.activeLeaf?.view.getViewType() ?? null,
        );
    }

    async openingFiles(): Promise<string[]> {
        return this.appState(() =>
            app.workspace
                .getLeavesOfType("markdown")
                .map((leaf: any) => leaf.view.file?.path ?? ""),
        );
    }

    async waitReady(timeout = 15000): Promise<void> {
        // 判定は PageWaiter と共通にして、layoutReady だけを見る。
        await PageWaiter.waitForVaultReady(this.page, timeout);
    }

    async waitForApp<Arg = undefined>(
        predicate: (arg: Arg) => boolean,
        arg?: Arg,
        timeout = 5000,
    ): Promise<void> {
        await this.page.waitForFunction(predicate as any, arg as any, {
            timeout,
        });
    }

    async waitForView<T extends ItemView>(
        viewType: string,
    ): Promise<JSHandle<T>> {
        await this.page.waitForFunction(
            (type) => app.workspace.getLeavesOfType(type).length > 0,
            viewType,
        );
        return this.page.evaluateHandle(async (type) => {
            const leaf = app.workspace.getLeavesOfType(type)?.[0];
            await app.workspace.revealLeaf(leaf);
            return leaf.view as unknown as T;
        }, viewType);
    }

    async waitForViewType(viewType: string, timeout = 5000): Promise<void> {
        await this.page.waitForFunction(
            (type) => app.workspace.activeLeaf?.view.getViewType() === type,
            viewType,
            { timeout },
        );
    }

    // ========================================
    // Editor - エディタ操作
    // ========================================

    async clear(): Promise<void> {
        await this.appState(() => {
            app.workspace.activeEditor?.editor?.setValue("");
        });
    }

    async content(): Promise<string | undefined> {
        return this.appState(() =>
            app.workspace.activeEditor?.editor?.getValue(),
        );
    }

    async filePath(): Promise<string | null> {
        return this.appState(() => app.workspace.getActiveFile()?.path ?? null);
    }

    async tabTitle(): Promise<string | null> {
        return this.appState(() => {
            const leaf = app.workspace.activeLeaf as any;
            const view = leaf?.view as any;
            const activeFile = app.workspace.getActiveFile();

            if (activeFile?.basename) {
                return activeFile.basename;
            }

            if (typeof view?.getDisplayText === "function") {
                return view.getDisplayText() ?? null;
            }

            return leaf?.tabHeaderInnerTitleEl?.textContent?.trim() ?? null;
        });
    }

    async write(content: string): Promise<void> {
        await this.appState((nextContent: string) => {
            app.workspace.activeEditor?.editor?.setValue(nextContent);
        }, content);
    }

    // ========================================
    // Files - ファイル操作
    // ========================================

    async exists(path: string): Promise<boolean> {
        return this.appState((p: string) => app.vault.adapter.exists(p), path);
    }

    async read(path: string): Promise<string> {
        return this.appState((p: string) => app.vault.adapter.read(p), path);
    }

    async save(path: string, content: string): Promise<void> {
        await this.appState(([p, c]) => app.vault.adapter.write(p, c), [
            path,
            content,
        ] as const);
    }

    /** Create a note through the vault API (creates parent folders, updates the metadata cache). */
    async createNote(path: string, content = ""): Promise<void> {
        await this.appState(
            async ([p, c]) => {
                const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
                if (dir && !(await app.vault.adapter.exists(dir))) {
                    await app.vault.createFolder(dir);
                }
                const existing = app.vault.getAbstractFileByPath(p);
                if (existing) {
                    await app.vault.modify(existing as any, c);
                } else {
                    await app.vault.create(p, c);
                }
            },
            [path, content] as const,
        );
    }

    async delete(path: string): Promise<void> {
        await this.appState((p: string) => app.vault.adapter.remove(p), path);
    }

    async open(path: string): Promise<void> {
        await this.appState(async (p: string) => {
            const file = app.vault.getAbstractFileByPath(p);
            if (file) {
                await app.workspace.getLeaf().openFile(file as any);
            }
        }, path);
    }

    async waitForFile(path: string, timeout = 5000): Promise<void> {
        await this.page.waitForFunction(
            (p) => app.vault.adapter.exists(p),
            path,
            {
                timeout,
            },
        );
    }

    // ========================================
    // Plugins - プラグイン操作
    // ========================================

    async plugin<T = any>(pluginId: string): Promise<JSHandle<T>> {
        if (!this.context?.pluginHandleMap) {
            throw new Error("Plugin context not initialized");
        }
        return this.context.pluginHandleMap.evaluateHandle(
            (map, id) => map.get(id) as T,
            pluginId,
        );
    }

    /** Read the plugin's persisted data (data.json) via `plugin.loadData()`. */
    async pluginData<T = Record<string, any>>(
        pluginId: string,
    ): Promise<T | null> {
        return this.appState(async (id: string) => {
            const plugin = app.plugins.plugins[id] as any;
            if (!plugin) {
                throw new Error(`Plugin not loaded: ${id}`);
            }
            return (await plugin.loadData()) ?? null;
        }, pluginId);
    }

    /** Shallow-merge `patch` into the plugin's persisted data via `plugin.saveData()`. */
    async setPluginData(
        pluginId: string,
        patch: Record<string, unknown>,
    ): Promise<void> {
        await this.appState(
            async ([id, data]) => {
                const plugin = app.plugins.plugins[id] as any;
                if (!plugin) {
                    throw new Error(`Plugin not loaded: ${id}`);
                }
                const current = (await plugin.loadData()) ?? {};
                await plugin.saveData({ ...current, ...data });
            },
            [pluginId, patch] as const,
        );
    }

    /** Read the startup-enabled setting, independently of the plugin's load state. */
    async isPluginEnabled(pluginId: string): Promise<boolean> {
        return this.appState(
            (id) => !!app.plugins.enabledPlugins.has(id),
            pluginId,
        );
    }

    /** Wait for the startup-enabled setting; use `waitForPluginLoaded` for runtime state. */
    async waitForPluginEnabled(
        pluginId: string,
        timeout = 8000,
    ): Promise<void> {
        await this.waitForApp(
            (id: string) => !!app?.plugins?.enabledPlugins?.has(id),
            pluginId,
            timeout,
        );
    }

    /** Wait for the startup-disabled setting; use `waitForPluginUnloaded` for runtime state. */
    async waitForPluginDisabled(
        pluginId: string,
        timeout = 8000,
    ): Promise<void> {
        await this.waitForApp(
            (id: string) => !app?.plugins?.enabledPlugins?.has(id),
            pluginId,
            timeout,
        );
    }

    /** Read the actual load state, independently of the startup-enabled setting. */
    async isPluginLoaded(pluginId: string): Promise<boolean> {
        return this.appState(
            (id) => !!app.plugins.plugins[id]?._loaded,
            pluginId,
        );
    }

    /** Wait until the plugin is loaded, regardless of its startup-enabled setting. */
    async waitForPluginLoaded(
        pluginId: string,
        timeout = 8000,
    ): Promise<void> {
        await this.waitForApp(
            (id: string) => !!app?.plugins?.plugins?.[id]?._loaded,
            pluginId,
            timeout,
        );
    }

    /** Wait until the plugin is unloaded, regardless of its startup-enabled setting. */
    async waitForPluginUnloaded(
        pluginId: string,
        timeout = 8000,
    ): Promise<void> {
        await this.waitForApp(
            (id: string) => !app?.plugins?.plugins?.[id]?._loaded,
            pluginId,
            timeout,
        );
    }

    async pluginState(pluginId: string): Promise<{
        enabled: boolean;
        loaded: boolean;
        registered: boolean;
    }> {
        return this.appState(
            (id: string) => ({
                enabled: !!app?.plugins?.enabledPlugins?.has(id),
                loaded: !!app?.plugins?.plugins?.[id]?._loaded,
                registered: !!app?.plugins?.plugins?.[id],
            }),
            pluginId,
        );
    }

    /**
     * Unload and reload a plugin so it re-reads its data.json (e.g. after `setPluginData`).
     * The handle returned by `plugin(id)` is refreshed to the new plugin instance.
     */
    async reloadPlugin(pluginId: string): Promise<void> {
        await this.appState(async (id: string) => {
            await app.plugins.disablePlugin(id);
            await app.plugins.enablePlugin(id);
        }, pluginId);
        await this.waitForPluginLoaded(pluginId);
        await this.context?.pluginHandleMap?.evaluate(
            (map, id) => {
                const plugin = (window as any).app?.plugins?.plugins?.[id];
                if (plugin) {
                    map.set(id, plugin);
                }
            },
            pluginId,
        );
    }

    async rebuildPlugins(
        vaultOptions: VaultOptions,
        getPluginHandleMapFn: typeof getPluginHandleMap = getPluginHandleMap,
    ): Promise<ObsidianPageTextContext> {
        const pluginHandleMap = await getPluginHandleMapFn(
            this.page,
            (vaultOptions.plugins || []).map((p) => ({
                ...p,
                pluginId: getActualPluginId(p.path),
            })),
        );
        this.context = { ...this.context!, pluginHandleMap };
        return this.context;
    }

    updateContext(context: ObsidianPageTextContext): void {
        this.context = context;
    }

    // ========================================
    // Settings Window - 設定ウィンドウ
    // ========================================

    /**
     * 設定ウィンドウを開いて tab を選び、その Page を返す。既に開いていれば同じウィンドウを返す。
     * subPage を渡すと、設定画面の項目名（.setting-item-name）のうち表示文字列が完全一致する可視の要素をクリックする。
     */
    async openSettings(
        tabId: string,
        options: { subPage?: string; timeout?: number } = {},
    ): Promise<Page> {
        const timeout = options.timeout ?? 10_000;
        await this.appState((id: string) => {
            const setting = (app as unknown as SettingHost).setting;
            setting.open();
            setting.openTabById(id);
        }, tabId);

        const settingsPage = await findVisiblePage(
            () => this.page.context().pages(),
            (page) => page.locator(SETTINGS_WINDOW_MARKER),
            { timeout, description: 'settings window for tab "' + tabId + '"' },
        );
        if (options.subPage !== undefined) {
            await settingItemNamed(settingsPage, options.subPage).click({ timeout });
        }
        return settingsPage;
    }

    /** 設定ウィンドウを閉じ、設定画面が見えなくなるまで待つ。 */
    async closeSettings(options: { timeout?: number } = {}): Promise<void> {
        const timeout = options.timeout ?? 10_000;
        await this.appState(() => (app as unknown as SettingHost).setting.close());
        await waitUntilNoVisiblePage(
            () => this.page.context().pages(),
            (page) => page.locator(SETTINGS_WINDOW_MARKER),
            { timeout, description: "settings window" },
        );
    }

    /**
     * 開いているどのウィンドウでも、locate が返す要素のうち可視なものが 1 つ以上になるまで待ち、そのウィンドウの Page を返す。
     * 待機中に開いたウィンドウも対象になる。timeout のエラーには各ウィンドウの一致数を載せる。
     */
    findPage(
        locate: (page: Page) => Locator,
        options: { timeout?: number; description?: string } = {},
    ): Promise<Page> {
        return findVisiblePage(() => this.page.context().pages(), locate, options);
    }

    // ========================================
    // Reload - 再読込とリロード要求の差し替え
    // ========================================

    /**
     * レイアウトを保存してからページを再読込し、plugin の読み込みと CSS 適用を待つ。
     * 待つ対象は、再読込の直前に読み込まれていた plugin（expectLoaded を渡すとその ID）。
     * plugin の有効化・無効化は行わない。
     */
    async reload(options: ReloadOptions = {}): Promise<void> {
        const timeout = options.timeout ?? 30_000;
        if (options.saveLayout ?? true) {
            await this.appState(() => (app.workspace as unknown as WorkspaceSaver).saveLayout());
        }

        const configuredIds = await this.context.pluginHandleMap.evaluate((map) => [...map.keys()]);
        const expectedIds =
            options.expectLoaded ??
            (await this.appState(() =>
                Object.keys(app.plugins.plugins).filter((id) => app.plugins.plugins[id]?._loaded === true),
            ));
        const pluginsDir = path.join(await this.vaultPath(), await this.configDir(), "plugins");

        await this.context.coverage?.checkpoint(this.page);
        this.invalidateReloadInterceptors();
        await this.page.reload({ waitUntil: "domcontentloaded", timeout });
        await PageWaiter.waitForPage(this.page, timeout);
        await waitForPluginFixtures(this.page, { pluginsDir, pluginIds: expectedIds }, timeout);
        this.context = { ...this.context, pluginHandleMap: await refreshPluginHandleMap(this.page, configuredIds) };
    }

    /**
     * app:reload だけを差し替えて呼び出しを記録する。他のコマンドは本当に実行される（this・引数・戻り値を保つ）。
     * 同じページで有効な差し替えは 1 つだけ。テスト終了時に fixture が自動で戻す。
     */
    async interceptReload(): Promise<ReloadInterceptor> {
        const session = new ReloadInterceptorSession(this.page, randomUUID());
        await this.page.evaluate(installReloadInterceptor, session.token);
        this.reloadInterceptors.add(session);
        return session;
    }

    /** fixture の終了処理から呼ばれる。残っている差し替えを元に戻す。 */
    async restoreReloadInterceptors(): Promise<void> {
        const sessions = [...this.reloadInterceptors];
        this.reloadInterceptors.clear();
        for (const session of sessions) {
            if (this.page.isClosed()) {
                session.invalidate();
            } else {
                await session.restore();
            }
        }
    }

    private invalidateReloadInterceptors(): void {
        for (const session of this.reloadInterceptors) {
            session.invalidate();
        }
        this.reloadInterceptors.clear();
    }

    // ========================================
    // Vault Paths - vault と設定ファイルの読み取り
    // ========================================

    /** vault のディスク上の絶対パス。 */
    vaultPath(): Promise<string> {
        return this.appState(() => {
            const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
            if (typeof adapter.getBasePath !== "function") {
                throw new Error("The vault adapter does not provide getBasePath(); the vault path is unavailable.");
            }
            return adapter.getBasePath();
        });
    }

    /** 設定ディレクトリ名（通常は .obsidian）。 */
    configDir(): Promise<string> {
        return this.appState(() => app.vault.configDir);
    }

    /** 設定ディレクトリ配下の JSON を読む。file は相対パスのみ。vault の外へ出る指定は拒否する。 */
    async readConfig<T = unknown>(file: string): Promise<T> {
        const root = path.join(await this.vaultPath(), await this.configDir());
        return readJsonInside<T>(root, file);
    }

    /** community-plugins.json に載っている有効な plugin の ID 一覧。 */
    async enabledPluginsOnDisk(): Promise<string[]> {
        const ids = await this.readConfig<unknown>("community-plugins.json");
        if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
            throw new Error("community-plugins.json must contain a JSON array of plugin IDs.");
        }
        return ids as string[];
    }

    // ========================================
    // Plugin Settings - プラグインのメモリ上の settings
    // ========================================

    /** 読み込まれた plugin の settings を読む（読み取り専用）。 */
    async pluginSettings<T = Record<string, unknown>>(pluginId: string): Promise<T> {
        const settings = await this.appState((id: string) => {
            const plugin = app.plugins.plugins[id];
            if (!plugin || plugin._loaded !== true) {
                throw new Error("Plugin is not loaded: " + id);
            }
            if (plugin.settings === undefined) {
                throw new Error("Plugin has no settings property: " + id);
            }
            return plugin.settings;
        }, pluginId);
        return settings as T;
    }

    /** settings に patch を浅くマージし、plugin の saveSettings() で保存する。UI の再描画は行わない。 */
    async updatePluginSettings(pluginId: string, patch: Record<string, unknown>): Promise<void> {
        await this.appState(async ([id, values]) => {
            const plugin = app.plugins.plugins[id];
            if (!plugin || plugin._loaded !== true) {
                throw new Error("Plugin is not loaded: " + id);
            }
            if (typeof plugin.saveSettings !== "function") {
                throw new Error("Plugin has no saveSettings(): " + id);
            }
            const settings = plugin.settings as Record<string, unknown> | undefined;
            if (!settings || typeof settings !== "object") {
                throw new Error("Plugin settings are not an object: " + id);
            }
            Object.assign(settings, values);
            await plugin.saveSettings();
        }, [pluginId, patch] as const);
    }

    /**
     * plugin インスタンスを渡して fn を renderer 内で実行する。fn は (plugin, arg) を受け取る。
     * fn はシリアライズされて実行されるため、外側の変数を参照しないこと。
     */
    async evaluatePlugin<T, P = unknown, Arg = undefined>(
        pluginId: string,
        fn: (plugin: P, arg: Arg) => T | Promise<T>,
        arg?: Arg,
    ): Promise<T> {
        const handle: JSHandle<unknown> = await this.page.evaluateHandle((id: string) => {
            const plugin = app.plugins.plugins[id];
            if (!plugin || plugin._loaded !== true) {
                throw new Error("Plugin is not loaded: " + id);
            }
            return plugin;
        }, pluginId);
        try {
            const run = fn as unknown as (plugin: unknown, arg: unknown) => T | Promise<T>;
            return await handle.evaluate<T, unknown>(run, arg);
        } finally {
            await handle.dispose();
        }
    }

    // ========================================
    // Workspace Layout - サイドバーと view
    // ========================================

    /** 左右のサイドバーを閉じる。 */
    async collapseSidebars(): Promise<void> {
        await this.appState(() => {
            app.workspace.leftSplit.collapse();
            app.workspace.rightSplit.collapse();
        });
    }

    /** 指定の view type を開いて前面に出す。newLeaf が true なら新しいタブ、既定はアクティブ leaf を使う。 */
    async openView(
        viewType: string,
        state: Record<string, unknown> = {},
        options: { newLeaf?: boolean } = {},
    ): Promise<void> {
        await this.appState(async ([type, viewState, newLeaf]) => {
            const leaf = app.workspace.getLeaf(newLeaf);
            await leaf.setViewState({ type, state: viewState, active: true });
            await app.workspace.revealLeaf(leaf);
            await leaf.loadIfDeferred();
            app.workspace.setActiveLeaf(leaf, { focus: true });
        }, [viewType, state, options.newLeaf === true] as const);
    }

    /** 指定 view type の先頭 leaf を前面に出し、遅延読み込みなら描画させる。無ければ例外。 */
    async revealView(viewType: string): Promise<void> {
        await this.appState(async (type: string) => {
            const leaf = app.workspace.getLeavesOfType(type)[0];
            if (!leaf) {
                throw new Error("No leaf of view type: " + type);
            }
            await app.workspace.revealLeaf(leaf);
            await leaf.loadIfDeferred();
            app.workspace.setActiveLeaf(leaf, { focus: true });
        }, viewType);
    }

    /** 開いている leaf を 1 行ずつ整形する。失敗メッセージに載せる用途。 */
    async describeLeaves(): Promise<string> {
        const tabs = await this.allTabs();
        if (tabs.length === 0) {
            return "(no leaves)";
        }
        return tabs
            .map((tab) => (tab.active ? "*" : "-") + " type=" + (tab.viewType ?? "-") + " file=" + (tab.filePath ?? "-") + " title=" + (tab.title ?? "-"))
            .join("\n");
    }

    // ========================================
    // Presentation - 撮影用の表示補助
    // ========================================

    /** body のテーマクラスを切り替える。設定ファイルは変えない。 */
    async setTheme(theme: "dark" | "light", page: Page = this.page): Promise<void> {
        await page.evaluate((next: "dark" | "light") => {
            document.body.classList.remove("theme-dark", "theme-light");
            document.body.classList.add("theme-" + next);
        }, theme);
    }

    /**
     * CSS クラスだけでモバイル表示を再現する。viewport と Platform.isMobile は変わらない。
     * 既定の platform は android（lazy の既存の撮影が使う is-android を維持するため）。
     */
    async emulateMobile(
        kind: MobileKind,
        page: Page = this.page,
        options: { platform?: MobilePlatform } = {},
    ): Promise<void> {
        const classes = mobileClassNames(kind, options.platform ?? "android");
        await page.evaluate(
            ({ managed, next }) => {
                document.body.classList.remove(...managed);
                document.body.classList.add(...next);
            },
            { managed: [...MANAGED_MOBILE_CLASSES], next: classes },
        );
    }

    /** 無限でない実行中のアニメーションが終わるまで待つ。無限のアニメーション（ローディング等）は待たない。 */
    async waitForAnimations(page: Page = this.page, options: { timeout?: number } = {}): Promise<void> {
        await page.waitForFunction(
            () =>
                document.getAnimations().every((animation) => {
                    if (animation.playState !== "running") {
                        return true;
                    }
                    return animation.effect?.getTiming().iterations === Infinity;
                }),
            undefined,
            { timeout: options.timeout ?? 10_000 },
        );
    }

    // ========================================
    // Commands - コマンドの確認と実行
    // ========================================

    /** コマンドが登録されているか。pluginId:name の形式では ID マッピングも試す。 */
    async hasCommand(commandId: string): Promise<boolean> {
        return this.appState((id: string) => {
            const commands = app.commands as unknown as CommandIndexHost;
            if (commands.findCommand(id)) {
                return true;
            }
            if (!id.includes(":")) {
                return false;
            }
            const [pluginId, ...rest] = id.split(":");
            const actualId = (window as unknown as PluginIdMappingHost).__pluginIdMapping?.get(pluginId);
            return actualId !== undefined && Boolean(commands.findCommand([actualId, ...rest].join(":")));
        }, commandId);
    }

    /** 接頭辞に一致する command ID の一覧。 */
    async findCommands(prefix: string): Promise<string[]> {
        return this.appState((p: string) => {
            const commands = (app.commands as unknown as CommandIndexHost).commands;
            return Object.keys(commands).filter((id) => id.startsWith(p));
        }, prefix);
    }

    /**
     * コマンドを実行し、実行されたかを返す。ID が無い・実行されなかった場合は false。
     * コマンド内で投げられた例外は隠さず、そのまま呼び出し元へ伝える。
     */
    async tryCommand(commandId: string): Promise<boolean> {
        return this.appState((id: string) => {
            if (app.commands.executeCommandById(id)) {
                return true;
            }
            if (!id.includes(":")) {
                return false;
            }
            const [pluginId, ...rest] = id.split(":");
            const actualId = (window as unknown as PluginIdMappingHost).__pluginIdMapping?.get(pluginId);
            if (actualId === undefined) {
                return false;
            }
            return app.commands.executeCommandById([actualId, ...rest].join(":"));
        }, commandId);
    }

    // ========================================
    // Expect - アサーション
    // ========================================

    async expectViews(viewType: string, count: number): Promise<void> {
        expect((await this.allViews(viewType)).length).toBe(count);
    }

    async expectTitle(viewType: string, title: string): Promise<void> {
        expect(await this.title(viewType)).toBe(title);
    }

    async expectTitleContains(viewType: string, text: string): Promise<void> {
        expect(await this.title(viewType)).toContain(text);
    }

    async expectActiveType(type: string): Promise<void> {
        expect((await this.activeTab())?.viewType).toBe(type);
    }

    async expectTabs(count: number): Promise<void> {
        expect((await this.allTabs()).length).toBe(count);
    }

    async expectExists(path: string): Promise<void> {
        expect(await this.exists(path)).toBe(true);
    }

    async expectNotExists(path: string): Promise<void> {
        expect(await this.exists(path)).toBe(false);
    }

    async expectContent(content: string): Promise<void> {
        const value = await this.content();
        expect(value).toBe(content);
    }

    async expectContentContains(text: string): Promise<void> {
        const value = await this.content();
        expect(value).toContain(text);
    }

    // ========================================
    // UI - その他のUI操作
    // ========================================

    async titleBarText(): Promise<string | null> {
        return this.tabTitle();
    }

    async tabHeaderText(): Promise<string | null> {
        return this.tabTitle();
    }

    async measureTime(action: () => Promise<void>): Promise<number> {
        const start = Date.now();
        await action();
        return Date.now() - start;
    }

    async search(text: string, selector = 'input[type="text"]'): Promise<void> {
        await this.page.locator(selector).fill(text);
        await this.page.waitForTimeout(300);
    }

    async clearSearch(selector = 'input[type="text"]'): Promise<void> {
        await this.page.locator(selector).clear();
        await this.page.waitForTimeout(200);
    }
}
