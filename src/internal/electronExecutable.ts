import { statSync } from "node:fs";
import { createRequire } from "node:module";

/** Electron 自身の解決処理で遅延ダウンロードを済ませ、実際に起動するファイルを返す。 */
export function resolveElectronExecutable(from: string | URL = import.meta.url): string {
    try {
        // 意図: dist の事前チェックや GUI の起動ではなく、Electron の標準の準備処理を使う。
        // ELECTRON_OVERRIDE_DIST_PATH もこの解決処理が扱う。
        const executable: unknown = createRequire(from)("electron");
        if (typeof executable !== "string" || !statSync(executable).isFile()) {
            throw new Error("electron did not return an executable file path");
        }
        return executable;
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error("Could not prepare Electron executable: " + detail, { cause: error });
    }
}
