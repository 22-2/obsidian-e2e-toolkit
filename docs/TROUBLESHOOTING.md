# トラブルシューティング

## テストが失敗したとき

失敗したテストには次のファイルが自動で添付されます（Playwright の HTML レポートと `.e2e/test-results/`）。

- `obsidian-screenshot` — 失敗時点の Obsidian ウィンドウ
- `obsidian-dom` — 失敗時点の DOM（HTML）

Electron のメインプロセスは、Obsidian の読み込み前からログを収集します。
警告・エラーは標準設定で端末に `[ELECTRON:MAIN:WARN]` / `[ELECTRON:MAIN:ERROR]` として表示され、例外のスタックも省略せずに出力されます。
メインプロセスのログ全体は、成功・失敗にかかわらず `obsidian-electron-main-log` として Playwright のレポートと `.e2e/test-results/` に添付されます（JSON Lines 形式）。起動中や終了処理でのエラーも含みます。
`enableBrowserConsoleLogging` はメインプロセスのログ収集には不要です。`logLevel` は端末に転送するレベルを制御し、添付ファイルには全レベルを保存します。

`Cannot read properties of undefined (reading 'origin')` は、Obsidian が `app://` の要求元フレームを参照する処理で起こることがあります。
Electron の要求元フレームは省略されたり、画面遷移・ウィンドウ終了後に失われたりするため、toolkit はフレームのない `app://` 要求をキャンセルして警告を残します。通常の要求は Obsidian 本来の origin 検証に渡します。

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
- GitHub Actions の Ubuntu: Node 24・pnpm 12・Xvfb で、同梱プラグインの起動・ロードを CI で確認しています。

```bash
xvfb-run -a pnpm exec playwright test
```

`xvfb-run` が見つからない場合は、Xvfb のパッケージ（Debian/Ubuntu では `xvfb`）をインストールしてください。

### GitHub Actions の Ubuntu

現在の [smoke CI](../.github/workflows/obsidian.e2e.yml) は、以下の手順で Ubuntu の起動を検証しています。Electron が内蔵する Chromium を使うため、smoke テスト用にブラウザー本体を別途取得する必要はありません。

```bash
pnpm exec playwright install-deps chromium
xvfb-run -a pnpm run test:e2e:smoke
```

確認範囲は Obsidian の起動と同梱プラグインのロードです。各プロジェクトの E2E は別途確認してください。起動に失敗した場合は、Electron のメインプロセスログと `DEBUG=pw:browser*` の出力で、表示環境・OS の依存・ダウンロード失敗を切り分けます。

## Electron のバイナリがない / ダウンロードを省きたい

- Electron パッケージは利用側の依存としてインストールしてください。toolkit は起動時に Electron 自身の実行ファイル解決処理を呼び、遅延取得する版にも対応します。`dist` が未作成という理由だけで失敗せず、準備できた実行ファイルを Playwright に渡します。
- ダウンロードが失敗した場合は `Could not prepare Electron executable` の元のエラーを確認してください。`ELECTRON_OVERRIDE_DIST_PATH` によるカスタム配置も Electron の解決処理に従います。
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

## lazy 設定に変えた後の `reload()` が待ち続ける

`reload()` の既定値は、リロード前に読み込まれていたプラグインを待ちます。起動時には読み込まない設定へ変更したテストでは、そのシナリオが期待する起動時のプラグインだけを `expectLoaded` に指定してください。指定は待機条件であり、プラグインを有効化する操作ではありません。

```ts
await obsidian.reload({ expectLoaded: [pluginUnderTestId] });
```

lazy 対象が停止していることは、リロード後に `isPluginLoaded` などで別途検証してください。

## `setPluginData` した設定がプラグインに反映されない

`setPluginData` は `data.json` を更新するだけで、実行中のプラグインのメモリ上の設定は変わりません。続けて `obsidian.reloadPlugin(id)` を呼ぶと、プラグインが `data.json` を読み直します。プラグインのメモリ上の状態を直接変えて内部ロジックを検証したいテストでは、`plugin(id)` のハンドルで `evaluate` してください。
