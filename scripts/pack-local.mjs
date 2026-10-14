#!/usr/bin/env node
// ビルド済みの toolkit を、release.yml と同じ形の npm 互換 tgz にまとめる。
// 同梱アセットは残し、ダウンロード用の cache と prepare / postinstall は含めない。
// package.json は書き換えず、加工と削除は coverage/local-pack の中に限る。
// 出力は未公開の開発版。ファイル名の hash で内容を区別する。
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as tar from "tar";

const PACKAGE_NAME = "obsidian-e2e-toolkit";
const ASSET_DIRECTORY = "obsidian-e2e-toolkit-assets";
const PACKAGED_ENTRIES = ["dist", "scripts", "README.md", "LICENSE"];
// exports・types・main・bin が指す成果物は declaredTargets で照合する。ここには、それ以外に必要なものだけを書く。
const REQUIRED_STATIC_OUTPUT = [
    "package.json",
    "README.md",
    "LICENSE",
    "scripts/setup.mjs",
    "scripts/init.mjs",
    "scripts/postinstall.cjs",
    "obsidian-e2e-toolkit-assets/obsidian-unpacked/main.cjs",
    "obsidian-e2e-toolkit-assets/obsidian-unpacked/obsidian.asar",
    "obsidian-e2e-toolkit-assets/obsidian-unpacked/.obsidian-version",
];
const OUTPUT_DIRECTORY = ["coverage", "local-pack"];
const STAGING_NAME = "staging";
// SemVer 2.0.0 のうち、ファイル名に安全な形だけを許す（build metadata の + は含めない）。
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?$/;
const MAX_VERSION_LENGTH = 64;
const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function assertSafeVersion(version) {
    if (typeof version !== "string" || version.length > MAX_VERSION_LENGTH || !SEMVER.test(version)) {
        throw new Error("package.json version must be a SemVer string without build metadata: " + JSON.stringify(version));
    }
    return version;
}

function isStrictlyInside(parent, child) {
    const relative = path.relative(parent, child);
    return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

// 削除・移動の前に、resolve 済みの絶対 path が outputRoot の内側にあることを確かめる。
function resolveInsideOutput(outputRoot, target, label) {
    const resolvedRoot = path.resolve(outputRoot);
    const resolved = path.resolve(target);
    if (!isStrictlyInside(resolvedRoot, resolved)) {
        throw new Error(label + " resolves outside " + resolvedRoot + ": " + resolved);
    }
    return resolved;
}

async function removeInside(outputRoot, target, label) {
    await rm(resolveInsideOutput(outputRoot, target, label), { recursive: true, force: true });
}

async function moveInside(outputRoot, from, to, label) {
    await rename(
        resolveInsideOutput(outputRoot, from, label + " source"),
        resolveInsideOutput(outputRoot, to, label + " destination"),
    );
}

async function statOrNull(file) {
    try {
        return await stat(file);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

async function lstatOrNull(file) {
    try {
        return await lstat(file);
    } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
    }
}

// 出力先の途中に symbolic link や junction があり、実体が repo の外を指す場合は何も書かない。
async function assertOutputInRepo(root) {
    const realRoot = await realpath(root);
    let current = root;
    for (const segment of OUTPUT_DIRECTORY) {
        current = path.join(current, segment);
        const info = await lstatOrNull(current);
        if (info === null) return;
        if (info.isSymbolicLink()) {
            throw new Error("output path must not be a symbolic link or junction: " + current);
        }
        const real = await realpath(current);
        if (!isStrictlyInside(realRoot, real)) {
            throw new Error("output path resolves outside the repo: " + current + " -> " + real);
        }
    }
}

// exports・types・main・bin が指す成果物（型定義を含む）。利用側が解決する先をそのまま確かめる。
function declaredTargets(sourcePackage) {
    const found = new Set();
    const visit = (value) => {
        if (typeof value === "string") {
            found.add(value);
        } else if (value !== null && typeof value === "object") {
            for (const child of Object.values(value)) visit(child);
        }
    };
    for (const key of ["exports", "main", "types", "typings", "bin"]) visit(sourcePackage[key]);
    return [...found].map((target) => target.replace(/^\.\//, ""));
}

async function assertBuildOutput(root, sourcePackage) {
    const required = [...new Set([...REQUIRED_STATIC_OUTPUT, ...declaredTargets(sourcePackage)])];
    const missing = [];
    for (const relative of required) {
        const file = path.resolve(root, relative);
        if (!isStrictlyInside(root, file)) throw new Error("build output path escapes the repo: " + relative);
        const info = await statOrNull(file);
        if (info === null || !info.isFile()) missing.push(relative);
    }
    if (missing.length > 0) {
        throw new Error("missing build output: " + missing.join(", ") + ". Run pnpm run build and pnpm run postinstall first.");
    }
}

// コピー元は repo 内、コピー先は staging 内に限る。
async function copyFromRepo(root, staging, relative, options = {}) {
    const from = path.resolve(root, relative);
    const to = path.resolve(staging, relative);
    if (!isStrictlyInside(root, from)) throw new Error("copy source escapes the repo: " + from);
    if (!isStrictlyInside(staging, to)) throw new Error("copy destination escapes staging: " + to);
    await cp(from, to, { recursive: true, ...options });
}

function isDownloadCache(assetsRoot, source) {
    const relative = path.relative(assetsRoot, source);
    return relative === "cache" || relative.startsWith("cache" + path.sep);
}

async function copyPackageContents(root, staging) {
    for (const entry of PACKAGED_ENTRIES) {
        await copyFromRepo(root, staging, entry);
    }
    const assetsRoot = path.resolve(root, ASSET_DIRECTORY);
    await copyFromRepo(root, staging, ASSET_DIRECTORY, {
        filter: (source) => !isDownloadCache(assetsRoot, source),
    });
}

// release.yml と同じ変換: prepare / postinstall を外し、同梱アセットを files に加える。
function stagedPackageJson(sourcePackage) {
    const pkg = structuredClone(sourcePackage);
    const scripts = { ...(pkg.scripts ?? {}) };
    delete scripts.prepare;
    delete scripts.postinstall;
    pkg.scripts = scripts;
    const files = Array.isArray(pkg.files) ? [...pkg.files] : [];
    if (!files.includes(ASSET_DIRECTORY)) files.push(ASSET_DIRECTORY);
    pkg.files = files;
    return pkg;
}

async function listFiles(directory) {
    const found = [];
    const walk = async (current) => {
        for (const entry of await readdir(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile()) {
                found.push(path.relative(directory, full).split(path.sep).join("/"));
            } else {
                throw new Error("staging contains a symbolic link or special file: " + full);
            }
        }
    };
    await walk(directory);
    return found.sort();
}

async function contentDigest(directory, files) {
    const hash = createHash("sha256");
    for (const relative of files) {
        const content = await readFile(path.join(directory, relative));
        const fileHash = createHash("sha256").update(content).digest("hex");
        hash.update(relative + "\0" + fileHash + "\n");
    }
    return hash.digest("hex");
}

async function fileSha256(file) {
    return createHash("sha256").update(await readFile(file)).digest("hex");
}

// npm と同じく先頭に package/ を付ける。時刻と所有者を固定して、entry の情報が毎回同じになるようにする。
async function writeArchive(outputRoot, staging, files, archivePath) {
    const partial = resolveInsideOutput(outputRoot, archivePath + ".partial", "partial archive");
    try {
        await tar.create(
            { gzip: true, file: partial, cwd: staging, prefix: "package", portable: true, mtime: new Date(0) },
            files,
        );
        await moveInside(outputRoot, partial, archivePath, "archive");
    } catch (error) {
        await removeInside(outputRoot, partial, "partial archive");
        throw error;
    }
}

async function verifyArchive(outputRoot, archivePath, files) {
    const listed = [];
    await tar.t({
        file: archivePath,
        onReadEntry: (entry) => {
            if (entry.type === "File") listed.push(entry.path);
            entry.resume();
        },
    });
    const expected = files.map((file) => "package/" + file).sort();
    if (listed.sort().join("\n") !== expected.join("\n")) {
        throw new Error("archive entries do not match the staged files");
    }
    if (listed.some((entry) => entry.startsWith("package/" + ASSET_DIRECTORY + "/cache/"))) {
        throw new Error("the download cache must not be packed");
    }

    const extracted = resolveInsideOutput(outputRoot, archivePath + ".verify", "verification directory");
    await removeInside(outputRoot, extracted, "verification directory");
    await mkdir(extracted, { recursive: true });
    try {
        await tar.x({ file: archivePath, cwd: extracted, filter: (entryPath) => entryPath === "package/package.json" });
        const pkg = JSON.parse(await readFile(path.join(extracted, "package", "package.json"), "utf8"));
        if (pkg.scripts?.prepare !== undefined || pkg.scripts?.postinstall !== undefined) {
            throw new Error("packed package.json must not keep prepare or postinstall");
        }
        if (!Array.isArray(pkg.files) || !pkg.files.includes(ASSET_DIRECTORY)) {
            throw new Error("packed package.json must list " + ASSET_DIRECTORY + " in files");
        }
    } finally {
        await removeInside(outputRoot, extracted, "verification directory");
    }
}

/**
 * ビルド済みの toolkit を、利用側で file: 指定できる未公開の開発版 tgz にまとめ、その情報を返す。
 * 必要なビルド成果物が無い、version が安全でない、出力先が repo の外を指す場合は、何も書かずに失敗する。
 */
export async function packLocal({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
    const root = path.resolve(repoRoot);
    const sourcePackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    if (sourcePackage.name !== PACKAGE_NAME) {
        throw new Error("expected package name " + PACKAGE_NAME + " but found " + sourcePackage.name);
    }
    const version = assertSafeVersion(sourcePackage.version);
    await assertBuildOutput(root, sourcePackage);
    await assertOutputInRepo(root);

    const outputRoot = path.join(root, ...OUTPUT_DIRECTORY);
    if (!isStrictlyInside(root, outputRoot)) throw new Error("output directory must be inside the repo");
    await mkdir(outputRoot, { recursive: true });
    const staging = resolveInsideOutput(outputRoot, path.join(outputRoot, STAGING_NAME), "staging directory");
    await removeInside(outputRoot, staging, "staging directory");
    await mkdir(staging, { recursive: true });
    try {
        await copyPackageContents(root, staging);
        await writeFile(
            path.join(staging, "package.json"),
            JSON.stringify(stagedPackageJson(sourcePackage), null, 4) + "\n",
            "utf8",
        );
        const files = await listFiles(staging);
        const digest = await contentDigest(staging, files);
        const archivePath = resolveInsideOutput(
            outputRoot,
            path.join(outputRoot, PACKAGE_NAME + "-" + version + "-" + digest.slice(0, 12) + ".tgz"),
            "archive",
        );
        await writeArchive(outputRoot, staging, files, archivePath);
        await verifyArchive(outputRoot, archivePath, files);
        const info = await stat(archivePath);
        return {
            archive: archivePath,
            specifier: "file:" + archivePath.split(path.sep).join("/"),
            sha256: await fileSha256(archivePath),
            bytes: info.size,
            files: files.length,
            note: "unpublished development build; version is the working-tree value",
        };
    } finally {
        await removeInside(outputRoot, staging, "staging directory");
    }
}

const invokedDirectly =
    process.argv[1] !== undefined &&
    pathToFileURL(path.resolve(process.argv[1])).href.toLowerCase() === import.meta.url.toLowerCase();
if (invokedDirectly) {
    console.log(JSON.stringify(await packLocal(), null, 2));
}
