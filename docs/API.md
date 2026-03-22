# API Reference (Public)

このドキュメントは、トップレベルで `import ... from "obsidian-e2e-toolkit"` したときに公開されているAPIの概要です。

対象は最新の 1.0.0 系の公開型定義です。

## Exports

- `test`
  - Playwright の `test` を拡張した `TestType`
  - fixture:
    - `obsidian: ObsidianAPI`
    - `vaultOptions: Partial<VaultOptions>`
    - `tempDir: string`
- `expect`
  - `@playwright/test` の `expect`
- `ObsidianAPI`
  - Obsidian の renderer を操作するためのAPIクラス
- `logger`
  - `loglevel` のロガー
- `VaultOptions`
  - vault 起動とプラグイン投入を制御する型
- `fetchPlugin(repo, destArg?, opts?)`
  - GitHub リポジトリからプラグインを取得するユーティリティ

---

## ObsidianAPI

`ObsidianAPI` は `page: Page` を保持し、主に `page.evaluate(...)` 経由で Obsidian の `app` グローバルを操作します。すべてのメソッドは Promise を返します。

### Workspace State

- `activeLeaf(): Promise<WorkspaceLeafState | null>`
  - アクティブな leaf の状態を返す
  - 返り値:
    - `{ active: boolean; viewType: string | null; filePath: string | null; title: string | null }`
- `activeEditor(): Promise<WorkspaceEditorState | null>`
  - アクティブなエディタの状態を返す
  - 返り値:
    - `{ viewType: string | null; filePath: string | null; content: string }`
- `activeTab(): Promise<WorkspaceLeafState | null>`
  - アクティブタブの状態を返す
- `allTabs(): Promise<WorkspaceLeafState[]>`
  - 開いている全タブの状態を返す
- `view(viewType: string): Promise<WorkspaceLeafState | null>`
  - 指定 view type のアクティブ leaf 状態を返す
- `allViews(viewType: string): Promise<WorkspaceLeafState[]>`
  - 指定 view type の全 leaf 状態を返す
- `title(viewType: string): Promise<string | null>`
  - 指定 view type のタイトルを返す
- `vaultName(): Promise<string>`
  - 現在の vault 名を返す
- `activeViewType(): Promise<string | null>`
  - 現在アクティブな view type を返す
- `openingFiles(): Promise<string[]>`
  - 開いている markdown ファイルの path 一覧を返す

### Workspace Actions

- `command(commandId: string): Promise<void>`
  - コマンドIDを実行する
  - `pluginId:command-name` 形式のコマンドも扱える
- `split(direction?: "vertical" | "horizontal"): Promise<void>`
  - アクティブ leaf を分割する
- `closeTab(): Promise<void>`
  - アクティブタブを閉じる
- `clickClose(): Promise<void>`
  - `closeTab()` の別名
- `undoClose(): Promise<void>`
  - 閉じたタブを戻す
- `back(): Promise<void>`
  - 履歴を戻る
- `forward(): Promise<void>`
  - 履歴を進める
- `switchToLeaf(index: number): Promise<void>`
  - 指定インデックスの leaf に切り替える

### Wait Helpers

- `waitReady(timeout?: number): Promise<void>`
  - `app.workspace.layoutReady` または `activeLeaf` が利用可能になるまで待つ
  - デフォルト timeout は実装依存だが、型上は省略可能
- `waitForApp<Arg = undefined>(predicate, arg?, timeout?): Promise<void>`
  - renderer 側で predicate が true になるまで待つ
- `waitForView<T extends ItemView>(viewType: string): Promise<JSHandle<T>>`
  - 指定 view type の view が生成されるまで待ち、その `leaf.view` を返す
- `waitForViewType(viewType: string, timeout?: number): Promise<void>`
  - 指定 view type がアクティブになるまで待つ

### Editor / Active File

- `clear(): Promise<void>`
  - アクティブエディタの内容をクリアする
- `content(): Promise<string | undefined>`
  - アクティブエディタの内容を返す
- `filePath(): Promise<string | null>`
  - アクティブファイルの path を返す
- `tabTitle(): Promise<string | null>`
  - アクティブタブの表示名を返す
- `write(content: string): Promise<void>`
  - アクティブエディタへ内容を書き込む

### File Operations

- `exists(path: string): Promise<boolean>`
  - ファイルの存在確認
- `read(path: string): Promise<string>`
  - ファイル内容を読み込む
- `save(path: string, content: string): Promise<void>`
  - ファイル内容を書き込む
- `delete(path: string): Promise<void>`
  - ファイルを削除する
- `open(path: string): Promise<void>`
  - ファイルを開く
- `waitForFile(path: string, timeout?: number): Promise<void>`
  - ファイル生成を待つ

### Plugin Operations

- `plugin<T = any>(pluginId: string): Promise<JSHandle<T>>`
  - 指定プラグインの JSHandle を返す
  - 対象は `vaultOptions.plugins` でインストールされたプラグイン
- `isPluginEnabled(pluginId: string): Promise<boolean>`
  - プラグインが有効かを返す
- `waitForPluginEnabled(pluginId: string, timeout?: number): Promise<void>`
  - プラグインが有効になるまで待つ
- `waitForPluginDisabled(pluginId: string, timeout?: number): Promise<void>`
  - プラグインが無効になるまで待つ
- `pluginState(pluginId: string): Promise<{ enabled: boolean; loaded: boolean; registered: boolean }>`
  - enable / load / register の状態を返す
- `rebuildPlugins(vaultOptions: VaultOptions, getPluginHandleMapFn?: typeof getPluginHandleMap): Promise<ObsidianPageTextContext>`
  - プラグイン構成を作り直した context を返す
- `updateContext(context: ObsidianPageTextContext): void`
  - `ObsidianAPI` が保持する内部 context を更新する

### Assertions

- `expectViews(viewType: string, count: number): Promise<void>`
  - view 数を検証する
- `expectTitle(viewType: string, title: string): Promise<void>`
  - view タイトル一致を検証する
- `expectTitleContains(viewType: string, text: string): Promise<void>`
  - view タイトル部分一致を検証する
- `expectActiveType(type: string): Promise<void>`
  - アクティブ view type を検証する
- `expectTabs(count: number): Promise<void>`
  - タブ数を検証する
- `expectExists(path: string): Promise<void>`
  - ファイルが存在することを検証する
- `expectNotExists(path: string): Promise<void>`
  - ファイルが存在しないことを検証する
- `expectContent(content: string): Promise<void>`
  - エディタ内容の完全一致を検証する
- `expectContentContains(text: string): Promise<void>`
  - エディタ内容の部分一致を検証する

### UI Helpers

- `titleBarText(): Promise<string | null>`
  - タイトルバーの表示文字列を返す
- `tabHeaderText(): Promise<string | null>`
  - タブヘッダーの表示文字列を返す
- `measureTime(action: () => Promise<void>): Promise<number>`
  - 任意アクションの所要時間を ms で返す
- `search(text: string, selector?: string): Promise<void>`
  - 入力欄へ検索文字列を入れる
  - デフォルト selector は `input[type="text"]`
- `clearSearch(selector?: string): Promise<void>`
  - 検索欄をクリアする
  - デフォルト selector は `input[type="text"]`

---

## Types

### WorkspaceLeafState

```ts
interface WorkspaceLeafState {
  active: boolean;
  viewType: string | null;
  filePath: string | null;
  title: string | null;
}
```

### WorkspaceEditorState

```ts
interface WorkspaceEditorState {
  viewType: string | null;
  filePath: string | null;
  content: string;
}
```

### VaultOptions

```ts
interface VaultOptions {
  name?: string;
  sandbox?: boolean;
  fresh?: boolean;
  logLevel?: log.LogLevelDesc;
  enableBrowserConsoleLogging?: boolean;
  browserConsoleLogging?: BrowserConsoleLoggingOptions;
  plugins: TestPlugin[];
}
```

#### 各フィールド

- `name?: string`
  - 使用する vault 名。省略時は一時 vault が使われる
- `sandbox?: boolean`
  - Obsidian を sandbox モードで起動するか
- `fresh?: boolean`
  - 毎回クリーンな vault で開始するか
- `logLevel?: log.LogLevelDesc`
  - ツールキットのログレベル
- `enableBrowserConsoleLogging?: boolean`
  - browser 側 console をロガーへ転送するか
- `browserConsoleLogging?: BrowserConsoleLoggingOptions`
  - browser console の詳細制御
- `plugins: TestPlugin[]`
  - テスト開始時に vault へ投入するプラグイン一覧

### BrowserConsoleLoggingOptions

```ts
interface BrowserConsoleLoggingOptions {
  enabledTypes?: string[];
  maxMessageLength?: number;
  previewLength?: number;
  ignoredMessagePatterns?: string[];
  demoteErrorMessagePatterns?: string[];
  includeLocation?: boolean;
  includePageErrors?: boolean;
  includeRequestFailures?: boolean;
  includeHttpErrors?: boolean;
  httpErrorThreshold?: number;
}
```

#### 各フィールド

- `enabledTypes?: string[]`
  - 捕捉する console message type 一覧
- `maxMessageLength?: number`
  - 1件の最大ログ長
- `previewLength?: number`
  - 切り詰め時に残すプレビュー長
- `ignoredMessagePatterns?: string[]`
  - 完全に無視するメッセージの正規表現パターン
- `demoteErrorMessagePatterns?: string[]`
  - error を warn 扱いへ落とすパターン
- `includeLocation?: boolean`
  - 発生箇所の URL / line / column を含めるか
- `includePageErrors?: boolean`
  - `pageerror` を拾うか
- `includeRequestFailures?: boolean`
  - `requestfailed` を拾うか
- `includeHttpErrors?: boolean`
  - HTTP エラー応答を拾うか
- `httpErrorThreshold?: number`
  - HTTP エラーとみなす status 下限

### TestPlugin

```ts
interface TestPlugin {
  path: string;
  symlink?: boolean;
}
```

- `path`
  - プラグインのディレクトリパス
- `symlink?: boolean`
  - `true` の場合はコピーではなく symlink で投入する

### TestFixtures

```ts
type TestFixtures = {
  obsidian: ObsidianAPI;
  vaultOptions: Partial<VaultOptions>;
  tempDir: string;
};
```

---

## fetchPlugin

```ts
fetchPlugin(
  repo: string,
  destArg?: string,
  opts?: { fallbackToGit?: boolean },
): Promise<string>
```

- `repo`
  - `owner/repo` 形式の GitHub リポジトリ名
- `destArg?`
  - 取得先ディレクトリ
- `opts?.fallbackToGit?`
  - release asset の取得に失敗したとき Git clone へフォールバックするか
- 戻り値
  - 展開先ディレクトリの path

---

## Note

- このドキュメントはトップレベル export のみを対象にしています
- 内部サービスや launcher 実装の型は含めていません
- 過去バージョンでは `ObsidianAPI` が Locator 中心のAPIだった時期がありますが、最新系では状態取得メソッドと待機ヘルパーが拡充されています
