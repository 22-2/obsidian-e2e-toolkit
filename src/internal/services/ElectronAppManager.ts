// ===================================================================
// 1. ElectronAppManager.ts - Electronアプリケーションの起動と管理
// ===================================================================
import { spawnSync } from "child_process";
import { once } from "events";
import log from "loglevel";
import type { ElectronApplication, Page } from "playwright";
import { _electron as electron } from "playwright/test";
import type { ResolvedPaths } from "../path";
import { createLaunchOptions } from "../path";
import { createElectronBootstrap } from "./electronBootstrap";
import { withoutElectronRunAsNode } from "../electronEnv";
import { resolveElectronExecutable } from "../electronExecutable";

const logger = log.getLogger("ElectronAppManager");

// Obsidian sometimes never exits after close() on CI Windows runners. Without a bound,
// fixture teardown hangs until Playwright's test timeout, and again on every retry.
const CLOSE_TIMEOUT_MS = 15_000;
// Give the killed processes a moment to release the temp user data and vault directories.
const KILL_EXIT_TIMEOUT_MS = 5_000;

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
        const executablePath = resolveElectronExecutable();
        const baseLaunchOptions = createLaunchOptions(this.paths);
        // Guard protocol registration before Obsidian runs, including with cached assets.
        const bootstrapDir = await createElectronBootstrap(
            this.paths.appMainJsPath,
            this.tempUserDataDir,
        );
        const launchOptions = {
            ...baseLaunchOptions,
            executablePath,
            args: [
                bootstrapDir,
                ...baseLaunchOptions.args.slice(1),
                `--user-data-dir=${this.tempUserDataDir}`,
            ],
            env: {
                ...withoutElectronRunAsNode(baseLaunchOptions.env),
                PLAYWRIGHT: "true",
                CI: process.env.CI || "false",
            },
        };

        return await electron.launch(launchOptions);
    }

    async cleanup(): Promise<void> {
        if (this.electronApp) {
            const closed = await this.closeWithin(
                this.electronApp,
                CLOSE_TIMEOUT_MS,
            );
            if (!closed) {
                await this.forceKill(this.electronApp);
            }
        }

        logger.debug("ElectronAppManager cleaned up");
    }

    /** @returns false when the app did not finish closing within `timeoutMs`. */
    private async closeWithin(
        app: ElectronApplication,
        timeoutMs: number,
    ): Promise<boolean> {
        let timer: NodeJS.Timeout | undefined;
        const timedOut = new Promise<false>((resolve) => {
            timer = setTimeout(() => resolve(false), timeoutMs);
        });
        try {
            return await Promise.race([
                this.closeGracefully(app).then(() => true as const),
                timedOut,
            ]);
        } finally {
            clearTimeout(timer);
        }
    }

    private async closeGracefully(app: ElectronApplication): Promise<void> {
        try {
            await Promise.all(app.windows().map((win) => win.close()));
            await app.close();
        } catch (error) {
            logger.warn("Error during cleanup:", error);
        }
    }

    private async forceKill(app: ElectronApplication): Promise<void> {
        const child = app.process();
        logger.warn(
            `Obsidian did not close within ${CLOSE_TIMEOUT_MS}ms. Killing process ${child.pid}.`,
        );
        if (child.exitCode !== null || child.signalCode !== null) return;

        // Playwright reports the app closed only after the stdio pipes close, and
        // Electron's helper processes inherit them. Kill the whole tree, as
        // Playwright does for its own forced shutdown, or teardown keeps waiting.
        const closed = once(child, "close");
        if (process.platform === "win32") {
            spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
                windowsHide: true,
            });
        } else {
            try {
                // Playwright launches Electron detached, so the pid also names its process group.
                process.kill(-child.pid!, "SIGKILL");
            } catch (error) {
                // The group can exit between the exit check and the kill.
                logger.warn("Failed to kill Obsidian process group:", error);
            }
        }
        let timer: NodeJS.Timeout | undefined;
        await Promise.race([
            closed,
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, KILL_EXIT_TIMEOUT_MS);
            }),
        ]);
        clearTimeout(timer);
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
