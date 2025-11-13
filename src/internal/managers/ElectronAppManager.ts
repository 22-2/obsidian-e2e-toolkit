// ===================================================================
// 1. ElectronAppManager.ts - Electronアプリケーションの起動と管理
// ===================================================================
import fs from "fs/promises";
import log from "loglevel";
import os from "os";
import path from "path";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright/test";
import type { ResolvedPaths } from "../path";
import { createLaunchOptions } from "../path";

const logger = log.getLogger("ElectronAppManager");

export class ElectronAppManager {
  private electronApp?: ElectronApplication;
  private tempUserDataDir: string;

  constructor(private paths: ResolvedPaths, tempUserDataDir: string) {
    this.tempUserDataDir = tempUserDataDir;
  }

  async launch(): Promise<ElectronApplication> {
    this.electronApp = await this.launchElectronApp();
    return this.electronApp;
  }

  private async launchElectronApp(): Promise<ElectronApplication> {
    const baseLaunchOptions = createLaunchOptions(this.paths);
    const launchOptions = {
      ...baseLaunchOptions,
      args: [
        ...baseLaunchOptions.args,
        `--user-data-dir=${this.tempUserDataDir}`,
      ],
      env: {
        ...baseLaunchOptions.env,
        PLAYWRIGHT: "true",
        CI: process.env.CI || "false",
      },
    };

    return await electron.launch(launchOptions);
  }

  async cleanup(): Promise<void> {
    if (this.electronApp) {
      await this.closeAllWindows();
      await this.electronApp.close();
    }

    logger.debug("ElectronAppManager cleaned up");
  }

  private async closeAllWindows(): Promise<void> {
    const windows = this.electronApp!.windows();
    await Promise.all(windows.map((win) => win.close()));
  }

  getApp(): ElectronApplication {
    if (!this.electronApp) {
      throw new Error("ElectronApp not initialized");
    }
    return this.electronApp;
  }

  getCurrentPage(): Page | undefined {
    return this.electronApp?.windows()[0];
  }
  getTempUserDataDir(): string {
    return this.tempUserDataDir;
  }
}
