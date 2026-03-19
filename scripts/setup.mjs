import * as asar from "@electron/asar";
import chalk from "chalk";
import { createReadStream, createWriteStream, existsSync } from "fs";
import {
    copyFile,
    mkdir,
    rename,
    rm,
    cp,
    readFile,
    writeFile,
} from "fs/promises";
import { findDown } from "find-up";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import zlib from "zlib";
import * as tar from "tar";

// =============================================================================
// Logger
// =============================================================================

const log = {
    info: (msg) => console.log(chalk.cyan(msg)),
    success: (msg) => console.log(chalk.green(msg)),
    warn: (msg) => console.log(chalk.yellow(msg)),
    error: (msg) => console.error(chalk.red(msg)),
};

// =============================================================================
// Paths
// =============================================================================

function resolvePaths() {
    const __filename = fileURLToPath(import.meta.url);
    const scriptDir = path.dirname(__filename);
    const repoRoot = path.resolve(scriptDir, "..");
    const initCwd = process.env.INIT_CWD || "";
    const toolkitHome =
        process.env.OBSIDIAN_E2E_TOOLKIT_HOME ||
        (initCwd && path.resolve(initCwd) !== path.resolve(repoRoot)
            ? initCwd
            : repoRoot);

    const cacheRoot = path.join(toolkitHome, "obsidian-e2e-toolkit-assets");
    const cacheDir = path.join(cacheRoot, "cache");
    const unpackedDir = path.join(cacheRoot, "obsidian-unpacked");

    return {
        cacheDir,
        unpackedDir,
        appAsarPath: path.join(cacheDir, "app.asar"),
        appTarGzPath: path.join(cacheDir, "app.tar.gz"),
        appExtractDir: path.join(cacheDir, "app-extracted"),
        obsidianAsarGzPath: path.join(cacheDir, "obsidian.asar.gz"),
        obsidianAsarPath: path.join(cacheDir, "obsidian.asar"),
        releaseCachePath: path.join(cacheDir, "release-latest.json"),
    };
}

// =============================================================================
// GitHub API
// =============================================================================

function getGitHubHeaders() {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    const base = {
        Accept: "application/vnd.github+json",
        "User-Agent": "obsidian-e2e-toolkit-setup",
    };
    return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

async function fetchLatestRelease(headers) {
    log.info("Fetching latest Obsidian release from GitHub...");
    const res = await fetch(
        "https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest",
        { headers },
    );
    if (!res.ok) {
        throw new Error(
            `Failed to fetch release info: ${res.status} ${res.statusText}`,
        );
    }
    return res.json();
}

async function loadRelease(releaseCachePath, headers) {
    if (existsSync(releaseCachePath)) {
        try {
            const raw = await readFile(releaseCachePath, "utf8");
            const cached = JSON.parse(raw);
            if (cached?.assets?.length) {
                log.info(
                    `Using cached release metadata (${cached.tag_name ?? "unknown"})`,
                );
                return cached;
            }
        } catch {
            log.warn(
                "Failed to read cached release metadata. Falling back to GitHub API.",
            );
        }
    }

    const release = await fetchLatestRelease(headers);
    log.success(`Found Obsidian ${release.tag_name}`);

    try {
        await writeFile(
            releaseCachePath,
            JSON.stringify(release, null, 2),
            "utf8",
        );
    } catch {
        log.warn("Failed to cache release metadata. Continuing without cache.");
    }

    return release;
}

function findReleaseAsset(assets, pattern) {
    const asset = assets.find((a) => a.name.match(pattern));
    if (!asset)
        throw new Error(`Could not find asset matching ${pattern} in release`);
    return asset;
}

// =============================================================================
// File Utilities
// =============================================================================

async function downloadFile(url, destPath, headers) {
    log.info(`Downloading from ${url}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
        throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    }
    await pipeline(res.body, createWriteStream(destPath));
    log.success(`Downloaded to ${destPath}`);
}

async function decompressGzip(srcPath, destPath) {
    log.info(`Decompressing ${path.basename(srcPath)}...`);
    await pipeline(
        createReadStream(srcPath),
        zlib.createGunzip(),
        createWriteStream(destPath),
    );
    log.success(`Decompressed to ${destPath}`);
}

// =============================================================================
// Asset Acquisition
// =============================================================================

/**
 * Ensures app.asar exists in the cache.
 * Downloads the tar.gz release asset if needed, extracts app.asar from it,
 * and copies any accompanying .unpacked directory.
 */
async function ensureAppAsar(
    { appAsarPath, appTarGzPath, appExtractDir },
    release,
    headers,
) {
    if (existsSync(appAsarPath)) {
        log.info(`Using cached ${appAsarPath}`);
        return;
    }

    if (!existsSync(appTarGzPath)) {
        const asset = findReleaseAsset(
            release.assets,
            /obsidian-[\d.]+\.tar\.gz$/,
        );
        await downloadFile(asset.browser_download_url, appTarGzPath, headers);
    }

    log.info("Extracting app.tar.gz to find app.asar...");
    await mkdir(appExtractDir, { recursive: true });
    await tar.extract({ file: appTarGzPath, cwd: appExtractDir });

    const foundAsar = await findDown("app.asar", {
        cwd: appExtractDir,
        depth: 10,
        type: "file",
    });
    if (!foundAsar)
        throw new Error("Could not find app.asar in extracted tar.gz archive");

    log.info(`Found app.asar at ${foundAsar}`);
    await copyFile(foundAsar, appAsarPath);
    log.success("Copied app.asar to cache");

    const srcUnpacked = `${foundAsar}.unpacked`;
    const destUnpacked = `${appAsarPath}.unpacked`;
    if (existsSync(srcUnpacked)) {
        log.info("Copying app.asar.unpacked to cache...");
        await cp(srcUnpacked, destUnpacked, { recursive: true });
        log.success("Copied app.asar.unpacked to cache");
    }

    await rm(appExtractDir, { recursive: true, force: true });
}

/**
 * Ensures obsidian.asar exists in the cache.
 * Downloads obsidian.asar.gz if needed and decompresses it.
 */
async function ensureObsidianAsar(
    { obsidianAsarPath, obsidianAsarGzPath },
    release,
    headers,
) {
    if (existsSync(obsidianAsarPath)) {
        log.info(`Using cached ${obsidianAsarPath}`);
        return;
    }

    if (!existsSync(obsidianAsarGzPath)) {
        const asset = findReleaseAsset(release.assets, /\.asar\.gz$/);
        await downloadFile(
            asset.browser_download_url,
            obsidianAsarGzPath,
            headers,
        );
    } else {
        log.info(`Using cached ${obsidianAsarGzPath}`);
    }

    await decompressGzip(obsidianAsarGzPath, obsidianAsarPath);
}

// =============================================================================
// Unpack
// =============================================================================

async function unpackAssets({ unpackedDir, appAsarPath, obsidianAsarPath }) {
    log.info("\nUnpacking Obsidian ASAR archives...");

    if (existsSync(unpackedDir)) {
        log.info("Cleaning up previous unpack directory...");
        await rm(unpackedDir, { recursive: true, force: true });
    }
    await mkdir(unpackedDir, { recursive: true });

    log.info(`Extracting ${appAsarPath} to ${unpackedDir}`);
    asar.extractAll(appAsarPath, unpackedDir);

    const mainJsPath = path.join(unpackedDir, "main.js");
    const mainCjsPath = path.join(unpackedDir, "main.cjs");
    if (existsSync(mainJsPath)) {
        log.info("Renaming main.js to main.cjs...");
        await rename(mainJsPath, mainCjsPath);
        log.success("Renamed main.js → main.cjs");
    } else {
        log.warn("main.js not found after extraction. Skipping rename.");
    }

    log.info(`Copying obsidian.asar to ${unpackedDir}/`);
    await copyFile(obsidianAsarPath, path.join(unpackedDir, "obsidian.asar"));
}

// =============================================================================
// Entry Point
// =============================================================================

async function main() {
    log.success("Starting E2E setup process...");

    const paths = resolvePaths();
    const headers = getGitHubHeaders();

    // Skip if already unpacked
    if (
        existsSync(paths.unpackedDir) &&
        existsSync(path.join(paths.unpackedDir, "main.cjs"))
    ) {
        log.info("Obsidian assets already unpacked. Skipping setup.");
        return;
    }

    log.info("\nFetching Obsidian release assets...");
    await mkdir(paths.cacheDir, { recursive: true });

    const needRelease =
        (!existsSync(paths.appAsarPath) && !existsSync(paths.appTarGzPath)) ||
        (!existsSync(paths.obsidianAsarPath) &&
            !existsSync(paths.obsidianAsarGzPath));

    const release = needRelease
        ? await loadRelease(paths.releaseCachePath, headers)
        : null;

    await ensureAppAsar(paths, release, headers);
    await ensureObsidianAsar(paths, release, headers);
    await unpackAssets(paths);

    log.success("\nAsset unpacking completed.");
    log.success("E2E setup process finished successfully.");
}

main().catch((err) => {
    log.error("\nE2E setup process failed:");
    log.error(err);
    process.exit(1);
});
