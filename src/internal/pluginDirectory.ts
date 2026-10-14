import { randomBytes } from "node:crypto";
import type { Stats } from "node:fs";
import { lstat, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createScopedLogger } from "./logger";

const logger = createScopedLogger("pluginDirectory");

// toolkit が作成した dir であることを示す marker。fetchPlugin と preparePlugin で別名にする。
export const TOOLKIT_MARKER_OWNER = "obsidian-e2e-toolkit";
export const TOOLKIT_SOURCE_MARKER = ".obsidian-e2e-plugin-source.json";
export const PREPARED_PLUGIN_MARKER = ".obsidian-e2e-prepared-plugin.json";
// 旧 lazy テストの取得 marker。読み取りだけに使い、削除や上書きはしない。
export const LEGACY_LAZY_SOURCE_MARKER = ".lazy-plugin-source.json";
const MARKER_VERSION = 1;

export type SourceMarker =
    | { kind: "toolkit"; repo: string; tag: string | null; resolvedTag: string | null }
    | { kind: "legacy-lazy"; repo: string; tag: string | null };

export interface SourceMarkerInput {
    repo: string;
    tag: string | null;
    resolvedTag: string | null;
    method: string;
}

export interface DestinationInspection {
    state: "absent" | "empty" | "populated";
    entries: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function nullableString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

// 存在しない・壊れた JSON は「所有 marker なし」として扱う。所有と判定しない側に倒すため。
export async function readJsonIfExists(file: string): Promise<unknown> {
    let text: string;
    try {
        text = await readFile(file, "utf8");
    } catch (error) {
        if (isNotFound(error)) return undefined;
        throw error;
    }
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

export async function readSourceMarker(dir: string): Promise<SourceMarker | null> {
    const toolkit = await readJsonIfExists(path.join(dir, TOOLKIT_SOURCE_MARKER));
    if (isRecord(toolkit) && toolkit.owner === TOOLKIT_MARKER_OWNER && typeof toolkit.repo === "string") {
        return {
            kind: "toolkit",
            repo: toolkit.repo,
            tag: nullableString(toolkit.tag),
            resolvedTag: nullableString(toolkit.resolvedTag),
        };
    }
    const legacy = await readJsonIfExists(path.join(dir, LEGACY_LAZY_SOURCE_MARKER));
    if (isRecord(legacy) && typeof legacy.repo === "string") {
        return { kind: "legacy-lazy", repo: legacy.repo, tag: nullableString(legacy.tag) };
    }
    return null;
}

export async function writeSourceMarker(dir: string, input: SourceMarkerInput): Promise<void> {
    const record = {
        owner: TOOLKIT_MARKER_OWNER,
        version: MARKER_VERSION,
        repo: input.repo,
        tag: input.tag,
        resolvedTag: input.resolvedTag,
        method: input.method,
        fetchedAt: new Date().toISOString(),
    };
    await writeFile(path.join(dir, TOOLKIT_SOURCE_MARKER), JSON.stringify(record, null, 4) + "\n", "utf8");
}

export interface PreparedPluginMarker {
    id: string;
    /** 元のプロジェクト root（manifest.json の親 folder）。coverage がソースを探す基準にする。 */
    projectRoot: string;
    files: string[];
}

export function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

// manifest の id と version が空でない文字列であることを確かめる。ここを通らない manifest は plugin として使えない。
export async function readManifestIdentity(file: string): Promise<{ id: string; version: string }> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
        throw new Error("manifest.json is not readable JSON (" + file + "): " + errorMessage(error));
    }
    const record: Record<string, unknown> = isRecord(parsed) ? parsed : {};
    const id = record.id;
    const version = record.version;
    if (!isNonEmptyString(id) || !isNonEmptyString(version)) {
        throw new Error("manifest.json must contain string id and version: " + file);
    }
    return { id, version };
}

// marker が無ければ null。marker があるのに壊れている場合は、置き換えや coverage の判断を止めるため例外にする。
export async function readPreparedPluginMarker(dir: string): Promise<PreparedPluginMarker | null> {
    const file = path.join(dir, PREPARED_PLUGIN_MARKER);
    let text: string;
    try {
        text = await readFile(file, "utf8");
    } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("prepared plugin marker is not valid JSON: " + file);
    }
    const record: Record<string, unknown> = isRecord(parsed) ? parsed : {};
    const id = record.id;
    const projectRoot = record.projectRoot;
    const owned = record.owner === TOOLKIT_MARKER_OWNER && record.kind === "prepared-plugin";
    if (!owned || !isNonEmptyString(id) || !isNonEmptyString(projectRoot) || !path.isAbsolute(projectRoot)) {
        throw new Error("invalid prepared plugin marker (requires id and an absolute projectRoot): " + file);
    }
    const files = Array.isArray(record.files)
        ? record.files.filter((name): name is string => typeof name === "string")
        : [];
    return { id, projectRoot, files };
}

// 親が source の内側にある dest を指していると、置き換え時に source を消すため拒否する。
export function isSameOrInside(child: string, parent: string): boolean {
    const relative = path.relative(parent, child);
    if (relative === "") return true;
    return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export function assertUsableDirectory(dest: string): void {
    if (path.dirname(dest) === dest || path.basename(dest) === "") {
        throw new Error("refusing to use a filesystem root as a plugin directory: " + dest);
    }
}

// 同じ親 dir に作る一時 path。promote で rename できるよう同じ volume に置く。
export function tempSiblingPath(dest: string, label: string): string {
    return path.join(path.dirname(dest), path.basename(dest) + "." + label + "-" + randomBytes(6).toString("hex"));
}

async function lstatIfExists(file: string): Promise<Stats | null> {
    try {
        return await lstat(file);
    } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
    }
}

export async function inspectDestination(dest: string): Promise<DestinationInspection> {
    const info = await lstatIfExists(dest);
    if (info === null) return { state: "absent", entries: [] };
    if (info.isSymbolicLink()) throw new Error("refusing to replace a symbolic link: " + dest);
    if (!info.isDirectory()) throw new Error("destination exists and is not a directory: " + dest);
    const entries = await readdir(dest);
    return { state: entries.length === 0 ? "empty" : "populated", entries };
}

export async function removeTempDirectory(temp: string, dest: string, label: string): Promise<void> {
    const prefix = path.basename(dest) + "." + label + "-";
    if (path.dirname(temp) !== path.dirname(dest) || !path.basename(temp).startsWith(prefix)) {
        throw new Error("refusing to remove an unexpected path: " + temp);
    }
    await rm(temp, { recursive: true, force: true });
}

// staging を dest に置き換える。既存 dest は backup に退避し、失敗時は戻す。
export async function promoteDirectory(staging: string, dest: string): Promise<void> {
    const hadDestination = (await lstatIfExists(dest)) !== null;
    const backup = tempSiblingPath(dest, "previous");
    if (hadDestination) await rename(dest, backup);
    try {
        await rename(staging, dest);
    } catch (error) {
        if (hadDestination) {
            await rename(backup, dest).catch((restoreError: unknown) => {
                logger.error("could not restore " + dest + " from " + backup + ": " + errorMessage(restoreError));
            });
        }
        throw error;
    }
    if (hadDestination) {
        await removeTempDirectory(backup, dest, "previous").catch((cleanupError: unknown) => {
            logger.warn("could not remove previous copy " + backup + ": " + errorMessage(cleanupError));
        });
    }
}
