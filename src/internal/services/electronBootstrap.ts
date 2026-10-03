import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";

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

    // Keep Obsidian's package metadata so Electron initializes its name and version normally.
    await fs.writeFile(
        path.join(bootstrapDir, "package.json"),
        JSON.stringify({ ...appPackage, type: "commonjs", main: "bootstrap.cjs" }),
        "utf8",
    );
    await fs.writeFile(
        path.join(bootstrapDir, "bootstrap.cjs"),
        `const { app } = require("electron");

// Obsidian registers its URL handler during startup. Install this guard before
// loading it so E2E cannot replace or remove the user's installed URL handler.
for (const method of ["setAsDefaultProtocolClient", "removeAsDefaultProtocolClient"]) {
    const original = app[method].bind(app);
    app[method] = (protocol, ...args) => {
        if (typeof protocol === "string" && protocol.toLowerCase() === "obsidian") {
            return false;
        }
        return original(protocol, ...args);
    };
}

// Assets and startup arguments must still resolve against the original app.
app.setAppPath(${JSON.stringify(appDir)});
process.argv[1] = ${JSON.stringify(appMainJsPath)};
require(${JSON.stringify(appMainJsPath)});
`,
        "utf8",
    );
    return bootstrapDir;
}
