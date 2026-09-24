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
import { NxshaApi } from "./api.js";
import {
  NXSHA_DOMAINS,
  NXSHA_ID,
  NXSHA_VERSION,
} from "./constants.js";
import { assertTmdbId, toRawStreams } from "./parser.js";
import type { NxshaDiscoveryMeta, NxshaRequestPayload } from "./types.js";

const CAPABILITIES: Capabilities = {
  movie: true,
  series: true,
  episodes: true,
  shortDrama: false,
  subtitles: false,
  multipleQualities: true,
  directStreams: true,
};

export class NxshaAdapter implements SiteAdapter {
  readonly capabilities = CAPABILITIES;
  readonly metadata: ExtractorMetadata = {
    id: NXSHA_ID,
    name: "Nxsha Federated Scraper",
    version: NXSHA_VERSION,
    enabled: true,
    lifecycle: "ACTIVE",
    capabilities: CAPABILITIES,
    domains: [...NXSHA_DOMAINS],
  };

  private readonly api: NxshaApi;

  constructor(http: HttpClient) {
    this.api = new NxshaApi(http);
  }

  canHandle(url: URL): boolean {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return NXSHA_DOMAINS.some(
      (d) => d === host || d.replace(/^www\./, "") === host,
    );
  }

  async findMovie(input: MovieInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const payload = this.toPayload("movie", input.tmdbId, input.imdbId);
    const servers = await this.api.fetchServers(payload);
    return [this.toSourcePage("movie", payload, servers, input)];
  }

  async findEpisode(input: EpisodeInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const payload = this.toPayload("tv", input.tmdbId, input.imdbId, {
      season: input.season,
      episode: input.episode,
    });
    const servers = await this.api.fetchServers(payload);
    return [this.toSourcePage("episode", payload, servers, input)];
  }

  async extract(source: SourcePage): Promise<Stream[]> {
    const meta = source.meta as NxshaDiscoveryMeta | undefined;
    if (!meta?.payload || !meta.servers?.length) {
      throw new ExtractionError(
        "API_CHANGED",
        "SourcePage missing Nxsha discovery payload",
        { extractorId: NXSHA_ID, layer: "extraction" },
      );
    }

    const sources = await this.api.fetchAllProviderSources(
      meta.payload,
      meta.servers,
    );
    const raws = toRawStreams(sources);

    return normalizeStreams(raws, {
      extractor: this.metadata.id,
      version: this.metadata.version,
    });
  }

  private toPayload(
    type: NxshaRequestPayload["type"],
    tmdbId: string | number,
    imdbId?: string,
    episode?: { season: number; episode: number },
  ): NxshaRequestPayload {
    return {
      tmdbId: String(tmdbId),
      imdb_id: imdbId ?? "",
      type,
      season: episode?.season,
      episode: episode?.episode,
    };
  }

  private toSourcePage(
    kind: SourcePage["kind"],
    payload: NxshaRequestPayload,
    servers: NxshaDiscoveryMeta["servers"],
    input: MovieInput | EpisodeInput,
  ): SourcePage {
    return {
      extractorId: NXSHA_ID,
      url: `nxsha://${kind}/${payload.tmdbId}`,
      kind,
      meta: {
        payload,
        servers,
        input,
      } satisfies NxshaDiscoveryMeta & { input: MovieInput | EpisodeInput },
    };
  }
}
