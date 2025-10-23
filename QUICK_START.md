# クイックスタートガイド - GitHub で公開

このガイドでは、obsidian-e2e-toolkit を GitHub で公開し、pnpm でインストールできるようにする手順を簡潔に説明します。

## 前提条件

- Node.js と pnpm がインストールされている
- GitHub アカウントを持っている
- Git がインストールされている

## 手順

### 1. package.json の更新

`package.json` 内の `22-2` を実際の GitHub ユーザー名に置き換えてください：

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/22-2/obsidian-e2e-toolkit.git"
}
```

### 2. ビルド

```bash
pnpm run build
```

これで `dist/` ディレクトリに JavaScript と型定義ファイルが生成されます。

### 3. GitHub リポジトリを作成

1. https://github.com/new にアクセス
2. リポジトリ名: `obsidian-e2e-toolkit`
3. Public に設定
4. README、.gitignore、LICENSE は追加しない（既に存在）
5. "Create repository" をクリック

### 4. Git の初期化とプッシュ

```bash
# Git リポジトリの初期化
git init

# すべてのファイルをステージング
git add .

# コミット
git commit -m "Initial commit: Obsidian E2E Toolkit"

# リモートリポジトリの追加
git remote add origin https://github.com/22-2/obsidian-e2e-toolkit.git

# プッシュ
git branch -M main
git push -u origin main
```

### 5. リリースタグの作成（推奨）

```bash
# タグを作成
git tag v1.0.0

# タグをプッシュ
git push origin v1.0.0
```

または GitHub の Web UI から：
1. リポジトリページで "Releases" → "Create a new release"
2. Tag version: `v1.0.0`
3. Release title: `v1.0.0 - Initial Release`
4. "Publish release" をクリック

## 使い方（他のプロジェクトから）

### インストール

```bash
# 最新版をインストール
pnpm add github:22-2/obsidian-e2e-toolkit

# 特定のバージョンをインストール
pnpm add github:22-2/obsidian-e2e-toolkit#v1.0.0

# 特定のブランチをインストール
pnpm add github:22-2/obsidian-e2e-toolkit#main
```

### セットアップ

プラグインプロジェクトの `package.json` に追加：

```json
{
  "scripts": {
    "setup:e2e": "bash ./node_modules/obsidian-e2e-toolkit/setup.sh"
  }
}
```

セットアップ実行：

```bash
pnpm run setup:e2e
```

### テストの実行

```bash
pnpm playwright test
```

## バージョンアップ

新しいバージョンをリリースする場合：

```bash
# コードを変更

# ビルド
pnpm run build

# バージョンを上げる
pnpm version patch   # 1.0.0 -> 1.0.1
# または
pnpm version minor   # 1.0.0 -> 1.1.0
# または
pnpm version major   # 1.0.0 -> 2.0.0

# コミットとタグをプッシュ
git push --follow-tags
```

## npm レジストリに公開する場合（オプション）

より簡単にインストールできるようにするには、npm に公開できます：

```bash
# npm にログイン
npm login

# 公開
npm publish
# スコープ付きの場合
npm publish --access public
```

公開後は以下のようにインストールできます：

```bash
pnpm add obsidian-e2e-toolkit
```

## トラブルシューティング

### インストールできない

- リポジトリが Public になっているか確認
- `dist/` ディレクトリがコミットされているか確認
- GitHub の URL が正しいか確認

### セットアップスクリプトが見つからない

`package.json` の `files` に `setup.sh` と `assets` が含まれているか確認：

```json
"files": [
  "dist",
  "setup.sh",
  "assets",
  "README.md",
  "LICENSE"
]
```

### Windows でスクリプトが実行できない

Git Bash または WSL を使用してください：

```bash
# Git Bash を使用
"setup:e2e": "bash ./node_modules/obsidian-e2e-toolkit/setup.sh"

# または WSL を使用
"setup:e2e": "wsl bash ./node_modules/obsidian-e2e-toolkit/setup.sh"
```

## 詳細情報

より詳しい情報は `PUBLISH.md` を参照してください。
