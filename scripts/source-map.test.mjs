import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { loadSource } from "./support/load-source.mjs";

const { rebaseSourceMap } = await loadSource("internal/sourceMap.ts");

const DIST = path.resolve("repo", "dist");
const WINDOWS_ONLY = { skip: process.platform !== "win32" };

function rebase(sources, baseDir, extra = {}) {
    const text = JSON.stringify({ version: 3, sources, sourcesContent: sources.map(() => "x"), names: [], mappings: "", ...extra });
    return JSON.parse(rebaseSourceMap(text, baseDir, "test.map"));
}

test("a relative source is resolved against the map's folder and becomes a file URL", () => {
    const map = rebase(["../src/main.ts"], DIST);
    assert.deepEqual(map.sources, [pathToFileURL(path.resolve(DIST, "../src/main.ts")).href]);
});

test("sourceRoot is applied to relative sources and then removed", () => {
    const map = rebase(["main.ts"], DIST, { sourceRoot: "../src" });
    assert.deepEqual(map.sources, [pathToFileURL(path.resolve(DIST, "../src", "main.ts")).href]);
    assert.equal(map.sourceRoot, undefined);
});

test("sourcesContent and mappings are kept as they were", () => {
    const map = rebase(["../src/main.ts"], DIST);
    assert.deepEqual(map.sourcesContent, ["x"]);
    assert.equal(map.mappings, "");
});

test("an absolute source ignores sourceRoot", () => {
    const absolute = path.resolve("/abs/src/main.ts");
    const map = rebase([absolute], DIST, { sourceRoot: "../other" });
    assert.deepEqual(map.sources, [pathToFileURL(absolute).href]);
});

test("a file: URL source is kept unchanged", () => {
    const url = "file:///V:/repo/src/main.ts";
    assert.deepEqual(rebase([url], DIST).sources, [url]);
});

test("a Windows drive path with backslashes stays an absolute file URL", WINDOWS_ONLY, () => {
    const map = rebase(["V:\\repo\\src\\main.ts"], DIST, { sourceRoot: "../other" });
    assert.deepEqual(map.sources, ["file:///V:/repo/src/main.ts"]);
});

test("a Windows drive path with forward slashes stays an absolute file URL", WINDOWS_ONLY, () => {
    assert.deepEqual(rebase(["V:/repo/src/main.ts"], DIST).sources, ["file:///V:/repo/src/main.ts"]);
});

test("an absolute sourceRoot with a drive letter joins relative sources", WINDOWS_ONLY, () => {
    assert.deepEqual(rebase(["main.ts"], DIST, { sourceRoot: "V:/repo/src/" }).sources, ["file:///V:/repo/src/main.ts"]);
});

test("other URL schemes are rejected", () => {
    assert.throws(() => rebase(["webpack://pkg/src/main.ts"], DIST), /unsupported source map source/);
});
