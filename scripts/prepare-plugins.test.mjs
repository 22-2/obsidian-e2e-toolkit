import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeGitHub } from "./support/fake-github.mjs";
import { loadSource } from "./support/load-source.mjs";

const { preparePlugins } = await loadSource("preparePlugins.ts");

const GOOD_API = "https://api.github.com/repos/example/good";
const BROKEN_API = "https://api.github.com/repos/example/broken";
const GOOD_MANIFEST = "{\"id\":\"good\",\"version\":\"1.0.0\"}";

async function tempRoot(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-prepare-plugins-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    return root;
}

test("placed plugins are returned, and every failure is reported in one error", async (t) => {
    const root = await tempRoot(t);
    const gh = createFakeGitHub(t);
    gh.publish(GOOD_API, "1.0.0", { "main.js": "good main", "manifest.json": GOOD_MANIFEST });
    gh.publish(BROKEN_API, "1.0.0", { "main.js": "broken main" });
    const sources = {
        good: { repo: "example/good", tag: "1.0.0" },
        broken: { repo: "example/broken", tag: "1.0.0" },
    };
    await assert.rejects(preparePlugins(sources, root, { fallbackToGit: false }), (error) => {
        assert.match(error.message, /^Failed to prepare external plugins:\n- broken: failed to download manifest\.json \(404\)/);
        assert.doesNotMatch(error.message, /- good:/);
        return true;
    });
    assert.equal(await readFile(path.join(root, "myfiles", "good", "main.js"), "utf8"), "good main");
});

test("success returns the placement of each plugin keyed by folder name", async (t) => {
    const root = await tempRoot(t);
    const gh = createFakeGitHub(t);
    gh.publish(GOOD_API, "1.0.0", { "main.js": "good main", "manifest.json": GOOD_MANIFEST });
    const prepared = await preparePlugins({ good: { repo: "example/good", tag: "1.0.0" } }, root, { fallbackToGit: false });
    assert.deepEqual(prepared, { good: path.join(root, "myfiles", "good") });
});

test("a folder key that is not a plain name is rejected before any request", async (t) => {
    const root = await tempRoot(t);
    const gh = createFakeGitHub(t);
    await assert.rejects(preparePlugins({ "../escape": "example/good" }, root), /plugin key must be a folder name/);
    assert.equal(gh.requests.length, 0);
});

test("destDir must stay inside baseDir", async (t) => {
    const root = await tempRoot(t);
    await assert.rejects(preparePlugins({}, root, { destDir: ".." }), /destDir must be a directory inside baseDir/);
});
