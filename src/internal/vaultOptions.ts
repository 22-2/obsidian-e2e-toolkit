import { toMerged } from "es-toolkit";
import type { VaultOptions } from "./types";

export const DEFAULT_VAULT_OPTIONS: VaultOptions = {
    sandbox: false,
    fresh: true,
    logLevel: "warn",
    browserConsoleLogging: {
        enabledTypes: ["warning", "warn", "error", "assert"],
        maxMessageLength: 300,
        previewLength: 160,
        ignoredMessagePatterns: ["Electron Security Warning"],
        demoteErrorMessagePatterns: ["Timeout waiting for plugin .+ to load"],
        includeLocation: false,
        includePageErrors: true,
        includeRequestFailures: true,
        includeHttpErrors: true,
        httpErrorThreshold: 400,
    },
    obsidianCli: "auto",
    plugins: [],
};

/**
 * Builds the options for one test from the shared defaults.
 *
 * `merge` mutates its target and merges arrays by index, so merging straight into
 * DEFAULT_VAULT_OPTIONS let a longer `plugins` list leak its tail into every later
 * test in the same worker. `toMerged` works on a deep clone of the defaults instead.
 */
export function resolveVaultOptions(vaultOptions: Partial<VaultOptions>): VaultOptions {
    return toMerged(DEFAULT_VAULT_OPTIONS, vaultOptions);
}
