import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { loadSource } from "./support/load-source.mjs";

const { preparePlugin } = await loadSource("preparePlugin.ts");
const { readCoverageTarget } = await loadSource("internal/coverage/targets.ts");
const { generateCoverageReport } = await loadSource("coverage.ts");

const SOURCE = [
    "const plugin: { add(a: number, b: number): number } = {",
    "    add(a: number, b: number): number {",
    "        return a + b;",
    "    },",
    "};",
    "",
    "module.exports = plugin;",
    "",
].join("\n");

async function tempRoot(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-prepared-coverage-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    return root;
}

// esbuild の sourcemap は、"external" が参照を書かず、"linked" は参照を書き、"inline" は data: URL に埋め込む。
async function createProject(root, sourcemap) {
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(path.join(root, "src", "main.ts"), SOURCE);
    await writeFile(
        path.join(root, "manifest.json"),
        JSON.stringify({ id: "coverage-fixture", name: "Coverage Fixture", version: "1.0.0", minAppVersion: "1.0.0" }),
    );
    await build({
        entryPoints: [path.join(root, "src", "main.ts")],
        outfile: path.join(root, "dist", "main.js"),
        bundle: true,
        format: "cjs",
        platform: "neutral",
        sourcemap,
        write: true,
        logLevel: "silent",
    });
    return path.join(root, "dist", "main.js");
}

function inputFor(root, main, sourceMap) {
    const input = { manifest: path.join(root, "manifest.json"), main };
    if (sourceMap !== undefined) input.sourceMap = sourceMap;
    return input;
}

// 測定結果を V8 coverage と同じ形で1件作り、lcov まで生成する。実行はしないので、関数全体を1回実行済みとみなす。
async function reportFor(root, pluginDir) {
    const target = await readCoverageTarget(pluginDir);
    const source = "(function (exports, require, module) {\n" + target.code + "\n})";
    const outputDir = path.join(root, "coverage");
    await mkdir(path.join(outputDir, "raw"), { recursive: true });
    const entry = {
        url: "plugin:" + target.pluginId,
        scriptId: "1",
        source,
        functions: [
            { functionName: "", isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }] },
        ],
    };
    await writeFile(
        path.join(outputDir, "raw", "run.json"),
        JSON.stringify({ version: 1, targets: [target], entries: [entry] }),
    );
    await generateCoverageReport({ outputDir, reporters: ["lcov"] });
    return { target, lcov: await readFile(path.join(outputDir, "lcov.info"), "utf8") };
}

function recordFor(lcov, file) {
    const wanted = path.resolve(file);
    return (
        lcov.split("end_of_record").find((record) =>
            record.split("\n").some((line) => line.startsWith("SF:") && path.resolve(line.slice(3)) === wanted),
        ) ?? null
    );
}

test("an explicit sidecar map gets a sourceMappingURL and keeps project sources in the coverage report", async (t) => {
    const root = await tempRoot(t);
    const main = await createProject(root, "external");
    const staged = path.join(root, "staged", "plugin");
    await preparePlugin(inputFor(root, main, main + ".map"), staged);

    assert.match(await readFile(path.join(staged, "main.js"), "utf8"), /\/\/# sourceMappingURL=main\.js\.map\n$/);
    const marker = JSON.parse(await readFile(path.join(staged, ".obsidian-e2e-prepared-plugin.json"), "utf8"));
    assert.equal(marker.projectRoot, root);

    const { target, lcov } = await reportFor(root, staged);
    assert.equal(target.root, root, "coverage measures against the project folder, not the staged copy");
    const record = recordFor(lcov, path.join(root, "src", "main.ts"));
    assert.ok(record, "src/main.ts must appear in the lcov report");
    assert.match(record, /^DA:\d+,1$/m, "mapped project lines are counted as executed");
});

test("a sourceMappingURL sidecar is found without passing sourceMap", async (t) => {
    const root = await tempRoot(t);
    const main = await createProject(root, "linked");
    assert.match(await readFile(main, "utf8"), /sourceMappingURL=main\.js\.map/, "the bundle really references its map");
    const staged = path.join(root, "staged", "plugin");
    await preparePlugin(inputFor(root, main), staged);

    assert.equal(existsSync(path.join(staged, "main.js.map")), true);
    const { lcov } = await reportFor(root, staged);
    assert.ok(recordFor(lcov, path.join(root, "src", "main.ts")), "src/main.ts must appear in the lcov report");
});

test("an inline source map is rebased inside the prepared main.js", async (t) => {
    const root = await tempRoot(t);
    const main = await createProject(root, "inline");
    const staged = path.join(root, "staged", "plugin");
    await preparePlugin(inputFor(root, main), staged);

    assert.equal(existsSync(path.join(staged, "main.js.map")), false);
    const bundle = await readFile(path.join(staged, "main.js"), "utf8");
    const encoded = bundle.match(/sourceMappingURL=data:application\/json;base64,([^\r\n]+)$/m)[1];
    const inline = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    assert.ok(inline.sources.length > 0);
    assert.ok(inline.sources.every((source) => source.startsWith("file:")), "inline sources become absolute file URLs");

    const { lcov } = await reportFor(root, staged);
    assert.ok(recordFor(lcov, path.join(root, "src", "main.ts")), "src/main.ts must appear in the lcov report");
});

test("a sourceMappingURL that points at a missing map is rejected", async (t) => {
    const root = await tempRoot(t);
    const main = await createProject(root, "linked");
    assert.match(await readFile(main, "utf8"), /sourceMappingURL=main\.js\.map/, "the bundle really references its map");
    await rm(main + ".map");
    const staged = path.join(root, "staged", "plugin");

    await assert.rejects(preparePlugin(inputFor(root, main), staged), /source map that does not exist/);
    assert.equal(existsSync(staged), false);
});

test("a prepared map that points at a missing source is rejected", async (t) => {
    const root = await tempRoot(t);
    const main = await createProject(root, "external");
    const mapPath = main + ".map";
    const map = JSON.parse(await readFile(mapPath, "utf8"));
    map.sourcesContent = [null];
    await writeFile(mapPath, JSON.stringify(map));
    await rm(path.join(root, "src", "main.ts"));
    const staged = path.join(root, "staged", "plugin");

    await assert.rejects(preparePlugin(inputFor(root, main, mapPath), staged), /missing source/);
    assert.equal(existsSync(staged), false);
});
