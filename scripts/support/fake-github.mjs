// 外部通信なしで GitHub API と asset の応答を再現する。テスト終了時に fetch を元へ戻す。
const ASSET_ORIGIN = "https://example.invalid/assets";

export function createFakeGitHub(t) {
    const requests = [];
    const routes = new Map();
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        requests.push({ url, headers: new Headers(init?.headers) });
        const route = routes.get(url);
        if (!route) return new Response("unexpected request: " + url, { status: 404 });
        return route();
    };
    t.after(() => {
        globalThis.fetch = original;
    });

    return {
        requests,
        json(url, body, status = 200) {
            routes.set(url, () => Response.json(body, { status }));
        },
        file(url, text, status = 200) {
            routes.set(url, () => new Response(text, { status }));
        },
        reset() {
            requests.length = 0;
        },
        // apiBase は https://api.github.com/repos/owner/name の形。tag の release と asset を登録し、release を返す。
        publish(apiBase, tag, files) {
            const assetBase = ASSET_ORIGIN + new URL(apiBase).pathname + "/" + tag;
            const assets = Object.entries(files).map(([name, text]) => {
                this.file(assetBase + "/" + name, text);
                return { name, browser_download_url: assetBase + "/" + name };
            });
            const release = { tag_name: tag, assets };
            this.json(apiBase + "/releases/tags/" + encodeURIComponent(tag), release);
            return release;
        },
    };
}
