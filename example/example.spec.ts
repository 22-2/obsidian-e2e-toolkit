// ===================================================================
// Example Test (example.test.ts)
// ===================================================================

// ===================================================================
// Example Test (example.test.ts)
// ===================================================================

import { expect, test } from "../src";
import path from "path";

test.use({
  vaultOptions: {
    plugins: [
      {
        path: path.resolve("example/sample-plugin"),
        // pluginId: "sample-plugin",
      },
    ],
  },
});

test("plugin activation test", async ({ obsidian }) => {
  // Verify plugin activation
  expect(await obsidian.plugin("sample-plugin")).toBeTruthy();
});

