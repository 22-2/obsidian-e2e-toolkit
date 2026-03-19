import type { Page } from "playwright";
import { logger } from "..";
import { ObsidianE2ELauncher } from "./launcher";
import type { Plugin, PluginHandleMap } from "./types";

export async function getPluginHandleMap(
    page: Page,
    plugins: { pluginId: string; path: string }[],
): Promise<PluginHandleMap> {
    // Wait for plugins to be loaded
    const pluginIds = plugins.map((p) => p.pluginId).filter(Boolean);
    logger.debug("getPluginHandleMap: waiting for plugin IDs:", pluginIds);

    if (pluginIds.length === 0) {
        logger.debug(
            "getPluginHandleMap: no plugin IDs to wait for — returning empty map",
        );
        return page.evaluateHandle(() => new Map());
    }
    try {
        await page.waitForFunction(
            (pluginIds) => {
                const plugins = (window as any).app?.plugins?.plugins;
                return (
                    !!plugins && pluginIds.every((id: string) => plugins[id])
                );
            },
            pluginIds,
            { timeout: 30000 },
        );
    } catch (err) {
        logger.error(
            "getPluginHandleMap: timeout waiting for plugins to load",
            err && (err as Error).message,
        );
        try {
            const available = await page.evaluate(() =>
                Object.keys((window as any).app?.plugins?.plugins || {}),
            );
            logger.error(
                "getPluginHandleMap: available app.plugins.plugins keys:",
                available,
            );
        } catch (e) {
            logger.error(
                "getPluginHandleMap: failed to enumerate app.plugins.plugins",
                e && (e as Error).message,
            );
        }
        throw err;
    }

    return page.evaluateHandle((plugins) => {
        const map = new Map<string, Plugin>();
        const idMapping = new Map<string, string>();
        plugins.forEach((p) => {
            const plugin = (globalThis as any).app?.plugins.plugins[p.pluginId];
            if (plugin) {
                map.set(p.pluginId, plugin);
                if ((p as any).originalId) {
                    map.set((p as any).originalId, plugin);
                    idMapping.set((p as any).originalId, p.pluginId);
                }
            }
        });
        (window as any).__pluginIdMapping = idMapping;
        return map;
    }, plugins);
}

// ===================================================================
// Test Error Handling
// ===================================================================
export function handleTestError(testInfo: any): void {
    const status = testInfo.status;

    if (status === "passed" || status === "skipped") {
        logger.debug(`Test finished with status: ${status}.`);
        return;
    }

    logger.error(`Test finished with status: ${status}. Pausing for debug.`);

    if (testInfo.error) {
        const separator = "=".repeat(20);
        logger.error(`\n${separator} TEST FAILED ${separator}`);
        logger.error(testInfo.error.message);

        if (testInfo.error.stack) {
            const firstNewlineIndex = testInfo.error.stack.indexOf("\n");
            const stackWithoutMessage = testInfo.error.stack.substring(
                firstNewlineIndex + 1,
            );
            logger.error(stackWithoutMessage);
        }

        logger.error("=".repeat(53) + "\n");
    }

    if (!process.env.CI) {
        logger.debug(testInfo.errors);
    }
}
// ===================================================================
// Vault Setup Helpers
// ===================================================================
export async function createObsidianContext(
    launcher: ObsidianE2ELauncher,
): Promise<any> {
    return launcher.launch();
}
