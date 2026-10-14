import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { loadSource } from "./support/load-source.mjs";

const { resolveElectronExecutable } = await loadSource("internal/electronExecutable.ts");

async function fixture(t, source) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-electron-executable-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    const moduleRoot = path.join(root, "node_modules", "electron");
    await mkdir(moduleRoot, { recursive: true });
    await writeFile(path.join(moduleRoot, "package.json"), JSON.stringify({ name: "electron", main: "index.cjs" }));
    await writeFile(path.join(moduleRoot, "index.cjs"), source);
    return { root, moduleRoot, from: pathToFileURL(path.join(root, "consumer.mjs")) };
}

test("cold Electron preparation runs its own lazy resolver before checking the executable", async (t) => {
    const f = await fixture(t, `
        const fs = require("node:fs");
        const path = require("node:path");
        const dist = path.join(__dirname, "dist");
        fs.mkdirSync(dist);
        const executable = path.join(dist, "electron");
        fs.writeFileSync(executable, "prepared lazily");
        module.exports = executable;
    `);
    assert.equal(existsSync(path.join(f.moduleRoot, "dist")), false);
    const executable = resolveElectronExecutable(f.from);
    assert.equal(await readFile(executable, "utf8"), "prepared lazily");
});

test("an executable outside the package dist folder is accepted", async (t) => {
    const f = await fixture(t, `module.exports = require("node:path").resolve(__dirname, "../../custom-electron");`);
    const executable = path.join(f.root, "custom-electron");
    await writeFile(executable, "override");
    assert.equal(await realpath(resolveElectronExecutable(f.from)), await realpath(executable));
});

test("missing executables fail before Playwright launch with the original cause", async (t) => {
    const f = await fixture(t, `module.exports = require("node:path").join(__dirname, "missing-electron");`);
    assert.throws(() => resolveElectronExecutable(f.from), (error) => {
        assert.match(error.message, /Could not prepare Electron executable:.*missing-electron/);
        assert.equal(error.cause.code, "ENOENT");
        return true;
    });
});

test("installer failures retain their cause instead of reporting only missing dist", async (t) => {
    const f = await fixture(t, `throw new Error("download was blocked");`);
    assert.throws(() => resolveElectronExecutable(f.from), (error) => {
        assert.match(error.message, /Could not prepare Electron executable: download was blocked/);
        assert.equal(error.cause.message, "download was blocked");
        return true;
    });
});
