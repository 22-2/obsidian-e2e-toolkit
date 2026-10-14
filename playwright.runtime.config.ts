import { defineConfig } from "@playwright/test";

// runtime API の実 E2E 用。readiness と coverage の suite とは別に runtime-*.spec.ts だけを実行する。
// 実 Electron を使うため workers は 1 に固定する（同時に複数の Obsidian を起動しない）。
export default defineConfig({
    testDir: "./example",
    testMatch: /runtime-.*\.spec\.ts$/,
    workers: 1,
    timeout: 120_000,
});
