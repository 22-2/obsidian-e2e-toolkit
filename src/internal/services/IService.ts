import type { ElectronApplication, Page } from "playwright";
import type { ResolvedPaths } from "../path";
import type { VaultOptions } from "../types";

export interface LoggerLike {
  trace: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface RuntimeContext {
  initialized: boolean;
  electronApp?: ElectronApplication;
  activePage?: Page;
  vaultPath?: string;
}

export interface ServiceContext {
  paths: ResolvedPaths;
  options: VaultOptions;
  tempVaultDir: string;
  runtime: RuntimeContext;
  logger: LoggerLike;
}

export interface IService {
  readonly id: string;
  setup?: (ctx: ServiceContext) => Promise<void> | void;
  dispose?: (ctx: ServiceContext) => Promise<void> | void;
}

export interface IServiceWithValue<T> extends IService {
  readonly value: T;
}
