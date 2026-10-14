import { expect, test as base, type ObsidianAPI } from "../src";
import { RUNTIME_PLUGIN_IDS, runtimeVaultOptions } from "./runtime-fixtures";

const test = base.extend({
    vaultOptions: async ({ tempDir }, use) => {
        await use(await runtimeVaultOptions(tempDir));
    },
});

const { styled, missingCss, plain } = RUNTIME_PLUGIN_IDS;

type PersistentPlugins = { disablePluginAndSave(id: string): Promise<void> };

// disablePluginAndSave は設定の保存を要求するだけで、community-plugins.json への反映は後から行われる。
// 反映を確かめてから再読込する。確かめずに再読込すると、古い有効設定が起動時に戻ってしまう。
async function disablePersistently(obsidian: ObsidianAPI, pluginId: string): Promise<void> {
    await obsidian.evaluateApp((id) => (app.plugins as unknown as PersistentPlugins).disablePluginAndSave(id), pluginId);
    await expect.poll(() => obsidian.enabledPluginsOnDisk(), { timeout: 10_000 }).not.toContain(pluginId);
}

test("reload waits for the plugins loaded before it and restores their CSS", async ({ obsidian, page }) => {
    await obsidian.reload();

    expect(await obsidian.pluginState(styled)).toEqual({ enabled: true, loaded: true, registered: true });
    expect(await obsidian.pluginState(missingCss)).toEqual({ enabled: true, loaded: true, registered: true });
    await expect(page.locator("body")).toHaveCSS("--rt-styled", "1");
    await expect(page.locator("body")).toHaveCSS("--rt-missing-css", "1");

    // 再読込後のハンドルは、再読込後に作られた plugin インスタンスを指す。
    const handle = await obsidian.plugin(styled);
    expect(await handle.evaluate((plugin: { manifest: { id: string } }) => plugin === app.plugins.plugins[plugin.manifest.id])).toBe(true);
});

test("a plugin disabled only at runtime keeps its startup setting, so the reload loads it again", async ({ obsidian }) => {
    await obsidian.evaluateApp((id) => app.plugins.disablePlugin(id), plain);
    expect(await obsidian.pluginState(plain)).toEqual(expect.objectContaining({ enabled: true, loaded: false }));
    expect(await obsidian.enabledPluginsOnDisk()).toContain(plain);

    // 再読込の直前には読み込まれていないので待たない。起動時の有効設定が残っているため、再読込後に読み込まれる。
    await obsidian.reload();
    await obsidian.waitForPluginLoaded(plain);
    expect(await obsidian.pluginState(plain)).toEqual({ enabled: true, loaded: true, registered: true });
});

test("reload does not rewrite the enabled-plugin list on disk", async ({ obsidian }) => {
    const before = (await obsidian.enabledPluginsOnDisk()).slice().sort();
    await obsidian.evaluateApp((id) => app.plugins.disablePlugin(id), plain);
    await obsidian.reload();
    await obsidian.waitForPluginLoaded(plain);

    expect((await obsidian.enabledPluginsOnDisk()).slice().sort()).toEqual(before);
});

test("a plugin disabled with disablePluginAndSave is not waited for, and stays disabled after reload", async ({ obsidian }) => {
    await disablePersistently(obsidian, plain);
    await obsidian.reload();

    expect(await obsidian.pluginState(plain)).toEqual({ enabled: false, loaded: false, registered: false });
    expect(await obsidian.enabledPluginsOnDisk()).not.toContain(plain);
});

test("expectLoaded replaces the default expectation, and an id that never loads fails with its state", async ({ obsidian }) => {
    await expect(obsidian.reload({ expectLoaded: ["rt-not-installed"], timeout: 3000 })).rejects.toThrow(/Not loaded: \[rt-not-installed\]/);
});

test("interceptReload records the enabled plugins at the request and runs other commands for real", async ({ obsidian }) => {
    const interceptor = await obsidian.interceptReload();
    expect(await interceptor.requested()).toBe(false);

    expect(await obsidian.tryCommand("app:reload")).toBe(true);
    expect(await interceptor.requested()).toBe(true);
    const [first] = await interceptor.requests();
    expect(first.enabledPluginIds).toEqual(expect.arrayContaining([styled, missingCss, plain]));
    expect(first.enabledPluginIds).toEqual([...first.enabledPluginIds].sort());

    // 要求の後で有効状態を永続的に変えても、記録済みのスナップショットは変わらない。
    await disablePersistently(obsidian, plain);
    expect((await interceptor.requests())[0].enabledPluginIds).toContain(plain);
    expect(await obsidian.enabledPluginsOnDisk()).not.toContain(plain);

    // app:reload 以外のコマンドは、差し替えを通っても本当に実行される。
    expect(await obsidian.tryCommand(styled + ":probe")).toBe(true);
    expect(await obsidian.evaluateApp((id) => (app.plugins.plugins[id] as unknown as { probes: number }).probes, styled)).toBe(1);
    await interceptor.restore();
});

test("commands other than app:reload keep this, every argument, and the return value", async ({ obsidian }) => {
    // 差し替えより前に、呼び出しを記録する関数を置く。interceptReload はこの関数をさらに包む。
    await obsidian.evaluateApp(() => {
        const host = window as unknown as { __rtCalls: unknown[] };
        const base = app.commands.executeCommandById as unknown as (...args: unknown[]) => boolean;
        host.__rtCalls = [];
        app.commands.executeCommandById = function (this: unknown, ...args: unknown[]) {
            host.__rtCalls.push({ isCommands: this === app.commands, count: args.length, second: args[1] });
            return base.apply(this, args);
        } as unknown as typeof app.commands.executeCommandById;
    });
    const interceptor = await obsidian.interceptReload();

    const results = await obsidian.evaluateApp(() => {
        const call = app.commands.executeCommandById as unknown as (id: string, event: unknown) => boolean;
        return [call.call(app.commands, "rt-styled:probe", { marker: 42 }), call.call(app.commands, "rt-missing:none", { marker: 7 })];
    });
    expect(results).toEqual([true, false]);
    expect(await obsidian.evaluateApp(() => (window as unknown as { __rtCalls: unknown[] }).__rtCalls)).toEqual([
        { isCommands: true, count: 2, second: { marker: 42 } },
        { isCommands: true, count: 2, second: { marker: 7 } },
    ]);
    expect(await interceptor.requested()).toBe(false);
    await interceptor.restore();
});

test("one interceptor per window, restore is idempotent, and the recorded requests survive restore", async ({ obsidian }) => {
    const interceptor = await obsidian.interceptReload();
    await expect(obsidian.interceptReload()).rejects.toThrow(/already intercepted/);

    await obsidian.tryCommand("app:reload");
    await interceptor.restore();
    await interceptor.restore();
    expect(await interceptor.requested()).toBe(true);
    expect(await interceptor.requests()).toHaveLength(1);

    const next = await obsidian.interceptReload();
    expect(await next.requested()).toBe(false);
    await next.restore();
});

test("a reload ends the interceptor: requests() fails and restore() does nothing", async ({ obsidian }) => {
    const interceptor = await obsidian.interceptReload();
    await obsidian.reload();

    await expect(interceptor.requests()).rejects.toThrow(/no longer active/);
    await expect(interceptor.restore()).resolves.toBeUndefined();
});

test("restore refuses to overwrite an executeCommandById that was replaced after interception", async ({ obsidian }) => {
    const interceptor = await obsidian.interceptReload();
    await obsidian.evaluateApp(() => {
        const host = window as unknown as { __rtWrapper: unknown };
        host.__rtWrapper = app.commands.executeCommandById;
        app.commands.executeCommandById = () => true;
    });

    await expect(interceptor.restore()).rejects.toThrow(/replaced after interception/);
    // 置き換えを戻してから restore すると、正常に終わる。
    await obsidian.evaluateApp(() => {
        app.commands.executeCommandById = (window as unknown as { __rtWrapper: typeof app.commands.executeCommandById }).__rtWrapper;
    });
    await interceptor.restore();
    expect(await interceptor.requested()).toBe(false);
});
