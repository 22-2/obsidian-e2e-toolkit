import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  // keep output visible to caller
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
  if (r.error) throw r.error;
  if (r.status && r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

export async function fetchPlugin(repo: string, destArg?: string): Promise<string> {
  if (!repo) throw new TypeError("repo url is required");

  const cwd = process.cwd();
  const repoName = path.basename(repo).replace(/\.git$/, "");
  const dest = destArg ? path.resolve(cwd, destArg) : path.resolve(cwd, "myfiles", repoName);

  if (fs.existsSync(dest)) {
    // update
    try {
      run("git", ["-C", dest, "pull"]);
    } catch (err) {
      throw new Error(`Failed to update plugin at ${dest}: ${err}`);
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
      run("git", ["clone", "--depth", "1", repo, dest]);
    } catch (err) {
      throw new Error(`Failed to clone ${repo}: ${err}`);
    }
  }

  const pkgJson = path.join(dest, "package.json");
  if (fs.existsSync(pkgJson)) {
    try {
      run("pnpm", ["install"], { cwd: dest });
    } catch (err) {
      throw new Error(`pnpm install failed in ${dest}: ${err}`);
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
      if (pkg.scripts && pkg.scripts.build) {
        run("pnpm", ["run", "build"], { cwd: dest });
      }
    } catch (err) {
      // non-fatal: package.json read errors should not abort the whole operation
    }
  }

  return dest;
}

export default fetchPlugin;
