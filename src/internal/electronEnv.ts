/**
 * Electron が通常のアプリではなく Node として起動してしまう環境変数を取り除いたコピーを返す。
 * 親プロセスに設定されていると Obsidian が起動できず、テストが始まる前に失敗するため、起動前に必ず外す。
 * Windows の環境変数名は大文字小文字を区別しないので、比較も大文字小文字を無視する。
 */
const RUN_AS_NODE = "ELECTRON_RUN_AS_NODE";

export function withoutElectronRunAsNode(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const copy: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(env)) {
        if (key.toUpperCase() === RUN_AS_NODE) {
            continue;
        }
        copy[key] = value;
    }
    return copy;
}
