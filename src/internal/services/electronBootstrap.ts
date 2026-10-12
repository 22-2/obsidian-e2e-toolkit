import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { getElectronMainLogPath } from "./electronMainLogging";

export async function createElectronBootstrap(
    appMainJsPath: string,
    tempUserDataDir: string,
): Promise<string> {
    const appDir = path.dirname(appMainJsPath);
    const packagePath = path.join(appDir, "package.json");
    const appPackage = existsSync(packagePath)
        ? JSON.parse(await fs.readFile(packagePath, "utf8"))
        : { name: "obsidian-e2e", version: "0.0.0" };
    const bootstrapDir = path.join(tempUserDataDir, "electron-bootstrap");
    await fs.mkdir(bootstrapDir, { recursive: true });

    // Electron が通常どおり名前とバージョンを初期化できるよう、元のメタデータを保つ。
    await fs.writeFile(
        path.join(bootstrapDir, "package.json"),
        JSON.stringify({ ...appPackage, type: "commonjs", main: "bootstrap.cjs" }),
        "utf8",
    );
    await fs.writeFile(
        path.join(bootstrapDir, "bootstrap.cjs"),
        `const { app } = require("electron");
const { appendFileSync } = require("node:fs");
const { format } = require("node:util");
const logPath = ${JSON.stringify(getElectronMainLogPath(tempUserDataDir))};

// アプリ読み込み前から同期保存し、起動失敗や終了直前の例外も残す。
function record(level, ...args) {
    const entry = { timestamp: new Date().toISOString(), level, message: format(...args) };
    try {
        appendFileSync(logPath, JSON.stringify(entry) + "\\n", "utf8");
    } catch (error) {
        process.stderr.write("Could not write Electron main log: " + String(error) + "\\n");
        process.stderr.write(entry.message + "\\n");
    }
}

for (const [method, level] of Object.entries({ log: "info", info: "info", debug: "debug", warn: "warn", error: "error" })) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
        record(level, ...args);
        original(...args);
    };
}
process.on("uncaughtExceptionMonitor", (error, origin) => {
    record("error", origin + ":", error);
});
process.on("warning", (warning) => {
    record("warn", warning);
});
record("info", "Starting Obsidian", { main: ${JSON.stringify(appMainJsPath)}, versions: process.versions });

// Obsidian は app:// の要求で frame.origin を参照するが、フレームは省略・破棄されることがある。
// 元の検証を維持しつつ、検証できない要求だけを拒否する。HTTP 等の要求には介入しない。
app.on("session-created", (session) => {
    const webRequest = session.webRequest;
    const original = webRequest.onBeforeRequest.bind(webRequest);
    webRequest.onBeforeRequest = (...args) => {
        const listener = args.at(-1);
        if (typeof listener !== "function") return original(...args);
        args[args.length - 1] = (details, callback) => {
            if (details.url.startsWith("app://") && !details.frame) {
                record("warn", "Cancelled app:// request without a frame", {
                    url: details.url,
                    method: details.method,
                    resourceType: details.resourceType,
                    webContentsId: details.webContentsId,
                });
                callback({ cancel: true });
                return;
            }
            return listener(details, callback);
        };
        return original(...args);
    };
});

// 起動直後の登録も防ぎ、通常の Obsidian の URL 関連付けを保護する。
for (const method of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient"]) {
    const original = app[method].bind(app);
    app[method] = (protocol, ...args) => {
        if (typeof protocol === "string" && protocol.toLowerCase() === "obsidian") {
            return false;
        }
        return original(protocol, ...args);
    };
}

// アセットと起動引数の解決先は元のアプリを維持する。
app.setAppPath(${JSON.stringify(appDir)});
process.argv[1] = ${JSON.stringify(appMainJsPath)};
require(${JSON.stringify(appMainJsPath)});
`,
        "utf8",
    );
    return bootstrapDir;
}
