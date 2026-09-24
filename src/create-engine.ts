import { AdapterRegistry } from "./core/registry.js";
import { SourceResolver } from "./core/resolver.js";
import { ExtractionPipeline } from "./core/pipeline.js";
import { HttpClient } from "./http/client.js";
import { StreamValidator } from "./validation/stream-validator.js";
import { MemoryCache } from "./cache/memory-cache.js";
import { registerVidsrc2 } from "./extractors/vidsrc2/index.js";
import { registerCineby } from "./extractors/cineby/index.js";
import { registerNxsha } from "./extractors/nxsha/index.js";
import { registerViduki } from "./extractors/viduki/index.js";
import { registerPrimeflix } from "./extractors/primeflix/index.js";
import {
  registerExternalAdapters,
  type LoadedExternalAdapter,
} from "./adapters/load-external.js";

export type Engine = {
  registry: AdapterRegistry;
  resolver: SourceResolver;
  pipeline: ExtractionPipeline;
  http: HttpClient;
};

export type CreateEngineOptions = {
  /** Skip registering built-in adapters (for tests). */
  bare?: boolean;
  http?: HttpClient;
  enableCache?: boolean;
  enableValidation?: boolean;
  /** Directories containing manifest.json + entry module (standalone adapters). */
  externalAdapterDirs?: string[];
};

/**
 * Wires core + built-in adapters into a ready pipeline.
 * New sites: registerXxx(registry, http) here — never a giant switch.
 */
export async function createEngine(
  options: CreateEngineOptions = {},
): Promise<Engine & { externalAdapters: LoadedExternalAdapter[] }> {
  const http =
    options.http ??
    new HttpClient({
      timeoutMs: 15_000,
      retries: 2,
    });

  const registry = new AdapterRegistry();

  const reservedIds: string[] = [];

  if (!options.bare) {
    registerVidsrc2(registry, http);
    registerCineby(registry, http);
    registerNxsha(registry, http);
    registerViduki(registry, http);
    registerPrimeflix(registry, http);
    reservedIds.push("vidsrc2", "cineby", "nxsha", "viduki", "primeflix");
  }

  const externalAdapters = options.externalAdapterDirs?.length
    ? await registerExternalAdapters(registry, http, options.externalAdapterDirs, {
        reservedIds,
      })
    : [];

  const resolver = new SourceResolver(registry);
  const validator =
    options.enableValidation === false
      ? undefined
      : new StreamValidator(http);
  const cache =
    options.enableCache === false ? undefined : new MemoryCache();

  const pipeline = new ExtractionPipeline({
    registry,
    resolver,
    validator,
    cache,
  });

  return { registry, resolver, pipeline, http, externalAdapters };
}
