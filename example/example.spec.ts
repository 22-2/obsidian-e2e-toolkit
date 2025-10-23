import "e2e/obsidian-e2e/setup";
import { CustomViewPageObject } from "./../src/helpers/ObsidianPageObject";

// ===================================================================
// Example Test (example.test.mts)
// ===================================================================

import { expect, test } from "../src";
import {
  DEFAULT_TEST_CONFIG,
  PLUGIN_ID,
  SANDBOX_VAULT_NAME,
} from "../src/constants";

const VIEW_TYPE_CUSTOM_VIEW = "custom-view";

class CustomPage extends CustomViewPageObject {}

test.use({
  vaultOptions: { ...DEFAULT_TEST_CONFIG, useSandbox: true },
});

test("sandbox test: plugin activation and view creation via command", async ({
  vault,
}) => {
  // 1. Initial setup verification
  // Verify Vault name
  const vaultName = await vault.window.evaluate(() => app.vault.getName());
  expect(vaultName).toBe(SANDBOX_VAULT_NAME);

  // Verify plugin activation
  expect(
    await vault.window.evaluate(
      (pluginId) => app.plugins.getPlugin(pluginId),
      PLUGIN_ID
    )
  ).toBeTruthy();

  // Instantiate HotSandboxPage
  const customPage = new CustomPage(VIEW_TYPE_CUSTOM_VIEW, vault);
});
