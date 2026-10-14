import type { Page } from "playwright";

export interface ReloadRequest {
    /** app:reload を受けた時点の app.plugins.enabledPlugins を昇順に複製したもの。 */
    enabledPluginIds: string[];
}

export interface ReloadInterceptor {
    /** 1 回でも app:reload が要求されたら true。 */
    requested(): Promise<boolean>;
    /** 要求ごとのスナップショット。呼び出し順。 */
    requests(): Promise<ReloadRequest[]>;
    /** 差し替えを元に戻す。2 回目以降は no-op。restore 後も requests() は restore 時点の記録を返す。 */
    restore(): Promise<void>;
}

const INVALIDATED_MESSAGE =
    "The app:reload interceptor is no longer active because the Obsidian window was reloaded. Call interceptReload() again after the reload.";

// 注意: 以下の 3 関数は page.evaluate へシリアライズされて renderer で実行される。
// 外側のモジュール変数を参照してはいけない。キー名も関数内に直接書く。

interface HostInterceptorState {
    token: string;
    original: CommandRunner;
    interceptor: CommandRunner;
    requests: ReloadRequest[];
}

type CommandRunner = (this: unknown, ...args: unknown[]) => boolean;

export function installReloadInterceptor(token: string): void {
    const host = window as unknown as Record<string, HostInterceptorState | undefined>;
    if (host["__obsidianE2EReloadInterceptor"]) {
        throw new Error("app:reload is already intercepted on this window. Call restore() on the existing interceptor first.");
    }

    const commands = app.commands;
    const original = commands.executeCommandById as unknown as CommandRunner;
    const requests: { enabledPluginIds: string[] }[] = [];
    const interceptor: CommandRunner = function (this: unknown, ...args: unknown[]): boolean {
        if (args[0] !== "app:reload") {
            // this・戻り値・2 番目以降の引数（event など）をすべて元の関数へそのまま渡す。
            return original.apply(this, args);
        }
        requests.push({ enabledPluginIds: [...app.plugins.enabledPlugins].sort() });
        return true;
    };
    commands.executeCommandById = interceptor as unknown as typeof commands.executeCommandById;
    host["__obsidianE2EReloadInterceptor"] = { token, original, interceptor, requests };
}

export type ReloadInterceptorReading = { active: false } | { active: true; requests: ReloadRequest[] };

export function readReloadInterceptor(token: string): ReloadInterceptorReading {
    const host = window as unknown as Record<string, HostInterceptorState | undefined>;
    const state = host["__obsidianE2EReloadInterceptor"];
    if (!state || state.token !== token) {
        return { active: false };
    }
    return {
        active: true,
        requests: state.requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] })),
    };
}

export type ReloadInterceptorRestoreResult = { restored: false } | { restored: true; requests: ReloadRequest[] };

export function restoreReloadInterceptor(token: string): ReloadInterceptorRestoreResult {
    const host = window as unknown as Record<string, HostInterceptorState | undefined>;
    const state = host["__obsidianE2EReloadInterceptor"];
    if (!state || state.token !== token) {
        return { restored: false };
    }
    if ((app.commands.executeCommandById as unknown) !== state.interceptor) {
        throw new Error("app.commands.executeCommandById was replaced after interception. Refusing to overwrite it.");
    }
    app.commands.executeCommandById = state.original as unknown as typeof app.commands.executeCommandById;
    delete host["__obsidianE2EReloadInterceptor"];
    return {
        restored: true,
        requests: state.requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] })),
    };
}

/** Node 側で差し替えの状態を持つ。renderer 側の状態は token で照合する。 */
export class ReloadInterceptorSession implements ReloadInterceptor {
    private status: "active" | "restored" | "invalidated" = "active";
    private restoredRequests: ReloadRequest[] = [];

    constructor(
        private readonly page: Page,
        readonly token: string,
    ) {}

    async requested(): Promise<boolean> {
        return (await this.requests()).length > 0;
    }

    async requests(): Promise<ReloadRequest[]> {
        if (this.status === "restored") {
            return copyRequests(this.restoredRequests);
        }
        if (this.status === "invalidated") {
            throw new Error(INVALIDATED_MESSAGE);
        }

        const reading = await this.page.evaluate(readReloadInterceptor, this.token);
        if (!reading.active) {
            this.status = "invalidated";
            throw new Error(INVALIDATED_MESSAGE);
        }
        return reading.requests;
    }

    async restore(): Promise<void> {
        if (this.status !== "active") {
            return;
        }

        const result = await this.page.evaluate(restoreReloadInterceptor, this.token);
        if (!result.restored) {
            // 差し替えが消えている = ページが再読込された。元に戻す対象が無いので no-op にする。
            this.status = "invalidated";
            return;
        }
        this.restoredRequests = result.requests;
        this.status = "restored";
    }

    /** ページが再読込されて差し替えが消えたことを記録する。renderer には触れない。 */
    invalidate(): void {
        if (this.status === "active") {
            this.status = "invalidated";
        }
    }
}

function copyRequests(requests: ReloadRequest[]): ReloadRequest[] {
    return requests.map((request) => ({ enabledPluginIds: [...request.enabledPluginIds] }));
}
