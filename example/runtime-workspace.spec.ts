import { expect, test as base } from "../src";
import { runtimeVaultOptions } from "./runtime-fixtures";

const test = base.extend({
    vaultOptions: async ({ tempDir }, use) => {
        await use(await runtimeVaultOptions(tempDir));
    },
});

test("openView and revealView bring the chosen view to the front and make it active", async ({ obsidian }) => {
    await obsidian.createNote("Runtime note.md", "body");
    await obsidian.open("Runtime note.md");
    expect(await obsidian.activeViewType()).toBe("markdown");

    await obsidian.openView("empty", {}, { newLeaf: true });
    expect(await obsidian.activeViewType()).toBe("empty");
    expect(await obsidian.describeLeaves()).toContain("type=markdown");

    await obsidian.revealView("markdown");
    expect(await obsidian.activeViewType()).toBe("markdown");
});

test("collapseSidebars collapses both sidebars", async ({ obsidian }) => {
    await obsidian.collapseSidebars();
    expect(await obsidian.evaluateApp(() => app.workspace.leftSplit.collapsed && app.workspace.rightSplit.collapsed)).toBe(true);
});

test("setTheme switches the body theme class and leaves the other one out", async ({ obsidian, page }) => {
    await obsidian.setTheme("dark");
    await expect(page.locator("body")).toHaveClass(/theme-dark/);
    await expect(page.locator("body")).not.toHaveClass(/theme-light/);

    await obsidian.setTheme("light");
    await expect(page.locator("body")).toHaveClass(/theme-light/);
    await expect(page.locator("body")).not.toHaveClass(/theme-dark/);
});

test("emulateMobile sets the kind and platform classes and removes the previous ones", async ({ obsidian, page }) => {
    await obsidian.emulateMobile("phone");
    const phone = await page.evaluate(() => Array.from(document.body.classList));
    expect(phone).toEqual(expect.arrayContaining(["is-mobile", "is-phone", "is-android"]));

    await obsidian.emulateMobile("tablet", undefined, { platform: "ios" });
    const tablet = await page.evaluate(() => Array.from(document.body.classList));
    expect(tablet).toEqual(expect.arrayContaining(["is-mobile", "is-tablet", "is-ios"]));
    expect(tablet).not.toContain("is-phone");
    expect(tablet).not.toContain("is-android");
});

test("waitForAnimations waits for finite animations and does not wait for infinite ones", async ({ obsidian, page }) => {
    await page.evaluate(() => {
        const finite = document.createElement("div");
        finite.id = "rt-finite";
        document.body.append(finite);
        finite.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
        const looping = document.createElement("div");
        looping.id = "rt-loop";
        document.body.append(looping);
        looping.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, iterations: Infinity });
    });

    await obsidian.waitForAnimations(page, { timeout: 5000 });
    const running = await page.evaluate(() => document.getAnimations().filter((animation) =>
        animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity,
    ).length);
    expect(running).toBe(0);
    await page.evaluate(() => {
        document.getElementById("rt-finite")?.remove();
        document.getElementById("rt-loop")?.remove();
    });
});
