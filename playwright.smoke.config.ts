import { defineObsidianConfig } from "./src/config";

// 意図: OS ごとの起動検証は同梱プラグインだけを使い、外部取得や他の suite と切り離す。
export default defineObsidianConfig({
    testDir: "./example",
    testMatch: "example.spec.ts",
    workers: 1,
    timeout: 90_000,
    reporter: [["list"], ["html", { open: "never" }]],
});
