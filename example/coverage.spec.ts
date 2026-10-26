import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";
import { expect, test as base } from "../src";

const test = base.extend({
    vaultOptions: async ({ tempDir }, use) => {
        const root = path.join(tempDir, "coverage-plugin");
        const source = "const { Plugin } = require('obsidian');\n" +
            "module.exports = class extends Plugin {\n" +
            "    onload() { this.startupValue = 42; }\n" +
            "    exercised() { return this.startupValue; }\n" +
            "    neverCalled() { return -1; }\n" +
            "};";
        await mkdir(path.join(root, "src"), { recursive: true });
        const sourcefile = path.join(root, "src/main.ts");
        await writeFile(sourcefile, source);
        await writeFile(path.join(root, "manifest.json"), JSON.stringify({ id: "fixture-coverage", name: "Coverage fixture", version: "1.0.0", minAppVersion: "1.0.0", author: "test" }));
        const result = await transform(source, { loader: "ts", sourcemap: "inline", sourcefile, format: "cjs" });
        await writeFile(path.join(root, "main.js"), result.code);
        await use({ fresh: true, obsidianCli: "off", plugins: [{ path: root }] });
    },
    coverageOptions: { enabled: true, outputDir: ".e2e/coverage/fixture" },
});

test("captures plugin activation before fixture setup reload", async ({ obsidian }) => {
    expect(await obsidian.evaluateApp(() => {
        const plugin = app.plugins.plugins["fixture-coverage"] as unknown as { exercised(): number };
        return plugin.exercised();
    })).toBe(42);
});

test("collects independent results after an Obsidian page reload", async ({ obsidian }) => {
    await obsidian.page.reload();
    await obsidian.waitReady();
    await obsidian.waitForPluginLoaded("fixture-coverage");
    expect(await obsidian.evaluateApp(() => {
        const plugin = app.plugins.plugins["fixture-coverage"] as unknown as { exercised(): number };
        return plugin.exercised();
    })).toBe(42);
});

test("obsidian.reload keeps collecting plugin coverage", async ({ obsidian }) => {
    await obsidian.waitReady();
    await obsidian.reload();
    expect(await obsidian.evaluateApp(() => {
        const plugin = app.plugins.plugins["fixture-coverage"] as unknown as { exercised(): number };
        return plugin.exercised();
    })).toBe(42);
});
