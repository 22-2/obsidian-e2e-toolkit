import esbuild from "esbuild";
import { glob } from "glob";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(__filename);
const repoRoot = path.resolve(scriptDir, "..");

const pkg = JSON.parse(
  await readFile(path.join(repoRoot, "package.json"), "utf8")
);

// Automatically find all .ts files in the src directory
const entryPoints = await glob("src/**/*.ts", { cwd: repoRoot });

// External dependencies that should not be bundled
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

try {
  await esbuild.build({
    entryPoints,
    absWorkingDir: repoRoot,
    outdir: "dist/src",
    bundle: true, // Set to true to enable bundling and module resolution
    sourcemap: true,
    platform: "node",
    format: "esm",
    external,
    tsconfig: "tsconfig.json",
  });
  console.log("✅ Build successful");
} catch (e) {
  console.error("❌ Build failed:", e);
  process.exit(1);
}
