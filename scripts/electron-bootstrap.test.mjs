import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { format } from "node:util";
import vm from "node:vm";
import { build } from "esbuild";

const { outputFiles } = await build({
    entryPoints: [fileURLToPath(new URL("../src/internal/services/electronBootstrap.ts", import.meta.url))],
    bundle: true, platform: "node", format: "esm", write: false,
});
const { createElectronBootstrap } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

async function createHarness(t, { withPackage = true, loadApp = () => {} } = {}) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "toolkit-bootstrap-"));
    t.after(async () => {
        assert.equal(path.dirname(tempRoot), os.tmpdir());
        await rm(tempRoot, { recursive: true, force: true });
    });
    const appDir = path.join(tempRoot, "Obsidian's assets");
    const mainPath = path.join(appDir, "main.cjs");
    const userDataDir = path.join(tempRoot, "user-data");
    await mkdir(appDir);
    if (withPackage) {
        await writeFile(path.join(appDir, "package.json"), JSON.stringify({
            name: "obsidian", version: "1.13.7", type: "module", main: "main.js",
        }));
    }
    const bootstrapDir = await createElectronBootstrap(mainPath, userDataDir);
    const metadata = JSON.parse(await readFile(path.join(bootstrapDir, "package.json"), "utf8"));
    const calls = [];
    const app = Object.assign(new EventEmitter(), {
        setAppPath(value) { this.appPath = value; },
        setAsDefaultProtocolClient(...args) { calls.push(["set", this, args]); return true; },
        removeAsDefaultProtocolClient(...args) { calls.push(["remove", this, args]); return true; },
    });
    const fakeProcess = Object.assign(new EventEmitter(), {
        argv: ["electron", bootstrapDir, "--no-sandbox"],
        versions: { electron: "test" },
        stderr: { write() {} },
    });
    const consoleCalls = [];
    const fakeConsole = Object.fromEntries(["log", "info", "debug", "warn", "error"].map(
        (method) => [method, (...args) => consoleCalls.push([method, ...args])],
    ));
    let loaded = false;
    vm.runInNewContext(await readFile(path.join(bootstrapDir, metadata.main), "utf8"), {
        process: fakeProcess,
        console: fakeConsole,
        require(id) {
            if (id === "electron") return { app };
            if (id === "node:fs") return { appendFileSync };
            if (id === "node:util") return { format };
            assert.equal(id, mainPath);
            loadApp({ app, fakeProcess, fakeConsole, mainPath, appDir });
            loaded = true;
        },
    });
    assert.equal(loaded, true);
    return {
        app, fakeProcess, fakeConsole, consoleCalls, calls, metadata,
        mainPath, appDir, mainLogPath: path.join(userDataDir, "electron-main.log"),
    };
}

for (const withPackage of [true, false]) {
    test(`Electron bootstrap protects the Obsidian protocol ${withPackage ? "with" : "without"} package metadata`, async (t) => {
        const { app, calls, fakeProcess, metadata } = await createHarness(t, {
            withPackage,
            loadApp({ app, fakeProcess, mainPath, appDir }) {
                // 起動直後の登録も防ぐ必要があるため、元のアプリを読む時点で検証する。
                assert.equal(app.appPath, appDir);
                assert.equal(fakeProcess.argv[1], mainPath);
                for (const method of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient"]) {
                    assert.equal(app[method]("obsidian"), false);
                    assert.equal(app[method]("OBSIDIAN", "test.exe", ["arg"]), false);
                }
            },
        });
        assert.equal(metadata.name, withPackage ? "obsidian" : "obsidian-e2e");
        assert.equal(metadata.version, withPackage ? "1.13.7" : "0.0.0");
        assert.equal(metadata.type, "commonjs");
        assert.equal(calls.length, 0);
        assert.equal(fakeProcess.argv[2], "--no-sandbox");
        // 他のプロトコルは元の処理と引数を維持し、Obsidian だけを保護する。
        assert.equal(app.setAsDefaultProtocolClient("toolkit-test", "test.exe", ["arg"]), true);
        assert.equal(app.removeAsDefaultProtocolClient("toolkit-test"), true);
        assert.deepEqual(calls, [
            ["set", app, ["toolkit-test", "test.exe", ["arg"]]],
            ["remove", app, ["toolkit-test"]],
        ]);
    });
}

test("Electron bootstrap cancels frameless app requests before Obsidian reads origin", async (t) => {
    let handler;
    const registrations = [];
    const webRequest = {
        onBeforeRequest(...args) {
            assert.equal(this, webRequest);
            registrations.push(args);
            handler = args.at(-1);
        },
    };
    const filter = { urls: ["app://*/*"] };
    let handled = 0;
    const { mainLogPath } = await createHarness(t, {
        loadApp({ app }) {
            app.emit("session-created", { webRequest });
            webRequest.onBeforeRequest(filter, (details, callback) => {
                handled++;
                callback({ cancel: details.frame.origin !== "app://obsidian.md" });
            });
        },
    });
    assert.equal(registrations[0][0], filter);
    for (const frame of [undefined, null]) {
        let called = 0;
        handler({ url: "app://obsidian.md/stale.js", frame, method: "GET", resourceType: "script", webContentsId: 7 }, (response) => {
            called++;
            assert.equal(response.cancel, true);
        });
        assert.equal(called, 1);
    }
    assert.equal(handled, 0);
    for (const origin of ["app://obsidian.md", "https://untrusted.example"]) {
        handler({ url: "app://obsidian.md/app.js", frame: { origin } }, (response) => {
            assert.equal(response.cancel, origin !== "app://obsidian.md");
        });
    }
    assert.equal(handled, 2);
    const logs = (await readFile(mainLogPath, "utf8")).trim().split("\n").map(JSON.parse);
    const warnings = logs.filter((entry) => entry.level === "warn");
    assert.equal(warnings.length, 2);
    assert.match(warnings[0].message, /Cancelled app:\/\/ request without a frame/);
    assert.match(warnings[0].message, /stale\.js/);
    assert.match(warnings[0].message, /webContentsId: 7/);

    // フィルター省略・購読解除を維持し、HTTP のフレームなし要求は元の処理へ渡す。
    const details = { url: "https://example.com/" };
    webRequest.onBeforeRequest((actual, callback) => {
        assert.equal(actual, details);
        callback({ cancel: false });
    });
    handler(details, (response) => assert.equal(response.cancel, false));
    webRequest.onBeforeRequest(null);
    assert.equal(handler, null);
    webRequest.onBeforeRequest(filter, null);
    assert.deepEqual(registrations.at(-1), [filter, null]);
});

test("Electron bootstrap records startup errors and full exception stacks without handling exceptions", async (t) => {
    const startupError = new Error("startup failed");
    const { fakeProcess, consoleCalls, mainLogPath } = await createHarness(t, {
        loadApp({ fakeConsole, fakeProcess }) {
            fakeConsole.error("Early failure: %s", "before Playwright connects");
            fakeProcess.emit("uncaughtExceptionMonitor", startupError, "uncaughtException");
            fakeProcess.emit("uncaughtExceptionMonitor", new Error("rejected promise"), "unhandledRejection");
            fakeProcess.emit("warning", new Error("runtime warning"));
        },
    });
    assert.equal(fakeProcess.listenerCount("uncaughtException"), 0);
    assert.equal(fakeProcess.listenerCount("unhandledRejection"), 0);
    assert.deepEqual(consoleCalls, [["error", "Early failure: %s", "before Playwright connects"]]);
    const logs = (await readFile(mainLogPath, "utf8")).trim().split("\n").map(JSON.parse);
    assert.match(logs[0].message, /Starting Obsidian/);
    assert.equal(logs[1].message, "Early failure: before Playwright connects");
    assert.equal(logs[2].level, "error");
    assert.equal(logs[2].message, `uncaughtException: ${startupError.stack}`);
    assert.match(logs[3].message, /unhandledRejection: Error: rejected promise/);
    assert.equal(logs[4].level, "warn");
});
