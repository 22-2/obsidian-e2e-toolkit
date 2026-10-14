import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as tar from "tar";
import { assertSafeVersion, packLocal } from "./pack-local.mjs";

const SOURCE_PACKAGE = {
    name: "obsidian-e2e-toolkit",
    version: "9.9.9-test",
    type: "module",
    main: "./dist/index.cjs",
    types: "./dist/index.d.cts",
    bin: { "obsidian-e2e-toolkit": "./scripts/init.mjs" },
    exports: {
        ".": {
            import: { types: "./dist/index.d.mts", default: "./dist/index.mjs" },
            require: { types: "./dist/index.d.cts", default: "./dist/index.cjs" },
        },
        "./coverage": {
            import: { types: "./dist/coverage.d.mts", default: "./dist/coverage.mjs" },
            require: { types: "./dist/coverage.d.cts", default: "./dist/coverage.cjs" },
        },
    },
    files: ["dist", "scripts", "README.md", "LICENSE"],
    scripts: {
        prepare: "pnpm run build",
        build: "tsdown",
        postinstall: "node ./scripts/postinstall.cjs",
    },
};

async function write(root, relative, text) {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, text, "utf8");
}

// 実 repo と同じ形の最小構成。巨大な download cache は置かず、同梱すべき asset と型定義を置く。
async function createFixture(t, overrides = {}) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-pack-local-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    await write(root, "package.json", JSON.stringify({ ...SOURCE_PACKAGE, ...overrides }, null, 4) + "\n");
    await write(root, "dist/index.mjs", "export const version = 1;\n");
    await write(root, "dist/index.cjs", "module.exports = {};\n");
    await write(root, "dist/index.d.mts", "export {};\n");
    await write(root, "dist/index.d.cts", "export {};\n");
    await write(root, "dist/coverage.mjs", "export {};\n");
    await write(root, "dist/coverage.cjs", "module.exports = {};\n");
    await write(root, "dist/coverage.d.mts", "export {};\n");
    await write(root, "dist/coverage.d.cts", "export {};\n");
    await write(root, "scripts/setup.mjs", "// setup\n");
    await write(root, "scripts/init.mjs", "// init\n");
    await write(root, "scripts/postinstall.cjs", "// postinstall\n");
    await write(root, "README.md", "# fixture\n");
    await write(root, "LICENSE", "MIT\n");
    await write(root, "obsidian-e2e-toolkit-assets/cache/app.tar.gz", "download cache\n");
    await write(root, "obsidian-e2e-toolkit-assets/obsidian-unpacked/main.cjs", "module.exports = 'app';\n");
    await write(root, "obsidian-e2e-toolkit-assets/obsidian-unpacked/obsidian.asar", "asar\n");
    await write(root, "obsidian-e2e-toolkit-assets/obsidian-unpacked/.obsidian-version", "v1.0.0\n");
    return root;
}

// 生成された tgz を実際に展開し、利用側が受け取る内容として確かめる。
async function extractPackage(t, archive) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "toolkit-pack-extract-"));
    t.after(async () => {
        assert.equal(path.dirname(dir), os.tmpdir());
        await rm(dir, { recursive: true, force: true });
    });
    await tar.x({ file: archive, cwd: dir });
    return path.join(dir, "package");
}

test("the archive has the release layout: bundled assets, no download cache, no lifecycle scripts", async (t) => {
    const root = await createFixture(t);
    const result = await packLocal({ repoRoot: root });
    const packed = await extractPackage(t, result.archive);

    const pkg = JSON.parse(await readFile(path.join(packed, "package.json"), "utf8"));
    assert.equal(pkg.scripts.prepare, undefined);
    assert.equal(pkg.scripts.postinstall, undefined);
    assert.equal(pkg.scripts.build, "tsdown", "other scripts are kept");
    assert.ok(pkg.files.includes("obsidian-e2e-toolkit-assets"));
    assert.equal(await readFile(path.join(packed, "dist", "index.mjs"), "utf8"), "export const version = 1;\n");
    assert.equal(existsSync(path.join(packed, "dist", "coverage.d.mts")), true, "declared type definitions are packed");
    assert.equal(existsSync(path.join(packed, "obsidian-e2e-toolkit-assets", "obsidian-unpacked", "main.cjs")), true);
    assert.equal(existsSync(path.join(packed, "obsidian-e2e-toolkit-assets", "cache")), false);
});

test("the source package.json is not rewritten", async (t) => {
    const root = await createFixture(t);
    const before = await readFile(path.join(root, "package.json"), "utf8");
    await packLocal({ repoRoot: root });
    assert.equal(await readFile(path.join(root, "package.json"), "utf8"), before);
});

test("the file name carries a content hash, so changed content gets a new name", async (t) => {
    const root = await createFixture(t);
    const first = await packLocal({ repoRoot: root });
    assert.match(path.basename(first.archive), /^obsidian-e2e-toolkit-9\.9\.9-test-[0-9a-f]{12}\.tgz$/);

    const again = await packLocal({ repoRoot: root });
    assert.equal(again.archive, first.archive, "the same content keeps the same name");

    await write(root, "dist/index.mjs", "export const version = 2;\n");
    const changed = await packLocal({ repoRoot: root });
    assert.notEqual(changed.archive, first.archive);
    assert.equal(existsSync(first.archive), true, "the earlier archive is left in place");
});

test("staging is removed, and the result is marked as an unpublished development build", async (t) => {
    const root = await createFixture(t);
    const result = await packLocal({ repoRoot: root });
    assert.deepEqual(await readdir(path.join(root, "coverage", "local-pack")), [path.basename(result.archive)]);
    assert.equal(result.specifier, "file:" + result.archive.split(path.sep).join("/"));
    assert.match(result.sha256, /^[0-9a-f]{64}$/);
    assert.match(result.note, /unpublished development build/);
});

test("a missing prebuilt asset stops the pack before any archive is written", async (t) => {
    const root = await createFixture(t);
    await rm(path.join(root, "obsidian-e2e-toolkit-assets", "obsidian-unpacked", "main.cjs"));
    await assert.rejects(packLocal({ repoRoot: root }), /main\.cjs[\s\S]*postinstall/);
    assert.equal(existsSync(path.join(root, "coverage")), false);
});

test("a missing type definition that the package declares blocks the pack", async (t) => {
    const root = await createFixture(t);
    await rm(path.join(root, "dist", "coverage.d.mts"));
    await assert.rejects(packLocal({ repoRoot: root }), /dist\/coverage\.d\.mts/);
    assert.equal(existsSync(path.join(root, "coverage")), false);
});

test("a repo that is not this package is refused", async (t) => {
    const root = await createFixture(t, { name: "other-package" });
    await assert.rejects(packLocal({ repoRoot: root }), /expected package name obsidian-e2e-toolkit/);
});

test("an unsafe version is refused before anything is written", async (t) => {
    for (const version of ["1.0.0/../../escape", "1.0.0+build.1", "1.0"]) {
        const root = await createFixture(t, { version });
        await assert.rejects(packLocal({ repoRoot: root }), /SemVer/);
        assert.equal(existsSync(path.join(root, "coverage")), false);
    }
});

test("the version must be a SemVer string that is safe in a file name", () => {
    for (const ok of ["1.6.0", "2.0.0-beta.1", "9.9.9-test"]) assert.equal(assertSafeVersion(ok), ok);
    for (const bad of ["01.0.0", "1.0", "../1.0.0", "1.0.0+build", "1.0.0 x", "", 1]) {
        assert.throws(() => assertSafeVersion(bad), /SemVer/);
    }
});

test("an output directory that points outside the repo is refused and nothing is written there", async (t) => {
    const root = await createFixture(t);
    const outside = await mkdtemp(path.join(os.tmpdir(), "toolkit-pack-outside-"));
    t.after(async () => {
        assert.equal(path.dirname(outside), os.tmpdir());
        await rm(outside, { recursive: true, force: true });
    });
    // Windows の junction は管理者権限なしで作れる。ほかの OS では通常の directory link になる。
    await symlink(outside, path.join(root, "coverage"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(packLocal({ repoRoot: root }), /symbolic link or junction|resolves outside/);
    assert.deepEqual(await readdir(outside), []);
});
