import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSource } from "./support/load-source.mjs";

const { preparePlugin } = await loadSource("preparePlugin.ts");

async function workspace(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-prepare-plugin-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    const build = path.join(root, "build");
    await mkdir(build, { recursive: true });
    return { root, build, dest: path.join(root, "out", "plugin") };
}

async function writeBuild(build, { id = "sample", manifest, main = "console.log(1);", styles, map } = {}) {
    const manifestPath = path.join(build, "manifest.json");
    const mainPath = path.join(build, "main.js");
    await writeFile(manifestPath, manifest ?? JSON.stringify({ id, name: "Sample", version: "1.0.0", minAppVersion: "1.0.0" }));
    await writeFile(mainPath, main);
    const input = { manifest: manifestPath, main: mainPath };
    if (styles !== undefined) {
        input.styles = path.join(build, "styles.css");
        await writeFile(input.styles, styles);
    }
    if (map !== undefined) {
        input.sourceMap = path.join(build, "main.js.map");
        await writeFile(input.sourceMap, map);
    }
    return input;
}

test("copies the artifacts into one folder under the Obsidian file names", async (t) => {
    const { build, dest } = await workspace(t);
    const map = JSON.stringify({ version: 3, sources: ["main.ts"], sourcesContent: ["export {};"], names: [], mappings: "" });
    const input = await writeBuild(build, { styles: "a {}", map });
    assert.equal(await preparePlugin(input, dest), dest);
    const names = (await readdir(dest)).sort();
    assert.deepEqual(names, [".obsidian-e2e-prepared-plugin.json", "main.js", "main.js.map", "manifest.json", "styles.css"]);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "console.log(1);\n//# sourceMappingURL=main.js.map\n");
    const rebased = JSON.parse(await readFile(path.join(dest, "main.js.map"), "utf8"));
    assert.ok(rebased.sources[0].startsWith("file:"), "sources become absolute file URLs");
    assert.equal(rebased.sourceRoot, undefined);
});

test("styles.css and the source map are optional", async (t) => {
    const { build, dest } = await workspace(t);
    await preparePlugin(await writeBuild(build), dest);
    assert.deepEqual((await readdir(dest)).sort(), [".obsidian-e2e-prepared-plugin.json", "main.js", "manifest.json"]);
});

test("a toolkit-prepared folder is replaced without leftover staging or backup folders", async (t) => {
    const { root, build, dest } = await workspace(t);
    await preparePlugin(await writeBuild(build, { main: "old" }), dest);
    await preparePlugin(await writeBuild(build, { main: "new" }), dest);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "new");
    assert.deepEqual(await readdir(path.join(root, "out")), ["plugin"]);
});

test("the palette layout without a marker is migrated", async (t) => {
    const { build, dest } = await workspace(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "manifest.json"), "{\"id\":\"old\"}");
    await writeFile(path.join(dest, "main.js"), "old main");
    await writeFile(path.join(dest, "styles.css"), "old styles");
    await preparePlugin(await writeBuild(build, { main: "new main" }), dest);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "new main");
    assert.equal(existsSync(path.join(dest, "styles.css")), false);
});

test("an unmarked folder that contains unknown files is never replaced", async (t) => {
    const { build, dest } = await workspace(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "notes.txt"), "keep me");
    await writeFile(path.join(dest, "main.js"), "old main");
    await assert.rejects(preparePlugin(await writeBuild(build), dest), /notes\.txt/);
    assert.equal(await readFile(path.join(dest, "notes.txt"), "utf8"), "keep me");
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "old main");
});

test("a manifest without id is rejected before the destination is touched", async (t) => {
    const { build, dest } = await workspace(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "main.js"), "old main");
    const input = await writeBuild(build, { manifest: "{\"version\":\"1.0.0\"}" });
    await assert.rejects(preparePlugin(input, dest), /must contain string id and version/);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "old main");
});

test("an empty main.js is rejected", async (t) => {
    const { build, dest } = await workspace(t);
    await assert.rejects(preparePlugin(await writeBuild(build, { main: "" }), dest), /main is empty/);
    assert.equal(existsSync(path.join(dest, "main.js")), false);
});

test("a destination that contains a source file is refused", async (t) => {
    const { build } = await workspace(t);
    const input = await writeBuild(build);
    await assert.rejects(preparePlugin(input, build), /contains the source file/);
    assert.equal(await readFile(input.main, "utf8"), "console.log(1);");
});

test("the manifest id does not have to match the destination folder name", async (t) => {
    const { root, build } = await workspace(t);
    const dest = path.join(root, "out", "graph-analysis");
    await preparePlugin(await writeBuild(build, { id: "graph-analysis-ex" }), dest);
    const manifest = JSON.parse(await readFile(path.join(dest, "manifest.json"), "utf8"));
    assert.equal(manifest.id, "graph-analysis-ex");
});
