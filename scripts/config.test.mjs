import assert from "node:assert/strict";
import test from "node:test";
import { loadSource } from "./support/load-source.mjs";

const { defineObsidianConfig } = await loadSource("config.ts");

test("shared defaults apply when the caller sets nothing, and retries stay off", () => {
    const config = defineObsidianConfig({});
    assert.deepEqual(config.use, { trace: "on-first-retry", screenshot: "only-on-failure" });
    assert.deepEqual(config.expect, { timeout: 5000 });
    assert.equal(config.retries, undefined);
    assert.equal(config.workers, undefined);
    assert.equal(config.timeout, undefined);
});

test("explicit caller values win over the defaults", () => {
    const config = defineObsidianConfig({
        workers: 2,
        timeout: 120000,
        reporter: [["list"]],
        projects: [{ name: "chromium" }],
        use: { trace: "off" },
        expect: { timeout: 10000 },
    });
    assert.equal(config.workers, 2);
    assert.equal(config.timeout, 120000);
    assert.deepEqual(config.reporter, [["list"]]);
    assert.deepEqual(config.projects, [{ name: "chromium" }]);
    assert.deepEqual(config.use, { trace: "off", screenshot: "only-on-failure" });
    assert.deepEqual(config.expect, { timeout: 10000 });
});

test("undefined overrides do not erase defaults, and repeated merges keep caller values", () => {
    const once = defineObsidianConfig({ use: { trace: undefined, baseURL: "http://127.0.0.1" } });
    assert.equal(once.use.trace, "on-first-retry");
    const twice = defineObsidianConfig(once);
    assert.deepEqual(twice, once);
    assert.equal(twice.use.baseURL, "http://127.0.0.1");
});
