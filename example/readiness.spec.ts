import fs from "node:fs/promises";
import path from "node:path";
import { expect, test as base } from "../src";
import { PluginManager } from "../src/internal/services/PluginManager";

const test = base.extend({
    vaultOptions: async ({ tempDir }, use) => {
        const plugins = [];
        for (const kind of ["no-css", "styled", "missing-css"]) {
            const styled = kind !== "no-css";
            const id = `fixture-${kind}`;
            const pluginPath = path.join(tempDir, id);
            await fs.mkdir(pluginPath, { recursive: true });
            await fs.writeFile(path.join(pluginPath, "manifest.json"), JSON.stringify({
                id, name: id, version: "1.0.0", minAppVersion: "1.0.0", author: "test",
            }));
            // 意図: 最初の CSS ロードだけ欠落させ、fixture がネイティブ処理で
            // 一度復旧することと、通常の CSS なしプラグインも扱えることを検証する。
            await fs.writeFile(path.join(pluginPath, "main.js"), `
                const { Plugin } = require("obsidian");
                module.exports = class extends Plugin {
                    onload() { this.fixtureReady = true; }
                    ${styled ? `async loadCSS() {
                        this.cssLoadAttempts = (this.cssLoadAttempts || 0) + 1;
                        ${kind === "missing-css" ? "if (this.cssLoadAttempts === 1) return;" : ""}
                        await super.loadCSS();
                    }` : ""}
                };
            `);
            if (styled) {
                await fs.writeFile(path.join(pluginPath, "styles.css"), `body { --toolkit-fixture-${kind}: 1; }`);
            }
            plugins.push({ path: pluginPath });
        }
        await use({ fresh: true, obsidianCli: "off", plugins });
    },
});

test("a stalled CSS reload fails with the plugin ID and does not retry", async ({ obsidian, page }) => {
    const vaultPath = await page.evaluate(() => (app.vault.adapter as any).getBasePath());
    // 意図: テスト用プラグインだけを停止させ、CSS 復旧が無期限の待機にならないことを確認する。
    await page.evaluate(() => {
        for (const sheet of Array.from(document.styleSheets)) {
            if (sheet.ownerNode?.textContent?.includes("--toolkit-fixture-missing-css")) {
                sheet.ownerNode.parentNode?.removeChild(sheet.ownerNode);
            }
        }
        const plugin = (app as any).plugins.plugins["fixture-missing-css"];
        plugin.stalledAttempts = 0;
        plugin.loadCSS = () => {
            plugin.stalledAttempts++;
            return new Promise(() => {});
        };
    });
    const manager = new PluginManager([
        { pluginId: "fixture-missing-css", path: "unused" },
    ], vaultPath, "off");
    await expect(manager.waitForReady(obsidian.page, 250)).rejects.toThrow(
        /Plugin fixtures are not ready after reload: fixture-missing-css/,
    );
    expect(await page.evaluate(() => (app as any).plugins.plugins["fixture-missing-css"].stalledAttempts)).toBe(1);
});

test("fixture provides the vault renderer and restores missing plugin CSS", async ({ obsidian, page }) => {
    expect(page).toBe(obsidian.page);
    expect(await page.evaluate(() => app.vault.getName())).toBe(await obsidian.vaultName());
    await expect(page.locator("body")).toHaveCSS("--toolkit-fixture-styled", "1");
    await expect(page.locator("body")).toHaveCSS("--toolkit-fixture-missing-css", "1");
    const state = await page.evaluate(() => {
        const plugins = (app as any).plugins.plugins;
        return {
            styledReady: plugins["fixture-styled"].fixtureReady,
            styledLoaded: plugins["fixture-styled"]._loaded,
            cssLoadAttempts: plugins["fixture-styled"].cssLoadAttempts,
            restoredCssLoadAttempts: plugins["fixture-missing-css"].cssLoadAttempts,
            noCssReady: plugins["fixture-no-css"].fixtureReady,
            noCssLoaded: plugins["fixture-no-css"]._loaded,
            stylesheets: Array.from(document.styleSheets).filter(
                (sheet) => sheet.ownerNode?.textContent?.includes("--toolkit-fixture-"),
            ).length,
        };
    });
    expect(state).toEqual({
        styledReady: true, styledLoaded: true, cssLoadAttempts: 1, restoredCssLoadAttempts: 2,
        noCssReady: true, noCssLoaded: true, stylesheets: 2,
    });
});

test("reloadPlugin waits for loading without enabling startup", async ({ obsidian }) => {
    const pluginId = "fixture-no-css";
    await obsidian.evaluateApp((id) => app.plugins.enabledPlugins.delete(id), pluginId);
    await obsidian.setPluginData(pluginId, { reloaded: true });

    await obsidian.reloadPlugin(pluginId);

    expect(await obsidian.pluginState(pluginId)).toEqual({
        enabled: false, loaded: true, registered: true,
    });
    const handle = await obsidian.plugin(pluginId);
    expect(await handle.evaluate(async (plugin) => ({
        current: plugin === app.plugins.plugins[plugin.manifest.id],
        loaded: plugin._loaded,
        data: await plugin.loadData(),
    }))).toEqual({ current: true, loaded: true, data: { reloaded: true } });
});

test("plugin load waits follow runtime transitions independently of startup settings", async ({ obsidian }) => {
    const pluginId = "fixture-no-css";
    await obsidian.evaluateApp((id) => app.plugins.disablePlugin(id), pluginId);

    expect(await obsidian.isPluginEnabled(pluginId)).toBe(true);
    expect(await obsidian.isPluginLoaded(pluginId)).toBe(false);
    await obsidian.waitForPluginEnabled(pluginId, 250);
    await obsidian.waitForPluginUnloaded(pluginId, 250);
    await expect(obsidian.waitForPluginLoaded(pluginId, 250)).rejects.toThrow(/Timeout/);

    await obsidian.evaluateApp((id) => {
        app.plugins.enabledPlugins.delete(id);
        setTimeout(() => { void app.plugins.enablePlugin(id); }, 100);
    }, pluginId);
    await obsidian.waitForPluginLoaded(pluginId);

    expect(await obsidian.isPluginEnabled(pluginId)).toBe(false);
    expect(await obsidian.isPluginLoaded(pluginId)).toBe(true);
    await obsidian.waitForPluginDisabled(pluginId, 250);
    await expect(obsidian.waitForPluginUnloaded(pluginId, 250)).rejects.toThrow(/Timeout/);

    await obsidian.evaluateApp((id) => {
        setTimeout(() => { void app.plugins.disablePlugin(id); }, 100);
    }, pluginId);
    await obsidian.waitForPluginUnloaded(pluginId);
    expect(await obsidian.isPluginLoaded(pluginId)).toBe(false);
    expect(await obsidian.pluginState(pluginId)).toEqual({
        enabled: false, loaded: false, registered: false,
    });
});

test("a registered plugin instance does not count as loaded after unload", async ({ obsidian }) => {
    const pluginId = "fixture-no-css";
    await obsidian.evaluateApp((id) => app.plugins.plugins[id].unload(), pluginId);

    expect(await obsidian.pluginState(pluginId)).toEqual({
        enabled: true, loaded: false, registered: true,
    });
    expect(await obsidian.isPluginLoaded(pluginId)).toBe(false);
    await obsidian.waitForPluginUnloaded(pluginId, 250);
    await expect(obsidian.waitForPluginLoaded(pluginId, 250)).rejects.toThrow(/Timeout/);
});
