import asar from "asar";
import chalk from "chalk";
import { createWriteStream, existsSync } from "fs";
import { copyFile, mkdir, rename, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import zlib from "zlib";

// =============================================================================
// Utility Functions
// =============================================================================
const log = {
  info: (msg) => console.log(chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warn: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.error(chalk.red(msg)),
};

// Download file from URL
async function downloadFile(url, destPath) {
  log.info(`Downloading from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const writer = createWriteStream(destPath);
  await pipeline(response.body, writer);
  log.success(`Downloaded to ${destPath}`);
}

// Get latest Obsidian release from GitHub API
async function getLatestObsidianRelease() {
  log.info("Fetching latest Obsidian release from GitHub...");
  const response = await fetch(
    "https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest"
  );
  if (!response.ok) {
    throw new Error(
      `Failed to fetch release info: ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  return data;
}

// Find asset by name pattern
function findAssetByName(assets, pattern) {
  return assets.find((asset) => asset.name.match(pattern));
}

// Extract tar.gz file
async function extractTarGz(tarGzPath, extractDir) {
  const { default: tar } = await import("tar");
  await tar.extract({
    file: tarGzPath,
    cwd: extractDir,
  });
}

// =============================================================================
// Core Functions
// =============================================================================

async function main() {
  log.success("Starting E2E setup process...");

  // --- Define Paths ---
  const __filename = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(__filename);
  const repoRoot = path.resolve(scriptDir, "..");

  const obsidianUnpackedPath = path.join(repoRoot, ".obsidian-unpacked");
  const cacheDir = path.join(repoRoot, ".obsidian-cache");
  const appAsarPath = path.join(cacheDir, "app.asar");
  const obsidianAsarGzPath = path.join(cacheDir, "obsidian.asar.gz");
  const obsidianAsarPath = path.join(cacheDir, "obsidian.asar");
  const appTarGzPath = path.join(cacheDir, "app.tar.gz");
  const appExtractDir = path.join(cacheDir, "app-extracted");

  try {
    // --- Download Assets ---
    log.info("\nFetching Obsidian release assets...");

    // Create cache directory
    await mkdir(cacheDir, { recursive: true });

    // Get release info
    const release = await getLatestObsidianRelease();
    log.success(`Found Obsidian ${release.tag_name}`);

    // Find and download app.tar.gz (Linux application archive)
    const appTarAsset = findAssetByName(
      release.assets,
      /obsidian-[\d.]+\.tar\.gz$/
    );
    if (!appTarAsset) {
      throw new Error("Could not find obsidian-*.tar.gz in release assets");
    }

    if (!existsSync(appAsarPath)) {
      if (!existsSync(appTarGzPath)) {
        await downloadFile(appTarAsset.browser_download_url, appTarGzPath);
      }

      // Extract tar.gz to get app.asar from resources/app.asar
      log.info("Extracting app.tar.gz to find app.asar...");
      await mkdir(appExtractDir, { recursive: true });
      await extractTarGz(appTarGzPath, appExtractDir);

      // Find app.asar in extracted files (usually at obsidian-*/resources/app.asar)
      const { execSync } = await import("child_process");
      try {
        const findResult = execSync(
          `find "${appExtractDir}" -name "app.asar" -type f`
        )
          .toString()
          .trim()
          .split("\n")[0];

        if (!findResult) {
          throw new Error(
            "Could not find app.asar in extracted tar.gz archive"
          );
        }

        log.info(`Found app.asar at ${findResult}`);
        await copyFile(findResult, appAsarPath);
        log.success("Copied app.asar to cache");

        // Cleanup extracted directory
        await rm(appExtractDir, { recursive: true, force: true });
      } catch (err) {
        log.error("Failed to extract app.asar from tar.gz");
        throw err;
      }
    } else {
      log.info(`Using cached ${appAsarPath}`);
    }

    // Find and download obsidian.asar.gz
    const obsidianAsarAsset = findAssetByName(release.assets, /\.asar\.gz$/);
    if (obsidianAsarAsset) {
      if (!existsSync(obsidianAsarGzPath)) {
        await downloadFile(obsidianAsarAsset.browser_download_url, obsidianAsarGzPath);
      } else {
        log.info(`Using cached ${obsidianAsarGzPath}`);
      }

      // Decompress obsidian.asar.gz if not already decompressed
      if (!existsSync(obsidianAsarPath)) {
        log.info("Decompressing obsidian.asar.gz...");
        await pipeline(
          createWriteStream(obsidianAsarGzPath),
          zlib.createGunzip(),
          createWriteStream(obsidianAsarPath)
        );
        log.success("Decompressed obsidian.asar");
      }
    } else {
      throw new Error("Could not find obsidian.asar.gz in release assets");
    }

    // --- Unpack Assets ---
    log.info("\nUnpacking Obsidian ASAR archives...");

    // Clean up and create directory
    log.info("Cleaning up previous unpack directory...");
    if (existsSync(obsidianUnpackedPath)) {
      await rm(obsidianUnpackedPath, { recursive: true, force: true });
    }
    await mkdir(obsidianUnpackedPath, { recursive: true });

    // Extract app.asar
    log.info(`Extracting ${appAsarPath} to ${obsidianUnpackedPath}`);
    asar.extractAll(appAsarPath, obsidianUnpackedPath);

    // Rename main.js to main.cjs
    const mainJsPath = path.join(obsidianUnpackedPath, "main.js");
    const mainCjsPath = path.join(obsidianUnpackedPath, "main.cjs");
    if (existsSync(mainJsPath)) {
      log.info("Renaming main.js to main.cjs...");
      await rename(mainJsPath, mainCjsPath);
      log.success("Renaming completed.");
    } else {
      log.warn("Warning: main.js not found after extraction. Skipping rename.");
    }

    // Copy obsidian.asar
    log.info(`Copying ${obsidianAsarPath} to ${obsidianUnpackedPath}/`);
    await copyFile(
      obsidianAsarPath,
      path.join(obsidianUnpackedPath, "obsidian.asar")
    );

    log.success("\nAsset unpacking completed.");
    log.success("E2E setup process finished successfully.");
  } catch (error) {
    log.error("\nE2E setup process failed:");
    log.error(error);
    process.exit(1);
  }
}

// =============================================================================
// Script Execution
// =============================================================================

main();
