import { existsSync } from "fs";
import path from "path";
import invariant from "tiny-invariant";
import { fileURLToPath } from "url";
import type { ResolvedPaths } from "./config";
import { resolveConfig } from "./config";

// --- Project Structure Detection ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Default configuration
 * Assumes this package is installed in node_modules or used as a submodule
 */
function getDefaultConfig() {
  // When used as a library, __dirname points to node_modules/obsidian-e2e-toolkit/dist
  // or to the e2e toolkit directory in the project
  const toolkitRoot = path.dirname(__dirname);
  const projectRoot = path.resolve(toolkitRoot, "..");

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

  console.log("Plugin Directory:", RESOLVED_PATHS.pluginDir);
  console.log("Dist Directory:", RESOLVED_PATHS.distDir);
  console.log("Toolkit Root:", __dirname);
  console.log("App Main Path:", RESOLVED_PATHS.appMainJsPath);

  // --- Pre-flight checks ---
  invariant(existsSync(__dirname), `Toolkit root not found at: ${__dirname}.`);
  invariant(
    existsSync(RESOLVED_PATHS.appMainJsPath),
    `Obsidian app not found at: ${RESOLVED_PATHS.appMainJsPath}. Did you run the setup script?`
  );
} catch (error) {
  console.error(
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