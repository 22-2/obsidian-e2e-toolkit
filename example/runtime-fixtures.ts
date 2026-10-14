import fs from "node:fs/promises";
import path from "node:path";
import type { VaultOptions } from "../src";

/** runtime 系 spec が共有するテスト用プラグインの ID。外部依存は無い。 */
export const RUNTIME_PLUGIN_IDS = {
    styled: "rt-styled",
    missingCss: "rt-missing-css",
    plain: "rt-plain",
} as const;

// 設定画面の項目（.setting-item-name）をクリックすると clickLog に項目名を積み、次の画面要素を出す。
// 見出し（h2）の同名テキストは、クリックしても clickLog に入らない。
const STYLED_MAIN = [
    "const { Plugin, PluginSettingTab, Setting } = require('obsidian');",
    "class RuntimeSettingTab extends PluginSettingTab {",
    "    constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }",
    "    display() {",
    "        const { containerEl } = this;",
    "        containerEl.empty();",
    "        containerEl.createEl('h2', { text: 'General' });",
    "        new Setting(containerEl).setName('Modes').setDesc('Modes item').settingEl.addEventListener('click', () => {",
    "            this.plugin.clickLog.push('Modes');",
    "        });",
    "        new Setting(containerEl).setName('General').setDesc('General item').settingEl.addEventListener('click', () => {",
    "            this.plugin.clickLog.push('General');",
    "            containerEl.createDiv({ cls: 'rt-general-opened', text: 'General page opened' });",
    "        });",
    "    }",
    "}",
    "module.exports = class extends Plugin {",
    "    async onload() {",
    "        this.settings = Object.assign({ mode: 'initial' }, await this.loadData());",
    "        this.probes = 0;",
    "        this.boomCount = 0;",
    "        this.clickLog = [];",
    "        this.addCommand({ id: 'probe', name: 'probe', callback: () => { this.probes += 1; } });",
    "        this.addCommand({ id: 'boom', name: 'boom', callback: () => { this.boomCount += 1; throw new Error('rt-boom'); } });",
    "        this.addSettingTab(new RuntimeSettingTab(this.app, this));",
    "    }",
    "    async saveSettings() { await this.saveData(this.settings); }",
    "};",
].join("\n");

// 最初の CSS 読み込みだけ欠落させる。再読込でも同じ欠落が起きるので、復旧の経路を毎回通る。
const MISSING_CSS_MAIN = [
    "const { Plugin } = require('obsidian');",
    "module.exports = class extends Plugin {",
    "    async loadCSS() {",
    "        this.cssLoadAttempts = (this.cssLoadAttempts || 0) + 1;",
    "        if (this.cssLoadAttempts === 1) return;",
    "        await super.loadCSS();",
    "    }",
    "};",
].join("\n");

const PLAIN_MAIN = "const { Plugin } = require('obsidian');\nmodule.exports = class extends Plugin {};\n";

const MANIFEST_FIELDS = { version: "1.0.0", minAppVersion: "1.0.0", author: "test" };

interface RuntimePluginSpec {
    id: string;
    main: string;
    css?: string;
}

const SPECS: RuntimePluginSpec[] = [
    { id: RUNTIME_PLUGIN_IDS.styled, main: STYLED_MAIN, css: "body { --rt-styled: 1; }" },
    { id: RUNTIME_PLUGIN_IDS.missingCss, main: MISSING_CSS_MAIN, css: "body { --rt-missing-css: 1; }" },
    { id: RUNTIME_PLUGIN_IDS.plain, main: PLAIN_MAIN },
];

/** テンポラリ配下に fixture plugin を書き出し、vaultOptions を返す。 */
export async function runtimeVaultOptions(tempDir: string): Promise<Partial<VaultOptions>> {
    const plugins: { path: string }[] = [];
    for (const spec of SPECS) {
        const dir = path.join(tempDir, spec.id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ id: spec.id, name: spec.id, ...MANIFEST_FIELDS }));
        await fs.writeFile(path.join(dir, "main.js"), spec.main);
        if (spec.css) {
            await fs.writeFile(path.join(dir, "styles.css"), spec.css);
        }
        plugins.push({ path: dir });
    }
    return { fresh: true, obsidianCli: "off", plugins };
}
