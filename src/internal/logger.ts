import chalk from "chalk";
import log from "loglevel";
import prefix from "loglevel-plugin-prefix";
import type { BrowserConsoleLoggingOptions } from "./types";

type LogMethod = "trace" | "debug" | "info" | "warn" | "error";

export interface LogScope {
    runId?: string;
    phase?: string;
}

export interface BrowserConsoleLoggerConfig {
    scope?: LogScope;
    options?: BrowserConsoleLoggingOptions;
}

// 色の設定
const colors = {
    TRACE: chalk.magenta,
    DEBUG: chalk.cyan,
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red,
};

// prefix プラグインを適用
prefix.reg(log);

prefix.apply(log, {
    format(level, name, timestamp) {
        const color =
            colors[level.toUpperCase() as keyof typeof colors] || chalk.white;
        const paddedLevel = level.toUpperCase().padEnd(5, " ");
        const nameStr = name ? `[${name}]` : "";
        return `${chalk.gray(`[${timestamp}]`)} ${color(paddedLevel)} ${chalk.green(
            nameStr,
        )}`;
    },
});

// デフォルトレベルを設定
log.setDefaultLevel("warn");

// Test Setup Factory
// ===================================================================
/**
 * Creates a new ObsidianTestSetup instance with the provided configuration
 *
 * @param config - Configuration object with plugin directory and optional settings
 * @returns Configured ObsidianTestSetup instance ready to launch
 *
 * @example
 * ```typescript
 * import { createTestSetup } from 'obsidian-e2e';
 *
 * const setup = createTestSetup({
 *   pluginDir: process.cwd(),
 *   distDir: 'dist',
 * });
 *
 * await setup.launch();
 * const vault = await setup.openVault({
 *   plugins: [{
 *     path: setup.getPaths().distDir,
 *     pluginId: setup.getPaths().pluginId,
 *   }],
 * });
 * ```
 */
// import { resolveConfig } from "./config";
// export function createTestSetup(
//   config: import("./config").ObsidianE2EConfig
// ): ObsidianTestLauncher {
//   const paths = resolveConfig(config);
//   return new ObsidianTestLauncher(paths);
// }
// ===================================================================
// Console Logging Helpers
// ===================================================================
function formatScope(scope?: LogScope): string {
    if (!scope) {
        return "";
    }

    const entries = [
        scope.runId ? `run=${scope.runId}` : "",
        scope.phase ? `phase=${scope.phase}` : "",
    ].filter(Boolean);

    return entries.length ? `[${entries.join(" ")}] ` : "";
}

export function formatLogMessage(message: string, scope?: LogScope): string {
    return `${formatScope(scope)}${message}`;
}

export function createScopedLogger(name: string, scope?: LogScope) {
    const scoped = log.getLogger(name);

    const invoke = (method: LogMethod, message: string, ...args: unknown[]) => {
        scoped[method](formatLogMessage(message, scope), ...args);
    };

    return {
        trace: (message: string, ...args: unknown[]) =>
            invoke("trace", message, ...args),
        debug: (message: string, ...args: unknown[]) =>
            invoke("debug", message, ...args),
        info: (message: string, ...args: unknown[]) =>
            invoke("info", message, ...args),
        warn: (message: string, ...args: unknown[]) =>
            invoke("warn", message, ...args),
        error: (message: string, ...args: unknown[]) =>
            invoke("error", message, ...args),
    };
}

export function createRunId(testTitle?: string): string {
    const normalized = (testTitle || "test")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 24);

    return `${normalized || "test"}-${Date.now().toString(36)}`;
}

const DEFAULT_BROWSER_CONSOLE_LOGGING_OPTIONS: Required<BrowserConsoleLoggingOptions> =
    {
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
    };

function resolveBrowserConsoleLoggerConfig(
    configOrScope?: BrowserConsoleLoggerConfig | LogScope,
    maybeOptions?: BrowserConsoleLoggingOptions,
): { scope?: LogScope; options: Required<BrowserConsoleLoggingOptions> } {
    const isScopeOnly =
        !!configOrScope &&
        (Object.prototype.hasOwnProperty.call(configOrScope, "runId") ||
            Object.prototype.hasOwnProperty.call(configOrScope, "phase"));

    const scope = isScopeOnly
        ? (configOrScope as LogScope)
        : (configOrScope as BrowserConsoleLoggerConfig | undefined)?.scope;
    const providedOptions = isScopeOnly
        ? maybeOptions
        : (configOrScope as BrowserConsoleLoggerConfig | undefined)?.options;

    return {
        scope,
        options: {
            ...DEFAULT_BROWSER_CONSOLE_LOGGING_OPTIONS,
            ...providedOptions,
        },
    };
}

function abbreviateMessage(
    text: string,
    options: Required<BrowserConsoleLoggingOptions>,
): string {
    const maxLength =
        options.maxMessageLength > 0
            ? options.maxMessageLength
            : Number.MAX_SAFE_INTEGER;
    const previewLength = Math.min(
        options.previewLength > 0 ? options.previewLength : maxLength,
        maxLength,
    );
    const normalized = text.trim();

    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, previewLength)}... [${normalized.length} chars; truncated at ${maxLength}]`;
}

function shouldDemoteError(
    type: string,
    message: string,
    demoteErrorPatterns: RegExp[],
): boolean {
    if (!(["error", "assert"].includes(type) || type === "pageerror")) {
        return false;
    }

    return demoteErrorPatterns.some((pattern) => pattern.test(message));
}

function toLogMethod(type: string): LogMethod {
    if (["error", "assert"].includes(type)) {
        return "error";
    }

    if (["warning", "warn"].includes(type)) {
        return "warn";
    }

    if (type === "debug") {
        return "debug";
    }

    return "info";
}

export function setupBrowserConsoleLogging(
    window: any,
    configOrScope?: BrowserConsoleLoggerConfig | LogScope,
    maybeOptions?: BrowserConsoleLoggingOptions,
): void {
    const { scope, options } = resolveBrowserConsoleLoggerConfig(
        configOrScope,
        maybeOptions,
    );
    const browserLogger = createScopedLogger("BrowserConsole", scope);
    const enabledTypes = new Set(
        options.enabledTypes.map((type) => type.toLowerCase()),
    );
    const ignoredMessagePatterns = options.ignoredMessagePatterns.map(
        (pattern) => new RegExp(pattern, "i"),
    );
    const demoteErrorPatterns = options.demoteErrorMessagePatterns.map(
        (pattern) => new RegExp(pattern, "i"),
    );

    window.on("console", (msg: any) => {
        const type = msg.type().toLowerCase();
        if (!enabledTypes.has(type)) {
            return;
        }

        const text = msg.text();
        if (ignoredMessagePatterns.some((pattern) => pattern.test(text))) {
            return;
        }

        const abbreviated = abbreviateMessage(text, options);
        const method = shouldDemoteError(type, abbreviated, demoteErrorPatterns)
            ? "warn"
            : toLogMethod(type);

        browserLogger[method](`[BROWSER:${type.toUpperCase()}] ${abbreviated}`);

        const location = msg.location();
        if (
            options.includeLocation &&
            location.url &&
            location.url !== "about:blank"
        ) {
            browserLogger.debug(
                `[BROWSER:LOCATION] ${location.url}:${location.lineNumber}:${location.columnNumber}`,
            );
        }
    });

    window.on("pageerror", (error: Error) => {
        if (!options.includePageErrors) {
            return;
        }

        const method = shouldDemoteError(
            "pageerror",
            error.message,
            demoteErrorPatterns,
        )
            ? "warn"
            : "error";

        browserLogger[method](`[BROWSER:PAGEERROR] ${error.message}`);
        if (error.stack) {
            browserLogger.debug(`[BROWSER:STACK] ${error.stack}`);
        }
    });

    window.on("requestfailed", (request: any) => {
        if (!options.includeRequestFailures) {
            return;
        }

        browserLogger.warn(`[BROWSER:REQUESTFAILED] ${request.url()}`);
        const failure = request.failure();
        if (failure) {
            browserLogger.warn(`[BROWSER:FAILURE] ${failure.errorText}`);
        }
    });

    window.on("response", (response: any) => {
        if (
            options.includeHttpErrors &&
            response.status() >= options.httpErrorThreshold
        ) {
            browserLogger.warn(
                `[BROWSER:HTTP] ${response.status()} ${response.statusText()} - ${response.url()}`,
            );
        }
    });
}

export function toggleLoggerBy(
    level: log.LogLevelDesc,
    filter: (name: string) => boolean = () => true,
): void {
    Object.values(log.getLoggers())
        // @ts-expect-error
        .filter((logger) => filter(logger.name))
        .forEach((logger) => {
            logger.setLevel(level);
        });
    log.setLevel(level);
}
