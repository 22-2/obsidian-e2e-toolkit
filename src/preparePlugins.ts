import path from "node:path";
import { createScopedLogger } from "./internal/logger";
import { errorMessage, isSameOrInside } from "./internal/pluginDirectory";
import { fetchPlugin, normalizePluginSource, type PluginSource } from "./fetchPlugin";

export type { PluginSource } from "./fetchPlugin";

const logger = createScopedLogger("preparePlugins");
const FOLDER_NAME = /^[A-Za-z0-9._-]+$/;

export interface PreparePluginsOptions {
    /** 既存の取得結果を再利用する。既定 true。 */
    cache?: boolean;
    /** リリースが使えない時に git clone する。省略時は tag 指定の source だけ true（既存 lazy の挙動）。 */
    fallbackToGit?: boolean;
    /** baseDir からの配置先。既定 "myfiles"。 */
    destDir?: string;
}

function assertFolderName(pluginId: string): void {
    if (!FOLDER_NAME.test(pluginId) || pluginId === "." || pluginId === "..") {
        throw new TypeError("plugin key must be a folder name: " + JSON.stringify(pluginId));
    }
}

/**
 * sources の各 plugin を baseDir/destDir/<key> に取得して配置する。
 * 1件でも失敗したら、すべての失敗を1つのエラーにまとめて投げる。
 * key は配置先の folder 名であり、manifest.id と一致させる必要はない。
 */
export async function preparePlugins(
    sources: Record<string, PluginSource>,
    baseDir: string,
    opts: PreparePluginsOptions = {},
): Promise<Record<string, string>> {
    const root = path.resolve(baseDir);
    const destRoot = path.resolve(root, opts.destDir ?? "myfiles");
    if (destRoot === root || !isSameOrInside(destRoot, root)) {
        throw new Error("destDir must be a directory inside baseDir: " + destRoot);
    }

    const prepared: Record<string, string> = {};
    const failures: string[] = [];
    for (const [pluginId, value] of Object.entries(sources)) {
        try {
            assertFolderName(pluginId);
            const source = normalizePluginSource(value);
            const fallbackToGit = opts.fallbackToGit ?? (source.tag !== undefined);
            logger.info("preparing " + pluginId + " from " + source.repo + (source.tag ? "@" + source.tag : ""));
            prepared[pluginId] = await fetchPlugin(source.repo, path.join(destRoot, pluginId), {
                tag: source.tag,
                cache: opts.cache,
                fallbackToGit,
            });
        } catch (error) {
            failures.push("- " + pluginId + ": " + errorMessage(error));
        }
    }

    if (failures.length > 0) {
        throw new Error("Failed to prepare external plugins:\n" + failures.join("\n"));
    }
    return prepared;
}
