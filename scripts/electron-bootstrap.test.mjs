import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/internal/services/electronBootstrap.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { createElectronBootstrap } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

for (const withPackage of [true, false]) {
    test(`Electron bootstrap protects the Obsidian protocol ${withPackage ? "with" : "without"} package metadata`, async () => {
        const tempRoot = await mkdtemp(path.join(os.tmpdir(), "toolkit-protocol-"));
        try {
            const appDir = path.join(tempRoot, "Obsidian's assets");
            const mainPath = path.join(appDir, "main.cjs");
            await mkdir(appDir);
            if (withPackage) {
                await writeFile(path.join(appDir, "package.json"), JSON.stringify({
                    name: "obsidian", version: "1.13.7", type: "module", main: "main.js",
                }));
            }
            const bootstrapDir = await createElectronBootstrap(mainPath, path.join(tempRoot, "user-data"));
            const metadata = JSON.parse(await readFile(path.join(bootstrapDir, "package.json"), "utf8"));
            assert.equal(metadata.name, withPackage ? "obsidian" : "obsidian-e2e");
            assert.equal(metadata.version, withPackage ? "1.13.7" : "0.0.0");
            assert.equal(metadata.type, "commonjs");

            const calls = [];
            const app = {
                setAppPath(value) { this.appPath = value; },
                setAsDefaultProtocolClient(...args) { calls.push(["set", this, args]); return true; },
                removeAsDefaultProtocolClient(...args) { calls.push(["remove", this, args]); return true; },
            };
            const fakeProcess = { argv: ["electron", bootstrapDir, "--no-sandbox"] };
            let loaded = false;
            vm.runInNewContext(await readFile(path.join(bootstrapDir, metadata.main), "utf8"), {
                process: fakeProcess,
                require(id) {
                    if (id === "electron") return { app };
                    assert.equal(id, mainPath);
                    // 起動直後の登録も防ぐ必要があるため、元のアプリを読む時点で検証する。
                    assert.equal(app.appPath, appDir);
                    assert.equal(fakeProcess.argv[1], mainPath);
                    for (const method of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient"]) {
                        assert.equal(app[method]("obsidian"), false);
                        assert.equal(app[method]("OBSIDIAN", "test.exe", ["arg"]), false);
                    }
                    loaded = true;
                },
            });
            assert.equal(loaded, true);
            assert.equal(calls.length, 0);
            assert.equal(fakeProcess.argv[2], "--no-sandbox");
            // 他のプロトコルは元の処理と引数を維持し、Obsidian だけを保護する。
            assert.equal(app.setAsDefaultProtocolClient("toolkit-test", "test.exe", ["arg"]), true);
            assert.equal(app.removeAsDefaultProtocolClient("toolkit-test"), true);
            assert.deepEqual(calls, [
                ["set", app, ["toolkit-test", "test.exe", ["arg"]]],
                ["remove", app, ["toolkit-test"]],
            ]);
        } finally {
            assert.equal(path.dirname(tempRoot), os.tmpdir());
            await rm(tempRoot, { recursive: true, force: true });
        }
    });
}
