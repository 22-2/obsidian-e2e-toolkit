import type { IService, IServiceWithValue, ServiceContext } from "./IService";

export class ServiceContainer {
    private readonly services = new Map<string, IService>();

    register<T extends IService>(service: T): T {
        if (this.services.has(service.id)) {
            throw new Error(`Service already registered: ${service.id}`);
        }

        this.services.set(service.id, service);
        return service;
    }

    get<T extends IService>(id: string): T {
        const service = this.services.get(id);
        if (!service) {
            throw new Error(`Service not found: ${id}`);
        }

        return service as T;
    }

    getValue<T>(id: string): T {
        const service = this.get<IServiceWithValue<T>>(id);
        return service.value;
    }

    async setupAll(ctx: ServiceContext): Promise<void> {
        for (const service of this.services.values()) {
            await service.setup?.(ctx);
        }
    }

    async disposeAll(ctx: ServiceContext): Promise<void> {
        const registered = [...this.services.values()].reverse();
        for (const service of registered) {
            await service.dispose?.(ctx);
        }
    }
}

export class ValueService<T> implements IServiceWithValue<T> {
    constructor(
        public readonly id: string,
        public readonly value: T,
        private readonly hooks?: {
            setup?: (ctx: ServiceContext, value: T) => Promise<void> | void;
            dispose?: (ctx: ServiceContext, value: T) => Promise<void> | void;
        },
    ) {}

    async setup(ctx: ServiceContext): Promise<void> {
        await this.hooks?.setup?.(ctx, this.value);
    }

    async dispose(ctx: ServiceContext): Promise<void> {
        await this.hooks?.dispose?.(ctx, this.value);
    }
}
