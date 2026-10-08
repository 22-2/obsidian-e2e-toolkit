# トラブルシューティング

## テストが失敗したとき

失敗したテストには次のファイルが自動で添付されます（Playwright の HTML レポートと `test-results/`）。

- `obsidian-screenshot` — 失敗時点の Obsidian ウィンドウ
- `obsidian-dom` — 失敗時点の DOM（HTML）

詳細なログが必要なときは `vaultOptions` で `logLevel: "debug"` と `enableBrowserConsoleLogging: true` を指定します。

```ts
test.use({
  vaultOptions: { logLevel: "debug", enableBrowserConsoleLogging: true },
});
```

## ディスプレイのない環境（Linux / コンテナ / CI）

仮想ディスプレイが必要です。

```bash
xvfb-run -a pnpm exec playwright test
```

GitHub Actions の Ubuntu では `electron.launch` が `Process failed to launch` で失敗する既知の問題があります（[microsoft/playwright#11932](https://github.com/microsoft/playwright/issues/11932)）。`xvfb-run` 付きで実行してください。このツールキットのメンテナ環境では GitHub Actions 上での動作は未検証です。

## Electron のバイナリがない / ダウンロードを省きたい

- 未取得の場合: `pnpm exec node node_modules/electron/install.js`
- E2E を実行しないジョブ（単体テストのみなど）では `ELECTRON_SKIP_BINARY_DOWNLOAD=1` を設定すると、インストール時のダウンロードを省略できます。

## Vitest など他のテストランナーが `e2e/` を拾う

E2E の spec は Playwright で実行します。他のランナーの対象を限定してください（例: Vitest なら `test.include: ["src/**/*.test.ts"]`）。

## Obsidian のバージョンを固定したい

`OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=1.12.4` のように指定します（デフォルトは `latest`）。同梱版が古いと一部の機能（例: 外部ファイルの `file:` 形式）が使えない場合があります。取得が GitHub のレート制限や 403 で失敗する場合は `GITHUB_TOKEN` を渡すか、`obsidian-e2e-toolkit-assets` をキャッシュしてください。詳細は README の「CI でのレートリミット対策」を参照してください。

## `plugins` の型エラー（readonly）

`vaultOptions.plugins` は `readonly TestPlugin[]` を受け付けます。`as const` で定義した設定も、`Partial<VaultOptions>` と注釈すればそのまま渡せます。

## プラグインがインストールされない

`path` のディレクトリに `manifest.json` と `main.js` が必要です。ビルド後のディレクトリを指定してください。足りない場合は `Failed to install plugin fixtures` で即座に失敗します。
