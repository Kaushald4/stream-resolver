import { SourceResolver } from "./resolver.js";
import type { AdapterRegistry } from "./registry.js";
import { ExtractionError, isExtractionError, toExtractionError } from "./errors.js";
import { dedupeStreams } from "./normalizer.js";
import { rankStreams } from "./ranker.js";
import type { StreamValidator } from "../validation/stream-validator.js";
import type { ExtractionCache } from "../cache/memory-cache.js";
import { cacheKeyForInput } from "../cache/memory-cache.js";
import type {
  ExtractionFailure,
  ExtractionInput,
  ExtractionResult,
  PipelineOptions,
  SourcePage,
  Stream,
} from "./types.js";

export type PipelineDeps = {
  registry: AdapterRegistry;
  resolver: SourceResolver;
  validator?: StreamValidator;
  cache?: ExtractionCache;
  cacheTtlMs?: number;
};

/**
 * End-to-end extraction pipeline:
 * Input → Resolve → Extract → Normalize (in adapter) → Validate → Dedupe → Rank
 */
export class ExtractionPipeline {
  private readonly registry: AdapterRegistry;
  private readonly resolver: SourceResolver;
  private readonly validator?: StreamValidator;
  private readonly cache?: ExtractionCache;
  private readonly cacheTtlMs: number;

  constructor(deps: PipelineDeps) {
    this.registry = deps.registry;
    this.resolver = deps.resolver;
    this.validator = deps.validator;
    this.cache = deps.cache;
    this.cacheTtlMs = deps.cacheTtlMs ?? 5 * 60_000;
  }

  async run(
    input: ExtractionInput,
    options: PipelineOptions = {},
  ): Promise<ExtractionResult> {
    const started = Date.now();
    const errors: ExtractionFailure[] = [];

    if (this.cache) {
      const key = cacheKeyForInput("pipeline", input as ExtractionInput & Record<string, unknown>);
      const hit = await this.cache.get<ExtractionResult>(key);
      if (hit) return hit;
    }

    let sources: SourcePage[] = [];
    try {
      sources = await this.resolver.find(input, options.extractors);
    } catch (err) {
      const e = toExtractionError(err, "UNKNOWN");
      errors.push(e.toFailure());
    }

    if (sources.length === 0 && errors.length === 0) {
      errors.push({
        extractorId: options.extractors?.[0] ?? "*",
        code: "NO_STREAM",
        message: "No source pages discovered",
        layer: "discovery",
      });
    }

    const streams: Stream[] = [];

    for (const source of sources) {
      const adapter = this.registry.get(source.extractorId);
      if (!adapter) {
        errors.push({
          extractorId: source.extractorId,
          code: "UNSUPPORTED",
          message: `Adapter not registered: ${source.extractorId}`,
          layer: "extraction",
        });
        continue;
      }

      try {
        const extracted = await adapter.extract(source);
        streams.push(...extracted);
        this.registry.recordSuccess(adapter.metadata.id);
      } catch (err) {
        this.registry.recordFailure(adapter.metadata.id);
        if (isExtractionError(err)) {
          errors.push(err.toFailure());
        } else {
          errors.push(
            new ExtractionError("UNKNOWN", String(err), {
              extractorId: adapter.metadata.id,
              layer: "extraction",
              cause: err,
            }).toFailure(),
          );
        }
      }
    }

    let finalStreams = dedupeStreams(streams);

    if (!options.skipValidation && this.validator && finalStreams.length > 0) {
      const { valid, invalid } = await this.validator.filterValid(finalStreams);
      for (const bad of invalid) {
        errors.push({
          extractorId: bad.stream.source.extractor,
          code: "VALIDATION_FAILED",
          message: bad.reason ?? "Stream failed validation",
          layer: "validation",
        });
      }
      finalStreams = valid;
    }

    if (!options.skipRanking) {
      finalStreams = rankStreams(finalStreams);
    }

    const result: ExtractionResult = {
      input,
      streams: finalStreams,
      sources,
      errors,
      durationMs: Date.now() - started,
    };

    if (this.cache && finalStreams.length > 0) {
      const key = cacheKeyForInput("pipeline", input as ExtractionInput & Record<string, unknown>);
      await this.cache.set(key, result, this.cacheTtlMs);
    }

    return result;
  }
}
