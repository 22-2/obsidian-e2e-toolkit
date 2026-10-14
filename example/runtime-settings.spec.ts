import path from "node:path";
import { expect, test as base } from "../src";
import { RUNTIME_PLUGIN_IDS, runtimeVaultOptions } from "./runtime-fixtures";

const test = base.extend({
    vaultOptions: async ({ tempDir }, use) => {
        await use(await runtimeVaultOptions(tempDir));
    },
});

const { styled, missingCss, plain } = RUNTIME_PLUGIN_IDS;
const SETTINGS_MARKER = ".vertical-tab-header";

type SettingHost = { setting: { open(): void; openTabById(id: string): void } };

test("openSettings opens a separate settings window and returns the same window on the next call", async ({ obsidian, page }) => {
    const settings = await obsidian.openSettings("about");
    await expect(settings.locator(SETTINGS_MARKER).first()).toBeVisible();
    expect(settings).not.toBe(page);

    const again = await obsidian.openSettings("editor");
    expect(again).toBe(settings);
    await obsidian.closeSettings();
});

test("subPage clicks the setting item named General, and the header with the same text is not the target", async ({ obsidian }) => {
    const settings = await obsidian.openSettings(styled, { subPage: "General" });

    // 項目のクリック処理が呼ばれ、次の画面要素が表示される。見出しを押していれば、どちらも起きない。
    await expect(settings.locator(".rt-general-opened")).toBeVisible();
    expect(await obsidian.evaluatePlugin(styled, (plugin: { clickLog: string[] }) => plugin.clickLog)).toEqual(["General"]);
    await obsidian.closeSettings();
});

test("closeSettings closes the settings window and waits until it is gone", async ({ obsidian }) => {
    await obsidian.openSettings("about");
    await obsidian.closeSettings();

    await expect(obsidian.findPage((window) => window.locator(SETTINGS_MARKER), { timeout: 500 })).rejects.toThrow(/not visible in any of/);
});

test("openSettings returns the vault window when the settings open as a modal", async ({ obsidian, page }) => {
    await obsidian.evaluateApp(() => {
        (app.vault as unknown as { setConfig(key: string, value: unknown): void }).setConfig("settingsPopoutWindow", false);
    });

    const settings = await obsidian.openSettings("about");
    expect(settings).toBe(page);
    await obsidian.closeSettings();
});

test("findPage matches a window when a matching element is visible, even if an earlier match is hidden", async ({ obsidian, page }) => {
    await page.evaluate(() => {
        const hidden = document.createElement("div");
        hidden.className = "rt-probe";
        hidden.textContent = "hidden probe";
        hidden.style.display = "none";
        const shown = document.createElement("div");
        shown.className = "rt-probe";
        shown.textContent = "shown probe";
        document.body.append(hidden, shown);
    });

    expect(await obsidian.findPage((window) => window.locator(".rt-probe"), { timeout: 2000 })).toBe(page);
});

test("findPage fails with its description and the match counts of each window", async ({ obsidian, page }) => {
    await page.evaluate(() => {
        const hidden = document.createElement("div");
        hidden.className = "rt-hidden-only";
        hidden.textContent = "hidden only";
        hidden.style.display = "none";
        document.body.append(hidden);
    });

    const failure = await obsidian.findPage((window) => window.locator(".rt-hidden-only"), { timeout: 500, description: "hidden probe" }).then(() => null, (error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure?.message).toContain("hidden probe");
    expect(failure?.message).toContain("matches: 1, visible: 0");
});

test("findPage finds a window that opens after the search has started", async ({ obsidian, page }) => {
    const search = obsidian.findPage((window) => window.locator(SETTINGS_MARKER), { timeout: 10000, description: "late settings window" });
    await obsidian.evaluateApp(() => (app as unknown as SettingHost).setting.open());

    const found = await search;
    expect(found).not.toBe(page);
    await expect(found.locator(SETTINGS_MARKER).first()).toBeVisible();
    await obsidian.closeSettings();
});

test("findPage keeps searching when a window closes during the search, and reports only the windows still open", async ({ obsidian }) => {
    const search = obsidian.findPage((window) => window.locator(".rt-never-shown"), { timeout: 2500, description: "closed-window probe" }).then(() => null, (error: Error) => error);
    await obsidian.evaluateApp(() => (app as unknown as SettingHost).setting.open());
    await obsidian.findPage((window) => window.locator(SETTINGS_MARKER), { timeout: 5000, description: "settings window before close" });
    await obsidian.closeSettings();

    const failure = await search;
    expect(failure?.message).toContain("closed-window probe");
    expect(failure?.message).toContain("not visible in any of 1 window(s)");
});

test("vaultPath, configDir and readConfig read the real vault and reject paths outside the config directory", async ({ obsidian, tempDir }) => {
    expect(path.resolve(await obsidian.vaultPath())).toBe(path.resolve(tempDir + "-vault"));
    expect(await obsidian.configDir()).toBe(".obsidian");

    const onDisk = await obsidian.enabledPluginsOnDisk();
    expect(onDisk).toEqual(expect.arrayContaining([styled, missingCss, plain]));
    expect(await obsidian.readConfig<string[]>("community-plugins.json")).toEqual(onDisk);

    await expect(obsidian.readConfig("../escape.json")).rejects.toThrow(/escapes the config directory/);
    await expect(obsidian.readConfig(path.resolve(tempDir, "outside.json"))).rejects.toThrow(/must be relative/);
});

test("pluginSettings reads the settings and updatePluginSettings saves the merged result", async ({ obsidian }) => {
    expect(await obsidian.pluginSettings<{ mode: string }>(styled)).toEqual({ mode: "initial" });

    await obsidian.updatePluginSettings(styled, { mode: "changed" });
    expect(await obsidian.pluginSettings<{ mode: string }>(styled)).toEqual({ mode: "changed" });
    expect(await obsidian.readConfig<{ mode: string }>("plugins/" + styled + "/data.json")).toEqual({ mode: "changed" });
});

test("pluginSettings and updatePluginSettings fail explicitly for a plugin without settings", async ({ obsidian }) => {
    await expect(obsidian.pluginSettings(plain)).rejects.toThrow(/has no settings property/);
    await expect(obsidian.updatePluginSettings(plain, { a: 1 })).rejects.toThrow(/has no saveSettings/);
});

test("evaluatePlugin runs the function with the plugin instance and rejects a plugin that is not loaded", async ({ obsidian }) => {
    const result = await obsidian.evaluatePlugin(styled, (plugin: { manifest: { id: string } }, suffix: string) => plugin.manifest.id + suffix, "-ok");
    expect(result).toBe(styled + "-ok");
    await expect(obsidian.evaluatePlugin("rt-not-installed", () => 1)).rejects.toThrow(/Plugin is not loaded/);
});

test("command helpers report unknown commands as false", async ({ obsidian }) => {
    expect(await obsidian.hasCommand(styled + ":probe")).toBe(true);
    expect(await obsidian.hasCommand("rt-not-installed:probe")).toBe(false);
    expect(await obsidian.findCommands(styled + ":")).toEqual(expect.arrayContaining([styled + ":probe", styled + ":boom"]));
    expect(await obsidian.tryCommand("rt-not-installed:probe")).toBe(false);
    await obsidian.command(styled + ":probe");
});

test("tryCommand lets an exception thrown by executeCommandById through, with or without interceptReload", async ({ obsidian }) => {
    await obsidian.evaluateApp(() => {
        const host = window as unknown as { __rtBase: unknown };
        const base = app.commands.executeCommandById as unknown as (id: string) => boolean;
        host.__rtBase = base;
        app.commands.executeCommandById = ((id: string) => {
            if (id === "rt-styled:throws") {
                throw new Error("rt-wrapper-probe");
            }
            return base.call(app.commands, id);
        }) as unknown as typeof app.commands.executeCommandById;
    });
    await expect(obsidian.tryCommand("rt-styled:throws")).rejects.toThrow(/rt-wrapper-probe/);

    const interceptor = await obsidian.interceptReload();
    await expect(obsidian.tryCommand("rt-styled:throws")).rejects.toThrow(/rt-wrapper-probe/);
    await interceptor.restore();
});

test("an exception thrown inside a native command callback is handled by Obsidian, and the callback still runs", async ({ obsidian }) => {
    // Obsidian がコールバックの例外をどう扱うかは契約に含めない。ここでは、呼び出しが完了し、コールバックが 1 回実行されたことだけを確かめる。
    await expect(obsidian.tryCommand(styled + ":boom")).resolves.toEqual(expect.any(Boolean));
    expect(await obsidian.evaluatePlugin(styled, (plugin: { boomCount: number }) => plugin.boomCount)).toBe(1);
});
