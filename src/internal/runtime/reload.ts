import type { Page } from "playwright";
import type { Plugin, PluginHandleMap } from "../types";

/**
 * 再読込後の plugin ハンドルを作り直す。ids のうち、いま存在する plugin だけを含める。
 * 存在しない plugin を待つことはしない（無効化された plugin や遅延読み込みの plugin を含むため）。
 */
export async function refreshPluginHandleMap(page: Page, pluginIds: readonly string[]): Promise<PluginHandleMap> {
    const handle = await page.evaluateHandle((ids: string[]) => {
        const map = new Map<string, Plugin>();
        const plugins = app.plugins.plugins;
        for (const id of ids) {
            const plugin = plugins[id];
            if (plugin) {
                map.set(id, plugin);
            }
        }
        return map;
    }, [...pluginIds]);
    return handle as PluginHandleMap;
}
