# API Reference (Public)

このドキュメントは、トップレベルで `import ... from "obsidian-e2e-toolkit"` したときに公開されているAPIの概要です。

対象は現在の公開型定義です。

## Exports

- `test`
  - Playwright の `test` を拡張した `TestType`
  - fixture:
    - `obsidian: ObsidianAPI`
    - `vaultOptions: Partial<VaultOptions>`
    - `coverageOptions: CoverageOptions`（既定で無効）
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

## Coverage

`CoverageOptions` はトップレベルから型として import できます。

```ts
type CoverageOptions = {
    enabled?: boolean;
    pluginPaths?: readonly string[];
    outputDir?: string;
};
```

`pluginPaths` の既定値は `vaultOptions.plugins` のパス、`outputDir` の既定値は `coverage/e2e` です。
測定対象には `manifest.json` と、ソースマップ付きの `main.js` が必要です。

`obsidian-e2e-toolkit/coverage` は次の API を公開します。

- `CoverageReporter`（default export でも提供）: Playwright reporter。`enabled`、`outputDir`、`clean`、`reporters` を指定できます。
- `resetCoverageOutput(outputDir?)`: toolkit の過去の `raw/` を削除します。他のファイルは削除しません。
- `generateCoverageReport({ outputDir?, reporters? }?)`: raw 結果からレポートを生成し、集計値を返します。
- `mergeCoverageReports({ inputFiles, outputDir?, reporters? })`: Istanbul JSON を合算し、集計値を返します。既定の出力先は `coverage/combined` です。

`reporters` は `"text" | "html" | "lcov" | "json"` の配列です。既定ではすべて出力します。
実行例・複数実行の合算・Vitest との統合は [README](../README.md#e2e-カバレッジ) を参照してください。

---

## ObsidianAPI

`ObsidianAPI` は `page: Page` を保持し、主に `page.evaluate(...)` 経由で Obsidian の `app` グローバルを操作します。すべてのメソッドは Promise を返します。

### App Access

- `electronApp: ElectronApplication`
  - Electron のメインプロセスを操作する Playwright のハンドル。レンダラーからは触れないウィンドウ操作に使う（例: `await obsidian.electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].blur())`）。`page` と違い、ウィンドウの実際のフォーカス状態などを扱える
- `evaluateApp<T, Arg = undefined>(callback: (arg: Arg) => T | Promise<T>, arg?: Arg): Promise<T>`
  - Obsidian のレンダラー内でコールバックを実行する。グローバルの `app` を使える（`page.evaluate` + `(window as any).app` の代わり）。引数と戻り値はシリアライズ可能な値に限る

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
  - 開いている全タブの状態を返す。`iterateAllLeaves` が拾えない背景タブ（Obsidian 1.14.4 で `getLeaf("tab").openFile(file, { active: false })` した場合）も、`getLeavesOfType` を併用して含める。まだ読み込まれていない deferred view は保存済みの view state から `filePath` / `viewType` を返す
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
  - `app.workspace.layoutReady === true` になるまで待つ。既定は 15000ms
  - fixture は起動時にこの状態を保証してからテストへ渡すため、テスト冒頭で呼ぶ必要はない。手動の画面遷移の後に使う
  - `activeLeaf` があるだけでは待ち終わらない
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
- `createNote(path: string, content?: string): Promise<void>`
  - vault API でノートを作成する（親フォルダも作成。既存なら内容を上書き）。`save` と違い、メタデータキャッシュにも反映される
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
- `pluginData<T = Record<string, any>>(pluginId: string): Promise<T | null>`
  - `plugin.loadData()` でプラグインの `data.json` を読む（プラグインがロードされていない場合は例外）
- `setPluginData(pluginId: string, patch: Record<string, unknown>): Promise<void>`
  - 現在の data に `patch` を浅くマージして `plugin.saveData()` で保存する。実行中のプラグインのメモリ上の設定は更新されないため、反映にはプラグイン側の再読み込みが必要な場合がある
- `isPluginEnabled(pluginId: string): Promise<boolean>`
  - `enabledPlugins` に含まれるか（設定上の有効状態）を返す。実際にロードされているかとは独立
- `waitForPluginEnabled(pluginId: string, timeout?: number): Promise<void>`
  - 設定上で有効になるまで待つ。ロード完了を待つ場合は `waitForPluginLoaded` を使う。`waitFor*` 系は**タイムアウト時に例外を投げる**（真偽値は返さない）。真偽で分岐したい場合は `isPluginEnabled` / `isPluginLoaded` / `pluginState` を `expect.poll` で使う
- `waitForPluginDisabled(pluginId: string, timeout?: number): Promise<void>`
  - 設定上で無効になるまで待つ。アンロード完了を待つ場合は `waitForPluginUnloaded` を使う
- `isPluginLoaded(pluginId: string): Promise<boolean>`
  - 実際のロード状態（プラグインインスタンスの `_loaded`）を返す。インスタンスが存在しない場合は `false`
- `waitForPluginLoaded(pluginId: string, timeout?: number): Promise<void>`
  - 実際にロードされるまで待つ。設定上は無効でも、遅延読み込みでロードされた場合に使える
- `waitForPluginUnloaded(pluginId: string, timeout?: number): Promise<void>`
  - 実際にアンロードされるまで待つ。設定上は有効でも、実行を停止した場合に使える
- `pluginState(pluginId: string): Promise<{ enabled: boolean; loaded: boolean; registered: boolean }>`
  - `enabled`: 設定上の有効状態、`loaded`: 実際のロード状態、`registered`: プラグインインスタンスの存在を返す
- `reloadPlugin(pluginId: string): Promise<void>`
  - プラグインをアンロード → ロードして `data.json` を読み直させ、ロード完了を待つ。設定上の有効状態は変更しない。`setPluginData` の後に使う。`plugin(id)` が返す対象も新しいインスタンスに更新される
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
  obsidianCli?: "off" | "auto" | "required";
  plugins: readonly TestPlugin[];
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
- `obsidianCli?: "off" | "auto" | "required"`
  - 同じ vault を CLI が操作できる場合だけ CLI を利用し、それ以外は Playwright へフォールバックするモード
- `plugins: readonly TestPlugin[]`
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
  data?: Record<string, unknown>;
}
```

- `path`
  - プラグインのディレクトリパス（`manifest.json` と `main.js` が必要）
- `symlink?: boolean`
  - `true` の場合はコピーではなく symlink で投入する
- `data?: Record<string, unknown>`
  - 起動前にプラグインの `data.json` として書き込む初期設定。symlink 投入時は元ディレクトリを変更しないよう無視され、警告ログが出る

## 失敗時の添付ファイル

テストが失敗（または timeout）すると、Obsidian ウィンドウのスクリーンショット `obsidian-screenshot`（PNG）と DOM `obsidian-dom`（HTML）が Playwright のテスト結果に自動で添付される。取得に失敗しても元のエラーは隠さず、警告ログだけを出す。

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
  opts?: { tag?: string; cache?: boolean; fallbackToGit?: boolean },
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

## 追加 API（runtime）

以下は `ObsidianAPI` のメソッド。すべて Promise を返す。

### 設定ウィンドウとウィンドウ探索

- `openSettings(tabId: string, options?: { subPage?: string; timeout?: number }): Promise<Page>`
  - 設定を開いて `tabId` のタブを選び、設定ウィンドウの `Page` を返す。既に開いていれば同じウィンドウを返す
  - 検出は `findPage` で行う。`page` イベントは待たない
  - 設定が vault 画面のモーダルとして出た場合（`settingsPopoutWindow` が無効）は、vault の `Page` を返す
  - `subPage` は設定画面の項目名（`.setting-item-name`）のうち、表示文字列が完全一致する可視の要素をクリックする。左メニューには限定しない。見出し等の同じ文字は対象外
  - 既定 timeout は 10000ms
- `closeSettings(options?: { timeout?: number }): Promise<void>`
  - `app.setting.close()` の後、設定ウィンドウが見えなくなるまで待つ
- `findPage(locate: (page: Page) => Locator, options?: { timeout?: number; description?: string }): Promise<Page>`
  - 開いている全ウィンドウを一定間隔で再列挙し、`locate` が返す要素のうち可視なものが 1 つ以上あるウィンドウの `Page` を返す
  - 先頭の要素だけは見ない。先頭が hidden で 2 個目が visible なら一致する
  - 待機中に開いたウィンドウも対象になる。探索中に閉じたウィンドウは候補から外れ、エラーにはならない
  - 複数のウィンドウに一致した場合は、Playwright の一覧順（古い順）の先頭を返す
  - 既定 timeout は 10000ms。失敗時のエラーには `description`、ウィンドウ数、各ウィンドウの一致数（全体と可視）を含める

### 再読込とリロード要求の差し替え

- `reload(options?: { saveLayout?: boolean; timeout?: number; expectLoaded?: string[] }): Promise<void>`
  - 既定ではレイアウトを保存（`app.workspace.saveLayout()`）してから、ページを再読込する
  - 準備完了の待機対象は、再読込の直前に読み込まれていた plugin。`expectLoaded` を渡すと、その ID を待つ（空配列なら待たない）
  - 起動時に導入した全 fixture は待たない。無効化された plugin と、再読込の直前に未ロードだった plugin は待たない
  - 待った plugin について、読み込みと styles.css の適用を確認する。CSS が欠落していれば Obsidian の `loadCSS()` で復旧する
  - plugin の有効化・無効化は行わない。設定ファイル（`community-plugins.json` など）は書き換えない
  - 完了後、plugin のハンドル（`plugin(id)`）は再読込後のインスタンスを指す
  - 既定 timeout は 30000ms。失敗時のエラーには、読み込まれなかった ID と CSS が欠落した ID を含める
  - coverage 有効時は、再読込の前に `checkpoint` を行う
- `interceptReload(): Promise<ReloadInterceptor>`
  - `app.commands.executeCommandById` のうち `app:reload` だけを差し替え、呼び出しを記録する。実行はしない
  - `app:reload` 以外の ID は元の関数へそのまま渡す。this・引数（2 番目以降を含む）・戻り値を保つ
  - 同じウィンドウで有効な差し替えは 1 つだけ。2 つ目は例外になる
  - テスト終了時に fixture が残りを自動で戻す

`ReloadInterceptor` は次のメソッドを持つ。

- `requested(): Promise<boolean>`: 1 回でも要求されたら true
- `requests(): Promise<ReloadRequest[]>`: 要求ごとのスナップショット（呼び出し順）。`ReloadRequest` は `enabledPluginIds: string[] を持ち、要求を受けた時点の `app.plugins.enabledPlugins` を昇順に複製したもの。後で有効状態を変えても変わらない
- `restore(): Promise<void>`: 差し替えを元に戻す。2 回目以降は何もしない。restore の後も `requests()` は restore 時点の記録を返す

差し替えは、`reload()` やページの再読込で消える。その後の `requests()` は例外、`restore()` は何もしない。`restore()` は、差し替えの後に `executeCommandById` が別の処理に置き換えられていた場合は例外を投げ、上書きしない。

### vault と設定ファイル

- `vaultPath(): Promise<string>`: vault のディスク上の絶対パス
- `configDir(): Promise<string>`: 設定ディレクトリ名（通常は `.obsidian`）
- `readConfig<T>(file: string): Promise<T>`: 設定ディレクトリ配下の JSON を読む。`file` は相対パスのみ。絶対パス、vault の外へ出る `..`、実体が設定ディレクトリの外にある symlink は拒否する
- `enabledPluginsOnDisk(): Promise<string[]>`: `community-plugins.json` の一覧。ファイルが無い、または配列でなければ例外

### プラグインの settings

- `pluginSettings<T>(pluginId: string): Promise<T>`: 読み込まれた plugin の `settings` を読む（読み取り専用）。未ロードや `settings` が無い場合は例外
- `updatePluginSettings(pluginId: string, patch: Record<string, unknown>): Promise<void>`: `settings` に `patch` を浅くマージし、`saveSettings()` を await する。UI の再描画は行わない。`saveSettings` が無い plugin は例外
- `evaluatePlugin<T, P, Arg>(pluginId, fn, arg?): Promise<T>`: plugin のインスタンスを渡して `fn(plugin, arg)` を renderer で実行する。`fn` はシリアライズされるため、外側の変数を参照しない

### ワークスペース

- `collapseSidebars(): Promise<void>`: 左右のサイドバーを閉じる
- `openView(viewType, state?, options?: { newLeaf?: boolean }): Promise<void>`: 指定の view を開き、前面に出して active にする。`newLeaf: true` なら新しいタブ、既定はアクティブ leaf を使う
- `revealView(viewType: string): Promise<void>`: 指定 view の先頭 leaf を前面に出して active にし、遅延読み込みなら描画させる。無ければ例外
- `describeLeaves(): Promise<string>`: 開いている leaf を 1 行ずつ整形した文字列（失敗メッセージ用）

### 撮影補助

- `setTheme(theme: 'dark' | 'light', page?: Page): Promise<void>`: `body` のテーマクラスを切り替える。設定ファイルは変えない
- `emulateMobile(kind: 'phone' | 'tablet', page?: Page, options?: { platform?: 'android' | 'ios' }): Promise<void>`: `body` のクラス（`is-mobile`、`is-phone` または `is-tablet`、`is-android` または `is-ios`）だけでモバイル表示を再現する。既定の platform は android（lazy の既存の撮影と同じ）。viewport と `Platform.isMobile` は変わらない
- `waitForAnimations(page?: Page, options?: { timeout?: number }): Promise<void>`: 実行中で無限でないアニメーションが終わるまで待つ。無限のアニメーションは待たない

### コマンド

- `hasCommand(id: string): Promise<boolean>`: コマンドが登録されているか。`pluginId:name` の形式では ID マッピングも試す
- `findCommands(prefix: string): Promise<string[]>`: 接頭辞に一致するコマンド ID の一覧
- `tryCommand(id: string): Promise<boolean>`: コマンドを実行し、実行されたかを返す。ID が無い・実行されなかった場合は false
  - `executeCommandById` 自体が投げた例外は隠さず、そのまま呼び出し元へ伝える
  - コマンドの callback（native command を含む）が投げた例外は Obsidian の処理に従う。この API は、その扱いを保証しない
- `command(id: string): Promise<void>`: `tryCommand` を呼び、実行されなければ失敗させる

### 準備 helper（ビルド済みプラグインの取得と配置）

- `preparePlugins(sources: Record<string, PluginSource>, baseDir: string, opts?: PreparePluginsOptions): Promise<Record<string, string>>`: 各 plugin を `baseDir/destDir/<key>` に取得して配置する。配置先の絶対パスを key ごとに返す。失敗は 1 つのエラーにまとめる
- `preparePlugin(input: PreparePluginInput, dest: string): Promise<string>`: manifest・main.js・styles.css（任意）から配置する
- `defineObsidianConfig(overrides?: PlaywrightTestConfig): PlaywrightTestConfig`: Playwright の設定に Obsidian E2E 向けの既定値を加える。利用者が明示した値を優先する

---

## Note

- このドキュメントはトップレベル export のみを対象にしています
- 内部サービスや launcher 実装の型は含めていません
- 過去バージョンでは `ObsidianAPI` が Locator 中心のAPIだった時期がありますが、最新系では状態取得メソッドと待機ヘルパーが拡充されています
