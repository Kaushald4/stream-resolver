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
import { CinebyApi, type CinebyEncryptedPayload } from "./api.js";
import {
  CINEBY_DOMAINS,
  CINEBY_ID,
  CINEBY_REFERER,
  CINEBY_VERSION,
} from "./constants.js";
import { decryptCinebyPayload } from "./decrypt.js";
import {
  assertTmdbId,
  parseCinebySourcesJson,
  toRawStreams,
} from "./parser.js";

const CAPABILITIES: Capabilities = {
  movie: true,
  series: true,
  episodes: true,
  shortDrama: false,
  subtitles: true,
  multipleQualities: true,
  directStreams: true,
};

/**
 * Cineby adapter (speedracelight API).
 *
 * Discovery: TMDB id → seed + encrypted sources payload
 * Extraction: custom decrypt → normalized HLS streams + subtitles
 */
export class CinebyAdapter implements SiteAdapter {
  readonly capabilities = CAPABILITIES;
  readonly metadata: ExtractorMetadata = {
    id: CINEBY_ID,
    name: "Cineby",
    version: CINEBY_VERSION,
    enabled: true,
    lifecycle: "ACTIVE",
    capabilities: CAPABILITIES,
    domains: [...CINEBY_DOMAINS],
  };

  private readonly api: CinebyApi;

  constructor(http: HttpClient) {
    this.api = new CinebyApi(http);
  }

  canHandle(url: URL): boolean {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return CINEBY_DOMAINS.some(
      (d) => d === host || d.replace(/^www\./, "") === host,
    );
  }

  async findMovie(input: MovieInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const payload = await this.api.discover({
      tmdbId: input.tmdbId,
      mediaType: "movie",
      title: input.title,
      year: input.year,
      imdbId: input.imdbId,
    });
    return [this.toSourcePage("movie", payload, input)];
  }

  async findEpisode(input: EpisodeInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const payload = await this.api.discover({
      tmdbId: input.tmdbId,
      mediaType: "tv",
      seasonId: input.season,
      episodeId: input.episode,
      title: input.title,
      imdbId: input.imdbId,
    });
    return [this.toSourcePage("episode", payload, input)];
  }

  async extract(source: SourcePage): Promise<Stream[]> {
    const meta = source.meta as CinebyEncryptedPayload | undefined;
    if (!meta?.ciphertext || !meta?.seed || meta.tmdbId == null) {
      throw new ExtractionError(
        "API_CHANGED",
        "SourcePage missing Cineby encrypted payload",
        { extractorId: CINEBY_ID, layer: "extraction" },
      );
    }

    const plaintext = decryptCinebyPayload(
      meta.ciphertext,
      meta.seed,
      meta.tmdbId,
    );
    const parsed = parseCinebySourcesJson(plaintext);
    const headers = {
      referer: CINEBY_REFERER,
      origin: "https://cineby.at",
    };

    return normalizeStreams(
      toRawStreams(parsed, headers),
      {
        extractor: this.metadata.id,
        version: this.metadata.version,
      },
    );
  }

  private toSourcePage(
    kind: SourcePage["kind"],
    payload: CinebyEncryptedPayload,
    input: MovieInput | EpisodeInput,
  ): SourcePage {
    return {
      extractorId: CINEBY_ID,
      url: `cineby://${kind}/${payload.tmdbId}`,
      kind,
      meta: {
        ...payload,
        input,
      },
    };
  }
}
