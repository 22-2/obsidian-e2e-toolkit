import esbuild from "esbuild";
import { glob } from "glob";
import { readFile } from "fs/promises";

const pkg = JSON.parse(await readFile(new URL("./package.json", import.meta.url)));

// Automatically find all .ts files in the src directory
const entryPoints = await glob("src/**/*.ts");

// External dependencies that should not be bundled
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

try {
  await esbuild.build({
    entryPoints,
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
