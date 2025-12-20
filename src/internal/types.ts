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

export interface VaultOptions {
  name?: string;
  sandbox?: boolean;
  fresh?: boolean;
  logLevel?: log.LogLevelDesc;
  enableBrowserConsoleLogging?: boolean;
  plugins: TestPlugin[];
}

export interface TestPlugin {
  path: string;
  pluginId: string;
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
