import type { JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import invariant from "tiny-invariant";
import { CMD_ID_CLOSE_TAB, CMD_ID_UNDO_CLOSE_TAB } from "./helpers/constants";
import type { ObsidianPageTextContext, VaultOptions } from "./helpers/types";
import { getPluginHandleMap } from "./helpers/utils";

interface ItemView {
  [key: string]: any;
}

/**
 * シンプルで直感的なObsidian APIクラス
 */
export class ObsidianAPI {
  private page: Page;
  private context?: ObsidianPageTextContext;

  // よく使うセレクタ
  private readonly sel = {
    activeLeaf: ".workspace-leaf.mod-active",
    activeTab: ".workspace-tab-header.mod-active.is-active",
    activeEditor: ".cm-content",
    tabContainer: ".mod-root .workspace-tab-header-container-inner",
  };

  constructor(context?: ObsidianPageTextContext) {
    invariant(context?.page, "Page context is required");
    this.page = context.page;
    this.context = context;
  }

  // ========================================
  // Locators - よく使うロケーター
  // ========================================

  get activeLeaf(): Locator {
    return this.page.locator(this.sel.activeLeaf);
  }

  get activeEditor(): Locator {
    return this.page.locator(`${this.sel.activeLeaf} ${this.sel.activeEditor}`);
  }

  get activeTab(): Locator {
    return this.page.locator(this.sel.activeTab);
  }

  get allTabs(): Locator {
    return this.page.locator(this.sel.tabContainer);
  }

  view(viewType: string): Locator {
    return this.page.locator(
      `${this.sel.activeLeaf} > .workspace-leaf-content[data-type="${viewType}"]`
    );
  }

  title(viewType: string): Locator {
    return this.page.locator(`${this.sel.activeTab}[data-type="${viewType}"]`);
  }

  allViews(viewType: string): Locator {
    return this.page.locator(
      `.workspace-leaf > .workspace-leaf-content[data-type="${viewType}"]`
    );
  }

  // ========================================
  // Commands & Workspace - コマンド実行と画面操作
  // ========================================

  async command(commandId: string): Promise<void> {
    const success = await this.page.evaluate(
      (id) => app.commands.executeCommandById(id),
      commandId
    );
    expect(success).toBe(true);
  }

  async split(
    direction: "vertical" | "horizontal" = "vertical"
  ): Promise<void> {
    await this.page.evaluate(
      (dir) => app.workspace.duplicateLeaf(app.workspace.activeLeaf!, dir),
      direction
    );
  }

  async closeTab(): Promise<void> {
    await this.activeLeaf.focus();
    await this.command(CMD_ID_CLOSE_TAB);
  }

  async clickClose(): Promise<void> {
    const closeBtn = this.page.locator(
      `${this.sel.activeTab} .workspace-tab-header-inner-close-button`
    );
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
  }

  async undoClose(): Promise<void> {
    await this.command(CMD_ID_UNDO_CLOSE_TAB);
  }

  async back(): Promise<void> {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.back());
  }

  async forward(): Promise<void> {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.forward());
  }

  async switchToLeaf(index: number): Promise<void> {
    await this.page.evaluate((i) => {
      const leaves = app.workspace.getLeavesOfType("markdown");
      if (leaves[i]) {
        app.workspace.setActiveLeaf(leaves[i], { focus: true });
      }
    }, index);
  }

  async activeViewType(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.view.getViewType() ?? null
    );
  }

  async openingFiles(): Promise<string[]> {
    return this.page.evaluate(() =>
      app.workspace
        .getLeavesOfType("markdown")
        .map((leaf: any) => leaf.view.file?.path ?? "")
    );
  }

  async waitReady(): Promise<void> {
    await this.page.waitForFunction(() => app.workspace.layoutReady);
  }

  async waitForView<T extends ItemView>(
    viewType: string
  ): Promise<JSHandle<T>> {
    await this.page.waitForFunction(
      (type) => app.workspace.getLeavesOfType(type).length > 0,
      viewType
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
      { timeout }
    );
  }

  // ========================================
  // Editor - エディタ操作
  // ========================================

  async clear(): Promise<void> {
    await this.activeEditor.focus();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.press("Backspace");
  }

  async content(): Promise<string | undefined> {
    return this.page.evaluate(() =>
      app.workspace.activeEditor?.editor?.getValue()
    );
  }

  async filePath(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.getActiveFile()?.path ?? null
    );
  }

  async tabTitle(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.tabHeaderInnerTitleEl.textContent ?? null
    );
  }

  async write(content: string): Promise<void> {
    await this.activeEditor.focus();
    await this.activeEditor.fill(content);
  }

  // ========================================
  // Files - ファイル操作
  // ========================================

  async exists(path: string): Promise<boolean> {
    return this.page.evaluate((p) => app.vault.adapter.exists(p), path);
  }

  async read(path: string): Promise<string> {
    return this.page.evaluate((p) => app.vault.adapter.read(p), path);
  }

  async save(path: string, content: string): Promise<void> {
    await this.page.evaluate(([p, c]) => app.vault.adapter.write(p, c), [
      path,
      content,
    ] as const);
  }

  async delete(path: string): Promise<void> {
    await this.page.evaluate((p) => app.vault.adapter.remove(p), path);
  }

  async open(path: string): Promise<void> {
    await this.page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (file) {
        await app.workspace.getLeaf().openFile(file as any);
      }
    }, path);
  }

  async waitForFile(path: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction((p) => app.vault.adapter.exists(p), path, {
      timeout,
    });
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
      pluginId
    );
  }

  async isPluginEnabled(pluginId: string): Promise<boolean> {
    return this.page.evaluate(
      (id) => !!app.plugins.enabledPlugins.has(id),
      pluginId
    );
  }

  async rebuildPlugins(
    vaultOptions: VaultOptions,
    getPluginHandleMapFn: typeof getPluginHandleMap = getPluginHandleMap
  ): Promise<ObsidianPageTextContext> {
    const pluginHandleMap = await getPluginHandleMapFn(
      this.page,
      vaultOptions.plugins || []
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
    await expect(this.allViews(viewType)).toHaveCount(count);
  }

  async expectTitle(viewType: string, title: string): Promise<void> {
    await expect(this.title(viewType)).toHaveText(title);
  }

  async expectTitleContains(viewType: string, text: string): Promise<void> {
    await expect(this.title(viewType)).toContainText(text);
  }

  async expectActiveType(type: string): Promise<void> {
    await expect(this.activeTab).toHaveAttribute("data-type", type);
  }

  async expectTabs(count: number): Promise<void> {
    await expect(this.allTabs).toHaveCount(count);
  }

  async expectExists(path: string): Promise<void> {
    expect(await this.exists(path)).toBe(true);
  }

  async expectNotExists(path: string): Promise<void> {
    expect(await this.exists(path)).toBe(false);
  }

  async expectContent(content: string): Promise<void> {
    await expect(this.activeEditor).toHaveText(content);
  }

  async expectContentContains(text: string): Promise<void> {
    await expect(this.activeEditor).toContainText(text);
  }

  // ========================================
  // UI - その他のUI操作
  // ========================================

  async titleBarText(): Promise<string | null> {
    return await this.page
      .locator(".workspace-leaf.mod-active .view-header-title")
      .textContent();
  }

  async tabHeaderText(): Promise<string | null> {
    return await this.page
      .locator(".workspace-tab-header.mod-active .workspace-tab-header-inner")
      .textContent();
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
