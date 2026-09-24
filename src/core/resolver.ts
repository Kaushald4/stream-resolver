import type { SiteAdapter } from "./extractor.js";
import { ExtractionError } from "./errors.js";
import type {
  EpisodeInput,
  ExtractionInput,
  MovieInput,
  ShortDramaInput,
  SourcePage,
} from "./types.js";
import type { AdapterRegistry } from "./registry.js";

/**
 * Discovers source pages across adapters.
 * Deliberately separate from stream extraction.
 */
export class SourceResolver {
  constructor(private readonly registry: AdapterRegistry) {}

  async find(input: ExtractionInput, extractorIds?: string[]): Promise<SourcePage[]> {
    const adapters = this.selectAdapters(input, extractorIds);
    const pages: SourcePage[] = [];

    for (const adapter of adapters) {
      const found = await this.findWithAdapter(adapter, input);
      pages.push(...found);
    }

    return pages;
  }

  private selectAdapters(
    input: ExtractionInput,
    extractorIds?: string[],
  ): SiteAdapter[] {
    let adapters = this.registry.all();
    if (extractorIds?.length) {
      adapters = adapters.filter((a) => extractorIds.includes(a.metadata.id));
    }

    return adapters.filter((a) => {
      switch (input.kind) {
        case "movie":
          return a.capabilities.movie && typeof a.findMovie === "function";
        case "episode":
        case "series":
          return (
            (a.capabilities.episodes || a.capabilities.series) &&
            typeof a.findEpisode === "function"
          );
        case "short_drama":
          return (
            a.capabilities.shortDrama && typeof a.findShortDrama === "function"
          );
        default:
          return false;
      }
    });
  }

  private async findWithAdapter(
    adapter: SiteAdapter,
    input: ExtractionInput,
  ): Promise<SourcePage[]> {
    try {
      switch (input.kind) {
        case "movie":
          return (await adapter.findMovie?.(input as MovieInput)) ?? [];
        case "episode":
          return (await adapter.findEpisode?.(input as EpisodeInput)) ?? [];
        case "series":
          throw new ExtractionError(
            "UNSUPPORTED",
            "Series catalog discovery is not implemented; use episode extraction",
            { extractorId: adapter.metadata.id, layer: "discovery" },
          );
        case "short_drama":
          return (
            (await adapter.findShortDrama?.(input as ShortDramaInput)) ?? []
          );
        default:
          return [];
      }
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      throw new ExtractionError("UNKNOWN", String(err), {
        extractorId: adapter.metadata.id,
        layer: "discovery",
        cause: err,
      });
    }
  }
}
