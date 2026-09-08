import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import log from "loglevel";
import type { ObsidianCliMode } from "../types";

const execFileAsync = promisify(execFile);
const CLI_TIMEOUT_MS = 5000;
const CLI_MAX_BUFFER = 1024 * 1024;
const logger = log.getLogger("ObsidianCli");

type CommandError = Error & {
    stderr?: string;
};

/**
 * Runs the official Obsidian CLI only when it can be proven to target the test vault.
 *
 * The Playwright fixture still owns the isolated Electron process. This adapter is
 * intentionally best-effort in auto mode because CI runners normally do not have
 * the desktop Obsidian CLI installed.
 */
export class ObsidianCli {
    private available: boolean | undefined;

    constructor(
        private readonly mode: ObsidianCliMode = "auto",
        private readonly executable =
            process.env.OBSIDIAN_CLI_PATH || "obsidian",
    ) {}

    isRequired(): boolean {
        return this.mode === "required";
    }

    async tryEnablePlugins(
        vaultPath: string,
        vaultName: string,
        pluginIds: string[],
    ): Promise<boolean> {
        if (this.mode === "off") {
            return false;
        }

        if (!vaultName) {
            return this.fallback("The Playwright app did not provide a vault name.");
        }

        if (!(await this.isAvailable())) {
            return this.fallback("Obsidian CLI is not available on PATH.");
        }

        const target = `vault=${vaultName}`;
        let cliVaultPath: string;

        try {
            cliVaultPath = this.normalizeOutput(
                await this.run([target, "vault", "info=path"]),
            );
        } catch (error) {
            return this.fallback(
                `Could not resolve the CLI target vault: ${this.describeError(error)}`,
            );
        }

        if (!this.pathsMatch(vaultPath, cliVaultPath)) {
            return this.fallback(
                `CLI target mismatch. Expected ${vaultPath}, received ${cliVaultPath}.`,
            );
        }

        try {
            await this.run([target, "plugins:restrict", "off"]);

            for (const pluginId of pluginIds) {
                await this.run([
                    target,
                    "plugin:enable",
                    `id=${pluginId}`,
                    "filter=community",
                ]);
            }

            logger.debug(
                `Enabled plugins through Obsidian CLI: ${pluginIds.join(", ")}`,
            );
            return true;
        } catch (error) {
            return this.fallback(
                `CLI plugin setup failed: ${this.describeError(error)}`,
            );
        }
    }

    private async isAvailable(): Promise<boolean> {
        if (this.available !== undefined) {
            return this.available;
        }

        try {
            await this.run(["version"]);
            this.available = true;
        } catch (error) {
            this.available = false;
            logger.debug(
                `Obsidian CLI is unavailable: ${this.describeError(error)}`,
            );
        }

        return this.available;
    }

    private async run(args: string[]): Promise<string> {
        const result = await execFileAsync(this.executable, args, {
            timeout: CLI_TIMEOUT_MS,
            maxBuffer: CLI_MAX_BUFFER,
            windowsHide: true,
        });

        return String(result.stdout ?? "");
    }

    private fallback(reason: string): false {
        if (this.mode === "required") {
            throw new Error(`Obsidian CLI is required but cannot be used: ${reason}`);
        }

        logger.debug(`${reason} Falling back to Playwright.`);
        return false;
    }

    private normalizeOutput(output: string): string {
        const lines = output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const lastLine = lines.at(-1) || "";
        return lastLine.replace(/^=>\s*/, "");
    }

    private pathsMatch(expected: string, actual: string): boolean {
        const normalizePath = (value: string) => {
            const normalized = path.normalize(path.resolve(value));
            return normalized.replace(/[\\/]$/, "");
        };

        const expectedPath = normalizePath(expected);
        const actualPath = normalizePath(actual);

        if (process.platform === "win32") {
            return expectedPath.toLowerCase() === actualPath.toLowerCase();
        }

        return expectedPath === actualPath;
    }

    private describeError(error: unknown): string {
        const commandError = error as CommandError;
        return (
            commandError.stderr?.trim() ||
            commandError.message ||
            String(error)
        );
    }
}
