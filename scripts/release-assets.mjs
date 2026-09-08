const DESKTOP_TAR_GZ_PATTERN = /^obsidian-[\d.]+\.tar\.gz$/i;
const OBSIDIAN_ASAR_GZ_PATTERN = /\.asar\.gz$/i;

export function hasRequiredDesktopAssets(release) {
    const assets = Array.isArray(release?.assets) ? release.assets : [];

    return (
        assets.some((asset) => DESKTOP_TAR_GZ_PATTERN.test(asset?.name ?? "")) &&
        assets.some((asset) => OBSIDIAN_ASAR_GZ_PATTERN.test(asset?.name ?? ""))
    );
}

export function findLatestDesktopRelease(releases) {
    if (!Array.isArray(releases)) {
        return null;
    }

    // The releases API is newest-first, so the first compatible release is the
    // newest desktop build even when a newer mobile-only release is published.
    return (
        releases.find(
            (release) =>
                !release?.draft &&
                !release?.prerelease &&
                hasRequiredDesktopAssets(release),
        ) ?? null
    );
}

export { DESKTOP_TAR_GZ_PATTERN, OBSIDIAN_ASAR_GZ_PATTERN };
