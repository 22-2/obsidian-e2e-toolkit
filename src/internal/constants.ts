import { findUpSync } from "find-up";
import { existsSync } from "fs";
import log from "loglevel";
import path from "path";
import invariant from "tiny-invariant";
import { fileURLToPath } from "url";
import type { ResolvedPaths } from "./path";
import { resolveConfig } from "./path";
import type { VaultOptions } from "./types";

// --- Project Structure Detection ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = log.getLogger("constants");

/**
 * Default configuration
 * Assumes this package is installed in node_modules or used as a submodule
 */
function getDefaultConfig() {
  // Find the root of the obsidian-e2e-toolkit package by looking for its package.json
  const toolkitPackageJsonPath = findUpSync("package.json", { cwd: __dirname });
  invariant(
    toolkitPackageJsonPath,
    "Could not find package.json for obsidian-e2e-toolkit."
  );
  const toolkitRoot = path.dirname(toolkitPackageJsonPath);

  const manifestPath = findUpSync("manifest.json", { cwd: toolkitRoot });
  invariant(
    manifestPath,
    "Could not find manifest.json for the plugin project."
  );
  const projectRoot = path.dirname(manifestPath);

  return {
    pluginDir: projectRoot,
    distDir: path.join(projectRoot, "dist"),
    assetsDir: path.join(toolkitRoot, "assets"),
    obsidianUnpackedDir: path.join(toolkitRoot, ".obsidian-unpacked"),
    appMainFile: "main.cjs",
  };
}

// Resolve paths using default configuration
let RESOLVED_PATHS: ResolvedPaths;

try {
  const defaultConfig = getDefaultConfig();
  RESOLVED_PATHS = resolveConfig(defaultConfig);

  logger.log("Plugin Directory:", RESOLVED_PATHS.pluginDir);
  logger.log("Dist Directory:", RESOLVED_PATHS.distDir);
  logger.log("Toolkit Root:", __dirname);
  logger.log("App Main Path:", RESOLVED_PATHS.appMainJsPath);

  // --- Pre-flight checks ---
  invariant(existsSync(__dirname), `Toolkit root not found at: ${__dirname}.`);
  invariant(
    existsSync(RESOLVED_PATHS.appMainJsPath),
    `Obsidian app not found at: ${RESOLVED_PATHS.appMainJsPath}. Did you run the setup script?`
  );
} catch (error) {
  logger.error(
    "Error: Could not resolve paths. Make sure you've run the setup script.",
    error
  );
  throw error;
}

// Export resolved paths for backward compatibility
export const E2E_ROOT_DIR = __dirname;
export const PROJECT_ROOT_DIR = RESOLVED_PATHS.pluginDir;
export const DIST_DIR = RESOLVED_PATHS.distDir;
export const PLUGIN_ID = RESOLVED_PATHS.pluginId;
export const SANDBOX_VAULT_NAME = "Obsidian Sandbox";
export const APP_MAIN_JS_PATH = RESOLVED_PATHS.appMainJsPath;

export const LAUNCH_OPTIONS = {
  args: [
    APP_MAIN_JS_PATH,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--unsafely-disable-devtools-self-xss-warnings",
  ],
  env: {
    ...process.env,
    NODE_ENV: "development",
  },
};

// Test constants for Hot Sandbox specs
export const CMD_ID_CLOSE_TAB = "workspace:close";
export const CMD_ID_CONVERT_TO_FILE = "sandbox-note:convert-to-file";
export const CMD_ID_NEW_HOT_SANDBOX = "sandbox-note:open-hot-sandbox-note-view";
export const CMD_ID_OPEN_HOT_SANDBOX =
  "sandbox-note:open-hot-sandbox-note-view";
export const CMD_ID_TOGGLE_SOURCE = "editor:toggle-source";
export const CMD_ID_UNDO_CLOSE_TAB = "workspace:undo-close-pane";

export const DATAT_TYPE_MARKDOWN = "markdown";
export const DATA_TYPE_EMPTY = "empty";

/**
 * Default test configuration for reuse
 */
export const DEFAULT_TEST_CONFIG = {
  useSandbox: false,
  showLoggerOnNode: true,
  plugins: [
    {
      path: DIST_DIR,
      pluginId: PLUGIN_ID,
    },
  ],
};

export const HOT_RELOAD_PLUGIN = {
  path: path.join(E2E_ROOT_DIR, "assets", "hot-reload"),
  pluginId: "hot-reload",
  useSymlink: true,
};

/**
 * Get the resolved paths (useful when you want to access the configuration)
 */
export function getResolvedPaths(): ResolvedPaths {
  return RESOLVED_PATHS;
}

/**
 * Override the resolved paths (useful for testing or custom configurations)
 */
export function setResolvedPaths(paths: ResolvedPaths): void {
  RESOLVED_PATHS = paths;
}

export const DEFAULT_VAULT_OPTIONS: VaultOptions = {
  sandbox: false,
  fresh: false,
  plugins: [],
};

// ===================================================================
// Playwright Test Fixtures
// ===================================================================
