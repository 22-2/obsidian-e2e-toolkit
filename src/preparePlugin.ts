import { copyFile, lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
    PREPARED_PLUGIN_MARKER,
    TOOLKIT_MARKER_OWNER,
    assertUsableDirectory,
    inspectDestination,
    isSameOrInside,
    promoteDirectory,
    readManifestIdentity,
    readPreparedPluginMarker,
    removeTempDirectory,
    tempSiblingPath,
} from "./internal/pluginDirectory";
import {
    SOURCE_MAP_FILE,
    assertSourceMapResolvable,
    decodeInlineSourceMap,
    encodeInlineSourceMap,
    findSourceMapReference,
    rebaseSourceMap,
    replaceSourceMapReference,
} from "./internal/sourceMap";

export interface PreparePluginInput {
    /** manifest.json の path。id と version は空でない文字列が必要。親 folder を元のプロジェクト root として記録する。 */
    manifest: string;
    /** ビルド済みの main.js の path。空ファイルは拒否する。 */
    main: string;
    /** styles.css の path（省略可）。 */
    styles?: string;
    /** main.js.map の path（省略可）。省略時は main.js の sourceMappingURL（inline か外部ファイル）を使う。 */
    sourceMap?: string;
}

// 旧 palette の prepare-plugin.mjs が marker なしで作ったファイル。この集合だけを移行対象にする。
const LEGACY_PREPARED_FILES = ["main.js", "manifest.json", "styles.css", "main.js.map"];

interface ResolvedInput {
    manifest: string;
    main: string;
    styles?: string;
    sourceMap?: string;
}

interface PreparedBundle {
    /** 書き出す main.js。sourceMappingURL は書き出し先の形に合わせて書き換え済み。 */
    main: string;
    /** 書き出す main.js.map。inline map を使う場合は undefined。 */
    sourceMap?: string;
}

function resolveInput(input: PreparePluginInput): ResolvedInput {
    const resolved: ResolvedInput = {
        manifest: path.resolve(input.manifest),
        main: path.resolve(input.main),
    };
    if (input.styles !== undefined) resolved.styles = path.resolve(input.styles);
    if (input.sourceMap !== undefined) resolved.sourceMap = path.resolve(input.sourceMap);
    return resolved;
}

async function assertFile(file: string, label: string, requireContent: boolean): Promise<void> {
    let info;
    try {
        info = await stat(file);
    } catch {
        throw new Error(label + " file not found: " + file);
    }
    if (!info.isFile()) throw new Error(label + " is not a file: " + file);
    if (requireContent && info.size === 0) throw new Error(label + " is empty: " + file);
}

// sidecar 形式で書き出す。sources は元の map の場所を基準に絶対化してから書く。
function sidecarBundle(bundle: string, mapText: string, mapBase: string, label: string): PreparedBundle {
    return {
        main: replaceSourceMapReference(bundle, SOURCE_MAP_FILE),
        sourceMap: rebaseSourceMap(mapText, mapBase, label),
    };
}

async function prepareBundle(resolved: ResolvedInput): Promise<PreparedBundle> {
    const bundle = await readFile(resolved.main, "utf8");
    if (resolved.sourceMap !== undefined) {
        const mapText = await readFile(resolved.sourceMap, "utf8");
        return sidecarBundle(bundle, mapText, path.dirname(resolved.sourceMap), resolved.sourceMap);
    }
    const reference = findSourceMapReference(bundle);
    if (reference === null) return { main: bundle };
    const inline = decodeInlineSourceMap(reference);
    if (inline !== null) {
        // inline map は main.js の中に入っているため、sources を main.js の場所基準で絶対化して書き戻す。
        const rebased = rebaseSourceMap(inline, path.dirname(resolved.main), resolved.main);
        return { main: replaceSourceMapReference(bundle, encodeInlineSourceMap(rebased)) };
    }
    const mapFile = path.resolve(path.dirname(resolved.main), reference);
    let mapText: string;
    try {
        mapText = await readFile(mapFile, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(
                resolved.main + " references a source map that does not exist: " + mapFile + ". Pass sourceMap or rebuild with sourcemap enabled.",
            );
        }
        throw error;
    }
    return sidecarBundle(bundle, mapText, path.dirname(mapFile), mapFile);
}

async function listUnknownEntries(dir: string, entries: string[]): Promise<string[]> {
    const unknown: string[] = [];
    for (const name of entries) {
        const info = await lstat(path.join(dir, name));
        if (!LEGACY_PREPARED_FILES.includes(name) || !info.isFile()) unknown.push(name);
    }
    return unknown;
}

// 置き換えてよいのは、空の dir、toolkit が作った dir（prepared marker あり）、旧 palette の既知ファイルだけ。
async function assertReplaceable(target: string): Promise<void> {
    const inspection = await inspectDestination(target);
    if (inspection.state !== "populated") return;
    if ((await readPreparedPluginMarker(target)) !== null) return;
    const unknown = await listUnknownEntries(target, inspection.entries);
    if (unknown.length > 0) {
        throw new Error(
            "refusing to replace " + target + ": it has no toolkit marker and contains files toolkit did not create (" + unknown.join(", ") + ")",
        );
    }
}

async function writePreparedMarker(dir: string, id: string, projectRoot: string, files: string[]): Promise<void> {
    const record = {
        owner: TOOLKIT_MARKER_OWNER,
        version: 1,
        kind: "prepared-plugin",
        id,
        projectRoot,
        files,
        preparedAt: new Date().toISOString(),
    };
    await writeFile(path.join(dir, PREPARED_PLUGIN_MARKER), JSON.stringify(record, null, 4) + "\n", "utf8");
}

/**
 * 分散したビルド成果物を1つの plugin dir にまとめる。
 * source map は元の場所基準の絶対 file URL に書き換え、必須ファイルと source の解決可否を
 * staging 上で検査してから dest を置き換える。
 */
export async function preparePlugin(input: PreparePluginInput, dest: string): Promise<string> {
    const resolved = resolveInput(input);
    const manifest = await readManifestIdentity(resolved.manifest);
    await assertFile(resolved.main, "main", true);
    if (resolved.styles !== undefined) await assertFile(resolved.styles, "styles", false);
    if (resolved.sourceMap !== undefined) await assertFile(resolved.sourceMap, "sourceMap", true);

    const target = path.resolve(dest);
    assertUsableDirectory(target);
    for (const source of [resolved.manifest, resolved.main, resolved.styles, resolved.sourceMap]) {
        if (source !== undefined && isSameOrInside(source, target)) {
            throw new Error("refusing to prepare into " + target + " because it contains the source file " + source);
        }
    }
    await assertReplaceable(target);

    const bundle = await prepareBundle(resolved);
    const projectRoot = path.dirname(resolved.manifest);
    await mkdir(path.dirname(target), { recursive: true });
    const staging = tempSiblingPath(target, "staging");
    try {
        await mkdir(staging);
        await copyFile(resolved.manifest, path.join(staging, "manifest.json"));
        await writeFile(path.join(staging, "main.js"), bundle.main, "utf8");
        const files = ["manifest.json", "main.js"];
        if (bundle.sourceMap !== undefined) {
            await writeFile(path.join(staging, SOURCE_MAP_FILE), bundle.sourceMap, "utf8");
            files.push(SOURCE_MAP_FILE);
        }
        if (resolved.styles !== undefined) {
            await copyFile(resolved.styles, path.join(staging, "styles.css"));
            files.push("styles.css");
        }
        await assertSourceMapResolvable(staging);
        await writePreparedMarker(staging, manifest.id, projectRoot, files);
        await promoteDirectory(staging, target);
    } catch (error) {
        await removeTempDirectory(staging, target, "staging");
        throw error;
    }
    return target;
}
