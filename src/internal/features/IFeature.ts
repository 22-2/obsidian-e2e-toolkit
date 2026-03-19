import type { ServiceContainer } from "../services/ServiceContainer";
import type { ServiceContext } from "../services/IService";

export interface IFeature<TInput, TOutput> {
    run(
        input: TInput,
        ctx: ServiceContext,
        services: ServiceContainer,
    ): Promise<TOutput>;
}
