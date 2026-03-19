import { App } from "obsidian";

declare global {
    declare const app: App;
}

declare module "obsidian" {
    interface WorkspaceHistory {
        back(): void;
        forward(): void;
    }

    interface WorkspaceLeaf {
        history: WorkspaceHistory;
    }

    interface Commands {
        executeCommandById: (id: string) => boolean;
    }

    interface Plugin {
        settings: unknown;
        saveSettings(): Promise<void>;
        _loaded: boolean;
    }

    interface Plugins {
        plugins: Record<string, Plugin>;
        enabledPlugins: Set<string>;
        enablePlugin(id: string): void;
        disablePlugin(id: string): void;
        isEnabled(id?: string): boolean;
    }

    interface App {
        commands: Commands;
        plugins: Plugins;
    }
}
