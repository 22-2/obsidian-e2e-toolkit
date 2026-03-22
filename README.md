# Obsidian E2E Test Toolkit

Obsidian（Electron）を Playwright でE2Eテストするためのユーティリティです。トップレベルの公開APIは `test` / `expect` / `ObsidianAPI` に絞っています。

## 要件

- Node.js: `>= 23`
- Playwright: `@playwright/test` / `playwright`（peerDependencies）

## インストール

```bash
pnpm add -D obsidian-e2e-toolkit electron playwright @playwright/test
```

インストール後に `postinstall` で `setup.mjs` が実行され、同梱されている Obsidian の ASAR アセットを `.obsidian-unpacked/` に展開します。

再実行したい場合:

```bash
node node_modules/obsidian-e2e-toolkit/setup.mjs
```

### Obsidian バージョン指定

`setup.mjs` は環境変数で取得バージョンを切り替えられます。

- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=latest`（デフォルト）: 最新版
- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=1.12.4`: 指定

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
    ],
    "overrides": {
      "electron": "41.0.3"
    }
  }
}
```

**理由**：
- `onlyBuiltDependencies` は、モジュール解決時にこれらのパッケージのプリビルト（ネイティブ）バイナリだけを使用させます。多くのプラグインが同梱依存関係として独自のバージョンの electron を持つため、この設定がないと互換性問題が発生します。
- `overrides` で electron のバージョンを統一することで、このツールキットが期待するバージョンが使われることを保証します。

> **`obsidian-typings` を使用する場合**: より厳密なバージョン管理が必要です。e2e-toolkit と同じバージョンの electron で上書きしてください。例えば e2e-toolkit が electron `41.0.3` を期待する場合、`overrides` に `"electron": "41.0.3"` を指定してください。
>
> `overrides` を設定しないと、プラグインが依存する electron のバージョンが優先されて、`Electron failed to install correctly` エラーが発生します。必ず `overrides` を含めてください。

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

## `vaultOptions`（fixture）

`test.use({ vaultOptions: ... })` で vault の挙動を調整できます。

- `name?: string` - vault名
- `sandbox?: boolean` - sandbox vaultを使うか
- `fresh?: boolean` - 毎回クリーンなvaultを作るか
- `logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "silent"`
- `enableBrowserConsoleLogging?: boolean`
- `browserConsoleLogging?: { enabledTypes?: string[]; maxMessageLength?: number; previewLength?: number; ignoredMessagePatterns?: string[]; includeLocation?: boolean; includePageErrors?: boolean; includeRequestFailures?: boolean; includeHttpErrors?: boolean; httpErrorThreshold?: number }`
- `plugins: Array<{ path: string; pluginId: string; symlink?: boolean }>`

## APIリファレンス

- `docs/API.md`

## このリポジトリ内のサンプルを動かす

```bash
pnpm -s test:e2e:example
```

License: MIT
