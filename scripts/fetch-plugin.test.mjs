import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeGitHub } from "./support/fake-github.mjs";
import { loadSource } from "./support/load-source.mjs";

const {
    buildCloneArgs,
    childEnvironment,
    fetchPlugin,
    normalizePluginSource,
    parseGitHubRepo,
    resolvePnpmInvocation,
} = await loadSource("fetchPlugin.ts");

const API = "https://api.github.com/repos/example/plugin";
const REPO = "example/plugin";
const MANIFEST = JSON.stringify({ id: "plugin", name: "Plugin", version: "1.0.0" });

async function tempPlugin(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-fetch-plugin-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    return { root, dest: path.join(root, "plugin") };
}

function setEnv(t, values) {
    const saved = {};
    for (const [key, value] of Object.entries(values)) {
        saved[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    t.after(() => {
        for (const [key, value] of Object.entries(saved)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

const tokenCases = [
    { name: "prefers GITHUB_TOKEN", env: { GITHUB_TOKEN: "github-test-token", GH_TOKEN: "gh-test-token" }, expected: "github-test-token" },
    { name: "falls back to GH_TOKEN", env: { GITHUB_TOKEN: "", GH_TOKEN: "gh-test-token" }, expected: "gh-test-token" },
    { name: "allows unauthenticated local usage", env: { GITHUB_TOKEN: undefined, GH_TOKEN: undefined }, expected: null },
];

for (const scenario of tokenCases) {
    test("release lookup " + scenario.name, async (t) => {
        const { dest } = await tempPlugin(t);
        setEnv(t, scenario.env);
        const gh = createFakeGitHub(t);
        const files = { "main.js": "module.exports = {};", "manifest.json": MANIFEST };
        gh.json(API + "/releases/latest", { tag_name: "2.0.0", assets: [] });
        gh.json(API + "/releases?per_page=20", [gh.publish(API, "1.0.0", files)]);

        await fetchPlugin("https://github.com/example/plugin.git", dest);

        assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), files["main.js"]);
        assert.equal(gh.requests.length, 4);
        for (const request of gh.requests.slice(0, 2)) {
            assert.equal(new URL(request.url).hostname, "api.github.com");
            assert.equal(request.headers.get("Authorization"), scenario.expected ? "Bearer " + scenario.expected : null);
            assert.equal(request.headers.get("Accept"), "application/vnd.github+json");
        }
        // 公開 asset の取得先には、API 用の token を送らない。
        for (const request of gh.requests.slice(2)) {
            assert.equal(request.headers.get("Authorization"), null);
        }
    });
}

test("a pinned tag installs the release and later reuses the copy without any GitHub request", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST });

    assert.equal(await fetchPlugin(REPO, dest, { tag: "1.0.0" }), dest);
    assert.equal(gh.requests.length, 3);
    assert.equal(existsSync(path.join(dest, "styles.css")), false);

    gh.reset();
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });
    assert.equal(gh.requests.length, 0);
});

test("latest is looked up every time, and the copy is replaced only when the resolved tag changes", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.json(API + "/releases/latest", gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST }));

    await fetchPlugin(REPO, dest);
    assert.equal(gh.requests.length, 3);

    gh.reset();
    await fetchPlugin(REPO, dest);
    assert.equal(gh.requests.length, 1, "only the latest lookup is repeated");

    gh.reset();
    gh.json(API + "/releases/latest", gh.publish(API, "1.1.0", { "main.js": "v2", "manifest.json": MANIFEST }));
    await fetchPlugin(REPO, dest);
    assert.equal(gh.requests.length, 3);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "v2");
});

test("a release without manifest.json is not treated as a success", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1" });
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "1.0.0" }), /main\.js and manifest\.json are required/);
    assert.equal(existsSync(dest), false);
});

test("a failed optional asset download fails the fetch and leaves no partial copy", async (t) => {
    const { root, dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    const release = gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST, "styles.css": "a {}" });
    gh.file(release.assets.find((asset) => asset.name === "styles.css").browser_download_url, "", 500);
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "1.0.0" }), /failed to download styles\.css \(500\)/);
    assert.equal(existsSync(dest), false);
    assert.deepEqual(await readdir(root), []);
});

test("a failed download keeps the previous copy and its marker", async (t) => {
    const { root, dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST });
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });

    const broken = gh.publish(API, "2.0.0", { "main.js": "v2", "manifest.json": MANIFEST });
    gh.file(broken.assets.find((asset) => asset.name === "manifest.json").browser_download_url, "", 500);
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "2.0.0" }), /failed to download manifest\.json/);

    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "v1");
    const marker = JSON.parse(await readFile(path.join(dest, ".obsidian-e2e-plugin-source.json"), "utf8"));
    assert.equal(marker.tag, "1.0.0");
    assert.deepEqual(await readdir(root), ["plugin"]);
});

test("an unowned non-empty folder is never replaced", async (t) => {
    const { dest } = await tempPlugin(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, "notes.txt"), "keep me");
    const gh = createFakeGitHub(t);
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "1.0.0" }), /refusing to replace/);
    assert.equal(gh.requests.length, 0);
    assert.equal(await readFile(path.join(dest, "notes.txt"), "utf8"), "keep me");
});

test("an owned copy with a missing main.js is fetched again", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST });
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });
    await rm(path.join(dest, "main.js"));

    gh.reset();
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });
    assert.ok(gh.requests.length > 0);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "v1");
});

test("a legacy lazy marker with the same tag is adopted without downloading", async (t) => {
    const { dest } = await tempPlugin(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, ".lazy-plugin-source.json"), JSON.stringify({ repo: REPO, tag: "1.0.0" }));
    await writeFile(path.join(dest, "main.js"), "legacy main");
    await writeFile(path.join(dest, "manifest.json"), MANIFEST);
    const gh = createFakeGitHub(t);

    await fetchPlugin(REPO, dest, { tag: "1.0.0" });

    assert.equal(gh.requests.length, 0);
    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "legacy main");
    assert.equal(existsSync(path.join(dest, ".lazy-plugin-source.json")), true);
    const marker = JSON.parse(await readFile(path.join(dest, ".obsidian-e2e-plugin-source.json"), "utf8"));
    assert.equal(marker.owner, "obsidian-e2e-toolkit");
    assert.equal(marker.tag, "1.0.0");
});

test("a legacy lazy marker with another tag is replaced by the requested release", async (t) => {
    const { dest } = await tempPlugin(t);
    await mkdir(dest, { recursive: true });
    await writeFile(path.join(dest, ".lazy-plugin-source.json"), JSON.stringify({ repo: REPO, tag: "0.9.0" }));
    await writeFile(path.join(dest, "main.js"), "old main");
    await writeFile(path.join(dest, "manifest.json"), MANIFEST);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "new main", "manifest.json": MANIFEST });

    await fetchPlugin(REPO, dest, { tag: "1.0.0" });

    assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "new main");
});

test("a release lookup failure is an error when git fallback is not allowed", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.file(API + "/releases/tags/1.0.0", "boom", 500);
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "1.0.0" }), /GitHub release lookup failed \(500\)/);
    assert.equal(existsSync(dest), false);
});

test("unsupported repos and option-like tags are rejected before any request", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    await assert.rejects(fetchPlugin("https://gitlab.example/a/b", dest), /Unsupported repo url/);
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "--upload-pack=x" }), /invalid release tag/);
    assert.equal(gh.requests.length, 0);
});

test("repo forms are normalized and unsupported forms are rejected", () => {
    assert.deepEqual(parseGitHubRepo("https://github.com/a/b.git"), { owner: "a", name: "b" });
    assert.deepEqual(parseGitHubRepo("git@github.com:a/b.git"), { owner: "a", name: "b" });
    assert.deepEqual(parseGitHubRepo("a/b"), { owner: "a", name: "b" });
    for (const bad of ["https://gitlab.com/a/b", "a/b/c", "-x/y", "https://github.com/a/.."]) {
        assert.throws(() => parseGitHubRepo(bad), /Unsupported repo url/);
    }
});

test("plugin sources accept a repo string or a repo with a tag", () => {
    assert.deepEqual(normalizePluginSource("a/b"), { repo: "a/b" });
    assert.deepEqual(normalizePluginSource({ repo: "a/b", tag: "1.0.0" }), { repo: "a/b", tag: "1.0.0" });
    assert.throws(() => normalizePluginSource({ repo: "" }), TypeError);
    assert.throws(() => normalizePluginSource({ repo: "a/b", tag: "" }), TypeError);
});

test("pnpm runs through node when npm_execpath points at the pnpm entry", () => {
    const entry = "C:\\pnpm\\dist\\pnpm.cjs";
    assert.deepEqual(resolvePnpmInvocation(["run", "build"], { npm_execpath: entry }, "win32"), {
        command: process.execPath,
        args: [entry, "run", "build"],
        shell: false,
    });
});

test("another package manager's entry is ignored in favor of pnpm", () => {
    const spec = resolvePnpmInvocation(["install"], { npm_execpath: "C:\\npm\\bin\\npm-cli.js" }, "win32");
    assert.deepEqual(spec, { command: "pnpm", args: ["install"], shell: true });
});

test("the Windows pnpm shim uses the shell only after arguments are validated", () => {
    assert.equal(resolvePnpmInvocation(["install", "--ignore-workspace"], {}, "win32").shell, true);
    assert.equal(resolvePnpmInvocation(["install"], {}, "linux").shell, false);
    assert.throws(() => resolvePnpmInvocation(["run", "build & calc"], {}, "win32"), TypeError);
    assert.throws(() => resolvePnpmInvocation(["install", "x;rm"], {}, "linux"), TypeError);
});

test("clone arguments pin the tag and keep options away from the URL", () => {
    assert.deepEqual(buildCloneArgs("https://github.com/a/b.git", "C:/x/y", "1.0.0"), [
        "clone", "--depth", "1", "--branch", "1.0.0", "--", "https://github.com/a/b.git", "C:/x/y",
    ]);
    assert.deepEqual(buildCloneArgs("https://github.com/a/b.git", "C:/x/y", undefined), [
        "clone", "--depth", "1", "--", "https://github.com/a/b.git", "C:/x/y",
    ]);
});

test("child processes never receive GitHub tokens, and the input is not modified", () => {
    const env = { GITHUB_TOKEN: "a", GH_TOKEN: "b", PATH: "p" };
    assert.deepEqual(childEnvironment(env), { PATH: "p" });
    assert.equal(env.GITHUB_TOKEN, "a");
});

test("a manifest without a string id and version is not a successful copy", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": "{}" });
    await assert.rejects(fetchPlugin(REPO, dest, { tag: "1.0.0" }), /must contain string id and version/);
    assert.equal(existsSync(dest), false);
});

test("an owned copy whose manifest lost its id is fetched again", async (t) => {
    const { dest } = await tempPlugin(t);
    const gh = createFakeGitHub(t);
    gh.publish(API, "1.0.0", { "main.js": "v1", "manifest.json": MANIFEST });
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });
    await writeFile(path.join(dest, "manifest.json"), "{}");

    gh.reset();
    await fetchPlugin(REPO, dest, { tag: "1.0.0" });
    assert.ok(gh.requests.length > 0);
    const manifest = JSON.parse(await readFile(path.join(dest, "manifest.json"), "utf8"));
    assert.equal(manifest.id, "plugin");
});
