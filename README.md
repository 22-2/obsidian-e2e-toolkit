# Obsidian E2E Test Toolkit

Obsidian（Electron）を Playwright でE2Eテストするためのユーティリティです。トップレベルの公開APIは `test` / `expect` / `ObsidianAPI` に絞っています。

## 要件

- Node.js: `>= 23`
- Playwright: `@playwright/test` / `playwright`（peerDependencies）

## インストール

```bash
pnpm add -D obsidian-e2e-toolkit electron playwright @playwright/test
```

Electron のバイナリが未取得で E2E を起動できない場合は、`pnpm exec node node_modules/electron/install.js` で取得できます。
E2E 用 Obsidian は起動時に `obsidian://` の既定アプリを登録・解除しないため、通常の Obsidian の関連付けを維持します。
旧バージョンの E2E 起動ですでに関連付けが変わっている場合は、Windows のレジストリ
`HKEY_CURRENT_USER\Software\Classes\obsidian\shell\open\command` の既定値を
`"実際にインストールした Obsidian.exe のフルパス" "%1"` に戻してください。

## クイックスタート

```bash
pnpm exec obsidian-e2e-toolkit   # playwright.config.ts と e2e/example.spec.ts を生成（既存ファイルは上書きしない）
```

## 便利な API

- `obsidian.createNote(path, content)`: vault API でノートを作成（親フォルダも作成。既存なら上書き）
- `obsidian.evaluateApp(fn, arg)`: Obsidian 内で `app` を使う関数を実行
- `obsidian.pluginData(id)` / `obsidian.setPluginData(id, patch)`: プラグインの `data.json` を読み書き
- `vaultOptions.plugins[].data`: 起動前にプラグインの初期 `data.json` を書き込む（symlink 時は無視）

## Linux / CI で実行する

ディスプレイのない環境（Linux サーバー、コンテナ、CI）では仮想ディスプレイが必要です。

```bash
xvfb-run -a pnpm exec playwright test
```

- テストが失敗すると、Obsidian ウィンドウのスクリーンショット（`obsidian-screenshot`）と DOM（`obsidian-dom`）が Playwright のレポートと `test-results/` に添付されます。
- 単体テスト用の Vitest などが `e2e/` の spec を拾わないよう、テスト対象を `src/**` などに限定してください。
- E2E を実行しないジョブでは `ELECTRON_SKIP_BINARY_DOWNLOAD=1` を設定すると、Electron のダウンロードを省略できます。
- GitHub Actions の Ubuntu では `electron.launch` が失敗する既知の問題があります。`xvfb-run` 付きで動作確認してください。

## リリース

リリースには Conventional Commits の履歴を使います。まず変更をコミットしてから、次のコマンドでバージョン更新と CHANGELOG の内容を確認してください。

```bash
pnpm release -- --dry-run --ci
```

確認後に `pnpm release` を実行すると、`package.json` と `CHANGELOG.md` を更新して、バージョン更新コミットと `1.2.0` のような `v` なしタグを push します。タグはソース履歴上に維持し、GitHub Actions はビルド済みの npm 互換 tarball を Release asset として作成します。インストール URL は各 Release の説明に表示されます。npm には publish しません。

インストール後に `postinstall` で `setup.mjs` が実行され、同梱されている Obsidian の ASAR アセットを `.obsidian-unpacked/` に展開します。

再実行したい場合:

```bash
node node_modules/obsidian-e2e-toolkit/setup.mjs
```

### Obsidian バージョン指定

`setup.mjs` は環境変数で取得バージョンを切り替えられます。

- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=latest`（デフォルト）: 最新版
- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=1.12.4`: 指定

`latest` でモバイル専用リリースが選ばれた場合は、デスクトップ用の
`tar.gz` と `asar.gz` を含む直近の公開リリースを自動的に使用します。

互換のため `OBSIDIAN_VERSION` も参照しますが、推奨は `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION` です。

```yaml
env:
  OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION: 1.12.4
```

### pnpm 設定（必須）

`pnpm` を使用する場合は、`package.json` に以下の設定を追加してください：

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "electron",
      "obsidian-e2e-toolkit"
    ]
  }
}
```

**理由**：
- `onlyBuiltDependencies` は、モジュール解決時にこれらのパッケージのプリビルト（ネイティブ）バイナリだけを使用させます。多くのプラグインが同梱依存関係として独自のバージョンの electron を持つため、この設定がないと互換性問題が発生します。
- Electron は利用側がインストールしたバージョンを使います。ツールキットは特定の Electron バージョンに固定しません。
- `obsidian-typings` など複数の Electron バージョンを要求する依存関係がある場合は、プロジェクト側で互換性を確認した上で `overrides` を設定してください。

## CI でのレートリミット対策

`setup.mjs` は以下を満たす場合、GitHub API を呼ばずにキャッシュだけで処理します。

- `obsidian-e2e-toolkit-assets/obsidian-unpacked/main.cjs` が存在する
- または `obsidian-e2e-toolkit-assets/cache` 配下に必要な ASAR キャッシュが存在する

GitHub Actions では、必要に応じて `GITHUB_TOKEN`（または `GH_TOKEN`）を環境変数に渡してください。

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

キャッシュ対象の例:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      obsidian-e2e-toolkit-assets
      node_modules/obsidian-e2e-toolkit/obsidian-e2e-toolkit-assets
    key: ${{ runner.os }}-obsidian-e2e-${{ hashFiles('pnpm-lock.yaml') }}
```

## クイックスタート

Playwright のテストはそのまま使い、import だけこのパッケージの `test` を使います（fixtureとして `obsidian: ObsidianAPI` が生えます）。

```ts
import { expect, test } from "obsidian-e2e-toolkit";

test("smoke", async ({ obsidian }) => {
  await obsidian.waitReady();
  expect(await obsidian.vaultName()).toBeTruthy();
});
```

### プラグインを読み込んでテストする

```ts
import { expect, test } from "obsidian-e2e-toolkit";
import path from "node:path";

test.use({
  vaultOptions: {
    plugins: [
      {
        path: path.resolve("example/sample-plugin"),
      },
    ],
  },
});

test("plugin activation", async ({ obsidian }) => {
  expect(await obsidian.isPluginEnabled("sample-plugin")).toBe(true);
  expect(await obsidian.plugin("sample-plugin")).toBeTruthy();
});
```

fixture はリロード後にプラグインのロード状態と、`styles.css` がある場合はスタイルの読み込みも確認します。未適用の CSS は Obsidian の `loadCSS()` で一度だけ再読み込みし、復旧できなければセットアップエラーになります。CSS を持たないプラグインも利用できます。プラグイン固有の非同期データや画面の描画完了は、各テストで待機してください。

`page` fixture は `obsidian.page` と同じ vault の Page を返すため、次の書き方でも Obsidian を操作できます。別ウィンドウで開く設定画面は、そのウィンドウの Page を取得して操作してください。

```ts
test("vault renderer", async ({ obsidian, page }) => {
  expect(page).toBe(obsidian.page);
  await expect(page.locator(".workspace")).toBeVisible();
});
```

toolkit 自体の準備完了と `page` fixture の E2E 検証は `pnpm test:e2e:readiness` で実行できます。この検証では、外部のコミュニティプラグインを取得せず、一時的なテストプラグインを使用します。

## `vaultOptions`（fixture）

`test.use({ vaultOptions: ... })` で vault の挙動を調整できます。

- `name?: string` - vault名
- `sandbox?: boolean` - sandbox vaultを使うか
- `fresh?: boolean` - 毎回クリーンなvaultを作るか
- `logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent"`
- `enableBrowserConsoleLogging?: boolean`
- `browserConsoleLogging?: { enabledTypes?: string[]; maxMessageLength?: number; previewLength?: number; ignoredMessagePatterns?: string[]; includeLocation?: boolean; includePageErrors?: boolean; includeRequestFailures?: boolean; includeHttpErrors?: boolean; httpErrorThreshold?: number }`
- `obsidianCli?: "off" | "auto" | "required"` - CLI利用モード（デフォルトは `auto`）
- `plugins: Array<{ path: string; pluginId: string; symlink?: boolean }>`

`auto` では、CLI が利用可能で対象 Vault のパスが一致した場合だけ、
`plugins:restrict off` と `plugin:enable` を実行します。CLI が未インストール、
対象 Vault が別、または対象アプリに接続できない場合は Playwright 経路へ
自動フォールバックするため、CI に Obsidian CLI をインストールする必要はありません。

CLI の実行ファイルを明示する場合は `OBSIDIAN_CLI_PATH` を指定できます。

## APIリファレンス

- `docs/API.md`

## このリポジトリ内のサンプルを動かす

```bash
pnpm -s test:e2e:example
```

License: MIT
