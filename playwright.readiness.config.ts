import { defineConfig } from "@playwright/test";

// 意図: toolkit 自体の fixture 検証では、他のコミュニティプラグインを取得しない。
export default defineConfig({
    testDir: "./example",
    testMatch: "readiness.spec.ts",
    workers: 1,
    timeout: 90000,
});
