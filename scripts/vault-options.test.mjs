import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const { outputFiles } = await build({
    entryPoints: [new URL("../src/internal/vaultOptions.ts", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
});
const { resolveVaultOptions } = await import(
    `data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`
);

test("a longer plugin list does not leak into later tests", () => {
    resolveVaultOptions({ plugins: [{ path: "a" }, { path: "b" }, { path: "c" }] });
    const later = resolveVaultOptions({ plugins: [{ path: "d" }] });
    assert.deepEqual(later.plugins, [{ path: "d" }]);
    assert.deepEqual(resolveVaultOptions({}).plugins, []);
});

test("resolved options do not share nested objects with the input", () => {
    const input = { browserConsoleLogging: { maxMessageLength: 10 } };
    const resolved = resolveVaultOptions(input);
    resolved.browserConsoleLogging.maxMessageLength = 99;
    assert.equal(input.browserConsoleLogging.maxMessageLength, 10);
    assert.equal(resolveVaultOptions({}).browserConsoleLogging.maxMessageLength, 300);
});
