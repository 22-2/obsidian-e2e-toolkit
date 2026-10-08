import { expect, test } from "../src";

test("allTabs includes a tab opened in the background", async ({ obsidian }) => {
  await obsidian.waitReady();
  await obsidian.createNote("Alpha plan.md", "alpha");
  await obsidian.createNote("Beta notes.md", "beta");
  await obsidian.open("Beta notes.md");

  await obsidian.evaluateApp(async () => {
    const file = app.vault.getAbstractFileByPath("Alpha plan.md");
    await app.workspace.getLeaf("tab").openFile(file as any, { active: false });
  });

  const paths = (await obsidian.allTabs()).map((tab) => tab.filePath);
  expect(paths).toContain("Alpha plan.md");
  expect(paths).toContain("Beta notes.md");
});
