import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { build, transform } from "esbuild";

const cacheRoot = path.resolve(fileURLToPath(new URL("../node_modules/.cache/", import.meta.url)));
await mkdir(cacheRoot, { recursive: true });
const temporary = await mkdtemp(path.join(cacheRoot, "coverage-tests-"));
const modulePath = path.join(temporary, "module.mjs");
await build({
    stdin: {
        contents: 'export * from "./src/coverage.ts"; export * from "./src/internal/coverage/collector.ts"; export * from "./src/internal/coverage/targets.ts"; export * from "./src/internal/coverage/merge.ts";',
        resolveDir: fileURLToPath(new URL("..", import.meta.url)),
    },
    bundle: true, packages: "external", platform: "node", format: "esm", outfile: modulePath,
});
const { PluginCoverageCollector, readCoverageTarget, generateCoverageReport, mergeCoverageReports, resetCoverageOutput, CoverageReporter, mergeIstanbulCoverage } = await import(pathToFileURL(modulePath).href);
test.after(async () => {
    assert.equal(path.dirname(temporary), cacheRoot);
    await rm(temporary, { recursive: true, force: true });
});

async function plugin(t, id = "coverage-fixture", external = false) {
    const root = await mkdtemp(path.join(temporary, "plugin-"));
    const sourcePath = path.join(root, "src/plugin.ts");
    const source = "function positive(): number { return 1; }\nfunction negative(): number { return -1; }\npositive(); negative();\n";
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, source);
    await writeFile(path.join(root, "manifest.json"), JSON.stringify({ id }));
    const transformed = await transform(source, { sourcefile: sourcePath, loader: "ts", sourcemap: external ? "external" : "inline" });
    await writeFile(path.join(root, "main.js"), transformed.code);
    if (external) await writeFile(path.join(root, "main.js.map"), transformed.map);
    return { root, sourcePath, target: await readCoverageTarget(root) };
}

function entry(target, executed = ["positive", "negative"]) {
    const prefix = "(function anonymous(require,module,exports){";
    const { code } = target;
    return {
        url: `plugin:${target.pluginId}`,
        source: `${prefix}${code}\n})\n//# sourceURL=plugin:${target.pluginId}\n`,
        functions: [
            { functionName: "", isBlockCoverage: true, ranges: [{ startOffset: prefix.length, endOffset: prefix.length + code.length, count: 1 }] },
            ...["positive", "negative"].map((name) => {
                const start = code.indexOf(`function ${name}`);
                return { functionName: name, isBlockCoverage: true, ranges: [{ startOffset: prefix.length + start, endOffset: prefix.length + code.indexOf("}", start) + 1, count: executed.includes(name) ? 1 : 0 }] };
            }),
        ],
    };
}

function page(entries) {
    let starts = 0;
    let stops = 0;
    return {
        coverage: {
            startJSCoverage: async () => { starts++; },
            stopJSCoverage: async () => { stops++; return entries; },
        },
        isClosed: () => false,
        counts: () => ({ starts, stops }),
    };
}

test("collects once before close and keeps independent worker/retry files", async (t) => {
    const { root, target, sourcePath } = await plugin(t);
    const outputDir = path.join(temporary, "parallel");
    const pages = [page([entry(target), { ...entry(target), url: "plugin:unrelated" }]), page([entry(target)])];
    const paths = await Promise.all(pages.map(async (renderer, index) => {
        const collector = await PluginCoverageCollector.create({ pluginPaths: [root], outputDir }, []);
        await collector.start(renderer);
        await collector.start(renderer);
        await collector.collect(renderer);
        await collector.collect(renderer);
        return collector.save(`worker-${index}`);
    }));
    assert.notEqual(paths[0], paths[1]);
    for (const renderer of pages) assert.deepEqual(renderer.counts(), { starts: 1, stops: 1 });
    for (const filename of paths) assert.equal(JSON.parse(await readFile(filename, "utf8")).entries.length, 1);
    // Reporting uses the captured build even after a release build replaces main.js.
    await writeFile(path.join(root, "main.js"), "production without source maps");
    await rm(sourcePath);
    const summary = await generateCoverageReport({ outputDir, reporters: ["html", "lcov", "json"] });
    assert.equal(summary.functions.pct, 100);
    const report = JSON.parse(await readFile(path.join(outputDir, "coverage-final.json"), "utf8"));
    assert.deepEqual(Object.keys(report), [sourcePath]);
    assert.deepEqual(Object.values(report[sourcePath].f), [2, 2]);
    for (const name of ["index.html", "lcov.info"]) assert.ok((await readFile(path.join(outputDir, name), "utf8")).length);
});

test("supports external source maps and fallback plugin paths", async (t) => {
    const { root, target } = await plugin(t, "external-fixture", true);
    const outputDir = path.join(temporary, "external");
    const collector = await PluginCoverageCollector.create({ outputDir }, [root]);
    await collector.start(page([entry(target)]));
    await collector.save("external");
    assert.equal((await generateCoverageReport({ outputDir, reporters: ["json"] })).functions.pct, 100);
});

test("reports a configured but unexecuted plugin as zero coverage", async (t) => {
    const { root } = await plugin(t);
    const outputDir = path.join(temporary, "unexecuted");
    const collector = await PluginCoverageCollector.create({ pluginPaths: [root], outputDir }, []);
    await collector.save("no-plugin");
    const summary = await generateCoverageReport({ outputDir, reporters: ["json"] });
    assert.ok(summary.lines.total > 0);
    assert.equal(summary.lines.pct, 0);
    assert.equal(summary.functions.pct, 0);
});

test("merges complementary unit/E2E coverage by source location", async (t) => {
    const { root, target } = await plugin(t);
    const inputFiles = [];
    for (const name of ["positive", "negative"]) {
        const outputDir = path.join(temporary, name);
        const collector = await PluginCoverageCollector.create({ pluginPaths: [root], outputDir }, []);
        await collector.start(page([entry(target, [name])]));
        await collector.save(name);
        const summary = await generateCoverageReport({ outputDir, reporters: ["json"] });
        assert.equal(summary.functions.pct, 50);
        inputFiles.push(path.join(outputDir, "coverage-final.json"));
    }
    const summary = await mergeCoverageReports({ inputFiles, outputDir: path.join(temporary, "combined"), reporters: ["json"] });
    assert.equal(summary.functions.total, 2);
    assert.equal(summary.functions.pct, 100);
});

test("reports missing maps, duplicate plugin IDs, and mismatched runtime source", async (t) => {
    const first = await plugin(t);
    const second = await plugin(t);
    await assert.rejects(PluginCoverageCollector.create({ pluginPaths: [first.root, second.root] }, []), /duplicate plugin ids/);
    await assert.rejects(PluginCoverageCollector.create({}, []), /requires pluginPaths/);
    await writeFile(path.join(second.root, "main.js"), "no map");
    await assert.rejects(readCoverageTarget(second.root), /requires a source map/);
    const outputDir = path.join(temporary, "mismatched");
    const collector = await PluginCoverageCollector.create({ outputDir }, [first.root]);
    await collector.start(page([{ ...entry(first.target), source: "different build" }]));
    await collector.save("mismatch");
    await assert.rejects(generateCoverageReport({ outputDir, reporters: ["json"] }), /does not match the captured bundle/);
});

test("reset removes raw results and preserves unrelated files", async () => {
    const outputDir = path.join(temporary, "reset");
    await mkdir(path.join(outputDir, "raw"), { recursive: true });
    await writeFile(path.join(outputDir, "keep.txt"), "keep");
    await writeFile(path.join(outputDir, "raw/stale.json"), "{}");
    await resetCoverageOutput(outputDir);
    assert.equal(await readFile(path.join(outputDir, "keep.txt"), "utf8"), "keep");
    await assert.rejects(readFile(path.join(outputDir, "raw/stale.json")), { code: "ENOENT" });
});

test("reporter fails a passing run when collection is missing and can be disabled", async (t) => {
    t.mock.method(console, "error", () => {});
    const reporter = new CoverageReporter({ outputDir: path.join(temporary, "missing") });
    assert.deepEqual(await reporter.onEnd({ status: "passed" }), { status: "failed" });
    const disabled = new CoverageReporter({ enabled: false });
    assert.equal(await disabled.onEnd({ status: "passed" }), undefined);
});

test("retains branch locations and extra arms when only the first arm matches", () => {
    const filename = path.join(temporary, "branch-fixture.ts");
    const location = (column) => ({ start: { line: 1, column }, end: { line: 1, column: column + 1 } });
    const file = (columns, counts) => ({
        [filename]: {
            path: filename, statementMap: {}, fnMap: {}, s: {}, f: {},
            branchMap: { 0: { type: "binary-expr", line: 1, loc: location(0), locations: columns.map(location) } },
            b: { 0: counts },
        },
    });
    const first = file([0, 2], [1, 0]);
    const second = file([0, 4, 6], [0, 2, 3]);
    const inputBefore = JSON.stringify([first, second]);
    const merged = mergeIstanbulCoverage([first, second, second]).fileCoverageFor(filename).toJSON();
    assert.deepEqual(Object.values(merged.b), [[1, 0], [0, 4, 6]]);
    assert.deepEqual(Object.values(merged.branchMap).map((branch) => branch.locations), [[location(0), location(2)], [location(0), location(4), location(6)]]);
    assert.equal(JSON.stringify([first, second]), inputBefore);
});
