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

実際の Obsidian（Electron）ウィンドウを起動するため、ディスプレイ（X サーバー）が必要です。ディスプレイのない環境では起動できません。

- ディスプレイのある環境（Windows / macOS / デスクトップの Linux）: そのまま動作します。
- ディスプレイのない Linux: 仮想ディスプレイ（Xvfb）が必要です。`xvfb-run` を使うと、Xvfb を起動してその上でテストを実行できます。
- GitHub Actions: 現時点では非対応として扱ってください（下記）。

```bash
xvfb-run -a pnpm exec playwright test
```

`xvfb-run` が見つからない場合は、Xvfb のパッケージ（Debian/Ubuntu では `xvfb`）をインストールしてください。

### GitHub Actions（未解決）

GitHub Actions の Ubuntu ランナーでは、`electron.launch` が `Process failed to launch` で失敗する既知の問題があり（[microsoft/playwright#11932](https://github.com/microsoft/playwright/issues/11932)）、**現時点で動作する構成は確認できていません**。実際に Actions で `xvfb-run` などを含めて試しましたが、解決しませんでした。

分かっていること:

- 同じ `xvfb-run -a pnpm exec playwright test` は、ローカルの Linux コンテナでは動作しました（Node 24）。
- そのため、E2E は当面ローカル（または自前の Linux 環境）で実行し、Actions では単体テストとビルドのみを実行する運用が現実的です。

解決に向けて、Actions で失敗したときのログ全文（`Process failed to launch` の前後、Electron の stderr、`DEBUG=pw:browser*` 付きの出力）を残すと、原因の切り分けに役立ちます。

## Electron のバイナリがない / ダウンロードを省きたい

- pnpm v10 以降は、依存パッケージの `postinstall` などが既定ではブロックされるため、Electron のバイナリが取得されないことがあります。`onlyBuiltDependencies` に `electron` と `obsidian-e2e-toolkit` を追加する（または `pnpm approve-builds` を実行する）と自動で取得されます。許可しない場合は、インストール後に `node node_modules/electron/install.js`（pnpm なら `pnpm exec node node_modules/electron/install.js`）を**手動で実行**してください。CI ではインストール後・テスト前のステップに加えます。
- E2E を実行しないジョブ（単体テストのみなど）では `ELECTRON_SKIP_BINARY_DOWNLOAD=1` を設定すると、インストール時のダウンロードを省略できます。

## Vitest など他のテストランナーが `e2e/` を拾う

E2E の spec は Playwright で実行します。他のランナーの対象を限定してください（例: Vitest なら `test.include: ["src/**/*.test.ts"]`）。

## Obsidian のバージョンを固定したい

`OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=1.12.4` のように指定します（デフォルトは `latest`）。同梱版が古いと一部の機能（例: 外部ファイルの `file:` 形式）が使えない場合があります。取得が GitHub のレート制限や 403 で失敗する場合は `GITHUB_TOKEN` を渡してください。アセットのキャッシュで再ダウンロードを省略できますが、`latest` は毎回 API で最新版を確認します。固定バージョンなら、その版のキャッシュが揃っている場合は API を呼びません。詳細は README の「CI でのレートリミット対策」を参照してください。

## `plugins` の型エラー（readonly）

`vaultOptions.plugins` は `readonly TestPlugin[]` を受け付けます。`as const` で定義した設定も、`Partial<VaultOptions>` と注釈すればそのまま渡せます。

## プラグインがインストールされない

`path` のディレクトリに `manifest.json` と `main.js` が必要です。ビルド後のディレクトリを指定してください。足りない場合は `Failed to install plugin fixtures` で即座に失敗します。

## `playwright install`（ブラウザ）は不要

このツールキットは Electron（Obsidian）だけを起動するため、Playwright 用の Chromium などのブラウザは不要です。CI で `playwright install chromium` やブラウザのキャッシュを用意する必要はありません。

## 依存として入れたとき、同梱の Obsidian が展開されない

`postinstall` が実行されない設定（pnpm の `onlyBuiltDependencies` に `obsidian-e2e-toolkit` がない、`--ignore-scripts` など）では、同梱の Obsidian が展開されず `Obsidian app not found ... Did you run the setup script?` で失敗します。CI で次を実行してください。

```bash
node node_modules/obsidian-e2e-toolkit/setup.mjs
```

## `waitFor*` がタイムアウトで例外になる

`waitForPluginEnabled` などはタイムアウトで例外を投げます。真偽値が欲しい場合は `isPluginEnabled` / `isPluginLoaded` / `pluginState` と `expect.poll` を組み合わせてください。

## 遅延読み込みでプラグインの有効／無効判定が合わない

`isPluginEnabled` / `waitForPluginEnabled` / `waitForPluginDisabled` は `enabledPlugins` による設定上の有効状態を見ます。Obsidian の `enablePlugin` は設定を変更せずにロードするため、実際のロード状態とは一致しない場合があります。

実行状態を調べる場合は `isPluginLoaded`、ロード完了を待つ場合は `waitForPluginLoaded`、停止を待つ場合は `waitForPluginUnloaded` を使ってください。`pluginState` では設定上の有効状態と実際のロード状態をまとめて確認できます。

## `setPluginData` した設定がプラグインに反映されない

`setPluginData` は `data.json` を更新するだけで、実行中のプラグインのメモリ上の設定は変わりません。続けて `obsidian.reloadPlugin(id)` を呼ぶと、プラグインが `data.json` を読み直します。プラグインのメモリ上の状態を直接変えて内部ロジックを検証したいテストでは、`plugin(id)` のハンドルで `evaluate` してください。
