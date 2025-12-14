# API Reference (Public)

このパッケージがトップレベル（`import ... from "obsidian-e2e-toolkit"`）で公開しているAPIの概要です。

## Exports

- `test`: Playwright `test` を拡張した fixture 付きの `test`
  - fixture: `obsidian: ObsidianAPI`
  - option: `vaultOptions: Partial<VaultOptions>`
- `expect`: `@playwright/test` の `expect`
- `ObsidianAPI`: Obsidian（renderer）を操作する薄いAPIラッパ
- `logger`: `loglevel` のロガー（名前: `obsidianSetup`）
- `VaultOptions`（type）: vault/起動オプション

---

## `ObsidianAPI`

`ObsidianAPI` は `page: Page` を保持し、主に `page.evaluate(...)` 経由で Obsidian の `app` グローバル（renderer）を操作します。

### Locators

- `activeLeaf: Locator`
- `activeEditor: Locator`
- `activeTab: Locator`
- `allTabs: Locator`
- `view(viewType: string): Locator` - アクティブleafの `data-type` を指定して取得
- `title(viewType: string): Locator` - タブのタイトル（`data-type`）
- `allViews(viewType: string): Locator` - 全leafの `data-type` を指定して取得

### Workspace / Commands

- `command(commandId: string): Promise<void>` - Obsidian commandを実行（失敗時は `expect` で落とす）
- `split(direction?: "vertical" | "horizontal"): Promise<void>`
- `closeTab(): Promise<void>`
- `clickClose(): Promise<void>` - UIの×ボタンをクリック
- `undoClose(): Promise<void>`
- `back(): Promise<void>` / `forward(): Promise<void>`
- `switchToLeaf(index: number): Promise<void>`
- `activeViewType(): Promise<string | null>`
- `openingFiles(): Promise<string[]>` - 開いているmarkdownファイルのpath一覧
- `waitReady(): Promise<void>` - `app.workspace.layoutReady` を待つ
- `waitForView(viewType: string): Promise<JSHandle<T>>` - 対象viewが生成されるまで待って `leaf.view` を返す
- `waitForViewType(viewType: string, timeout?: number): Promise<void>`

### Editor

- `clear(): Promise<void>`
- `content(): Promise<string | undefined>`
- `filePath(): Promise<string | null>`
- `tabTitle(): Promise<string | null>`
- `write(content: string): Promise<void>`

### Files (Vault)

- `exists(path: string): Promise<boolean>`
- `read(path: string): Promise<string>`
- `save(path: string, content: string): Promise<void>`
- `delete(path: string): Promise<void>`
- `open(path: string): Promise<void>`
- `waitForFile(path: string, timeout?: number): Promise<void>`

### Plugins

- `plugin(pluginId: string): Promise<JSHandle<T>>` - `vaultOptions.plugins` で指定されたpluginのhandleを取得
- `isPluginEnabled(pluginId: string): Promise<boolean>`
- `rebuildPlugins(vaultOptions: VaultOptions, getPluginHandleMapFn?): Promise<ObsidianPageTextContext>`
- `updateContext(context: ObsidianPageTextContext): void`

### Assertions (Expect helpers)

- `expectViews(viewType: string, count: number): Promise<void>`
- `expectTitle(viewType: string, title: string): Promise<void>`
- `expectTitleContains(viewType: string, text: string): Promise<void>`
- `expectActiveType(type: string): Promise<void>`
- `expectTabs(count: number): Promise<void>`
- `expectExists(path: string): Promise<void>` / `expectNotExists(path: string): Promise<void>`
- `expectContent(content: string): Promise<void>` / `expectContentContains(text: string): Promise<void>`

### Misc UI

- `vaultName(): Promise<string>`
- `titleBarText(): Promise<string | null>`
- `tabHeaderText(): Promise<string | null>`
- `measureTime(action: () => Promise<void>): Promise<number>`
- `search(text: string, selector?: string): Promise<void>`
- `clearSearch(selector?: string): Promise<void>`
