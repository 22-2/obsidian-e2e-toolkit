import type { ServiceContext } from "../services/IService";
import type { ServiceContainer } from "../services/ServiceContainer";

export interface IFeature<TInput, TOutput> {
    run(
        input: TInput,
        ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<TOutput>;
}
