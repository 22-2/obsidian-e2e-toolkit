import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  globalSetup: "./example/on-demand-plugins/tests/global-setup.mjs",
  fullyParallel: false,
  timeout: 90_000,
});
