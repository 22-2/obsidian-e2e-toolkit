import type { ElectronApplication, JSHandle, Page } from "playwright";
import { ObsidianAPI } from "../ObsidianAPI";
import type { ResolvedPaths } from "./config";
import type { ObsidianTestLauncher } from "./launcher";

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
  vaultPath?: string;
  forceNewVault?: boolean;
  useSandbox?: boolean;
  showLoggerOnNode?: boolean;
  plugins?: TestPlugin[];
}

export interface TestPlugin {
  path: string;
  pluginId: string;
  useSymlink?: boolean;
}

export type TestFixtures = {
  obsLauncher: ObsidianTestLauncher;
  obsOptions: VaultOptions;
  obsidian: ObsidianAPI;
};

export type WorkerFixtures = object;
