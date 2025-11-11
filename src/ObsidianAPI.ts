import type { JSHandle, Locator, Page } from "playwright";
import { expect } from "playwright/test";
import invariant from "tiny-invariant";
import { CMD_ID_CLOSE_TAB, CMD_ID_UNDO_CLOSE_TAB } from "./constants";
import type { ObsidianPageTextContext, VaultOptions } from "./helpers/types";
import { getPluginHandleMap } from "./helpers/utils";

interface ItemView {
  [key: string]: any;
}

export interface PageObjectConfig {
  viewType?: string;
  pluginId?: string;
}

/**
 * セレクタ生成の責務を持つクラス
 */
export class ObsidianSelectors {
  protected readonly ACTIVE_LEAF = ".workspace-leaf.mod-active";
  protected readonly ACTIVE_TAB_HEADER =
    ".workspace-tab-header.mod-active.is-active";
  protected readonly ACTIVE_EDITOR = ".cm-content";
  protected readonly TAB_HEADER_CONTAINER =
    ".mod-root .workspace-tab-header-container-inner";

  protected getDatatype(viewType: string): string {
    return `[data-type="${viewType}"]`;
  }

  getActiveView(type: string): string {
    return `${this.ACTIVE_LEAF} > .workspace-leaf-content${this.getDatatype(
      type
    )}`;
  }

  getActiveTitle(type: string): string {
    return `${this.ACTIVE_TAB_HEADER}${this.getDatatype(type)}`;
  }

  getAllViews(type: string): string {
    return this.getActiveView(type).replace(".mod-active", "");
  }
}

/**
 * Locator提供の責務を持つクラス
 */
export class ObsidianLocators {
  constructor(private page: Page, private selectors: ObsidianSelectors) {}

  get activeLeaf(): Locator {
    return this.page.locator(this.selectors["ACTIVE_LEAF"]);
  }

  get activeEditor(): Locator {
    return this.page.locator(
      `${this.selectors["ACTIVE_LEAF"]} ${this.selectors["ACTIVE_EDITOR"]}`
    );
  }

  get activeTabHeader(): Locator {
    return this.page.locator(this.selectors["ACTIVE_TAB_HEADER"]);
  }

  get allTabs(): Locator {
    return this.page.locator(this.selectors["TAB_HEADER_CONTAINER"]);
  }

  getViewByType(viewType: string): Locator {
    return this.page.locator(this.selectors.getActiveView(viewType));
  }

  getTitleByType(viewType: string): Locator {
    return this.page.locator(this.selectors.getActiveTitle(viewType));
  }

  getAllViewsByType(viewType: string): Locator {
    return this.page.locator(this.selectors.getAllViews(viewType));
  }
}

/**
 * コマンド実行とワークスペース操作の責務を持つクラス
 */
export class ObsidianWorkspace {
  constructor(private page: Page, private locators: ObsidianLocators) {}

  async runCommand(commandId: string): Promise<void> {
    const success = await this.page.evaluate(
      (id) => app.commands.executeCommandById(id),
      commandId
    );
    expect(success).toBe(true);
  }

  async splitVertically(): Promise<void> {
    await this.page.evaluate(() =>
      app.workspace.duplicateLeaf(app.workspace.activeLeaf!, "vertical")
    );
  }

  async splitHorizontally(): Promise<void> {
    await this.page.evaluate(() =>
      app.workspace.duplicateLeaf(app.workspace.activeLeaf!, "horizontal")
    );
  }

  async closeActiveTab(): Promise<void> {
    await this.locators.activeLeaf.focus();
    await this.runCommand(CMD_ID_CLOSE_TAB);
  }

  async clickCloseButtonOnActiveTab(): Promise<void> {
    const closeButton = this.page.locator(
      `${this.locators["selectors"]["ACTIVE_TAB_HEADER"]} .workspace-tab-header-inner-close-button`
    );
    await expect(closeButton).toBeVisible();
    await closeButton.click();
  }

  async undoCloseTab(): Promise<void> {
    await this.runCommand(CMD_ID_UNDO_CLOSE_TAB);
  }

  async goBackInHistory(): Promise<void> {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.back());
  }

  async goForwardInHistory(): Promise<void> {
    await this.page.evaluate(() => app.workspace.activeLeaf?.history.forward());
  }

  async switchToLeafIndex(index: number): Promise<void> {
    await this.page.evaluate((i) => {
      const leaves = app.workspace.getLeavesOfType("markdown");
      if (leaves[i]) {
        app.workspace.setActiveLeaf(leaves[i], { focus: true });
      }
    }, index);
  }

  async getActiveViewType(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.view.getViewType() ?? null
    );
  }

  async getOpenFiles(): Promise<string[]> {
    return this.page.evaluate(() =>
      app.workspace
        .getLeavesOfType("markdown")
        .map((leaf: any) => leaf.view.file?.path ?? "")
    );
  }

  async waitForLayoutReady(): Promise<void> {
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
}

/**
 * ファイル操作の責務を持つクラス
 */
export class ObsidianFileSystem {
  constructor(private page: Page) {}

  async fileExists(path: string): Promise<boolean> {
    return this.page.evaluate((p) => app.vault.adapter.exists(p), path);
  }

  async readFile(path: string): Promise<string> {
    return this.page.evaluate((p) => app.vault.adapter.read(p), path);
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.page.evaluate(([p, c]) => app.vault.adapter.write(p, c), [
      path,
      content,
    ] as const);
  }

  async deleteFile(path: string): Promise<void> {
    await this.page.evaluate((p) => app.vault.adapter.remove(p), path);
  }

  async openFile(path: string): Promise<void> {
    await this.page.evaluate(async (p) => {
      const file = app.vault.getAbstractFileByPath(p);
      if (file) {
        await app.workspace.getLeaf().openFile(file as any);
      }
    }, path);
  }

  async waitForFileCreated(path: string, timeout = 5000): Promise<void> {
    await this.page.waitForFunction((p) => app.vault.adapter.exists(p), path, {
      timeout,
    });
  }
}

/**
 * エディタ操作の責務を持つクラス
 */
export class ObsidianEditor {
  constructor(private page: Page, private locators: ObsidianLocators) {}

  async clearActiveEditor(): Promise<void> {
    await this.locators.activeEditor.focus();
    await this.page.keyboard.press("Control+A");
    await this.page.keyboard.press("Backspace");
  }

  async getActiveFileContent(): Promise<string | undefined> {
    return this.page.evaluate(() =>
      app.workspace.activeEditor?.editor?.getValue()
    );
  }

  async getActiveFilePath(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.getActiveFile()?.path ?? null
    );
  }

  async getTabInnerTitle(): Promise<string | null> {
    return this.page.evaluate(
      () => app.workspace.activeLeaf?.tabHeaderInnerTitleEl.textContent ?? null
    );
  }

  async setActiveEditorContent(content: string): Promise<void> {
    await this.locators.activeEditor.focus();
    await this.locators.activeEditor.fill(content);
  }
}

/**
 * プラグイン操作の責務を持つクラス
 */
export class ObsidianPlugins {
  constructor(private page: Page, private context?: ObsidianPageTextContext) {}

  async getPlugin<T = any>(pluginId: string): Promise<JSHandle<T>> {
    if (!this.context?.pluginHandleMap) {
      throw new Error("vaultContext.pluginHandleMap is not initialized");
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

  async rebuildReferences(
    vaultOptions: VaultOptions,
    getPluginHandleMapFn: typeof getPluginHandleMap = getPluginHandleMap
  ): Promise<ObsidianPageTextContext> {
    const pluginHandleMap = await getPluginHandleMapFn(
      this.page,
      vaultOptions.plugins || []
    );
    this.context = { ...this.context!, ...pluginHandleMap };
    return this.context;
  }

  updateContext(context: ObsidianPageTextContext): void {
    this.context = context;
  }
}

/**
 * アサーションの責務を持つクラス
 */
export class ObsidianAssertions {
  constructor(
    private page: Page,
    private locators: ObsidianLocators,
    private fileSystem: ObsidianFileSystem
  ) {}

  async expectViewCount(viewType: string, count: number): Promise<void> {
    await expect(this.locators.getAllViewsByType(viewType)).toHaveCount(count);
  }

  async expectActiveTitle(viewType: string, title: string): Promise<void> {
    await expect(this.locators.getTitleByType(viewType)).toHaveText(title);
  }

  async expectActiveTitleToContain(
    viewType: string,
    text: string
  ): Promise<void> {
    await expect(this.locators.getTitleByType(viewType)).toContainText(text);
  }

  async expectActiveTabType(type: string): Promise<void> {
    await expect(this.locators.activeTabHeader).toHaveAttribute(
      "data-type",
      type
    );
  }

  async expectTabCount(count: number): Promise<void> {
    await expect(this.locators.allTabs).toHaveCount(count);
  }

  async expectFileExists(path: string): Promise<void> {
    const exists = await this.fileSystem.fileExists(path);
    expect(exists).toBe(true);
  }

  async expectFileNotExists(path: string): Promise<void> {
    const exists = await this.fileSystem.fileExists(path);
    expect(exists).toBe(false);
  }

  async expectActiveEditorContent(content: string): Promise<void> {
    await expect(this.locators.activeEditor).toHaveText(content);
  }

  async expectActiveEditorToContain(text: string): Promise<void> {
    await expect(this.locators.activeEditor).toContainText(text);
  }
}

/**
 * UI操作とユーティリティの責務を持つクラス
 */
export class ObsidianUI {
  constructor(private page: Page) {}

  async getTitleBarText(): Promise<string | null> {
    return await this.page
      .locator(".workspace-leaf.mod-active .view-header-title")
      .textContent();
  }

  async getTabHeaderText(): Promise<string | null> {
    return await this.page
      .locator(".workspace-tab-header.mod-active .workspace-tab-header-inner")
      .textContent();
  }

  async measureLoadTime(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
  }

  async applySearchFilter(
    searchText: string,
    selector = 'input[type="text"]'
  ): Promise<void> {
    const searchInput = this.page.locator(selector);
    await searchInput.fill(searchText);
    await this.page.waitForTimeout(300);
  }

  async clearSearchFilter(selector = 'input[type="text"]'): Promise<void> {
    const searchInput = this.page.locator(selector);
    await searchInput.clear();
    await this.page.waitForTimeout(200);
  }
}

/**
 * 統合されたObsidian Page Object - Facadeパターン
 */
export class ObsidianAPI {
  public selectors: ObsidianSelectors;
  public locators: ObsidianLocators;
  public workspace: ObsidianWorkspace;
  public fileSystem: ObsidianFileSystem;
  public editor: ObsidianEditor;
  public plugins: ObsidianPlugins;
  public assertions: ObsidianAssertions;
  public ui: ObsidianUI;

  constructor(
    protected context?: ObsidianPageTextContext,
    protected config: PageObjectConfig = {}
  ) {
    const page = context!.page;
    invariant(page);

    this.selectors = new ObsidianSelectors();
    this.locators = new ObsidianLocators(page, this.selectors);
    this.workspace = new ObsidianWorkspace(page, this.locators);
    this.fileSystem = new ObsidianFileSystem(page);
    this.editor = new ObsidianEditor(page, this.locators);
    this.plugins = new ObsidianPlugins(page, context);
    this.assertions = new ObsidianAssertions(
      page,
      this.locators,
      this.fileSystem
    );
    this.ui = new ObsidianUI(page);
  }

  // Locators delegation
  get activeLeaf() {
    return this.locators.activeLeaf;
  }
  get activeEditor() {
    return this.locators.activeEditor;
  }
  get activeTabHeader() {
    return this.locators.activeTabHeader;
  }
  get allTabs() {
    return this.locators.allTabs;
  }
  getViewByType(viewType: string) {
    return this.locators.getViewByType(viewType);
  }
  getTitleByType(viewType: string) {
    return this.locators.getTitleByType(viewType);
  }
  getAllViewsByType(viewType: string) {
    return this.locators.getAllViewsByType(viewType);
  }
  runCommand(commandId: string): Promise<void> {
    return this.workspace.runCommand(commandId);
  }
}
