import "e2e/obsidian-e2e/setup";

/**
 * カスタムビュー用のPage Object
 */
export class CustomViewAPI extends ObsidianAPI {
  constructor(
    private customViewType: string,
    vaultContext?: ObsidianPageTextContext
  ) {
    super(vaultContext, { viewType: customViewType });
  }

  get activeCustomView(): Locator {
    return this.getViewByType(this.customViewType);
  }

  get activeCustomTitle(): Locator {
    return this.getTitleByType(this.customViewType);
  }

  async setActiveEditorContent(content: string): Promise<void> {
    await this.activeEditor.focus();
    await this.activeEditor.fill(content);
  }

  async openCustomView(commandId: string, content?: string): Promise<void> {
    await this.runCommand(commandId);
    await expect(this.activeCustomView.last()).toBeVisible();

    if (content) {
      await this.setActiveEditorContent(content);
    }
  }

  async expectCustomViewCount(count: number): Promise<void> {
    await this.assertions.expectViewCount(this.customViewType, count);
  }

  async expectCustomViewTitle(title: string): Promise<void> {
    await this.assertions.expectActiveTitle(this.customViewType, title);
  }
}

// ===================================================================
// Example Test (example.test.mts)
// ===================================================================

import { Locator } from "playwright";
import { expect, test } from "../src";
import { ObsidianAPI } from "../src/ObsidianAPI";
import {
  DEFAULT_TEST_CONFIG,
  PLUGIN_ID,
  SANDBOX_VAULT_NAME,
} from "../src/constants";
import { ObsidianPageTextContext } from "../src/helpers/types";

const VIEW_TYPE_CUSTOM_VIEW = "custom-view";

class CustomPage extends CustomViewAPI {}

test.use({
  options: { ...DEFAULT_TEST_CONFIG, useSandbox: true },
});

test("sandbox test: plugin activation and view creation via command", async ({
  context: vault,
}) => {
  // 1. Initial setup verification
  // Verify Vault name
  const vaultName = await vault.page.evaluate(() => app.vault.getName());
  expect(vaultName).toBe(SANDBOX_VAULT_NAME);

  // Verify plugin activation
  expect(
    await vault.page.evaluate(
      (pluginId) => app.plugins.getPlugin(pluginId),
      PLUGIN_ID
    )
  ).toBeTruthy();

  // Instantiate HotSandboxPage
  const customPage = new CustomPage(VIEW_TYPE_CUSTOM_VIEW, vault);
});
