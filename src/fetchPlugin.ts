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

export async function fetchPlugin(repo: string, destArg?: string): Promise<string> {
  if (!repo) throw new TypeError("repo url is required");

  const cwd = process.cwd();
  const { owner, repo: repoName } = parseRepoUrl(repo);
  const dest = destArg ? path.resolve(cwd, destArg) : path.resolve(cwd, "myfiles", repoName);

  // Try GitHub releases first
  try {
    const api = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
    const res = await fetch(api, { headers: { 'User-Agent': 'obsidian-e2e-toolkit' } });
    if (res.ok) {
      const rel = await res.json();
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      const candidate = assets.find((a: any) => /\.(zip|tgz|tar\.gz|tar)$/.test(a.name));
      if (candidate && candidate.browser_download_url) {
        fs.mkdirSync(dest, { recursive: true });
        const tmp = path.join(os.tmpdir(), `plugin-${owner}-${repoName}-${Date.now()}`);
        await downloadToFile(candidate.browser_download_url, tmp);
        // prefer zip extraction
        if (/\.zip$/i.test(candidate.name)) {
          await extract(tmp, { dir: dest });
        } else {
          // fallback: try tar extraction via system tar
          try {
            run("tar", ["-xzf", tmp, "-C", dest]);
          } catch (err) {
            // if tar is not available, throw
            throw new Error(`Failed to extract tarball: ${err}`);
          }
        }
        try { fs.rmSync(tmp); } catch {}
        return dest;
      }
    }
  } catch (err) {
    // ignore and fallback to git clone
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
    return dest;
  } catch (err) {
    throw new Error(`Failed to clone ${repo}: ${err}`);
  }
}

export default fetchPlugin;

