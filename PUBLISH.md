# Publishing Guide

このガイドでは、obsidian-e2e-toolkit を GitHub で公開し、pnpm でインストールできるようにする手順を説明します。

## 前提条件

- Node.js と pnpm がインストールされていること
- GitHub アカウントを持っていること
- Git がインストールされていること

## 手順

### 1. package.json の更新

`package.json` の `repository` セクションで、`22-2` を実際の GitHub ユーザー名に置き換えてください：

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/22-2/obsidian-e2e-toolkit.git"
},
"bugs": {
  "url": "https://github.com/22-2/obsidian-e2e-toolkit/issues"
},
"homepage": "https://github.com/22-2/obsidian-e2e-toolkit#readme"
```

### 2. ビルドの実行

パッケージを公開する前に、TypeScript コードをビルドします：

```bash
pnpm run build
```

これにより、`dist/` ディレクトリに JavaScript ファイルと型定義ファイルが生成されます。

### 3. GitHub リポジトリの作成

1. GitHub で新しいリポジトリを作成
   - リポジトリ名: `obsidian-e2e-toolkit`
   - Public/Private: Public を推奨
   - README, .gitignore, LICENSE は追加しない（既に存在するため）

### 4. Git の初期化とプッシュ

```bash
# Git リポジトリの初期化（まだの場合）
git init

# .gitignore の確認
# dist/ がコミット対象に含まれていることを確認
# （npm パッケージとしては dist/ を含める必要がある）

# すべてのファイルをステージング
git add .

# コミット
git commit -m "Initial commit"

# リモートリポジトリの追加
git remote add origin https://github.com/22-2/obsidian-e2e-toolkit.git

# プッシュ
git branch -M main
git push -u origin main
```

### 5. リリースの作成（推奨）

GitHub でリリースを作成すると、バージョン管理がしやすくなります：

1. GitHub リポジトリページで "Releases" をクリック
2. "Create a new release" をクリック
3. Tag version に `v1.0.0` を入力
4. Release title に `v1.0.0 - Initial Release` を入力
5. 変更内容を記載
6. "Publish release" をクリック

## インストール方法

### GitHub から直接インストール

他のプロジェクトからこのツールキットをインストールするには：

```bash
# 最新版をインストール
pnpm add https://github.com/22-2/obsidian-e2e-toolkit

# 特定のバージョンをインストール
pnpm add https://github.com/22-2/obsidian-e2e-toolkit#v1.0.0

# 特定のブランチをインストール
pnpm add https://github.com/22-2/obsidian-e2e-toolkit#main

# 特定のコミットをインストール
pnpm add https://github.com/22-2/obsidian-e2e-toolkit#commit-hash
```

### npm レジストリに公開する場合（オプション）

npm レジストリに公開すると、より簡単にインストールできます：

1. npm アカウントの作成（https://www.npmjs.com/signup）

2. npm にログイン：
```bash
npm login
```

3. パッケージ名の確認：
   - `obsidian-e2e-toolkit` が既に使われている場合は、`@your-username/obsidian-e2e-toolkit` のようにスコープ付きにする

4. 公開：
```bash
npm publish
# スコープ付きの場合
npm publish --access public
```

5. インストール：
```bash
pnpm add obsidian-e2e-toolkit
# または
pnpm add @your-username/obsidian-e2e-toolkit
```

## バージョン管理

新しいバージョンをリリースする場合：

```bash
# バージョンを上げる（patch: 1.0.0 -> 1.0.1）
pnpm version patch

# バージョンを上げる（minor: 1.0.0 -> 1.1.0）
pnpm version minor

# バージョンを上げる（major: 1.0.0 -> 2.0.0）
pnpm version major

# 変更をプッシュ（タグも含む）
git push --follow-tags

# GitHub でリリースを作成
# npm に公開する場合
npm publish
```

## トラブルシューティング

### dist/ がコミットされない

`.gitignore` で `dist/` が除外されている場合は、以下のいずれかの対応をしてください：

1. **推奨**: `.gitignore` から `dist/` を削除
   - npm パッケージには dist/ を含める必要があります
   - `.npmignore` で開発用ファイルのみを除外します

2. **代替案**: GitHub Actions でビルドを自動化
   - リリース時に自動ビルドするワークフローを設定

### pnpm add でインストールできない

- リポジトリが Public になっているか確認
- URL が正しいか確認
- `dist/` ディレクトリがコミットされているか確認
- `package.json` の `main` と `types` のパスが正しいか確認

### セットアップスクリプトが見つからない

`setup.sh` が `package.json` の `files` に含まれているか確認してください：

```json
"files": [
  "dist",
  "setup.sh",
  "assets",
  "README.md",
  "LICENSE"
]
```

## 参考リンク

- [pnpm documentation](https://pnpm.io/)
- [npm documentation](https://docs.npmjs.com/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Packages](https://docs.github.com/en/packages)
