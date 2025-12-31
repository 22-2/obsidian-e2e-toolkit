import asar from "asar";
import chalk from "chalk";
import extract from "extract-zip";
import { existsSync } from "fs";
import { copyFile, mkdir, rename, rm } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// =============================================================================
// Utility Functions
// =============================================================================
const log = {
  info: (msg) => console.log(chalk.cyan(msg)),
  success: (msg) => console.log(chalk.green(msg)),
  warn: (msg) => console.log(chalk.yellow(msg)),
  error: (msg) => console.error(chalk.red(msg)),
};

// =============================================================================
// Core Functions
// =============================================================================

async function main() {
  log.success("Starting E2E setup process...");

  // --- Define Paths ---
  const __filename = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(__filename);

  const obsidianUnpackedPath = path.join(scriptDir, ".obsidian-unpacked");
  const assetsDir = path.join(scriptDir, "assets");
  const appAsarPath = path.join(assetsDir, "app.asar");
  const appAsarUnpackedZipPath = path.join(assetsDir, "app.asar.unpacked.zip");
  const obsidianAsarPath = path.join(assetsDir, "obsidian.asar");

  try {
    // --- Unpack Assets ---
    log.info("\nUnpacking Obsidian ASAR archives...");

    // Clean up and create directory
    log.info("Cleaning up previous unpack directory...");
    if (existsSync(obsidianUnpackedPath)) {
      await rm(obsidianUnpackedPath, { recursive: true, force: true });
    }
    await mkdir(obsidianUnpackedPath, { recursive: true });

    // Unzip app.asar.unpacked.zip
    if (existsSync(appAsarUnpackedZipPath)) {
      log.info("Unzipping app.asar.unpacked.zip...");
      await extract(appAsarUnpackedZipPath, {
        dir: path.resolve(assetsDir),
      });
      log.success("Unzip completed.");
    } else {
      log.warn("Warning: app.asar.unpacked.zip not found. Skipping unzip.");
    }

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
    if (existsSync(obsidianAsarPath)) {
      log.info(`Copying ${obsidianAsarPath} to ${obsidianUnpackedPath}/`);
      await copyFile(
        obsidianAsarPath,
        path.join(obsidianUnpackedPath, "obsidian.asar")
      );
    } else {
      log.warn(
        `Warning: obsidian.asar not found at '${obsidianAsarPath}'. Skipping.`
      );
    }

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
