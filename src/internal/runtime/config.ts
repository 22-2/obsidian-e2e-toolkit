import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

/** root の内側にある相対パスだけを解決する。絶対パスや root の外へ出る指定は例外にする。 */
export function resolveInside(root: string, relativePath: string): string {
    if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath)) {
        throw new Error(`Config path must be relative to the config directory: ${relativePath}`);
    }
    const resolved = path.resolve(root, relativePath);
    if (!isStrictlyInside(root, resolved)) {
        throw new Error(`Config path escapes the config directory: ${relativePath}`);
    }
    return resolved;
}

export function isStrictlyInside(root: string, candidate: string): boolean {
    const relative = path.relative(root, candidate);
    if (relative === "" || path.isAbsolute(relative)) {
        return false;
    }
    return relative !== ".." && !relative.startsWith(`..${path.sep}`);
}

/** JSON を読む。symlink を解決した実体が root の外にあれば拒否する。 */
export async function readJsonInside<T>(root: string, relativePath: string): Promise<T> {
    const target = resolveInside(root, relativePath);
    const realRoot = await realpath(root);

    let realTarget: string;
    try {
        realTarget = await realpath(target);
    } catch (error) {
        throw new Error(`Config file cannot be read: ${target}`, { cause: error });
    }
    if (!isStrictlyInside(realRoot, realTarget)) {
        throw new Error(`Config file resolves outside the config directory: ${target}`);
    }
    return JSON.parse(await readFile(realTarget, "utf8")) as T;
}
