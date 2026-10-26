# Obsidian E2E Test Toolkit

Obsidian（Electron）を Playwright でE2Eテストするためのユーティリティです。`test` / `expect` / `ObsidianAPI` と、任意のカバレッジ収集・レポート生成を提供します。

## 要件

- Node.js: `>= 23`
- Playwright: `@playwright/test` / `playwright`（peerDependencies）

## インストール

```bash
pnpm add -D obsidian-e2e-toolkit electron playwright @playwright/test
```

> **注意:** pnpm v10 以降は、セキュリティ強化のため依存パッケージの `postinstall` などのライフサイクルスクリプトがデフォルトでは実行されません。Electron のバイナリ取得（`install.js`）も `postinstall` で行われるため、許可していないと取得されません。次のどちらかで対処してください。
>
> - 下の「pnpm 設定（必須）」のとおり `onlyBuiltDependencies` に `electron` と `obsidian-e2e-toolkit` を追加する（または `pnpm approve-builds`）
> - 許可しない場合は、インストール後に次のコマンドを**手動で実行**する実行しないと、E2E の起動時に Electron のバイナリが見つからず失敗します。
>
> ```bash
> node node_modules/electron/install.js
> # pnpm の場合（node_modules が .pnpm 配下にあるとき）
> pnpm exec node node_modules/electron/install.js
> ```
>
> CI でも、依存のインストール後・テスト実行前にこのステップが必要です。
E2E 用 Obsidian は起動時に `obsidian://` の既定アプリを登録・解除しないため、通常の Obsidian の関連付けを維持します。
旧バージョンの E2E 起動ですでに関連付けが変わっている場合は、Windows のレジストリ
`HKEY_CURRENT_USER\Software\Classes\obsidian\shell\open\command` の既定値を
`"実際にインストールした Obsidian.exe のフルパス" "%1"` に戻してください。

## 雛形の生成

```bash
pnpm exec obsidian-e2e-toolkit   # playwright.config.ts と e2e/example.spec.ts を生成（既存ファイルは上書きしない）
```

## 便利な API

- `obsidian.createNote(path, content)`: vault API でノートを作成（親フォルダも作成。既存なら上書き）
- `obsidian.evaluateApp(fn, arg)`: Obsidian 内で `app` を使う関数を実行
- `obsidian.pluginData(id)` / `obsidian.setPluginData(id, patch)`: プラグインの `data.json` を読み書き
- `vaultOptions.plugins[].data`: 起動前にプラグインの初期 `data.json` を書き込む（symlink 時は無視）
- `preparePlugins(sources, baseDir, opts?)`: `sources` は、プラグイン ID をキー、`owner/repo` の文字列または `{ repo, tag }` を値にしたオブジェクトです。`baseDir/myfiles/<ID>` に取得して配置します。tag を指定すると、GitHub API を使わず公開リリースの `main.js`・`manifest.json`・任意の `styles.css` を直接取得します。`styles.css` の404だけは許容し、その他の取得失敗は成功扱いしません。既定ではリリースが使えない時に同じ tag を clone します。失敗はすべてまとめて 1 つのエラーにします。
- `preparePlugin({ manifest, main, styles?, sourceMap? }, dest)`: 分散したビルド成果物を 1 つのフォルダーにまとめます。sourceMap は元のプロジェクトを基準に解決できる形で書き出します。
- `defineObsidianConfig(overrides)`: Playwright 設定に共通の既定値を加えます。workers、timeout、reporter などは利用者の値を優先します。

## E2E カバレッジ

プラグインをソースマップ付きでビルドしてから、測定対象と出力先を指定します。
esbuild の `sourcemap: "inline"` と、`sourcemap: "external"` による `main.js.map` の両方に対応しています。
Playwright の結果、レポート、アセットキャッシュ、カバレッジは既定で `.e2e/` に保存します。

```ts
import { test } from "obsidian-e2e-toolkit";

test.use({
    vaultOptions: { plugins: [{ path: process.cwd() }] },
    coverageOptions: {
        enabled: process.env.E2E_COVERAGE === "1",
        pluginPaths: [process.cwd()],
        outputDir: ".e2e/coverage/e2e",
    },
});
```

`pluginPaths` を省略すると `vaultOptions.plugins` の全プラグインを測定します。
複数の spec が共有する fixture ファイルで設定する場合は、`test.use(...)` ではなく
`test.extend({ coverageOptions: 設定値 })` で既定値を持つ `test` を export してください。
`test.use(...)` は呼び出した spec にだけ適用され、共有モジュールがキャッシュされると後続の spec には適用されません。
測定対象のフォルダーには `manifest.json` とソースマップ付きの `main.js` が必要です。
プラグイン有効化前に測定を開始し、toolkit が行うセットアップ時の再読み込み前と終了前に結果を回収します。
V8 の測定は画面の再読み込みでリセットせず、toolkit がウィンドウを閉じる前にも回収します。
直接ウィンドウを閉じたり Electron のプロセスを強制終了した場合、その画面の結果は回収できずテストが失敗します。

Playwright の reporter に追加すると、実行終了時に HTML・LCOV・JSON と端末の集計を生成します。
reporter と `coverageOptions` の `outputDir` を合わせてください。

```ts
import { defineObsidianConfig } from "obsidian-e2e-toolkit";

export default defineObsidianConfig({
    reporter: [
        ["list"],
        ["obsidian-e2e-toolkit/coverage", {
            enabled: process.env.E2E_COVERAGE === "1",
            outputDir: ".e2e/coverage/e2e",
        }],
    ],
});
```

Windows PowerShell での実行例:

```powershell
$env:E2E_COVERAGE = "1"
pnpm exec playwright test
```

`.e2e/coverage/e2e/index.html`、`lcov.info`、`coverage-final.json` を生成します。
テスト・モック・型宣言・依存パッケージ・測定対象フォルダーの外にあるソースは除外します。
ビルドとソースマップはテストごとの JSON に保存するため、テスト終了後に一時プラグインを削除したり通常ビルドに戻してもレポートを生成できます。
並列ワーカーとリトライはそれぞれ別ファイルに保存します。失敗した試行も集計対象です。

### 複数の実行をまとめる

並列用と直列用などで Playwright を複数回実行する場合は、reporter の `clean` オプションを切り替えます。既定の reporter は開始時に過去の `raw/` を削除してから書き込みます。`E2E_COVERAGE_APPEND=1` の場合は `clean: false` になり、削除せずに既存の `raw/` へ追記します。

reporter の設定は次のとおりです。

```ts
import { defineObsidianConfig } from "obsidian-e2e-toolkit";

export default defineObsidianConfig({
    reporter: [
        ["list"],
        ["obsidian-e2e-toolkit/coverage", {
            enabled: process.env.E2E_COVERAGE === "1",
            outputDir: ".e2e/coverage/e2e",
            clean: process.env.E2E_COVERAGE_APPEND !== "1",
        }],
    ],
});
```

次のスクリプトは、`E2E_COVERAGE=1` と `E2E_COVERAGE_APPEND=1` を設定して、ソースマップ付きのビルドと並列・直列の両方の実行を行い、結果を 1 つに集計します。集計のあとは、`E2E_COVERAGE=0` で通常のビルドに戻し、その終了コードも含めて結果を判定します。`build:coverage` はプロジェクト側で定義してください。

```js
// scripts/e2e-coverage.mjs
import { spawn } from "node:child_process";
import { generateCoverageReport, resetCoverageOutput } from "obsidian-e2e-toolkit/coverage";

const outputDir = ".e2e/coverage/e2e";
const COVERAGE_ENV = { E2E_COVERAGE: "1", E2E_COVERAGE_APPEND: "1" };
const NORMAL_ENV = { E2E_COVERAGE: "0" };

function run(command, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            env: { ...process.env, ...env },
            shell: process.platform === "win32",
        });
        child.once("error", reject);
        child.once("exit", (code, signal) => {
            if (signal) reject(new Error("terminated by " + signal));
            else resolve(code ?? 1);
        });
    });
}

const exitCodes = [];
await resetCoverageOutput(outputDir);
try {
    const buildExit = await run("pnpm", ["run", "build:coverage"], COVERAGE_ENV);
    if (buildExit === 0) {
        exitCodes.push(await run("pnpm", ["exec", "playwright", "test", "--grep-invert", "@serial", "--pass-with-no-tests"], COVERAGE_ENV));
        exitCodes.push(await run("pnpm", ["exec", "playwright", "test", "--grep", "@serial", "--workers=1", "--pass-with-no-tests"], COVERAGE_ENV));
    } else {
        exitCodes.push(buildExit);
    }
} finally {
    // 失敗した実行の結果も集計し、通常のビルドへ戻す。どちらの終了コードも必ず集計する。
    try {
        await generateCoverageReport({ outputDir });
    } catch (error) {
        console.error(error);
        exitCodes.push(1);
    }
    exitCodes.push(await run("pnpm", ["run", "build"], NORMAL_ENV));
}
process.exitCode = exitCodes.find((code) => code !== 0) ?? 0;
```

各 Playwright 実行には `--pass-with-no-tests` を付けているため、対象のテストが 0 件でも失敗しません。ビルド、いずれかの実行、集計、通常ビルドへの復帰のどれかが失敗すると、スクリプトは 0 以外で終了します。

### 単体テストと E2E を合算する

Vitest で `coverage.reporter` に `"json"` を指定し、両方の `coverage-final.json` を渡します。
同じチェックアウト・同じソースを対象に実行した結果を合算してください。

```js
import { mergeCoverageReports } from "obsidian-e2e-toolkit/coverage";

await mergeCoverageReports({
    inputFiles: [".e2e/coverage/unit/coverage-final.json", ".e2e/coverage/e2e/coverage-final.json"],
    outputDir: ".e2e/coverage/combined",
});
```

`.e2e/coverage/combined/index.html` に統合レポートを生成します。
ファイルとソース位置ごとに実行回数を合算し、単体テストだけで読み込まれたファイルも残します。
異なるビルドでソースマップの位置が異なる場合は、それぞれの位置を保持します。
特に分岐は種類と全選択肢の位置が一致した場合だけ合算するため、選択肢の実行回数が別の位置に移ったり失われたりしません。
異なる位置が追加されることで分母が増える場合があり、合算後の割合が各レポート以上になるとは限りません。

## Linux / CI で実行する

このツールキットは実際の Obsidian（Electron）ウィンドウを起動するため、**ディスプレイ（X サーバー）が必要**です。ディスプレイのない環境（Linux サーバー、コンテナ、CI）では起動できません。

- **ディスプレイのある環境**（Windows / macOS / デスクトップの Linux）: そのまま動作します。
- **ディスプレイのない Linux**: 仮想ディスプレイ（Xvfb）を用意すれば動作します。`xvfb-run` は Xvfb を起動して、その上でコマンドを実行します。動作を確認できた例は、Linux コンテナでの `xvfb-run -a` です（Node 24）。
- **GitHub Actions の Ubuntu**: Node 24・pnpm 12・Xvfb の構成で、同梱プラグインの起動・ロードを [smoke CI](.github/workflows/obsidian.e2e.yml) で検証しています。

```bash
xvfb-run -a pnpm exec playwright test
```

- テストが失敗すると、Obsidian ウィンドウのスクリーンショット（`obsidian-screenshot`）と DOM（`obsidian-dom`）が Playwright のレポートと `.e2e/test-results/` に添付されます。
- Electron のメインプロセスの警告・エラーは標準設定で端末に表示されます。起動前から終了処理までのログ全体は、成功・失敗にかかわらず `obsidian-electron-main-log` として添付されます。
- 単体テスト用の Vitest などが `e2e/` の spec を拾わないよう、テスト対象を `src/**` などに限定してください。
- E2E を実行しないジョブでは `ELECTRON_SKIP_BINARY_DOWNLOAD=1` を設定すると、Electron のダウンロードを省略できます。
- Ubuntu の起動検証は `pnpm exec playwright install-deps chromium` で OS の依存を準備し、`xvfb-run -a pnpm run test:e2e:smoke` で実行します。利用するプラグインの全テストは各プロジェクトで確認してください。詳細は [トラブルシューティング](docs/TROUBLESHOOTING.md) を参照してください。

## リリース

リリースには Conventional Commits の履歴を使います。まず変更をコミットしてから、次のコマンドでバージョン更新と CHANGELOG の内容を確認してください。

```bash
pnpm release -- --dry-run --ci
```

確認後に `pnpm release` を実行すると、`package.json` と `CHANGELOG.md` を更新して、バージョン更新コミットと `1.2.0` のような `v` なしタグを push します。タグはソース履歴上に維持し、GitHub Actions はビルド済みの npm 互換 tarball を Release asset として作成します。インストール URL は各 Release の説明に表示されます。npm には publish しません。

ソースや Git から依存として入れた場合、`postinstall` がダウンロードした Obsidian の ASAR アセットを `.e2e/obsidian-e2e-toolkit-assets/obsidian-unpacked/` に展開します。GitHub Release のビルド済みパッケージには展開済みアセットが含まれます。
`defineObsidianConfig` を使うと Playwright の出力先も `.e2e/test-results/` になり、HTML reporter の出力先は `.e2e/playwright-report/` になります（明示した `outputFolder` はそのまま使います）。

再実行したい場合:

```bash
node node_modules/obsidian-e2e-toolkit/setup.mjs
```

### ローカルで配布物を検証する

公開前の build 結果を、release と同じ形の tgz にまとめて利用側で試せます。アセットは同梱し、`prepare` と `postinstall` は含めません。

```bash
pnpm run build
pnpm run postinstall
pnpm run pack:local
```

`pack:local` は `.e2e/local-pack/obsidian-e2e-toolkit-<version>-<hash>.tgz` を作り、絶対 path と `file:` で始まる指定子を表示します。表示される指定子は絶対 path なので、consumer の `package.json` には保存せず、下の相対 path に直して使います。`package.json` は書き換えません。この tgz は未公開の開発版です。version は作業ツリーの値をそのまま使い、ファイル名の hash で内容を区別します。公開済みのリリース（`1.5.0` など）と番号が同じに見えても中身は別物なので、公開版として扱わないでください。`preparePlugins` などの新しい API は、公開済みの 1.5.0 には含まれません。

#### 型チェック

ソースの型は次のコマンドで確かめます。TypeScript は devDependencies の `tsc6` を使います。

```bash
pnpm exec tsc6 --noEmit -p tsconfig.json
```

#### 利用側から参照する（相対 file:）

利用側（consumer）は、この tgz を相対の `file:` 指定で参照します。絶対 path（`file:V:/...`）を consumer の `package.json` に保存しないでください。相対 path は、作成したホストで toolkit と consumer の repo を並べて配置している前提でのみ解決できます。

ファイル名の hash は内容を示します。同じ内容を pack し直した場合は同じ名前になり、内容が変わった場合は consumer 側の指定も更新します。

### Obsidian バージョン指定

`setup.mjs` は環境変数で取得バージョンを切り替えられます。

- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=latest`（デフォルト）: 最新版
- `OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION=1.12.4`: 指定

`latest` でモバイル専用リリースが選ばれた場合は、デスクトップ用の
`tar.gz` と `asar.gz` を含む直近の公開リリースを自動的に使用します。

`latest` はセットアップのたびに GitHub API で最新バージョンを確認します。
キャッシュには実際のバージョンを記録し、同じバージョンなら再利用、
新しいバージョンならアセットの再取得・再展開を行います。
旧形式の `latest` と記録されたキャッシュは、初回のみ再取得・再展開します。

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
- `onlyBuiltDependencies` は、依存パッケージの install や postinstall などのビルドスクリプトを実行してよいパッケージを指定します。Electron のバイナリ取得（`install.js`）を実行させるために必要で、`obsidian-e2e-toolkit` を含めるのは、その postinstall を許可するためです。モジュールの解決やプリビルトの選択には関係しません。
- Electron は利用側がインストールしたバージョンを使います。ツールキットは特定の Electron バージョンに固定しません。
- 起動時に Electron 自身の実行ファイル解決処理を使い、未取得のバイナリはその場で準備します。`electron --version` などで GUI を先に起動する必要はありません。解決された実行ファイルを Playwright に渡すため、`ELECTRON_OVERRIDE_DIST_PATH` も使用できます。
- `obsidian-typings` など複数の Electron バージョンを要求する依存関係がある場合は、プロジェクト側で互換性を確認した上で `overrides` を設定してください。

## CI でのレートリミット対策

バージョンを固定した場合、`setup.mjs` は初回も GitHub API を使わず、公開リリースの `obsidian-<version>.tar.gz` と `obsidian-<version>.asar.gz` を直接取得します。以下を満たす場合は、ダウンロードもせずキャッシュだけで処理します。

- `.e2e/obsidian-e2e-toolkit-assets/obsidian-unpacked/main.cjs` が存在し、記録されたバージョンが指定と一致する
- または `.e2e/obsidian-e2e-toolkit-assets/cache` 配下に必要なアセットが存在し、記録されたバージョンが指定と一致する

`latest` の場合はキャッシュがあっても最新バージョンの確認に GitHub API を呼びます。
確認に失敗するとセットアップはエラーになります。キャッシュした旧版を使い続けることはありません。

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
      .e2e/obsidian-e2e-toolkit-assets
      node_modules/obsidian-e2e-toolkit/obsidian-e2e-toolkit-assets
    key: ${{ runner.os }}-obsidian-e2e-${{ hashFiles('pnpm-lock.yaml') }}
```

## クイックスタート

Playwright のテストはそのまま使い、import だけこのパッケージの `test` を使います（fixture として `obsidian: ObsidianAPI` が使えます）。テスト本体が始まる時点で、Obsidian の起動と準備は完了しています。

```ts
import { expect, test } from "obsidian-e2e-toolkit";

test("smoke", async ({ obsidian }) => {
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
  expect(await obsidian.isPluginLoaded("sample-plugin")).toBe(true);
  expect(await obsidian.plugin("sample-plugin")).toBeTruthy();
});
```

fixture は、テスト本体の前に次の 3 つを待ちます。vault の `layoutReady`、`vaultOptions.plugins` で導入したプラグインの読み込み、プラグインに `styles.css` がある場合はその適用です。そのため、テストの冒頭で `waitReady()` を呼ぶ必要はありません。`waitReady()` は `layoutReady` だけを待つ API として残しています。どれか 1 つでも満たされない場合は、テスト本体の前にセットアップエラーとして失敗します。未適用の CSS は Obsidian の `loadCSS()` で一度だけ再読み込みし、復旧できなければセットアップエラーになります。CSS を持たないプラグインも利用できます。プラグイン固有の非同期データや画面の描画完了は、各テストで待機してください。

遅延読み込みなどの実行状態は `isPluginLoaded` / `waitForPluginLoaded` / `waitForPluginUnloaded` で確認できます。`isPluginEnabled` / `waitForPluginEnabled` / `waitForPluginDisabled` は設定上の有効状態を確認するためのAPIです。

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
- `plugins: ReadonlyArray<{ path: string; symlink?: boolean; data?: Record<string, unknown> }>` - 投入するプラグイン（`data` は初期 `data.json`）

`auto` では、CLI が利用可能で対象 Vault のパスが一致した場合だけ、
`plugins:restrict off` と `plugin:enable` を実行します。CLI が未インストール、
対象 Vault が別、または対象アプリに接続できない場合は Playwright 経路へ
自動フォールバックするため、CI に Obsidian CLI をインストールする必要はありません。

CLI の実行ファイルを明示する場合は `OBSIDIAN_CLI_PATH` を指定できます。

## ドキュメント

- [APIリファレンス](docs/API.md)
- [トラブルシューティング](docs/TROUBLESHOOTING.md)（Linux/CI、失敗時の調査、Obsidian バージョン、pnpm）

## このリポジトリ内のサンプルを動かす

```bash
pnpm -s test:e2e:example
```

License: MIT
