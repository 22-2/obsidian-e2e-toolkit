export const SERVICE_IDS = {
    electronManager: "electronManager",
    windowManager: "windowManager",
    storageManager: "storageManager",
    ipcBridge: "ipcBridge",
    vaultManager: "vaultManager",
    pluginManager: "pluginManager",
} as const;

export type ServiceId = (typeof SERVICE_IDS)[keyof typeof SERVICE_IDS];
