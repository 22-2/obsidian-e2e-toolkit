import type { JSHandle, Page } from "playwright";
import { expect } from "playwright/test";
import invariant from "tiny-invariant";
import { CMD_ID_CLOSE_TAB, CMD_ID_UNDO_CLOSE_TAB } from "./internal/constants";
import { getActualPluginId } from "./internal/services/PluginManager";
import type { ObsidianPageTextContext, VaultOptions } from "./internal/types";
import { getPluginHandleMap } from "./internal/utils";

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

    constructor(context: ObsidianPageTextContext) {
        invariant(context.page, "Page context is required");
        this.page = context.page;
        this.context = context;
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

    async command(commandId: string): Promise<void> {
        const success = await this.appState((id: string) => {
            if (app.commands.executeCommandById(id)) {
                return true;
            }

            // Try with mapped plugin ID if available
            if (id.includes(":")) {
                const [pluginId, ...rest] = id.split(":");
                const actualId = (window as any).__pluginIdMapping?.get(
                    pluginId,
                );
                if (actualId) {
                    const mappedId = [actualId, ...rest].join(":");
                    return app.commands.executeCommandById(mappedId);
                }
            }
            return false;
        }, commandId);
        expect(success).toBe(true);
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
        await this.page.waitForFunction(
            () =>
                !!app?.workspace &&
                (app.workspace.layoutReady === true ||
                    !!app.workspace.activeLeaf),
            // 意図: timeout を評価関数の引数にせず、Playwright の待機設定として使う。
            undefined,
            { timeout },
        );
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
