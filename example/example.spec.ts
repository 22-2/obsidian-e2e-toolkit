import "e2e/obsidian-e2e/setup";

// ===================================================================
// Example Test (example.test.ts)
// ===================================================================

import { expect, test } from "../src";
import {
  DEFAULT_TEST_CONFIG,
  PLUGIN_ID,
  SANDBOX_VAULT_NAME,
} from "../src/helpers/constants";

test.use({
  obsOptions: { ...DEFAULT_TEST_CONFIG },
});

test("sandbox test: plugin activation and view creation via command", async ({
  obsidian,
}) => {
  // 1. Initial setup verification
  // Verify Vault name
  expect(obsidian.vaultName()).toBe(SANDBOX_VAULT_NAME);

  // Verify plugin activation

  expect(await obsidian.plugin(PLUGIN_ID)).toBeTruthy();
});
