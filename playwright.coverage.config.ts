import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./example",
    testMatch: "coverage.spec.ts",
    workers: 2,
    timeout: 90000,
    outputDir: ".e2e/test-results",
    reporter: [["list"], ["./src/coverage.ts", { outputDir: ".e2e/coverage/fixture" }]],
});
