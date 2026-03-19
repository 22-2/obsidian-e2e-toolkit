import { expect, test } from "obsidian-e2e-toolkit";
import { externalPluginPath } from "./test-utils";

test.use({
    vaultOptions: {
        logLevel: "info",
        fresh: true,
        plugins: [
            {
                path: externalPluginPath("obsidian42-brat"),
            },
        ],
    },
});

test("plugin activation", async ({ obsidian }) => {
    expect(await obsidian.isPluginEnabled("obsidian42-brat")).toBe(true);
    expect(await obsidian.plugin("obsidian42-brat")).toBeTruthy();
});
