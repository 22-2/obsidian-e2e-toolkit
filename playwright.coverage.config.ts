import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./example",
    testMatch: "coverage.spec.ts",
    workers: 2,
    timeout: 90000,
    reporter: [["list"], ["./src/coverage.ts", { outputDir: "coverage/fixture" }]],
});
