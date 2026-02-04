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
  // ESM build
  await esbuild.build({
    entryPoints,
    absWorkingDir: repoRoot,
    outdir: "dist/src",
    bundle: true,
    sourcemap: true,
    platform: "node",
    format: "esm",
    external,
    tsconfig: "tsconfig.json",
  });

  // CJS build for consumers that require() the package
  await esbuild.build({
    entryPoints,
    absWorkingDir: repoRoot,
    outdir: "dist/cjs",
    bundle: true,
    sourcemap: true,
    platform: "node",
    format: "cjs",
    external,
    tsconfig: "tsconfig.json",
  });
  console.log("✅ Build successful");
} catch (e) {
  console.error("❌ Build failed:", e);
  process.exit(1);
}
