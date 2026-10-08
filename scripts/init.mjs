#!/usr/bin/env node
// Scaffold a minimal Playwright setup for testing an Obsidian plugin.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = {
  "playwright.config.ts": `import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  timeout: 90_000,
});
`,
  "e2e/example.spec.ts": `import path from "node:path";
import { expect, test } from "obsidian-e2e-toolkit";

// Build your plugin first, then point at the folder containing manifest.json and main.js.
test.use({
  vaultOptions: {
    plugins: [{ path: path.resolve(".") }],
  },
});

test("plugin loads", async ({ obsidian }) => {
  await obsidian.waitReady();
  await obsidian.createNote("hello.md", "# Hello");
  await obsidian.open("hello.md");
  expect(await obsidian.filePath()).toBe("hello.md");
});
`,
};

for (const [rel, content] of Object.entries(files)) {
  const target = path.join(root, rel);
  if (existsSync(target)) {
    console.log(`skip   ${rel} (already exists)`);
    continue;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`create ${rel}`);
}

console.log(`
Next steps:
  1. pnpm add -D electron playwright @playwright/test
  2. Add "e2e": "playwright test" to package.json scripts
  3. Keep unit-test runners (e.g. Vitest) away from e2e/
  4. On headless Linux/CI: xvfb-run -a pnpm e2e
`);
