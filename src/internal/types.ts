// E:\Desktop\coding\templates\obsidian-e2e-toolkit\src\helpers\types.ts
import type { ElectronApplication, JSHandle, Page } from "playwright";
import { ObsidianAPI } from "../ObsidianAPI";
import type { ResolvedPaths } from "./path";
import log from "loglevel";

// Minimal Plugin interface to avoid importing from obsidian package
export interface Plugin {
    [key: string]: any;
}

export type PluginHandleMap = JSHandle<Map<string, Plugin>>;

export interface TestContext {
    electronApp: ElectronApplication;
    page: Page;
    vaultName?: string;
}

export interface ObsidianPageTextContext extends TestContext {
    pluginHandleMap: PluginHandleMap;
    paths: ResolvedPaths;
}

export interface BrowserConsoleLoggingOptions {
    /** Console message types to capture from Playwright's page "console" event. */
    enabledTypes?: string[];
    /** Hard limit for a single logged message length before truncation is applied. */
    maxMessageLength?: number;
    /** Number of characters to keep in the visible preview when truncating. */
    previewLength?: number;
    /** Case-insensitive regex patterns; matching messages are skipped entirely. */
    ignoredMessagePatterns?: string[];
    /** Whether to include source URL/line/column for browser console entries. */
    includeLocation?: boolean;
    /** Whether to forward page-level runtime errors (pageerror event). */
    includePageErrors?: boolean;
    /** Whether to forward failed network requests (requestfailed event). */
    includeRequestFailures?: boolean;
    /** Whether to log HTTP responses whose status meets the configured threshold. */
    includeHttpErrors?: boolean;
    /** Minimum status code treated as HTTP error for browser response logging. */
    httpErrorThreshold?: number;
}

export interface VaultOptions {
    /** Vault directory name. If omitted, a temporary vault directory is created. */
    name?: string;
    /** Open Obsidian in sandbox mode (typically disabled in CI). */
    sandbox?: boolean;
    /** Start from a clean vault state for each test run. */
    fresh?: boolean;
    /** Global toolkit logger level for the current test run. */
    logLevel?: log.LogLevelDesc;
    /** Enable forwarding browser-side console logs into toolkit logger. */
    enableBrowserConsoleLogging?: boolean;
    /** Fine-grained browser console logging behavior (filtering/truncation/threshold). */
    browserConsoleLogging?: BrowserConsoleLoggingOptions;
    /** Plugin fixtures to install into the test vault. */
    plugins: TestPlugin[];
}

export interface TestPlugin {
    path: string;
    // pluginId: string;
    symlink?: boolean;
}

// Simplified fixture types
export type TestFixtures = {
    obsidian: ObsidianAPI;
    vaultOptions: Partial<VaultOptions>;
    tempDir: string;
};

export type WorkerFixtures = {};

export type PluginConfig = {
    path: string;
    pluginId: string;
    symlink?: boolean;
};
