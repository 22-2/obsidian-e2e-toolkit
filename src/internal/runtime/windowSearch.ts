import type { Locator, Page } from "playwright";

export const DEFAULT_WINDOW_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 100;

export interface WindowSearchOptions {
    timeout?: number;
    /** 失敗時のエラーに載せる、探している対象の説明。 */
    description?: string;
}

/**
 * 開いているウィンドウを一定間隔で再列挙し、locate が返す要素のうち可視なものが 1 つ以上ある最初の page を返す。
 * 先頭の要素だけは見ない。先頭が hidden で 2 個目が visible の場合も一致とする。
 * 待機中に開いたウィンドウも対象になる。リスナーは登録しないので、解除漏れは起きない。
 */
export async function findVisiblePage(
    listPages: () => readonly Page[],
    locate: (page: Page) => Locator,
    options: WindowSearchOptions = {},
): Promise<Page> {
    const timeout = options.timeout ?? DEFAULT_WINDOW_TIMEOUT_MS;
    const found = await pollUntil(() => firstVisiblePage(listPages(), locate), timeout);
    if (found) {
        return found;
    }

    const windows = openPages(listPages());
    const details = await describeMatches(windows, locate);
    throw new Error(
        `findPage: ${options.description ?? "the target element"} was not visible in any of ${windows.length} window(s) within ${timeout}ms. Windows: [${details}]`,
    );
}

/** locate が返す要素のうち可視なものが、開いているどのウィンドウにも無くなるまで待つ。 */
export async function waitUntilNoVisiblePage(
    listPages: () => readonly Page[],
    locate: (page: Page) => Locator,
    options: WindowSearchOptions = {},
): Promise<void> {
    const timeout = options.timeout ?? DEFAULT_WINDOW_TIMEOUT_MS;
    const gone = await pollUntil(async () => ((await firstVisiblePage(listPages(), locate)) ? undefined : true), timeout);
    if (gone) {
        return;
    }

    const windows = openPages(listPages());
    throw new Error(
        `waitForNoPage: ${options.description ?? "the target element"} is still visible after ${timeout}ms. Windows: [${describePages(windows)}]`,
    );
}

/** check が undefined 以外を返すまで待つ。期限までに値が出なければ undefined を返す。 */
async function pollUntil<T>(check: () => Promise<T | undefined>, timeout: number): Promise<T | undefined> {
    const deadline = Date.now() + timeout;
    for (;;) {
        const value = await check();
        if (value !== undefined) {
            return value;
        }
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
            return undefined;
        }
        await delay(Math.min(POLL_INTERVAL_MS, remaining));
    }
}

async function firstVisiblePage(pages: readonly Page[], locate: (page: Page) => Locator): Promise<Page | undefined> {
    for (const page of openPages(pages)) {
        if (await hasVisibleMatch(page, locate)) {
            return page;
        }
    }
    return undefined;
}

async function hasVisibleMatch(page: Page, locate: (page: Page) => Locator): Promise<boolean> {
    try {
        return (await locate(page).filter({ visible: true }).count()) > 0;
    } catch (error) {
        // 判定中に閉じたウィンドウだけを候補から外す。それ以外の失敗は隠さない。
        if (page.isClosed()) {
            return false;
        }
        throw error;
    }
}

function openPages(pages: readonly Page[]): Page[] {
    return pages.filter((page) => !page.isClosed());
}

function describePages(pages: readonly Page[]): string {
    return pages.map((page) => page.url() || "(no url)").join(", ");
}

/**
 * 各 window の一致数（全体と可視）を返す。hidden だけで一致している等の原因を見分けるため。
 * 診断の途中で閉じた page は一覧から外す。診断自体の失敗は行に記録するだけで、呼び出し元の timeout エラーを置き換えない。
 */
async function describeMatches(pages: readonly Page[], locate: (page: Page) => Locator): Promise<string> {
    const parts: string[] = [];
    for (const page of pages) {
        const line = await describeMatch(page, locate);
        if (line !== undefined) {
            parts.push(line);
        }
    }
    return parts.join(", ");
}

async function describeMatch(page: Page, locate: (page: Page) => Locator): Promise<string | undefined> {
    const url = page.url() || "(no url)";
    if (page.isClosed()) {
        return undefined;
    }
    try {
        const total = await locate(page).count();
        const visible = await locate(page).filter({ visible: true }).count();
        return url + " (matches: " + total + ", visible: " + visible + ")";
    } catch (error) {
        if (page.isClosed()) {
            return undefined;
        }
        const reason = error instanceof Error ? error.message : String(error);
        return url + " (match count failed: " + reason + ")";
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
