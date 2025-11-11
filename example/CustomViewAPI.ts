import { Locator } from "playwright";
import { expect } from "playwright/test";
import { ObsidianAPI } from "../src";
import { ObsidianPageTextContext } from "../src/helpers/types";

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
