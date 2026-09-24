import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import { CINEBY_API_BASE, CINEBY_ID, CINEBY_REFERER } from "./constants.js";

export type CinebySeedResponse = {
  seed: string;
};

export type CinebyDiscoveryParams = {
  tmdbId: string | number;
  mediaType: "movie" | "tv";
  seasonId?: string | number;
  episodeId?: string | number;
  title?: string;
  year?: string | number;
  imdbId?: string;
};

export type CinebyEncryptedPayload = {
  seed: string;
  ciphertext: string;
  tmdbId: string | number;
  mediaType: "movie" | "tv";
};

const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  referer: CINEBY_REFERER,
};

/**
 * Network layer for Cineby / speedracelight API.
 */
export class CinebyApi {
  constructor(private readonly http: HttpClient) {}

  async fetchSeed(tmdbId: string | number): Promise<string> {
    let res;
    try {
      res = await this.http.get<CinebySeedResponse>(
        `${CINEBY_API_BASE}/seed`,
        {
          query: { mediaId: tmdbId },
          responseType: "json",
          headers: DEFAULT_HEADERS,
        },
      );
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Cineby seed request failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: CINEBY_ID, layer: "discovery", cause: err },
      );
    }

    if (!res.ok) {
      throw new ExtractionError(
        res.status === 403 ? "CLOUDFLARE" : "SITE_UNAVAILABLE",
        `Cineby seed HTTP ${res.status}`,
        { extractorId: CINEBY_ID, layer: "discovery" },
      );
    }

    const seed = res.data?.seed;
    if (!seed || typeof seed !== "string") {
      throw new ExtractionError("API_CHANGED", "Cineby seed response missing seed", {
        extractorId: CINEBY_ID,
        layer: "discovery",
      });
    }

    return seed;
  }

  async fetchEncryptedSources(
    params: CinebyDiscoveryParams,
    seed: string,
  ): Promise<string> {
    const query: Record<string, string | number> = {
      title: params.title ?? "title",
      mediaType: params.mediaType,
      seasonId: params.seasonId ?? 1,
      episodeId: params.episodeId ?? 1,
      tmdbId: params.tmdbId,
      enc: 2,
      seed,
      year: params.year ?? "year",
    };
    if (params.imdbId) query.imdbId = params.imdbId;

    let res;
    try {
      res = await this.http.get<string>(
        `${CINEBY_API_BASE}/cdn/sources-with-title`,
        {
          query,
          responseType: "text",
          headers: DEFAULT_HEADERS,
        },
      );
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Cineby sources request failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: CINEBY_ID, layer: "discovery", cause: err },
      );
    }

    if (!res.ok) {
      throw new ExtractionError(
        res.status === 403 ? "CLOUDFLARE" : "SITE_UNAVAILABLE",
        `Cineby sources HTTP ${res.status}`,
        { extractorId: CINEBY_ID, layer: "discovery" },
      );
    }

    const ciphertext = (res.text ?? String(res.data)).trim();
    if (!ciphertext) {
      throw new ExtractionError("NO_STREAM", "Cineby returned empty payload", {
        extractorId: CINEBY_ID,
        layer: "discovery",
      });
    }

    return ciphertext;
  }

  async discover(params: CinebyDiscoveryParams): Promise<CinebyEncryptedPayload> {
    const seed = await this.fetchSeed(params.tmdbId);
    const ciphertext = await this.fetchEncryptedSources(params, seed);
    return {
      seed,
      ciphertext,
      tmdbId: params.tmdbId,
      mediaType: params.mediaType,
    };
  }
}
