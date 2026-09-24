import type { SiteAdapter } from "../../core/extractor.js";
import type { HttpClient } from "../../http/client.js";
import { normalizeStreams } from "../../core/normalizer.js";
import { ExtractionError } from "../../core/errors.js";
import type {
  Capabilities,
  EpisodeInput,
  ExtractorMetadata,
  MovieInput,
  SourcePage,
  Stream,
} from "../../core/types.js";
import { Vidsrc2Api } from "./api.js";
import {
  VIDSRC2_DOMAINS,
  VIDSRC2_ID,
  VIDSRC2_REFERER,
  VIDSRC2_VERSION,
} from "./constants.js";
import { Vidsrc2Decryptor } from "./decrypt.js";
import { assertHasIds } from "./parser.js";

const CAPABILITIES: Capabilities = {
  movie: true,
  series: true,
  episodes: true,
  shortDrama: false,
  subtitles: false,
  multipleQualities: true,
  directStreams: true,
};

type Vidsrc2Meta = {
  encryptedStreamUrls: string;
  wasmUrl: string;
};

/**
 * Vidsrc2 site adapter.
 *
 * Discovery: IMDb/TMDB → encrypted payload + wasm URL
 * Extraction: WASM decrypt → token stamp → normalized streams
 */
export class Vidsrc2Adapter implements SiteAdapter {
  readonly capabilities = CAPABILITIES;
  readonly metadata: ExtractorMetadata = {
    id: VIDSRC2_ID,
    name: "Vidsrc2",
    version: VIDSRC2_VERSION,
    enabled: true,
    lifecycle: "ACTIVE",
    capabilities: CAPABILITIES,
    domains: [...VIDSRC2_DOMAINS],
  };

  private readonly api: Vidsrc2Api;
  private readonly decryptor: Vidsrc2Decryptor;

  constructor(http: HttpClient) {
    this.api = new Vidsrc2Api(http);
    this.decryptor = new Vidsrc2Decryptor(http, this.api);
  }

  canHandle(url: URL): boolean {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return VIDSRC2_DOMAINS.some(
      (d) => d === host || d.replace(/^www\./, "") === host,
    );
  }

  async findMovie(input: MovieInput): Promise<SourcePage[]> {
    assertHasIds({ imdbId: input.imdbId, tmdbId: input.tmdbId, require: "imdb" });
    const payload = await this.api.fetchMovieStreams(input.imdbId!);
    return [this.toSourcePage("movie", payload, input)];
  }

  async findEpisode(input: EpisodeInput): Promise<SourcePage[]> {
    assertHasIds({
      imdbId: input.imdbId,
      tmdbId: input.tmdbId,
      require: "either",
    });
    if (input.tmdbId == null) {
      throw new ExtractionError(
        "UNSUPPORTED",
        "vidsrc2 TV extraction prefers tmdbId (see flow: type=tv&tmdb=...)",
        { extractorId: VIDSRC2_ID, layer: "discovery" },
      );
    }

    const payload = await this.api.fetchEpisodeStreams({
      tmdbId: input.tmdbId,
      season: input.season,
      episode: input.episode,
      imdbId: input.imdbId,
    });

    return [this.toSourcePage("episode", payload, input)];
  }

  async extract(source: SourcePage): Promise<Stream[]> {
    const meta = source.meta as Vidsrc2Meta | undefined;
    if (!meta?.encryptedStreamUrls || !meta?.wasmUrl) {
      throw new ExtractionError(
        "API_CHANGED",
        "SourcePage missing encrypted payload / wasm URL",
        { extractorId: VIDSRC2_ID, layer: "extraction" },
      );
    }

    const { urls } = await this.decryptor.decryptAndTokenize(
      meta.encryptedStreamUrls,
      meta.wasmUrl,
    );

    const raw = urls.map((url) => ({
      url,
      quality: this.decryptor.enrichQuality(url),
      headers: {
        referer: VIDSRC2_REFERER,
        origin: "https://vidsrc2.ru",
      },
    }));

    return normalizeStreams(raw, {
      extractor: this.metadata.id,
      version: this.metadata.version,
    });
  }

  private toSourcePage(
    kind: SourcePage["kind"],
    payload: Vidsrc2Meta,
    input: MovieInput | EpisodeInput,
  ): SourcePage {
    const id =
      ("imdbId" in input && input.imdbId) ||
      ("tmdbId" in input && input.tmdbId) ||
      "unknown";
    return {
      extractorId: VIDSRC2_ID,
      url: `vidsrc2://${kind}/${id}`,
      kind,
      meta: {
        encryptedStreamUrls: payload.encryptedStreamUrls,
        wasmUrl: payload.wasmUrl,
        input,
      },
    };
  }
}
