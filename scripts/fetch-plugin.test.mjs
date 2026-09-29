import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { fetchPlugin } from "../dist/index.mjs";

// 実際の API 制限や秘密情報に依存せず、環境変数が両方の検索経路へ届くことを確認する。
const cases = [
    { name: "prefers GITHUB_TOKEN", github: "github-test-token", gh: "gh-test-token", expected: "github-test-token" },
    { name: "falls back to GH_TOKEN", github: "", gh: "gh-test-token", expected: "gh-test-token" },
    { name: "allows unauthenticated local usage", expected: undefined },
];

for (const scenario of cases) {
    test(`release lookup ${scenario.name}`, async () => {
        const originalFetch = globalThis.fetch;
        const originalGithub = process.env.GITHUB_TOKEN;
        const originalGh = process.env.GH_TOKEN;
        const tempRoot = await mkdtemp(path.join(os.tmpdir(), "toolkit-fetch-plugin-"));
        const requests = [];
        const assetUrl = "https://example.invalid/main.js";

        try {
            for (const [key, value] of [["GITHUB_TOKEN", scenario.github], ["GH_TOKEN", scenario.gh]]) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }

            globalThis.fetch = async (url, options) => {
                requests.push({ url, headers: new Headers(options?.headers) });
                if (url.endsWith("/releases/latest")) {
                    // latest にアセットがない場合も、一覧取得に認証が引き継がれる必要がある。
                    return Response.json({ tag_name: "2.0.0", assets: [] });
                }
                if (url.endsWith("/releases?per_page=20")) {
                    return Response.json([{ tag_name: "1.0.0", assets: [{ name: "main.js", browser_download_url: assetUrl }] }]);
                }
                assert.equal(url, assetUrl);
                return new Response("module.exports = {};");
            };

            const dest = await fetchPlugin("https://github.com/example/plugin.git", tempRoot);
            assert.equal(await readFile(path.join(dest, "main.js"), "utf8"), "module.exports = {};");
            assert.equal(requests.length, 3);
            for (const request of requests.slice(0, 2)) {
                assert.equal(new URL(request.url).hostname, "api.github.com");
                assert.equal(request.headers.get("Authorization"), scenario.expected ? `Bearer ${scenario.expected}` : null);
                assert.equal(request.headers.get("Accept"), "application/vnd.github+json");
            }
            // 公開アセットの取得先には API 用のトークンを送らない。
            assert.equal(requests[2].headers.get("Authorization"), null);
        } finally {
            globalThis.fetch = originalFetch;
            for (const [key, value] of [["GITHUB_TOKEN", originalGithub], ["GH_TOKEN", originalGh]]) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            assert.equal(path.dirname(tempRoot), os.tmpdir());
            await rm(tempRoot, { recursive: true, force: true });
        }
    });
}
