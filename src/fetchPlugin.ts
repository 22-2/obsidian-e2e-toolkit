import { spawnSync } from "child_process";
import fs from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import { createScopedLogger } from "./internal/logger";

const logger = createScopedLogger("fetchPlugin");
function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
    const r = spawnSync(cmd, args, { stdio: "inherit", cwd: opts.cwd });
    if (r.error) throw r.error;
    if (r.status && r.status !== 0)
        throw new Error(`${cmd} ${args.join(" ")} failed`);
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

export async function fetchPlugin(
    repo: string,
    destArg?: string,
    opts?: { fallbackToGit?: boolean },
): Promise<string> {
    if (!repo) throw new TypeError("repo url is required");

    const cwd = process.cwd();
    const { owner, repo: repoName } = parseRepoUrl(repo);
    const dest = destArg
        ? path.resolve(cwd, destArg)
        : path.resolve(cwd, "myfiles", repoName);
    logger.debug(
        `repo=${repo} owner=${owner} repoName=${repoName} dest=${dest} opts=${JSON.stringify(opts)}`,
    );

    // Try to find a release that contains plugin files (main.js / manifest.json / styles.css).
    const desiredFiles = ["main.js", "manifest.json", "styles.css"];
    let chosenRelease: any = null;
    try {
        const latestApi = `https://api.github.com/repos/${owner}/${repoName}/releases/latest`;
        logger.debug(`checking latest release: ${latestApi}`);
        let res = await fetch(latestApi, {
            headers: { "User-Agent": "obsidian-e2e-toolkit" },
        });
        if (res.ok) {
            const rel = await res.json();
            const assets = Array.isArray(rel.assets) ? rel.assets : [];
            logger.debug(
                `latest release tag=${rel.tag_name} assets=${assets.map((a: any) => a.name).join(",")}`,
            );
            if (assets.some((a: any) => desiredFiles.includes(a.name))) {
                chosenRelease = rel;
                logger.info(`using latest release ${rel.tag_name}`);
            }
        } else {
            logger.debug(`latest release fetch failed: ${res.status}`);
        }

        if (!chosenRelease) {
            // try listing recent releases and find one that contains desired files
            const listApi = `https://api.github.com/repos/${owner}/${repoName}/releases?per_page=20`;
            logger.debug(`listing releases: ${listApi}`);
            const listRes = await fetch(listApi, {
                headers: { "User-Agent": "obsidian-e2e-toolkit" },
            });
            if (listRes.ok) {
                const list = await listRes.json();
                for (const rel of list) {
                    const assets = Array.isArray(rel.assets) ? rel.assets : [];
                    logger.debug(
                        `examining release tag=${rel.tag_name} assets=${assets.map((a: any) => a.name).join(",")}`,
                    );
                    if (
                        assets.some((a: any) => desiredFiles.includes(a.name))
                    ) {
                        chosenRelease = rel;
                        logger.info(`using release ${rel.tag_name}`);
                        break;
                    }
                }
            } else {
                logger.debug(`release list fetch failed: ${listRes.status}`);
            }
        }
    } catch (err) {
        logger.warn(`release lookup error: ${err && (err as Error).message}`);
        // ignore and fallback handling below
    }

    if (chosenRelease) {
        const assets = Array.isArray(chosenRelease.assets)
            ? chosenRelease.assets
            : [];
        fs.mkdirSync(dest, { recursive: true });

        // Download specific files if present, otherwise download all assets
        for (const fname of desiredFiles) {
            const asset = assets.find((a: any) => a.name === fname);
            if (asset && asset.browser_download_url) {
                const out = path.join(dest, fname);
                logger.info(
                    `downloading ${fname} from release ${chosenRelease.tag_name}`,
                );
                try {
                    await downloadToFile(asset.browser_download_url, out);
                    logger.debug(`downloaded ${fname}`);
                } catch (err) {
                    logger.warn(
                        `failed to download ${fname}: ${err && (err as Error).message}`,
                    );
                }
            }
        }

        // If none of desiredFiles were written, fallback to downloading all assets
        const written = desiredFiles.some((f) =>
            fs.existsSync(path.join(dest, f)),
        );
        if (!written) {
            for (const a of assets) {
                if (!a.browser_download_url || !a.name) continue;
                const out = path.join(dest, a.name);
                logger.debug(`downloading asset ${a.name} -> ${out}`);
                try {
                    await downloadToFile(a.browser_download_url, out);
                    logger.debug(`downloaded asset ${a.name}`);
                } catch (err) {
                    logger.warn(
                        `failed to download asset ${a.name}: ${err && (err as Error).message}`,
                    );
                }
            }
        }

        // After download, run install/build if package.json exists
        try {
            const pkgJson = path.join(dest, "package.json");
            if (fs.existsSync(pkgJson)) {
                run("pnpm", ["install"], { cwd: dest });
                const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
                if (pkg.scripts && pkg.scripts.build) {
                    run("pnpm", ["run", "build"], { cwd: dest });
                }
            }
        } catch (err) {
            logger.error(`prepare error: ${err && (err as Error).message}`);
            throw new Error(
                `Failed to prepare plugin from release in ${dest}: ${err}`,
            );
        }

        return dest;
    }
    // No release asset found. Either fallback to git clone if allowed, or fail.
    if (!opts || !opts.fallbackToGit) {
        logger.warn(
            `no release found and fallbackToGit is false for ${owner}/${repoName}`,
        );
        throw new Error(
            `No release asset found for ${owner}/${repoName} and fallbackToGit is false`,
        );
    }

    // Fallback: git clone (shallow)
    if (fs.existsSync(dest)) {
        try {
            logger.info(`destination exists; pulling ${dest}`);
            run("git", ["-C", dest, "pull"]);
            return dest;
        } catch (err) {
            throw new Error(`Failed to update plugin at ${dest}: ${err}`);
        }
    }

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    try {
        logger.info(`cloning ${repo} -> ${dest}`);
        run("git", ["clone", "--depth", "1", repo, dest]);
        // After clone, install deps and build if needed
        try {
            const pkgJson = path.join(dest, "package.json");
            if (fs.existsSync(pkgJson)) {
                run("pnpm", ["install"], { cwd: dest });
                const pkg = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
                if (pkg.scripts && pkg.scripts.build) {
                    run("pnpm", ["run", "build"], { cwd: dest });
                }
            }
        } catch (err) {
            throw new Error(
                `Failed to prepare plugin after clone in ${dest}: ${err}`,
            );
        }
        return dest;
    } catch (err) {
        throw new Error(`Failed to clone ${repo}: ${err}`);
    }
}

export default fetchPlugin;
