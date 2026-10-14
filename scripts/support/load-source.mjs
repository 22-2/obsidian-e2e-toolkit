import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

// テスト用に src の TypeScript を1ファイルへ bundle する。npm パッケージは bundle せず外部のまま読む。
// istanbul のように動的 require や __dirname を使うパッケージを、通常の Node モジュールとして動かすため。
// 出力は gitignore 対象の coverage/ 配下に置き、パッケージ解決を実際の依存関係と一致させる。
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const bundleDirectory = path.join(repoRoot, "coverage", "test-bundles");

export async function loadSource(relativePath) {
    const entry = fileURLToPath(new URL("../../src/" + relativePath, import.meta.url));
    const name = relativePath.replace(/\.ts$/, "").replaceAll("/", "-");
    await mkdir(bundleDirectory, { recursive: true });
    // プロセスごとに別名にし、並列に動く test file が同じ出力を書き換えないようにする。
    const outfile = path.join(bundleDirectory, process.pid + "-" + name + ".mjs");
    await build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        packages: "external",
        platform: "node",
        format: "esm",
        logLevel: "silent",
    });
    try {
        return await import(pathToFileURL(outfile).href);
    } finally {
        await rm(outfile, { force: true });
    }
}
