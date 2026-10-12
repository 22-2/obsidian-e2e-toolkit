import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/internal/services/electronMainLogging.ts", import.meta.url), "utf8");
const { code } = await transform(source, { loader: "ts", format: "esm" });
const { forwardElectronMainLogs, getElectronMainLogPath } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);

test("main logs are forwarded before connection, during execution, and on shutdown without duplicates", async (t) => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), "toolkit-main-log-"));
    t.after(async () => {
        assert.equal(path.dirname(tempRoot), os.tmpdir());
        await rm(tempRoot, { recursive: true, force: true });
    });
    const logPath = getElectronMainLogPath(tempRoot);
    const calls = [];
    const logger = Object.fromEntries(["debug", "info", "warn", "error"].map(
        (level) => [level, (message) => calls.push([level, message])],
    ));
    const line = (level, message) => JSON.stringify({ level, message, timestamp: "test-time" }) + "\n";
    const stop = forwardElectronMainLogs(logPath, logger);
    t.after(stop);
    assert.deepEqual(calls, []);
    await writeFile(logPath, line("error", "startup stack\n    at startup.js:42"));
    await t.waitFor(() => calls.length === 1);
    await appendFile(logPath, line("warn", "request cancelled"));
    await t.waitFor(() => calls.length === 2);

    // 書き込み途中の行は次の改行まで待ち、停止時にも未転送の行を回収する。
    const finalLine = line("error", "shutdown error");
    await appendFile(logPath, finalLine.slice(0, -1));
    stop();
    assert.equal(calls.length, 2);
    await appendFile(logPath, "\n");
    stop();
    stop();
    assert.deepEqual(calls, [
        ["error", "[ELECTRON:MAIN:ERROR] test-time startup stack\n    at startup.js:42"],
        ["warn", "[ELECTRON:MAIN:WARN] test-time request cancelled"],
        ["error", "[ELECTRON:MAIN:ERROR] test-time shutdown error"],
    ]);
});
