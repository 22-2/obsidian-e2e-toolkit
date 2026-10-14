import type { PlaywrightTestConfig } from "@playwright/test";

type UseOptions = NonNullable<PlaywrightTestConfig["use"]>;
type ExpectOptions = NonNullable<PlaywrightTestConfig["expect"]>;

// 共有する既定値だけを置く。workers・timeout・projects・reporter は利用者の設定に任せる。
// リトライは既定にしない。失敗を隠してテストを通すことを防ぐため。
const DEFAULT_USE: UseOptions = {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
};
const DEFAULT_EXPECT: ExpectOptions = { timeout: 5_000 };

function definedEntries<T extends object>(value: T | undefined): Partial<T> {
    if (value === undefined) return {};
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

/**
 * Playwright の設定に Obsidian E2E 向けの既定値を加える。
 * 利用者が明示した値（undefined を除く）は既定値より優先する。
 * 何度重ねて呼んでも利用者の値は消えない。Linux でも例外にしない。
 */
export function defineObsidianConfig(overrides: PlaywrightTestConfig = {}): PlaywrightTestConfig {
    const { use, expect, ...rest } = overrides;
    return {
        ...definedEntries(rest),
        use: { ...DEFAULT_USE, ...definedEntries(use) },
        expect: { ...DEFAULT_EXPECT, ...definedEntries(expect) },
    };
}
