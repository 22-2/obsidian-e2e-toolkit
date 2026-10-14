import { spawnSync } from "node:child_process";
import { mkdir, lstat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createScopedLogger } from "./internal/logger";
import {
    assertUsableDirectory,
    errorMessage,
    inspectDestination,
    isRecord,
    promoteDirectory,
    readManifestIdentity,
    readSourceMarker,
    removeTempDirectory,
    tempSiblingPath,
    writeSourceMarker,
} from "./internal/pluginDirectory";

const logger = createScopedLogger("fetchPlugin");

const GITHUB_API_ORIGIN = "https://api.github.com";
const USER_AGENT = "obsidian-e2e-toolkit";
const REQUIRED_FILES = ["main.js", "manifest.json"];
const OPTIONAL_FILES = ["styles.css"];
const NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
const TAG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+/-]*$/;
const SAFE_PNPM_ARGUMENT = /^[A-Za-z0-9._:=-]+$/;
const PNPM_SCRIPT_ENTRY = /[\\/]pnpm\.[cm]?js$/i;
const PNPM_EXECUTABLE_ENTRY = /[\\/]pnpm(?:\.exe)?$/i;
const REPO_PATTERNS = [
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^([^/:@\s]+)\/([^/:@\s]+?)(?:\.git)?$/,
];
const TOKEN_VARIABLES = ["GITHUB_TOKEN", "GH_TOKEN"];
const OUTPUT_TAIL_LENGTH = 2000;

export type PluginSource = string | { repo: string; tag?: string };

export interface FetchPluginOptions {
    /** この release tag だけを取得する。省略すると latest を使う。 */
    tag?: string;
    /** marker と必須ファイルが一致する取得結果を再利用する。既定 true。latest は毎回 API で確認する。 */
    cache?: boolean;
    /** リリースが使えない時、または取得に失敗した時に git clone する。既定 false。 */
    fallbackToGit?: boolean;
}

export interface GitHubRepo {
    owner: string;
    name: string;
}

export interface CommandSpec {
    command: string;
    args: string[];
    shell: boolean;
}

interface ReleaseAsset {
    name?: string;
    browser_download_url?: string;
}

interface Release {
    tag_name?: string;
    draft?: boolean;
    assets?: ReleaseAsset[];
}

interface UsableRelease {
    tag_name: string;
    assets: ReleaseAsset[];
}

export function normalizePluginSource(source: PluginSource): { repo: string; tag?: string } {
    if (typeof source === "string") return { repo: source };
    if (!source || typeof source.repo !== "string" || source.repo.length === 0) {
        throw new TypeError("plugin source must be a repo string or an object with a repo field");
    }
    if (source.tag === undefined) return { repo: source.repo };
    if (typeof source.tag !== "string" || source.tag.length === 0) {
        throw new TypeError("plugin source tag must be a non-empty string");
    }
    return { repo: source.repo, tag: source.tag };
}

function isValidName(value: string): boolean {
    return NAME_PATTERN.test(value) && !value.startsWith("-") && value !== "." && value !== "..";
}

export function parseGitHubRepo(repo: string): GitHubRepo {
    if (typeof repo !== "string" || repo.trim() === "") throw new TypeError("repo url is required");
    const trimmed = repo.trim();
    for (const pattern of REPO_PATTERNS) {
        const match = pattern.exec(trimmed);
        if (!match) continue;
        const owner = match[1];
        const name = match[2];
        if (!isValidName(owner) || !isValidName(name)) break;
        return { owner, name };
    }
    throw new Error("Unsupported repo url: " + repo);
}

function repoFullName(repo: GitHubRepo): string {
    return repo.owner + "/" + repo.name;
}

function apiRepoUrl(repo: GitHubRepo): string {
    return GITHUB_API_ORIGIN + "/repos/" + repo.owner + "/" + repo.name;
}

function cloneUrl(repo: GitHubRepo): string {
    return "https://github.com/" + repo.owner + "/" + repo.name + ".git";
}

function normalizeTag(tag: string | undefined): string | undefined {
    if (tag === undefined) return undefined;
    if (!TAG_PATTERN.test(tag)) throw new TypeError("invalid release tag: " + JSON.stringify(tag));
    return tag;
}

export function getGitHubToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
    return env.GITHUB_TOKEN || env.GH_TOKEN || undefined;
}

// token を付けてよい origin は GitHub API だけ。asset の取得先など他 origin には決して付けない。
export function authorizationHeaders(url: string, token: string | undefined): Record<string, string> {
    if (!token || new URL(url).origin !== GITHUB_API_ORIGIN) return {};
    return { Authorization: "Bearer " + token };
}

async function fetchGitHubApi(url: string): Promise<Response> {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        ...authorizationHeaders(url, getGitHubToken()),
    };
    return fetch(url, { headers });
}

async function readRelease(url: string): Promise<Release | null> {
    const response = await fetchGitHubApi(url);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("GitHub release lookup failed (" + response.status + "): " + url);
    return (await response.json()) as Release;
}

async function readReleaseList(url: string): Promise<Release[]> {
    const response = await fetchGitHubApi(url);
    if (!response.ok) throw new Error("GitHub release list failed (" + response.status + "): " + url);
    const body: unknown = await response.json();
    return Array.isArray(body) ? (body as Release[]) : [];
}

// main.js と manifest.json が揃った release だけを使える release とみなす。
function toUsableRelease(release: Release | null): UsableRelease | null {
    if (!release || typeof release.tag_name !== "string") return null;
    const assets = release.assets ?? [];
    const complete = REQUIRED_FILES.every((name) =>
        assets.some((asset) => asset.name === name && typeof asset.browser_download_url === "string"),
    );
    return complete ? { tag_name: release.tag_name, assets } : null;
}

function pinnedRelease(repo: GitHubRepo, tag: string): UsableRelease {
    const base = "https://github.com/" + repoFullName(repo) + "/releases/download/" + encodeURIComponent(tag);
    return {
        tag_name: tag,
        assets: REQUIRED_FILES.concat(OPTIONAL_FILES).map((name) => ({
            name,
            browser_download_url: base + "/" + name,
        })),
    };
}

async function lookupRelease(repo: GitHubRepo): Promise<UsableRelease | null> {
    const base = apiRepoUrl(repo);
    const latest = toUsableRelease(await readRelease(base + "/releases/latest"));
    if (latest) return latest;
    // latest が asset を持たない場合は、直近の release を順に見て最初に使えるものを選ぶ。
    const releases = await readReleaseList(base + "/releases?per_page=20");
    for (const release of releases) {
        if (release.draft === true) continue;
        const usable = toUsableRelease(release);
        if (usable) return usable;
    }
    return null;
}

async function downloadAsset(url: string, target: string, name: string, optional: boolean): Promise<void> {
    // 公開 asset の取得には token を付けない。
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    // 意図: 固定 tag では一覧を問い合わせず、任意の styles.css だけは不存在を許す。
    if (optional && response.status === 404) return;
    if (!response.ok) throw new Error("failed to download " + name + " (" + response.status + ")");
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

async function downloadReleaseFiles(release: UsableRelease, dir: string): Promise<void> {
    for (const name of REQUIRED_FILES.concat(OPTIONAL_FILES)) {
        const asset = release.assets.find((entry) => entry.name === name);
        if (!asset || typeof asset.browser_download_url !== "string") continue;
        await downloadAsset(asset.browser_download_url, path.join(dir, name), name, OPTIONAL_FILES.includes(name));
    }
}

async function isNonEmptyFile(file: string): Promise<boolean> {
    try {
        const info = await lstat(file);
        return info.isFile() && info.size > 0;
    } catch {
        return false;
    }
}

async function assertRequiredFiles(dir: string): Promise<void> {
    const missing: string[] = [];
    for (const name of REQUIRED_FILES) {
        if (!(await isNonEmptyFile(path.join(dir, name)))) missing.push(name);
    }
    if (missing.length > 0) throw new Error("missing required files: " + missing.join(", "));
    await readManifestIdentity(path.join(dir, "manifest.json"));
}

async function hasRequiredFiles(dir: string): Promise<boolean> {
    try {
        await assertRequiredFiles(dir);
        return true;
    } catch {
        return false;
    }
}

function isSameRepository(markerRepo: string, repo: GitHubRepo): boolean {
    try {
        const other = parseGitHubRepo(markerRepo);
        return (
            other.owner.toLowerCase() === repo.owner.toLowerCase() &&
            other.name.toLowerCase() === repo.name.toLowerCase()
        );
    } catch {
        return false;
    }
}

// 再利用の条件: repo が一致し、必須ファイルが揃い、tag と解決済み tag が一致すること。
// latest は API で得た解決済み tag と比べる。解決できない時は再利用しない。
async function isReusableCopy(dir: string, repo: GitHubRepo, tag: string | undefined, resolvedTag: string | null): Promise<boolean> {
    const marker = await readSourceMarker(dir);
    if (!marker || !isSameRepository(marker.repo, repo)) return false;
    if (!(await hasRequiredFiles(dir))) return false;
    if (marker.kind === "legacy-lazy") {
        // 旧 lazy の marker は解決済み tag を持たないため、pinned tag の一致だけで再利用する。
        return tag !== undefined && marker.tag === tag;
    }
    if (resolvedTag === null || marker.resolvedTag !== resolvedTag) return false;
    return marker.tag === (tag ?? null);
}

// 旧 lazy の取得結果は、tag が一致した時だけ toolkit の marker を追加して採用する。ファイルは残す。
async function reuseCopy(dir: string, repo: GitHubRepo, tag: string | undefined): Promise<string> {
    const marker = await readSourceMarker(dir);
    if (marker?.kind === "legacy-lazy" && tag !== undefined) {
        await writeSourceMarker(dir, {
            repo: repoFullName(repo),
            tag,
            resolvedTag: tag,
            method: "adopted-legacy",
        });
        logger.info("adopted legacy cache for " + repoFullName(repo) + "@" + tag);
    }
    logger.info("reusing cached plugin at " + dir);
    return dir;
}

async function assertReplaceable(dest: string): Promise<void> {
    const inspection = await inspectDestination(dest);
    if (inspection.state !== "populated") return;
    if (await readSourceMarker(dest)) return;
    throw new Error(
        "refusing to replace " + dest + ": it is not empty and has no toolkit or legacy cache marker. Move or delete it, then run again.",
    );
}

// staging に取得・検証・marker 作成を済ませてから dest に置き換える。失敗時は staging を消す。
async function stageAndPromote(dest: string, populate: (staging: string) => Promise<void>): Promise<void> {
    await mkdir(path.dirname(dest), { recursive: true });
    const staging = tempSiblingPath(dest, "staging");
    try {
        await populate(staging);
        await promoteDirectory(staging, dest);
    } catch (error) {
        await removeTempDirectory(staging, dest, "staging");
        throw error;
    }
}

async function installFromRelease(release: UsableRelease, repo: GitHubRepo, tag: string | undefined, dest: string): Promise<void> {
    await stageAndPromote(dest, async (staging) => {
        await mkdir(staging);
        await downloadReleaseFiles(release, staging);
        await assertRequiredFiles(staging);
        await writeSourceMarker(staging, {
            repo: repoFullName(repo),
            tag: tag ?? null,
            resolvedTag: release.tag_name,
            method: "release",
        });
    });
}

async function installFromGit(repo: GitHubRepo, tag: string | undefined, dest: string): Promise<void> {
    await stageAndPromote(dest, async (staging) => {
        runCommand({ command: "git", args: buildCloneArgs(cloneUrl(repo), staging, tag), shell: false }, path.dirname(staging), "git clone " + repoFullName(repo));
        await buildCheckout(staging);
        await assertRequiredFiles(staging);
        await writeSourceMarker(staging, {
            repo: repoFullName(repo),
            tag: tag ?? null,
            resolvedTag: tag ?? null,
            method: "git",
        });
    });
}

// clone 直後のソースだけ install と build を1回ずつ行う。release の asset にはビルドを重ねない。
async function buildCheckout(dir: string): Promise<void> {
    const packageJsonPath = path.join(dir, "package.json");
    if (!(await isNonEmptyFile(packageJsonPath))) return;
    runCommand(resolvePnpmInvocation(["install", "--ignore-workspace"]), dir, "pnpm install");
    const pkg: unknown = JSON.parse(await readFile(packageJsonPath, "utf8"));
    const scripts = isRecord(pkg) && isRecord(pkg.scripts) ? pkg.scripts : {};
    if (typeof scripts.build === "string") {
        runCommand(resolvePnpmInvocation(["run", "build"]), dir, "pnpm run build");
    }
}

/**
 * pnpm を起動するコマンドを決める。
 * npm_execpath が pnpm の JS entry なら node で起動し、native executable は直接起動する。
 * Windows の pnpm は .cmd の shim なので shell 経由にする。その場合は引数を先に検証する。
 */
export function resolvePnpmInvocation(
    args: readonly string[],
    env: NodeJS.ProcessEnv = process.env,
    platform: NodeJS.Platform = process.platform,
): CommandSpec {
    for (const arg of args) {
        if (!SAFE_PNPM_ARGUMENT.test(arg)) throw new TypeError("unsafe pnpm argument: " + JSON.stringify(arg));
    }
    const entry = env.npm_execpath;
    if (entry && PNPM_SCRIPT_ENTRY.test(entry)) {
        return { command: process.execPath, args: [entry, ...args], shell: false };
    }
    if (entry && PNPM_EXECUTABLE_ENTRY.test(entry)) {
        return { command: entry, args: [...args], shell: false };
    }
    return { command: "pnpm", args: [...args], shell: platform === "win32" };
}

export function buildCloneArgs(url: string, target: string, tag: string | undefined): string[] {
    const branch = tag === undefined ? [] : ["--branch", tag];
    return ["clone", "--depth", "1", ...branch, "--", url, target];
}

// 子プロセスへ GitHub の token を渡さない。ビルドスクリプトが無関係な origin へ送るのを防ぐ。
export function childEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const copy: NodeJS.ProcessEnv = { ...env };
    for (const name of TOKEN_VARIABLES) delete copy[name];
    return copy;
}

function runCommand(spec: CommandSpec, cwd: string, label: string): void {
    const result = spawnSync(spec.command, spec.args, {
        cwd,
        shell: spec.shell,
        encoding: "utf8",
        env: childEnvironment(process.env),
        windowsHide: true,
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) throw new Error(label + " could not start: " + result.error.message);
    if (result.status === 0) return;
    const reason = result.status === null ? "terminated by " + (result.signal ?? "a signal") : "exit code " + result.status;
    const output = (String(result.stdout) + "\n" + String(result.stderr)).trim().slice(-OUTPUT_TAIL_LENGTH);
    throw new Error(label + " failed (" + reason + ")" + (output ? ":\n" + output : ""));
}

function resolveDestination(destArg: string | undefined, name: string): string {
    const dest = destArg ? path.resolve(process.cwd(), destArg) : path.resolve(process.cwd(), "myfiles", name);
    assertUsableDirectory(dest);
    return dest;
}

function describeTag(tag: string | undefined): string {
    return tag === undefined ? "" : " at " + tag;
}

/**
 * GitHub の plugin repo を dest に取得して、main.js と manifest.json が揃った状態で返す。
 * 検証に通らない取得は成功にしない。既存の dest は、空、または toolkit / 旧 lazy の marker を持つ場合だけ置き換える。
 */
export async function fetchPlugin(repo: string, destArg?: string, opts?: FetchPluginOptions): Promise<string> {
    const parsed = parseGitHubRepo(repo);
    const tag = normalizeTag(opts?.tag);
    const dest = resolveDestination(destArg, parsed.name);
    const useCache = opts?.cache ?? true;
    const fallbackToGit = opts?.fallbackToGit ?? false;
    logger.debug("repo=" + repoFullName(parsed) + " tag=" + (tag ?? "latest") + " dest=" + dest + " cache=" + useCache + " fallbackToGit=" + fallbackToGit);
    await assertReplaceable(dest);

    // pinned tag は API を呼ばずに、取得済みの marker だけで判定できる。
    if (tag !== undefined && useCache && (await isReusableCopy(dest, parsed, tag, tag))) {
        return reuseCopy(dest, parsed, tag);
    }

    let usable: UsableRelease | null = null;
    try {
        usable = tag === undefined ? await lookupRelease(parsed) : pinnedRelease(parsed, tag);
    } catch (error) {
        if (!fallbackToGit) throw error;
        logger.warn("release lookup failed for " + repoFullName(parsed) + "; falling back to git: " + errorMessage(error));
    }

    if (usable) {
        if (useCache && (await isReusableCopy(dest, parsed, tag, usable.tag_name))) {
            return reuseCopy(dest, parsed, tag);
        }
        try {
            await installFromRelease(usable, parsed, tag, dest);
            return dest;
        } catch (error) {
            if (!fallbackToGit) throw error;
            logger.warn("release install failed for " + repoFullName(parsed) + "; falling back to git: " + errorMessage(error));
        }
    } else if (!fallbackToGit) {
        throw new Error(
            "No usable release for " + repoFullName(parsed) + describeTag(tag) + " (main.js and manifest.json are required). Set fallbackToGit to clone the source.",
        );
    }

    await installFromGit(parsed, tag, dest);
    return dest;
}

export default fetchPlugin;
