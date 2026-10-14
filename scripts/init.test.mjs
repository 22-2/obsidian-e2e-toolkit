import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const initScript = fileURLToPath(new URL("./init.mjs", import.meta.url));

async function tempProject(t) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "toolkit-init-"));
    t.after(async () => {
        assert.equal(path.dirname(dir), os.tmpdir());
        await rm(dir, { recursive: true, force: true });
    });
    return dir;
}

function runInit(cwd) {
    return spawnSync(process.execPath, [initScript], { cwd, encoding: "utf8" });
}

test("the scaffold writes a config that uses defineObsidianConfig, and the example spec", async (t) => {
    const dir = await tempProject(t);
    const result = runInit(dir);
    assert.equal(result.status, 0, result.stderr);

    const config = await readFile(path.join(dir, "playwright.config.ts"), "utf8");
    assert.match(config, /import \{ defineObsidianConfig \} from "obsidian-e2e-toolkit";/);
    assert.match(config, /export default defineObsidianConfig\(\{/);
    assert.doesNotMatch(config, /defineConfig/);
    assert.match(await readFile(path.join(dir, "e2e", "example.spec.ts"), "utf8"), /obsidian-e2e-toolkit/);
});

test("an existing config is kept, and the scaffold reports the skip", async (t) => {
    const dir = await tempProject(t);
    await writeFile(path.join(dir, "playwright.config.ts"), "// mine\n");
    const result = runInit(dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /skip\s+playwright\.config\.ts/);
    assert.equal(await readFile(path.join(dir, "playwright.config.ts"), "utf8"), "// mine\n");
});
