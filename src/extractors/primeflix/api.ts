import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import {
  PRIMEFLIX_API_BASE,
  PRIMEFLIX_DEFAULT_HEADERS,
  PRIMEFLIX_ID,
} from "./constants.js";
import type { PrimeflixApiResponse } from "./types.js";

export class PrimeflixApi {
  constructor(private readonly http: HttpClient) {}

  async fetchMovieSources(tmdbId: string): Promise<PrimeflixApiResponse> {
    return this.fetchSources(`${PRIMEFLIX_API_BASE}/movie/${tmdbId}`);
  }

  async fetchEpisodeSources(
    tmdbId: string,
    season: number,
    episode: number,
  ): Promise<PrimeflixApiResponse> {
    return this.fetchSources(
      `${PRIMEFLIX_API_BASE}/tv/${tmdbId}/${season}/${episode}`,
    );
  }

  private async fetchSources(url: string): Promise<PrimeflixApiResponse> {
    const res = await this.http.get<PrimeflixApiResponse>(url, {
      responseType: "json",
      headers: PRIMEFLIX_DEFAULT_HEADERS,
      timeoutMs: 200000,
      retries: 2,
    });

    if (!res.ok || !res.data || typeof res.data !== "object") {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Primeflix API HTTP ${res.status}`,
        { extractorId: PRIMEFLIX_ID, layer: "extraction" },
      );
    }

    return res.data;
  }
}
