const { existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const requiredFiles = [
  "index.cjs",
  "index.d.cts",
  "index.mjs",
  "index.d.mts",
  "coverage.cjs",
  "coverage.d.cts",
  "coverage.mjs",
  "coverage.d.mts",
];
const missingFiles = requiredFiles.filter(
  (file) => !existsSync(path.join(__dirname, "..", "dist", file)),
);

if (missingFiles.length === 0) {
  console.log("obsidian-e2e-toolkit: using committed build output.");
  process.exit(0);
}

const result = spawnSync("pnpm", ["run", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
