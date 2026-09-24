import type {
  Capabilities,
  EpisodeInput,
  ExtractorMetadata,
  MovieInput,
  ShortDramaInput,
  SourcePage,
  Stream,
} from "./types.js";

/**
 * Strict adapter contract.
 *
 * Site-specific URLs, APIs, players, and crypto stay inside the adapter.
 * The engine only talks through this interface.
 */
export interface SiteAdapter {
  readonly metadata: ExtractorMetadata;
  readonly capabilities: Capabilities;

  canHandle(url: URL): boolean;

  /** Optional URL → source page bootstrap (embed links, deep links). */
  resolveUrl?(url: URL): Promise<SourcePage[]>;

  findMovie?(input: MovieInput): Promise<SourcePage[]>;
  findEpisode?(input: EpisodeInput): Promise<SourcePage[]>;
  findShortDrama?(input: ShortDramaInput): Promise<SourcePage[]>;

  extract(source: SourcePage): Promise<Stream[]>;
}

/** Convenience alias matching the architecture doc naming. */
export type Extractor = SiteAdapter;
