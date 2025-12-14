# Obsidian E2E Test Toolkit

Obsidian（Electron）を Playwright でE2Eテストするためのユーティリティです。トップレベルの公開APIは `test` / `expect` / `ObsidianAPI` に絞っています。

## 要件

- Node.js: `>= 23`
- Playwright: `@playwright/test` / `playwright`（peerDependencies）

## インストール

```bash
pnpm add -D obsidian-e2e-toolkit
```

インストール後に `postinstall` で `setup.mjs` が実行され、同梱されている Obsidian の ASAR アセットを `.obsidian-unpacked/` に展開します。

再実行したい場合:

```bash
node node_modules/obsidian-e2e-toolkit/setup.mjs
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
        pluginId: "sample-plugin",
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
- `plugins: Array<{ path: string; pluginId: string; symlink?: boolean }>`

## APIリファレンス

- `docs/API.md`

## このリポジトリ内のサンプルを動かす

```bash
pnpm -s test:e2e:example
```

License: MIT
