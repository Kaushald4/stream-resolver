/**
 * Short-drama adapter skeleton.
 *
 * Movie/series adapters key off IMDb/TMDB.
 * Short-drama adapters typically key off site-native show/episode ids
 * or shelf URLs (Reelshort, DramaBox, etc.).
 *
 * Implement a new folder under extractors/<site>/ and register it —
 * do not extend vidsrc2 or grow a giant switch.
 */

import type { SiteAdapter } from "../../core/extractor.js";
import type {
  Capabilities,
  ExtractorMetadata,
  ShortDramaInput,
  SourcePage,
  Stream,
} from "../../core/types.js";
import { ExtractionError } from "../../core/errors.js";

const CAPABILITIES: Capabilities = {
  movie: false,
  series: false,
  episodes: false,
  shortDrama: true,
  subtitles: false,
  multipleQualities: false,
  directStreams: true,
};

/**
 * Abstract base for short-drama sites. Concrete adapters extend this
 * and implement discovery + extract only.
 */
export abstract class ShortDramaAdapter implements SiteAdapter {
  abstract readonly metadata: ExtractorMetadata;
  readonly capabilities = CAPABILITIES;

  abstract canHandle(url: URL): boolean;
  abstract findShortDrama(input: ShortDramaInput): Promise<SourcePage[]>;
  abstract extract(source: SourcePage): Promise<Stream[]>;

  async findMovie(): Promise<SourcePage[]> {
    throw new ExtractionError("UNSUPPORTED", "Not a movie extractor", {
      extractorId: this.metadata.id,
      layer: "discovery",
    });
  }

  async findEpisode(): Promise<SourcePage[]> {
    throw new ExtractionError("UNSUPPORTED", "Not an episode extractor", {
      extractorId: this.metadata.id,
      layer: "discovery",
    });
  }
}
