import fs from "node:fs";
import path from "node:path";
import { test } from "obsidian-e2e-toolkit";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, "..");
const pluginUnderTestId = "on-demand-plugins";
const targetPluginId = "obsidian42-brat";
const excalidrawPluginId = "obsidian-excalidraw-plugin";

export function externalPluginPath(pluginId: string): string {
    return path.resolve(repoRoot, "myfiles", pluginId);
}

export function createOnDemandVaultOptions(pluginIds: string[] = [targetPluginId]) {
    return {
        enableBrowserConsoleLogging: true,
        logLevel: "info" as const,
        fresh: true,
        plugins: [
            {
                path: repoRoot,
            },
            ...pluginIds.map((pluginId) => ({
                path: externalPluginPath(pluginId),
            })),
        ],
    };
}

export function useOnDemandPlugins() {
    test.use({
        vaultOptions: createOnDemandVaultOptions(),
    });
}

export function useOnDemandPluginsWithExcalidraw() {
    test.use({
        vaultOptions: createOnDemandVaultOptions([excalidrawPluginId]),
    });
}

export function ensureBuilt() {
    const mainJsPath = path.resolve(repoRoot, "main.js");
    if (!fs.existsSync(mainJsPath)) {
        test.skip(true, "main.js not found; run build before tests");
        return false;
    }
    return true;
}

export { repoRoot, pluginUnderTestId, targetPluginId, excalidrawPluginId };
