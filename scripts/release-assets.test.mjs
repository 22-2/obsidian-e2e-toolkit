import assert from "node:assert/strict";
import test from "node:test";

import {
    findLatestDesktopRelease,
    hasRequiredDesktopAssets,
} from "./release-assets.mjs";

test("recognizes a release with desktop tar and asar assets", () => {
    assert.equal(
        hasRequiredDesktopAssets({
            assets: [
                { name: "obsidian-1.13.7.tar.gz" },
                { name: "obsidian-1.13.7.asar.gz" },
            ],
        }),
        true,
    );
});

test("ignores a mobile-only release when selecting the latest desktop release", () => {
    const desktopRelease = {
        tag_name: "v1.13.7",
        assets: [
            { name: "obsidian-1.13.7.tar.gz" },
            { name: "obsidian-1.13.7.asar.gz" },
        ],
    };

    assert.equal(
        findLatestDesktopRelease([
            { tag_name: "v1.13.8", assets: [{ name: "Obsidian-1.13.8.apk" }] },
            desktopRelease,
        ]),
        desktopRelease,
    );
});

test("does not select drafts or prereleases", () => {
    const desktopAssets = [
        { name: "obsidian-1.13.7.tar.gz" },
        { name: "obsidian-1.13.7.asar.gz" },
    ];

    assert.equal(
        findLatestDesktopRelease([
            { tag_name: "v1.13.8-beta", prerelease: true, assets: desktopAssets },
            { tag_name: "v1.13.8-draft", draft: true, assets: desktopAssets },
        ]),
        null,
    );
});
