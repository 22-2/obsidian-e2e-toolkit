import type { Locator, Page } from "playwright";

/** 設定ウィンドウ（または vault 画面の設定モーダル）の左メニューに出る見出しのマーカー。 */
export const SETTINGS_WINDOW_MARKER = ".vertical-tab-header";

/**
 * 設定画面の項目名（.setting-item-name）のうち、表示文字列が完全一致する可視の最初の要素。
 * 左メニューには限定しない。プラグインの最初の設定ページ内の項目（Modes、General など）も対象にする。
 * ヘッダーや説明文の同名テキストは .setting-item-name の外なので、対象から外れる。
 */
export function settingItemNamed(page: Page, name: string): Locator {
    const exact = new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`);
    return page.locator(".setting-item-name").filter({ hasText: exact }).filter({ visible: true }).first();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
