// ===================================================================
// 4. PluginManager.ts - プラグインの管理
// ===================================================================
import { expect } from "@playwright/test";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    statSync,
    symlinkSync,
    writeFileSync
} from "fs";
import log from "loglevel";
import path from "path";
import type { Page } from "playwright";
import type { ObsidianCliMode, PluginConfig } from "../types";
import { ObsidianCli } from "./ObsidianCli";

const logger = log.getLogger("PluginManager");

export class PluginManager {
    constructor(
        private plugins: PluginConfig[],
        private vaultPath: string,
        cliMode: ObsidianCliMode = "auto",
    ) {
        this.obsidianCli = new ObsidianCli(cliMode);
    }

    private readonly obsidianCli: ObsidianCli;

    async installAll(): Promise<void> {
        const pluginsDir = this.ensurePluginsDirectory();
        const installedIds: string[] = [];
        const installedPlugins: PluginConfig[] = [];
        const failedPlugins: string[] = [];

        for (const plugin of this.getPlugins()) {
            if (await this.installSingle(pluginsDir, plugin)) {
                installedIds.push(plugin.pluginId);
                installedPlugins.push(plugin);
            } else {
                failedPlugins.push(`${plugin.pluginId} (${plugin.path})`);
            }
        }

        // Fail fast so missing build artifacts do not become opaque waitForFunction timeouts later.
        if (failedPlugins.length > 0) {
            throw new Error(
                `Failed to install plugin fixtures: ${failedPlugins.join(", ")}. Ensure each plugin path contains manifest.json and main.js.`,
            );
        }

        // Replace the managed plugin list with only those that were successfully installed
        this.plugins = installedPlugins;

        this.updateCommunityPluginsJson(installedIds);
        logger.debug(`Installed plugins: ${installedIds.join(", ")}`);
    }

    getPlugins(): PluginConfig[] {
        return this.plugins || [];
    }

    private ensurePluginsDirectory(): string {
        const obsidianDir = path.join(this.vaultPath, ".obsidian");
        const pluginsDir = path.join(obsidianDir, "plugins");

        if (!existsSync(obsidianDir)) {
            mkdirSync(obsidianDir, { recursive: true });
        }

        if (!existsSync(pluginsDir)) {
            mkdirSync(pluginsDir, { recursive: true });
        }

        return pluginsDir;
    }

    private async installSingle(
        pluginsDir: string,
        plugin: PluginConfig,
    ): Promise<boolean> {
        if (!this.validatePluginPath(plugin)) {
            logger.warn(`Invalid plugin path: ${plugin.path}`);
            return false;
        }

        // const actualId = getActualPluginId(plugin.path);
        // if (actualId && actualId !== plugin.pluginId) {
        //   logger.info(
        //     `Plugin ID mismatch for ${plugin.path}: expected ${plugin.pluginId}, found ${actualId}. Using ${actualId}.`
        //   );
        //   (plugin as any).originalId = plugin.pluginId;
        //   plugin.pluginId = actualId;
        // }

        const destDir = path.join(pluginsDir, plugin.pluginId);

        if (plugin.symlink) {
            logger.debug(`Creating symlink for plugin: ${plugin.pluginId}`);
            return this.createPluginSymlink(
                plugin.path,
                destDir,
                plugin.pluginId,
            );
        } else {
            logger.debug(`Copying files for plugin: ${plugin.pluginId}`);
            return this.copyPluginFiles(plugin.path, destDir, plugin.pluginId);
        }
    }

    private validatePluginPath(plugin: PluginConfig): boolean {
        if (!existsSync(plugin.path)) {
            logger.warn(`Plugin path not found: ${plugin.path}`);
            return false;
        }

        if (!existsSync(path.join(plugin.path, "manifest.json"))) {
            logger.warn(`manifest.json not found in: ${plugin.path}`);
            return false;
        }

        if (!existsSync(path.join(plugin.path, "main.js"))) {
            logger.warn(`main.js not found in: ${plugin.path}`);
            return false;
        }

        return true;
    }

    private createPluginSymlink(
        sourcePath: string,
        destDir: string,
        pluginId: string,
    ): boolean {
        if (existsSync(destDir)) {
            logger.debug(
                `Destination already exists: ${destDir}, skipping symlink`,
            );
            return true;
        }

        try {
            symlinkSync(sourcePath, destDir, "dir");
            logger.debug(`Created symlink: ${sourcePath} -> ${destDir}`);
            return true;
        } catch (error) {
            logger.error(`Failed to create symlink for ${pluginId}:`, error);
            return false;
        }
    }

    private copyPluginFiles(
        sourcePath: string,
        destDir: string,
        pluginId: string,
    ): boolean {
        if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
        }

        const filesToCopy = ["manifest.json", "main.js", "styles.css"];

        for (const file of readdirSync(sourcePath)) {
            const srcFile = path.join(sourcePath, file);
            const stat = statSync(srcFile);

            if (stat.isDirectory() || !filesToCopy.includes(file)) {
                continue;
            }

            const destFile = path.join(destDir, file);
            copyFileSync(srcFile, destFile);
            logger.debug(`Copied: ${file} to ${destDir}`);
        }

        logger.debug(`Installed plugin: ${pluginId}`);
        return true;
    }

    private updateCommunityPluginsJson(installedIds: string[]): void {
        const pluginsJsonPath = path.join(
            this.vaultPath,
            ".obsidian",
            "community-plugins.json",
        );
        writeFileSync(pluginsJsonPath, JSON.stringify(installedIds));
    }

    async enableAll(page: Page): Promise<void> {
        const pluginIds = this.plugins.map((p) => p.pluginId);

        const vaultName = await page.evaluate(() => {
            const app = (window as any).app;
            return app?.vault?.getName?.() || "";
        });
        const handledByCli = await this.obsidianCli.tryEnablePlugins(
            this.vaultPath,
            vaultName,
            pluginIds,
        );

        if (handledByCli) {
            let allEnabled = false;
            try {
                await page.waitForFunction(
                    (ids) => {
                        const app = (window as any).app;
                        return ids.every((id) =>
                            app?.plugins?.enabledPlugins?.has(id),
                        );
                    },
                    pluginIds,
                    { timeout: 5000 },
                );
                allEnabled = true;
            } catch (error) {
                logger.warn(
                    "Obsidian CLI completed, but plugin state could not be observed in Playwright:",
                    error,
                );
            }

            if (allEnabled) {
                return;
            }

            if (this.obsidianCli.isRequired()) {
                throw new Error(
                    "Obsidian CLI completed, but the Playwright app did not observe all plugins.",
                );
            }

            logger.warn(
                "Obsidian CLI completed, but the Playwright app did not observe all plugins. Falling back to Playwright.",
            );
        }

        await this.disableRestrictedMode(page);
        const enabledIds = await page.evaluate(async (ids) => {
            const app = (window as any).app;
            const enabled: string[] = [];

            for (const id of ids) {
                await app.plugins.enablePluginAndSave(id);
                enabled.push(id);
            }

            return enabled;
        }, pluginIds);

        logger.debug(`Enabled plugins: ${enabledIds.join(", ")}`);
    }

    private async disableRestrictedMode(page: Page): Promise<void> {
        await this.waitForPluginsAPI(page);

        if (await this.isCommunityPluginsEnabled(page)) {
            logger.debug("Community plugins are already enabled.");
            return;
        }

        logger.debug("Enabling community plugins without opening settings...");
        const enabledWithoutReload = await page.evaluate(() => {
            const app = (window as any).app;
            const appId = app?.appId;

            if (typeof appId !== "string" || appId.length === 0) {
                return false;
            }

            // Obsidian stores restricted-mode state in this localStorage flag. Using it directly avoids
            // the settings button's reload path, which can race the temporary config JSON cleanup in E2E.
            localStorage.setItem(`enable-plugin-${appId}`, "true");
            return app.plugins.isEnabled?.() === true;
        });

        if (enabledWithoutReload) {
            return;
        }

        // Keep the UI flow as a compatibility fallback for Obsidian builds whose internal storage key differs.
        logger.debug("Falling back to the community plugins settings UI...");
        await this.openCommunityPluginsSettings(page);
        await this.clickEnableButtons(page);
        await this.closeCommunityPluginsSettings(page);
        await this.verifyCommunityPluginsEnabled(page);
    }

    private async waitForPluginsAPI(page: Page): Promise<void> {
        await page.waitForFunction(
            () => {
                const app = (window as any).app;
                return app?.plugins?.isEnabled !== undefined;
            },
            { timeout: 10000 },
        );
    }

    private async isCommunityPluginsEnabled(page: Page): Promise<boolean> {
        return await page.evaluate(() => {
            const app = (window as any).app;
            return app?.plugins?.isEnabled?.() ?? false;
        });
    }

    private async openCommunityPluginsSettings(page: Page): Promise<void> {
        await page.evaluate(() => {
            (window as any).app.setting.open();
            (window as any).app.setting.openTabById("community-plugins");
        });
    }

    private async clickEnableButtons(page: Page): Promise<void> {
        const getButtonText = () =>
            page.evaluate(() => {
                const button = (
                    window as any
                ).app.setting.activeTab?.setting?.contentEl?.querySelector(
                    "button.mod-cta",
                ) as HTMLElement | null;
                return button?.textContent?.trim() || null;
            });

        const clickButton = () =>
            page.evaluate(() => {
                const button = (
                    window as any
                ).app.setting.activeTab?.setting?.contentEl?.querySelector(
                    "button.mod-cta",
                ) as HTMLElement | null;
                button?.click();
            });

        let buttonText = await getButtonText();

        if (buttonText === "Turn on and reload") {
            logger.debug("Clicking 'Turn on and reload'...");
            await clickButton();
            await page.waitForTimeout(1000);
            buttonText = await getButtonText();
        }

        if (buttonText === "Turn on community plugins") {
            logger.debug("Clicking 'Turn on community plugins'...");
            await clickButton();
            await page.waitForTimeout(1000);
        }
    }

    private async closeCommunityPluginsSettings(page: Page): Promise<void> {
        await page.keyboard.press("Escape");
    }

    private async verifyCommunityPluginsEnabled(page: Page): Promise<void> {
        const isEnabled = await this.isCommunityPluginsEnabled(page);
        expect(isEnabled, "Failed to enable community plugins.").toBe(true);
    }
}

export function getActualPluginId(pluginPath: string): string {
    const manifestPath = path.join(pluginPath, "manifest.json");
    if (existsSync(manifestPath)) {
        try {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
            return manifest.id;
        } catch (e) {
            logger.warn(`Failed to parse manifest.json at ${pluginPath}`);
        }
    }
    return "";
}
