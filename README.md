# Obsidian E2E Test Toolkit

Reusable E2E testing utilities for Obsidian plugins using Playwright.

## Installation

```bash
npm install --save-dev obsidian-e2e-toolkit
# or
pnpm add -D obsidian-e2e-toolkit
```

## Setup

### 1. Install the toolkit

```bash
pnpm add -D obsidian-e2e-toolkit
```

### 2. Add setup script to your `package.json`

```json
{
  "scripts": {
    "setup:e2e": "sh node_modules/obsidian-e2e-toolkit/setup.sh"
  }
}
```

### 3. Run the setup script

This will unpack Obsidian assets and prepare the E2E environment:

```bash
pnpm setup:e2e
```

**Important**: Run this script from your **plugin project root** (where `manifest.json` is located).

### Path Resolution

The toolkit uses the following path resolution strategy:

- **Project Root**: `$PWD` (current working directory where npm script is executed)
  - Looks for `manifest.json` and `dist/` here
- **Toolkit Resources**: `node_modules/obsidian-e2e-toolkit/`
  - Assets (`app.asar`, `obsidian.asar`) are stored here
  - Unpacked Obsidian (`.obsidian-unpacked/`) is created here

This design allows the toolkit to work both as:
- An installed npm package (`node_modules/obsidian-e2e-toolkit/`)
- A local development setup

## Usage

### Basic Setup

```typescript
import { test, expect } from "obsidian-e2e-toolkit";

test("should open vault", async ({ vault }) => {
  const { window } = vault;

  // Your test code here
  expect(window).toBeDefined();
});
```

### With Custom Config

```typescript
import { resolveConfig } from "obsidian-e2e-toolkit";

const customPaths = resolveConfig({
  pluginDir: "/path/to/your-plugin",
  distDir: "/path/to/your-plugin/dist",
  // Optional overrides
  assetsDir: "/custom/assets/path",
  obsidianUnpackedDir: "/custom/unpacked/path",
  appMainFile: "main.cjs"
});
```

### Testing with Plugins

```typescript
test.use({
  vaultOptions: {
    useSandbox: false,
    plugins: [
      {
        pluginId: "my-plugin",
        path: "./dist"
      }
    ]
  }
});

test("should load plugin", async ({ vault }) => {
  const { window, pluginHandleMap } = vault;
  const myPlugin = pluginHandleMap.get("my-plugin");

  expect(myPlugin).toBeDefined();
});
```

## Configuration

Create a `playwright.config.ts` in your project:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 60000,
  workers: 1,
  use: {
    trace: "on-first-retry"
  }
});
```

## License

MIT
```

### 4. 元のプロジェクトから使う方法

元の`obsidian-sandbox-note`プロジェクトでは以下のように変更します：

#### **package.json**を更新

```/dev/null/package.json#L1-10
{
  "devDependencies": {
    "obsidian-e2e-toolkit": "github:YOUR_USERNAME/obsidian-e2e-toolkit",
    // または、npmに公開した場合
    // "obsidian-e2e-toolkit": "^1.0.0",
    // または、ローカルでリンクする場合
    // "obsidian-e2e-toolkit": "file:../obsidian-e2e-toolkit"
  }
}
```

#### **e2e/specs/example.spec.ts**などで使用

```/dev/null/example.spec.ts#L1-15
import { test, expect } from "obsidian-e2e-toolkit";

test.use({
  vaultOptions: {
    useSandbox: true,
    showLoggerOnNode: true,
    plugins: [
      {
        pluginId: "obsidian-sandbox-note",
        path: "./dist"
      }
    ]
  }
});

test("my test", async ({ vault }) => {
  // テストコード
});
```
