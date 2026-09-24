import { ExtractionError } from "../../core/errors.js";
import type { SiteAdapter } from "../../core/extractor.js";
import type { HttpClient } from "../../http/client.js";
import { normalizeStreams } from "../../core/normalizer.js";
import type {
  Capabilities,
  EpisodeInput,
  ExtractorMetadata,
  MovieInput,
  SourcePage,
  Stream,
} from "../../core/types.js";
import { PrimeflixApi } from "./api.js";
import {
  PRIMEFLIX_DOMAINS,
  PRIMEFLIX_ID,
  PRIMEFLIX_VERSION,
} from "./constants.js";
import { expandPlaylistUrls } from "./playlist.js";
import { assertTmdbId, apiResponseToRawStreams } from "./parser.js";
import type { PrimeflixDiscoveryMeta } from "./types.js";

const CAPABILITIES: Capabilities = {
  movie: true,
  series: true,
  episodes: true,
  shortDrama: false,
  subtitles: false,
  multipleQualities: true,
  directStreams: true,
};

export class PrimeflixAdapter implements SiteAdapter {
  readonly capabilities = CAPABILITIES;
  readonly metadata: ExtractorMetadata = {
    id: PRIMEFLIX_ID,
    name: "Primeflix",
    version: PRIMEFLIX_VERSION,
    enabled: true,
    lifecycle: "ACTIVE",
    capabilities: CAPABILITIES,
    domains: [...PRIMEFLIX_DOMAINS],
  };

  private readonly http: HttpClient;
  private readonly api: PrimeflixApi;

  constructor(http: HttpClient) {
    this.http = http;
    this.api = new PrimeflixApi(http);
  }

  canHandle(url: URL): boolean {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return PRIMEFLIX_DOMAINS.some(
      (d) => d === host || d.replace(/^www\./, "") === host,
    );
  }

  async findMovie(input: MovieInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    return [this.toSourcePage("movie", String(input.tmdbId), input)];
  }

  async findEpisode(input: EpisodeInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    return [this.toSourcePage("episode", String(input.tmdbId), input)];
  }

  async extract(source: SourcePage): Promise<Stream[]> {
    const meta = source.meta as PrimeflixDiscoveryMeta | undefined;
    if (!meta?.tmdbId) {
      throw new ExtractionError(
        "API_CHANGED",
        "SourcePage missing Primeflix discovery meta",
        { extractorId: PRIMEFLIX_ID, layer: "extraction" },
      );
    }

    const data =
      meta.kind === "episode" && meta.season != null && meta.episode != null
        ? await this.api.fetchEpisodeSources(meta.tmdbId, meta.season, meta.episode)
        : await this.api.fetchMovieSources(meta.tmdbId);

    const raws = await expandPlaylistUrls(this.http, apiResponseToRawStreams(data));
    return normalizeStreams(raws, {
      extractor: this.metadata.id,
      version: this.metadata.version,
    });
  }

  private toSourcePage(
    kind: "movie" | "episode",
    tmdbId: string,
    input: MovieInput | EpisodeInput,
  ): SourcePage {
    const meta: PrimeflixDiscoveryMeta = {
      tmdbId,
      kind,
      ...(kind === "episode" && "season" in input
        ? { season: input.season, episode: input.episode }
        : {}),
    };

    return {
      extractorId: PRIMEFLIX_ID,
      url: `primeflix://${kind}/${tmdbId}`,
      kind,
      meta,
    };
  }
}
