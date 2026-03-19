import { expect, test } from "obsidian-e2e-toolkit";
import {
    ensureBuilt,
    excalidrawPluginId,
    pluginUnderTestId,
    useOnDemandPluginsWithExcalidraw
} from "./test-utils";

useOnDemandPluginsWithExcalidraw();

test("opening .excalidraw.md triggers lazy load and shows Excalidraw view", async ({ obsidian }) => {
    if (!ensureBuilt()) return;

    await obsidian.waitReady();

    const pluginHandle = await obsidian.plugin(pluginUnderTestId);
    // configure lazyOnView for Excalidraw
    const result = await pluginHandle.evaluate(async (plugin, pluginId) => {
        const original = app.commands.executeCommandById;
        app.commands.executeCommandById = () => true;
        try {
            await plugin.updatePluginSettings(pluginId, "lazy");
            // plugin.settings.lazyOnViews = plugin.settings.lazyOnViews || {};
            // plugin.settings.lazyOnViews[pluginId] = [];
            await plugin.saveSettings();
        } finally {
            app.commands.executeCommandById = original;
        }
        return { mode: plugin.settings?.plugins?.[pluginId]?.mode ?? null };
    }, excalidrawPluginId);

    expect(result.mode).toBe("lazy");
    // create an Excalidraw markdown file and open it
    await obsidian.page.evaluate(async () => {
        const f = await app.vault.create("test.excalidraw.md", "---\n\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n\n---\n==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'\n\n\n## Drawing\n```compressed-json\nN4IgLgngDgpiBcIYA8DGBDANgSwCYCd0B3EAGhADcZ8BnbAewDsEAmcm+gV31TkQAswYKDXgB6MQHNsYfpwBGAOlT0AtmIBeNCtlQbs6RmPry6uA4wC0KDDgLFLUTJ2lH8MTDHQ0YNMWHRJMRZFFgAGRQBmMiRPVRhGMBoEAG0AXXJ0KCgAZQCwPlBJfDwc7A0+Rk5MTHIdGCIAIXRUAGtirkZcAGF6THp8BBAAYgAzcYmQAF8poA===\n```\n%%");
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(f);
    });

    // wait for plugin to be enabled
    await obsidian.waitForPluginEnabled(excalidrawPluginId, 10000);
    expect(await obsidian.isPluginEnabled(excalidrawPluginId)).toBe(true);

    // assert an excalidraw view exists (poll because view registration is async)
    await obsidian.waitForApp(
        () => app.workspace.getLeavesOfType("excalidraw").length > 0,
        undefined,
        10000,
    );
    const hasView = await obsidian.page.evaluate(() => {
        return app.workspace.getLeavesOfType("excalidraw").length > 0;
    });

    expect(hasView).toBe(true);
});

test("layout-restore triggers lazy load for already-open Excalidraw file", async ({ obsidian }) => {
    if (!ensureBuilt()) return;

    await obsidian.waitReady();

    const pluginHandle = await obsidian.plugin(pluginUnderTestId);
    // configure lazyOnView for Excalidraw
    await pluginHandle.evaluate(async (plugin, pluginId) => {
        const original = app.commands.executeCommandById;
        app.commands.executeCommandById = () => true;
        try {
            await plugin.updatePluginSettings(pluginId, "lazy");
            plugin.settings.lazyOnViews = plugin.settings.lazyOnViews || {};
            plugin.settings.lazyOnViews[pluginId] = [];
            await plugin.saveSettings();
        } finally {
            app.commands.executeCommandById = original;
        }
    }, excalidrawPluginId);

    // create file and open it (will open as markdown initially)
    await obsidian.page.evaluate(async () => {
        const f = await app.vault.create("test.excalidraw.md", "---\n\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n\n---\n==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠== You can decompress Drawing data with the command palette: 'Decompress current Excalidraw file'. For more info check in plugin settings under 'Saving'\n\n\n## Drawing\n```compressed-json\nN4IgLgngDgpiBcIYA8DGBDANgSwCYCd0B3EAGhADcZ8BnbAewDsEAmcm+gV31TkQAswYKDXgB6MQHNsYfpwBGAOlT0AtmIBeNCtlQbs6RmPry6uA4wC0KDDgLFLUTJ2lH8MTDHQ0YNMWHRJMRZFFgAGRQBmMiRPVRhGMBoEAG0AXXJ0KCgAZQCwPlBJfDwc7A0+Rk5MTHIdGCIAIXRUAGtirkZcAGF6THp8BBAAYgAzcYmQAF8poA===\n```\n%%");
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(f);
    });

    // simulate layout restore event
    await obsidian.page.evaluate(() => {
        const workspace = app.workspace as any;
        workspace.trigger && workspace.trigger("layout-ready");
    });

    await obsidian.waitForPluginEnabled(excalidrawPluginId, 10000);
    expect(await obsidian.isPluginEnabled(excalidrawPluginId)).toBe(true);

    // poll for excalidraw view (view registration is async after plugin load)
    await obsidian.waitForApp(
        () => app.workspace.getLeavesOfType("excalidraw").length > 0,
        undefined,
        10000,
    );
    const hasView2 = await obsidian.page.evaluate(() => {
        return app.workspace.getLeavesOfType("excalidraw").length > 0;
    });

    expect(hasView2).toBe(true);
});
