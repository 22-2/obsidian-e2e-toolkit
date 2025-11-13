// ===================================================================
// 5. StorageManager.ts - ストレージとデータの管理
// ===================================================================
import chalk from "chalk";
import type { WebContents } from "electron";
import { rmSync } from "fs";
import log from "loglevel";
import path from "path";
import type { ElectronApplication } from "playwright";
import { SANDBOX_VAULT_NAME } from "../constants";

const logger = log.getLogger("StorageManager");

export class StorageManager {
  constructor(private electronApp: ElectronApplication) {}

  async clearAll(): Promise<void> {
    await this.deleteUserDataFiles();
    await this.clearBrowserStorage();
  }

  private async deleteUserDataFiles(): Promise<void> {
    const userDataDir = await this.electronApp.evaluate(({ app }) =>
      app.getPath("userData")
    );

    const pathsToDelete = [
      path.join(userDataDir, "obsidian.json"),
      path.join(userDataDir, SANDBOX_VAULT_NAME),
    ];

    for (const p of pathsToDelete) {
      logger.debug("delete", p);
      rmSync(p, { force: true, recursive: true });
    }
  }

  private async clearBrowserStorage(): Promise<void> {
    const win = this.electronApp.windows()[0];
    if (!win) return;

    logger.log(chalk.magenta("clearing..."));

    const success = await win.evaluate(async () => {
      const webContents = (
        window as any
      ).electron.remote.BrowserWindow.getFocusedWindow()
        ?.webContents as WebContents;

      if (!webContents) return false;

      webContents.session.flushStorageData();
      await webContents.session.clearStorageData({
        storages: ["indexdb", "localstorage", "websql"],
      });
      await webContents.session.clearCache();
      return true;
    });

    const message = success
      ? chalk.magenta("localStorage cleared.")
      : chalk.red("failed to clear localStorage");

    logger.log(message);
  }
}
