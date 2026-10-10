import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import * as asar from "@electron/asar";
import * as tar from "tar";

const execFileAsync = promisify(execFile);
const setupUrl = new URL("./setup.mjs", import.meta.url).href;
const releasesUrl = "https://api.github.com/repos/obsidianmd/obsidian-releases/releases";

async function createFixture(t) {
    const root = await mkdtemp(path.join(os.tmpdir(), "toolkit-setup-"));
    t.after(async () => {
        assert.equal(path.dirname(root), os.tmpdir());
        await rm(root, { recursive: true, force: true });
    });
    const home = path.join(root, "toolkit home");
    const assets = path.join(home, "obsidian-e2e-toolkit-assets");
    const cache = path.join(assets, "cache");
    const unpacked = path.join(assets, "obsidian-unpacked");
    await mkdir(cache, { recursive: true });
    return { root, home, cache, unpacked };
}

async function createRelease(fixture, version) {
    const root = path.join(fixture.root, version);
    const app = path.join(root, "app");
    const archive = path.join(root, "archive");
    await mkdir(app, { recursive: true });
    await mkdir(archive);
    await writeFile(path.join(app, "main.js"), `module.exports = "${version}";`);
    await asar.createPackage(app, path.join(archive, "app.asar"));
    const tarPath = path.join(root, "app.tar.gz");
    const obsidianPath = path.join(root, "obsidian.asar.gz");
    await tar.create({ cwd: archive, file: tarPath, gzip: true }, ["app.asar"]);
    await writeFile(obsidianPath, gzipSync(`obsidian ${version}`));

    const tarUrl = `https://example.invalid/${version}/app.tar.gz`;
    const obsidianUrl = `https://example.invalid/${version}/obsidian.asar.gz`;
    return {
        release: {
            tag_name: `v${version}`,
            assets: [
                { name: `obsidian-${version}.tar.gz`, browser_download_url: tarUrl },
                { name: `obsidian-${version}.asar.gz`, browser_download_url: obsidianUrl },
            ],
        },
        downloads: {
            [tarUrl]: { file: tarPath },
            [obsidianUrl]: { file: obsidianPath },
        },
    };
}

async function seedCache(fixture, marker = "v1.0.0") {
    await mkdir(fixture.unpacked);
    await writeFile(path.join(fixture.unpacked, "main.cjs"), "old app");
    await writeFile(path.join(fixture.unpacked, "obsidian.asar"), "old obsidian");
    await writeFile(path.join(fixture.cache, "app.asar"), "old app archive");
    await writeFile(path.join(fixture.cache, "obsidian.asar"), "old obsidian archive");
    if (marker) {
        await writeFile(path.join(fixture.cache, ".cache-version"), `${marker}\n`);
        await writeFile(path.join(fixture.unpacked, ".obsidian-version"), `${marker}\n`);
    }
    await writeFile(path.join(fixture.cache, "release-latest.json"), JSON.stringify({
        tag_name: "v1.0.0",
        assets: [
            { name: "obsidian-1.0.0.tar.gz" },
            { name: "obsidian-1.0.0.asar.gz" },
        ],
    }));
}

async function runSetup(fixture, responses, version = "latest") {
    const requestsPath = path.join(fixture.root, "requests.json");
    // Run the real entry point with fake HTTP responses and tiny local archives.
    // Unexpected requests fail instead of touching the network or using tokens.
    const script = `
        import { readFile, writeFileSync } from "node:fs";
        import { promisify } from "node:util";
        const responses = ${JSON.stringify(responses)};
        const requests = [];
        globalThis.fetch = async (url) => {
            requests.push(url);
            const response = responses[url];
            if (!response) throw new Error("Unexpected request: " + url);
            return response.file
                ? new Response(await promisify(readFile)(response.file))
                : Response.json(response.body, { status: response.status ?? 200 });
        };
        process.on("exit", () => writeFileSync(${JSON.stringify(requestsPath)}, JSON.stringify(requests)));
        await import(${JSON.stringify(setupUrl)});
    `;
    const env = {
        ...process.env,
        INIT_CWD: fixture.home,
        OBSIDIAN_E2E_TOOLKIT_HOME: fixture.home,
        OBSIDIAN_E2E_TOOLKIT_OBSIDIAN_VERSION: version,
        OBSIDIAN_VERSION: "",
        GITHUB_TOKEN: "",
        GH_TOKEN: "",
    };
    const result = await execFileAsync(process.execPath, ["--input-type=module", "--eval", script], {
        env,
        timeout: 30_000,
        windowsHide: true,
    }).then(
        (output) => ({ ...output, code: 0 }),
        (error) => ({ stdout: error.stdout, stderr: error.stderr, code: error.code }),
    );
    const requests = JSON.parse(await readFile(requestsPath, "utf8"));
    return { ...result, requests };
}

async function assertInstalled(fixture, version) {
    assert.equal(await readFile(path.join(fixture.unpacked, "main.cjs"), "utf8"), `module.exports = "${version}";`);
    assert.equal(await readFile(path.join(fixture.unpacked, "obsidian.asar"), "utf8"), `obsidian ${version}`);
    assert.equal(await readFile(path.join(fixture.cache, ".cache-version"), "utf8"), `v${version}\n`);
    assert.equal(await readFile(path.join(fixture.unpacked, ".obsidian-version"), "utf8"), `v${version}\n`);
}

for (const marker of ["v1.0.0", "latest", null]) {
    test(`latest refreshes stale assets with ${marker ?? "missing"} version markers`, async (t) => {
        const fixture = await createFixture(t);
        await seedCache(fixture, marker);
        const { release, downloads } = await createRelease(fixture, "1.1.0");
        const result = await runSetup(fixture, {
            [`${releasesUrl}/latest`]: { body: release },
            ...downloads,
        });

        assert.equal(result.code, 0, result.stderr);
        assert.deepEqual(result.requests, [`${releasesUrl}/latest`, ...Object.keys(downloads)]);
        await assertInstalled(fixture, "1.1.0");
        const cached = JSON.parse(await readFile(path.join(fixture.cache, "release-latest.json"), "utf8"));
        assert.equal(cached.tag_name, "v1.1.0");
    });
}

test("default latest checks GitHub but reuses assets when the version is unchanged", async (t) => {
    const fixture = await createFixture(t);
    await seedCache(fixture);
    const { release } = await createRelease(fixture, "1.0.0");
    const result = await runSetup(fixture, {
        [`${releasesUrl}/latest`]: { body: release },
    }, "");

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.requests, [`${releasesUrl}/latest`]);
    assert.equal(await readFile(path.join(fixture.unpacked, "main.cjs"), "utf8"), "old app");
    assert.equal(await readFile(path.join(fixture.cache, "app.asar"), "utf8"), "old app archive");
});

test("latest skips mobile-only releases before updating cached assets", async (t) => {
    const fixture = await createFixture(t);
    await seedCache(fixture);
    const { release, downloads } = await createRelease(fixture, "1.1.0");
    const mobileRelease = { tag_name: "v1.2.0", assets: [{ name: "Obsidian-1.2.0.apk" }] };
    const result = await runSetup(fixture, {
        [`${releasesUrl}/latest`]: { body: mobileRelease },
        [`${releasesUrl}?per_page=100&page=1`]: { body: [mobileRelease, release] },
        ...downloads,
    });

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.requests, [
        `${releasesUrl}/latest`, `${releasesUrl}?per_page=100&page=1`, ...Object.keys(downloads),
    ]);
    await assertInstalled(fixture, "1.1.0");
});

test("latest fails without modifying cached assets when GitHub lookup fails", async (t) => {
    const fixture = await createFixture(t);
    await seedCache(fixture);
    const result = await runSetup(fixture, {
        [`${releasesUrl}/latest`]: { body: { message: "API rate limit exceeded" }, status: 403 },
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Failed to fetch release info: 403/);
    assert.deepEqual(result.requests, [`${releasesUrl}/latest`]);
    assert.equal(await readFile(path.join(fixture.unpacked, "main.cjs"), "utf8"), "old app");
    assert.equal(await readFile(path.join(fixture.cache, "app.asar"), "utf8"), "old app archive");
    assert.equal(await readFile(path.join(fixture.cache, ".cache-version"), "utf8"), "v1.0.0\n");
});

test("pinned versions reuse unpacked assets without GitHub requests", async (t) => {
    const fixture = await createFixture(t);
    await seedCache(fixture);
    const result = await runSetup(fixture, {}, "1.0.0");

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.requests, []);
    assert.equal(await readFile(path.join(fixture.unpacked, "main.cjs"), "utf8"), "old app");
});

test("pinned versions unpack cached archives without release metadata or GitHub requests", async (t) => {
    const fixture = await createFixture(t);
    const { downloads } = await createRelease(fixture, "1.0.0");
    await writeFile(path.join(fixture.cache, "app.tar.gz"), await readFile(Object.values(downloads)[0].file));
    await writeFile(path.join(fixture.cache, "obsidian.asar.gz"), await readFile(Object.values(downloads)[1].file));
    await writeFile(path.join(fixture.cache, ".cache-version"), "v1.0.0\n");
    const result = await runSetup(fixture, {}, "v1.0.0");

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.requests, []);
    await assertInstalled(fixture, "1.0.0");
});

test("pinned versions reuse cached release metadata to download missing assets", async (t) => {
    const fixture = await createFixture(t);
    const { release, downloads } = await createRelease(fixture, "1.0.0");
    await writeFile(path.join(fixture.cache, "release-v1.0.0.json"), JSON.stringify(release));
    const result = await runSetup(fixture, downloads, "1.0.0");

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(result.requests, Object.keys(downloads));
    await assertInstalled(fixture, "1.0.0");
});

test("latest and pinned requests share the concrete version cache", async (t) => {
    const fixture = await createFixture(t);
    const { release, downloads } = await createRelease(fixture, "1.0.0");
    const installed = await runSetup(fixture, {
        [`${releasesUrl}/latest`]: { body: release },
        ...downloads,
    });
    assert.equal(installed.code, 0, installed.stderr);
    await assertInstalled(fixture, "1.0.0");

    const pinned = await runSetup(fixture, {}, "1.0.0");
    assert.equal(pinned.code, 0, pinned.stderr);
    assert.deepEqual(pinned.requests, []);

    const latest = await runSetup(fixture, {
        [`${releasesUrl}/latest`]: { body: release },
    });
    assert.equal(latest.code, 0, latest.stderr);
    assert.deepEqual(latest.requests, [`${releasesUrl}/latest`]);
    await assertInstalled(fixture, "1.0.0");
    assert.equal(existsSync(path.join(fixture.unpacked, "main.js")), false);
});
