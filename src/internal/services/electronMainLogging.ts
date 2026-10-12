import { readFileSync, unwatchFile, watchFile } from "fs";
import path from "path";

type MainLogLevel = "debug" | "info" | "warn" | "error";
type MainLogger = Record<MainLogLevel, (message: string) => void>;

export function getElectronMainLogPath(tempUserDataDir: string): string {
    return path.join(tempUserDataDir, "electron-main.log");
}

/** 起動前から監視し、Playwright の接続前と切断後のログも転送する。 */
export function forwardElectronMainLogs(
    logPath: string,
    logger: MainLogger,
): () => void {
    let offset = 0;

    const flush = () => {
        let contents: string;
        try {
            contents = readFileSync(logPath, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                logger.warn(`Could not read Electron main log: ${String(error)}`);
            }
            return;
        }

        if (contents.length < offset) offset = 0;
        const end = contents.lastIndexOf("\n") + 1;
        if (end <= offset) return;
        const lines = contents.slice(offset, end).split("\n").filter(Boolean);
        offset = end;

        for (const line of lines) {
            try {
                const entry = JSON.parse(line) as {
                    level: MainLogLevel;
                    timestamp: string;
                    message: string;
                };
                logger[entry.level](
                    `[ELECTRON:MAIN:${entry.level.toUpperCase()}] ${entry.timestamp} ${entry.message}`,
                );
            } catch (error) {
                logger.warn(`Could not forward Electron main log: ${String(error)}`);
            }
        }
    };

    watchFile(logPath, { interval: 100, persistent: false }, flush);
    flush();
    return () => {
        unwatchFile(logPath, flush);
        flush();
    };
}
