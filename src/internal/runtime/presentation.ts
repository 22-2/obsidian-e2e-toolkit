export type MobileKind = "phone" | "tablet";
export type MobilePlatform = "android" | "ios";

/** emulateMobile が付け替えるクラス。付与前にこれらをすべて外す。 */
export const MANAGED_MOBILE_CLASSES = ["is-mobile", "is-phone", "is-tablet", "is-android", "is-ios"] as const;

export function mobileClassNames(kind: MobileKind, platform: MobilePlatform): string[] {
    const shape = kind === "phone" ? "is-phone" : "is-tablet";
    return ["is-mobile", shape, `is-${platform}`];
}
