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
import { VidukiApi } from "./api.js";
import { VIDUKI_DOMAINS, VIDUKI_ID, VIDUKI_VERSION } from "./constants.js";
import { assertTmdbId, decryptedToRawStream, toRawStreams } from "./parser.js";
import type { VidukiDiscoveryMeta, VidukiSessionMeta } from "./types.js";
import { isPlaybackReachable } from "./validate.js";

const CAPABILITIES: Capabilities = {
  movie: true,
  series: true,
  episodes: true,
  shortDrama: false,
  subtitles: false,
  multipleQualities: true,
  directStreams: true,
};

export class VidukiAdapter implements SiteAdapter {
  readonly capabilities = CAPABILITIES;
  readonly metadata: ExtractorMetadata = {
    id: VIDUKI_ID,
    name: "Viduki",
    version: VIDUKI_VERSION,
    enabled: true,
    lifecycle: "ACTIVE",
    capabilities: CAPABILITIES,
    domains: [...VIDUKI_DOMAINS],
  };

  private readonly api: VidukiApi;
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
    this.api = new VidukiApi(http);
  }

  canHandle(url: URL): boolean {
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return VIDUKI_DOMAINS.some(
      (d) => d === host || d.replace(/^www\./, "") === host,
    );
  }

  async findMovie(input: MovieInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const servers = await this.api.fetchServers();
    return [
      this.toSourcePage("movie", String(input.tmdbId), servers, input),
    ];
  }

  async findEpisode(input: EpisodeInput): Promise<SourcePage[]> {
    assertTmdbId(input.tmdbId);
    const servers = await this.api.fetchServers();
    return [
      this.toSourcePage("episode", String(input.tmdbId), servers, input),
    ];
  }

  async extract(source: SourcePage): Promise<Stream[]> {
    const meta = source.meta as VidukiDiscoveryMeta | undefined;
    if (!meta?.servers?.length) {
      throw new ExtractionError(
        "API_CHANGED",
        "SourcePage missing Viduki discovery meta",
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }

    const session = await this.api.bootstrapSession();
    const bridge = await this.api.prepareBridge(
      session.sessionNonce,
      session.altchaHeader,
    );

    const decrypted: Array<{ server: VidukiDiscoveryMeta["servers"][0]; plaintext: string }> =
      [];

    try {
      for (const server of meta.servers) {
        try {
          const fetched =
            meta.kind === "episode" && meta.season != null && meta.episode != null
              ? await this.api.fetchEpisodeEnvelope(
                  meta.tmdbId,
                  meta.season,
                  meta.episode,
                  server.name,
                  session.sessionNonce,
                  session.altchaHeader,
                )
              : await this.api.fetchMovieEnvelope(
                  meta.tmdbId,
                  server.name,
                  session.sessionNonce,
                  session.altchaHeader,
                );

          const plaintext = bridge.decryptEnvelope(
            fetched.envelope,
            fetched.clientNonce,
            fetched.requestId,
          );
          const raw = decryptedToRawStream(server, plaintext);
          if (!raw?.url) continue;
          if (!(await isPlaybackReachable(this.http, raw.url, raw.headers))) {
            continue;
          }
          decrypted.push({ server, plaintext });
        } catch {
          // Skip servers that fail (provider down, no stream, etc.)
        }
      }
    } finally {
      bridge.dropPepper();
    }

    const raws = toRawStreams(decrypted);
    return normalizeStreams(raws, {
      extractor: this.metadata.id,
      version: this.metadata.version,
    });
  }

  private toSourcePage(
    kind: "movie" | "episode",
    tmdbId: string,
    servers: VidukiDiscoveryMeta["servers"],
    input: MovieInput | EpisodeInput,
  ): SourcePage {
    const meta: VidukiDiscoveryMeta = {
      tmdbId,
      kind,
      servers,
      ...(kind === "episode" && "season" in input
        ? { season: input.season, episode: input.episode }
        : {}),
    };

    return {
      extractorId: VIDUKI_ID,
      url: `viduki://${kind}/${tmdbId}`,
      kind,
      meta: meta satisfies VidukiSessionMeta | VidukiDiscoveryMeta,
    };
  }
}
