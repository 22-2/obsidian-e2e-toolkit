import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preparePlugins } from "obsidian-e2e-toolkit";

const exampleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * on-demand 例の準備。example 自身の main.js を確認し、plugin-sources.json の外部プラグインを取得する。
 * 取得・検証・キャッシュは toolkit の preparePlugins に任せる。
 */
export default async function globalSetup() {
    const mainJsPath = path.resolve(exampleRoot, "main.js");
    if (!existsSync(mainJsPath)) {
        throw new Error("[global-setup] " + mainJsPath + " not found; build the example first");
    }

    const sourcesPath = path.resolve(exampleRoot, "tests", "plugin-sources.json");
    if (!existsSync(sourcesPath)) {
        console.warn("[global-setup] No plugin-sources.json found; skipping external plugins");
        return;
    }
    const sources = JSON.parse(await readFile(sourcesPath, "utf8"));
    await preparePlugins(sources, exampleRoot);
}
