import { spawnSync } from "child_process";
import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";
import os from "os";
import extract from "extract-zip";
function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
  if (r.error) throw r.error;
  if (r.status && r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function parseRepoUrl(repo: string) {
  // Accept formats like https://github.com/owner/repo.git or git@github.com:owner/repo.git
  const httpsMatch = repo.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };
  throw new Error(`Unsupported repo url: ${repo}`);
}

async function downloadToFile(url: string, destPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

export async function fetchPlugin(repo: string, destArg?: string, opts?: { fallbackToGit?: boolean }): Promise<string> {
  if (!repo) throw new TypeError("repo url is required");

  const cwd = process.cwd();
  const { owner, repo: repoName } = parseRepoUrl(repo);
  const dest = destArg ? path.resolve(cwd, destArg) : path.resolve(cwd, "myfiles", repoName);

  // Try to find a release that contains plugin files (main.js / manifest.json / styles.css).
  const desiredFiles = ["main.js", "manifest.json", "styles.css"];
  let chosenRelease: any = null;
  try {
    const latestApi = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
    let res = await fetch(latestApi, { headers: { 'User-Agent': 'obsidian-e2e-toolkit' } });
    if (res.ok) {
      const rel = await res.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      if (assets.some((a: any) => desiredFiles.includes(a.name))) {
        chosenRelease = rel;
      }
    }

    if (!chosenRelease) {
      // try listing recent releases and find one that contains desired files
      const listApi = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=20`;
      const listRes = await fetch(listApi, { headers: { 'User-Agent': 'obsidian-e2e-toolkit' } });
      if (listRes.ok) {
        const list = await listRes.json();
        for (const rel of list) {
          const assets = Array.isArray(rel.assets) ? rel.assets : [];
          if (assets.some((a: any) => desiredFiles.includes(a.name))) {
            chosenRelease = rel;
            break;
          }
        }
      }
    }
  } catch (err) {
    // ignore and fallback handling below
  }

  if (chosenRelease) {
    const assets = Array.isArray(chosenRelease.assets) ? chosenRelease.assets : [];
    fs.mkdirSync(dest, { recursive: true });

    // Download specific files if present, otherwise download all assets
    for (const fname of desiredFiles) {
      const asset = assets.find((a: any) => a.name === fname);
      if (asset && asset.browser_download_url) {
        const out = path.join(dest, fname);
        await downloadToFile(asset.browser_download_url, out);
      }
    }

    // If none of desiredFiles were written, fallback to downloading all assets
    const written = desiredFiles.some(f => fs.existsSync(path.join(dest, f)));
    if (!written) {
      for (const a of assets) {
        if (!a.browser_download_url || !a.name) continue;
        const out = path.join(dest, a.name);
        await downloadToFile(a.browser_download_url, out);
      }
    }

    // After download, run install/build if package.json exists
    try {
      const pkgJson = path.join(dest, 'package.json');
      if (fs.existsSync(pkgJson)) {
        run('pnpm', ['install'], { cwd: dest });
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
        if (pkg.scripts && pkg.scripts.build) {
          run('pnpm', ['run', 'build'], { cwd: dest });
        }
      }
    } catch (err) {
      throw new Error(`Failed to prepare plugin from release in ${dest}: ${err}`);
    }

    return dest;
  }
  // No release asset found. Either fallback to git clone if allowed, or fail.
  if (!opts || !opts.fallbackToGit) {
    throw new Error(`No release asset found for ${owner}/${repoName} and fallbackToGit is false`);
  }

  // Fallback: git clone (shallow)
  if (fs.existsSync(dest)) {
    try {
      run("git", ["-C", dest, "pull"]);
      return dest;
    } catch (err) {
      throw new Error(`Failed to update plugin at ${dest}: ${err}`);
    }
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    run("git", ["clone", "--depth", "1", repo, dest]);
    // After clone, install deps and build if needed
    try {
      const pkgJson = path.join(dest, 'package.json');
      if (fs.existsSync(pkgJson)) {
        run('pnpm', ['install'], { cwd: dest });
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf8'));
        if (pkg.scripts && pkg.scripts.build) {
          run('pnpm', ['run', 'build'], { cwd: dest });
        }
      }
    } catch (err) {
      throw new Error(`Failed to prepare plugin after clone in ${dest}: ${err}`);
    }
    return dest;
  } catch (err) {
    throw new Error(`Failed to clone ${repo}: ${err}`);
  }
}

export default fetchPlugin;

