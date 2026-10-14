import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isRecord } from "./pluginDirectory";

// readCoverageTarget と同じ規則で sourceMappingURL を読む。書き換え後も同じ行の形を保つ。
const SOURCE_MAP_COMMENT = /^(\/\/[#@] sourceMappingURL=)([^\r\n]+)$/m;
const INLINE_SOURCE_MAP = /^data:application\/json(?:;charset=[^;,]+)?;base64,(.+)$/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:/i;
// 1 文字の scheme は Windows のドライブ文字（V:\ や V:/）なので URL_SCHEME では拾わない。絶対 path として先に扱う。
const WINDOWS_DRIVE_PATH = /^[a-z]:[\\/]/i;
export const SOURCE_MAP_FILE = "main.js.map";

export function findSourceMapReference(bundle: string): string | null {
    const match = SOURCE_MAP_COMMENT.exec(bundle);
    return match === null ? null : match[2].trim();
}

// sourceMappingURL の行を書き換える。無ければ末尾に追加する。
export function replaceSourceMapReference(bundle: string, reference: string): string {
    const match = SOURCE_MAP_COMMENT.exec(bundle);
    if (match === null) return bundle.trimEnd() + "\n//# sourceMappingURL=" + reference + "\n";
    return bundle.slice(0, match.index) + match[1] + reference + bundle.slice(match.index + match[0].length);
}

// data: URL の inline map を取り出す。外部ファイルの参照なら null。
export function decodeInlineSourceMap(reference: string): string | null {
    const match = INLINE_SOURCE_MAP.exec(reference);
    return match === null ? null : Buffer.from(match[1], "base64").toString("utf8");
}

export function encodeInlineSourceMap(json: string): string {
    return "data:application/json;base64," + Buffer.from(json, "utf8").toString("base64");
}

function parseSourceMap(text: string, label: string): Record<string, unknown> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new Error("source map is not valid JSON (" + label + "): " + (error instanceof Error ? error.message : String(error)));
    }
    if (!isRecord(parsed) || parsed.version !== 3 || !Array.isArray(parsed.sources) || typeof parsed.mappings !== "string") {
        throw new Error("invalid source map (version 3 with sources and mappings is required): " + label);
    }
    return parsed;
}

function rebaseSource(source: unknown, baseDir: string, sourceRoot: string, label: string): string {
    if (typeof source !== "string") throw new Error("source map sources must be strings: " + label);
    if (source.startsWith("file:")) return source;
    // 絶対 path は sourceRoot と連結せず、そのまま file: URL にする。scheme 判定より前に行う。
    if (path.isAbsolute(source) || WINDOWS_DRIVE_PATH.test(source)) return pathToFileURL(path.resolve(source)).href;
    if (URL_SCHEME.test(source)) throw new Error("unsupported source map source " + JSON.stringify(source) + ": " + label);
    return pathToFileURL(path.resolve(baseDir, sourceRoot, source)).href;
}

/**
 * sources を、map を生成した場所（baseDir）基準の絶対 file URL に書き換える。
 * コピー先の場所を基準に解釈されると、プロジェクトの source が coverage から外れるため必須の処理。
 */
export function rebaseSourceMap(text: string, baseDir: string, label: string): string {
    const map = parseSourceMap(text, label);
    const sourceRoot = typeof map.sourceRoot === "string" ? map.sourceRoot : "";
    const sources = map.sources as unknown[];
    map.sources = sources.map((source) => rebaseSource(source, baseDir, sourceRoot, label));
    delete map.sourceRoot;
    return JSON.stringify(map);
}

async function exists(file: string): Promise<boolean> {
    try {
        await access(file);
        return true;
    } catch {
        return false;
    }
}

async function readStagedMap(dir: string, reference: string): Promise<string> {
    if (reference !== SOURCE_MAP_FILE) {
        throw new Error("prepared main.js must reference " + SOURCE_MAP_FILE + " but references " + reference);
    }
    const file = path.join(dir, SOURCE_MAP_FILE);
    if (!(await exists(file))) throw new Error("prepared main.js references a missing " + SOURCE_MAP_FILE);
    return readFile(file, "utf8");
}

/**
 * 準備済み dir の source map を検査する。sources は file: の絶対 URL で、
 * sourcesContent が無い source は実ファイルが存在する必要がある。
 */
export async function assertSourceMapResolvable(dir: string): Promise<void> {
    const bundle = await readFile(path.join(dir, "main.js"), "utf8");
    const reference = findSourceMapReference(bundle);
    if (reference === null) return;
    const inline = decodeInlineSourceMap(reference);
    const text = inline ?? (await readStagedMap(dir, reference));
    const map = parseSourceMap(text, "prepared main.js");
    const contents = Array.isArray(map.sourcesContent) ? (map.sourcesContent as unknown[]) : [];
    for (const [index, source] of (map.sources as unknown[]).entries()) {
        if (typeof source !== "string" || !source.startsWith("file:")) {
            throw new Error("prepared source map must use absolute file: sources, found " + String(source));
        }
        if (typeof contents[index] === "string") continue;
        const file = fileURLToPath(source);
        if (!(await exists(file))) throw new Error("prepared source map references a missing source: " + file);
    }
}
