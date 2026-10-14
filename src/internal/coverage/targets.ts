import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CoverageTarget, CoverageSourceMap } from "./types";
import { readPreparedPluginMarker } from "../pluginDirectory";

// 準備済み plugin では、ソースは元のプロジェクト root の下にある。測定の source root はそこを使う。
async function resolveCoverageRoot(stagedRoot: string, pluginId: string): Promise<string> {
    const prepared = await readPreparedPluginMarker(stagedRoot);
    if (prepared === null) return stagedRoot;
    if (prepared.id !== pluginId) {
        throw new Error("Prepared plugin marker id " + prepared.id + " does not match manifest id " + pluginId + ": " + stagedRoot);
    }
    try {
        await stat(prepared.projectRoot);
    } catch {
        throw new Error("Prepared plugin project folder is missing: " + prepared.projectRoot);
    }
    return prepared.projectRoot;
}

export async function readCoverageTarget(pluginPath: string): Promise<CoverageTarget> {
    const root = path.resolve(pluginPath);
    const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as { id?: unknown };
    if (typeof manifest.id !== "string" || !manifest.id) {
        throw new Error(`Coverage plugin manifest is missing its id: ${root}`);
    }
    const coverageRoot = await resolveCoverageRoot(root, manifest.id);
    const bundle = await readFile(path.join(root, "main.js"), "utf8");
    const mapMatch = bundle.match(/^\/\/[#@] sourceMappingURL=([^\r\n]+)$/m);
    // esbuild's "external" mode writes a sidecar without sourceMappingURL.
    const reference = mapMatch?.[1].trim() ?? "main.js.map";
    const inline = reference.match(/^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/);
    const mapPath = inline ? path.join(root, "main.js") : path.resolve(root, reference);
    let rawMap: string;
    try {
        rawMap = inline ? Buffer.from(inline[1], "base64").toString("utf8") : await readFile(mapPath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`Coverage requires a source map for ${manifest.id}. Build main.js with sourcemap: "inline" or "external".`);
        }
        throw error;
    }
    const sourceMap = JSON.parse(rawMap) as CoverageSourceMap & { sourceRoot?: string };
    if (sourceMap.version !== 3 || !Array.isArray(sourceMap.sources) || typeof sourceMap.mappings !== "string") {
        throw new Error(`Invalid source map for ${manifest.id}`);
    }
    sourceMap.sources = sourceMap.sources.map((source) => source.startsWith("file:")
        ? fileURLToPath(source)
        : path.resolve(path.dirname(mapPath), sourceMap.sourceRoot ?? "", source));
    sourceMap.sourcesContent = await Promise.all(sourceMap.sources.map((source, index) =>
        sourceMap.sourcesContent?.[index] ?? readFile(source, "utf8")));
    delete sourceMap.sourceRoot;
    return {
        pluginId: manifest.id,
        root: coverageRoot,
        // Obsidian strips sourceMappingURL before wrapping main.js in a function.
        code: (mapMatch ? bundle.replace(mapMatch[0], "") : bundle).trimEnd(),
        sourceMap,
    };
}

export function isTargetScript(url: string, target: CoverageTarget): boolean {
    return url === `plugin:${target.pluginId}` ||
        url.replaceAll("\\", "/").endsWith(`/plugins/${target.pluginId}/main.js`);
}
