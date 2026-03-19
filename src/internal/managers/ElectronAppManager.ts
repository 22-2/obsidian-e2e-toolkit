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
import { createRequire } from "module";
import { existsSync } from "fs";

const logger = log.getLogger("ElectronAppManager");

export class ElectronAppManager {
    private electronApp?: ElectronApplication;
    private tempUserDataDir: string;

    constructor(
        private paths: ResolvedPaths,
        tempUserDataDir: string,
    ) {
        this.tempUserDataDir = tempUserDataDir;
    }

    async launch(): Promise<ElectronApplication> {
        this.electronApp = await this.launchElectronApp();
        return this.electronApp;
    }

    private async launchElectronApp(): Promise<ElectronApplication> {
        // Preflight: ensure `electron` package is resolvable and has its binary installed
        try {
            const req = createRequire(import.meta.url);
            const pkgJson = req.resolve("electron/package.json");
            const electronRoot = path.dirname(pkgJson);
            const distDir = path.join(electronRoot, "dist");
            if (!existsSync(distDir)) {
                logger.error(`Electron dist not found at ${distDir}`);
                logger.error(
                    `Electron root contents:`,
                    await fs.readdir(electronRoot),
                );
                throw new Error(
                    "Electron appears to be missing its platform binaries. Ensure `electron` was installed correctly.",
                );
            }
        } catch (err: any) {
            logger.error(
                "Electron preflight check failed:",
                err && err.message ? err.message : err,
            );
            throw err;
        }
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
            try {
                await this.closeAllWindows();
                await this.electronApp.close();
            } catch (error) {
                logger.warn("Error during cleanup:", error);
            }
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
