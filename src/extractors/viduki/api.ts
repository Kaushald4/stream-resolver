import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import { applyPepperKey, loadVidukiBridge } from "../../primitives/viduki-wasm.js";
import type { VidukiBridgeHandle } from "../../primitives/viduki-wasm.js";
import { createAltchaHeader, randomHex, solveAltcha } from "./altcha.js";
import {
  VIDUKI_API_BASE,
  VIDUKI_DEFAULT_HEADERS,
  VIDUKI_ID,
} from "./constants.js";
import type {
  AltchaChallenge,
  VidukiBootstrap,
  VidukiEnvelope,
  VidukiPepperKey,
  VidukiServer,
} from "./types.js";

export class VidukiApi {
  constructor(private readonly http: HttpClient) {}

  async fetchServers(): Promise<VidukiServer[]> {
    const res = await this.http.get<VidukiServer[]>(`${VIDUKI_API_BASE}/main/servers`, {
      responseType: "json",
      headers: VIDUKI_DEFAULT_HEADERS,
    });
    if (!res.ok || !Array.isArray(res.data)) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Viduki servers HTTP ${res.status}`,
        { extractorId: VIDUKI_ID, layer: "discovery" },
      );
    }
    // Match reference scraper — avoids dozens of sequential envelope fetches.
    return res.data.filter(
      (s) =>
        s?.name &&
        (s.language === "ENGLISH" || s.language === "HINDI" || !s.language),
    );
  }

  async bootstrapSession(): Promise<{ sessionNonce: string; altchaHeader: string }> {
    const altcha = await this.fetchAltcha();
    const start = Date.now();
    const solution = solveAltcha(altcha.salt, altcha.challenge, altcha.maxnumber);
    const altchaHeader = createAltchaHeader(altcha, solution, start);

    const bootstrap = await this.http.get<VidukiBootstrap>(`${VIDUKI_API_BASE}/bootstrap`, {
      responseType: "json",
      headers: { ...VIDUKI_DEFAULT_HEADERS, "X-Altcha": altchaHeader },
    });
    if (!bootstrap.ok) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Viduki bootstrap HTTP ${bootstrap.status}`,
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }

    const sessionNonce = bootstrap.data?.n;
    if (!sessionNonce || !/^[0-9a-f]{32}$/i.test(sessionNonce)) {
      throw new ExtractionError(
        "API_CHANGED",
        "Viduki bootstrap returned no valid session nonce",
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }

    const altcha2 = await this.fetchAltcha();
    const start2 = Date.now();
    const solution2 = solveAltcha(altcha2.salt, altcha2.challenge, altcha2.maxnumber);
    const altchaHeader2 = createAltchaHeader(altcha2, solution2, start2);

    return { sessionNonce, altchaHeader: altchaHeader2 };
  }

  async prepareBridge(sessionNonce: string, altchaHeader: string): Promise<VidukiBridgeHandle> {
    const pepper = await this.fetchPepperKey(sessionNonce, altchaHeader);
    const bridge = await loadVidukiBridge(this.http);
    applyPepperKey(bridge, sessionNonce, pepper);
    return bridge;
  }

  async fetchMovieEnvelope(
    tmdbId: string,
    serverName: string,
    sessionNonce: string,
    altchaHeader: string,
  ): Promise<{ envelope: VidukiEnvelope; clientNonce: string; requestId: string }> {
    return this.fetchMediaEnvelope(
      `${VIDUKI_API_BASE}/main/movie/${tmdbId}`,
      serverName,
      sessionNonce,
      altchaHeader,
    );
  }

  async fetchEpisodeEnvelope(
    tmdbId: string,
    season: number,
    episode: number,
    serverName: string,
    sessionNonce: string,
    altchaHeader: string,
  ): Promise<{ envelope: VidukiEnvelope; clientNonce: string; requestId: string }> {
    return this.fetchMediaEnvelope(
      `${VIDUKI_API_BASE}/main/tv/${tmdbId}/${season}/${episode}`,
      serverName,
      sessionNonce,
      altchaHeader,
    );
  }

  private async fetchAltcha(): Promise<AltchaChallenge> {
    const res = await this.http.get<AltchaChallenge>(`${VIDUKI_API_BASE}/altcha-challenge`, {
      responseType: "json",
      headers: VIDUKI_DEFAULT_HEADERS,
    });
    if (!res.ok || !res.data?.challenge) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Viduki altcha HTTP ${res.status}`,
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }
    return res.data;
  }

  private async fetchPepperKey(
    sessionNonce: string,
    altchaHeader: string,
  ): Promise<VidukiPepperKey> {
    const res = await this.http.get<VidukiPepperKey>(`${VIDUKI_API_BASE}/pepper-key`, {
      responseType: "json",
      headers: {
        ...VIDUKI_DEFAULT_HEADERS,
        "X-Altcha": altchaHeader,
        "X-Nonce": sessionNonce,
      },
    });
    if (!res.ok || res.data?.error) {
      throw new ExtractionError(
        "DECRYPT_FAILED",
        res.data?.error ?? `Viduki pepper-key HTTP ${res.status}`,
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }
    return res.data;
  }

  private async fetchMediaEnvelope(
    baseUrl: string,
    serverName: string,
    sessionNonce: string,
    altchaHeader: string,
  ): Promise<{ envelope: VidukiEnvelope; clientNonce: string; requestId: string }> {
    const clientNonce = randomHex(16);
    const requestId = randomHex(16);

    const res = await this.http.get<VidukiEnvelope>(baseUrl, {
      responseType: "json",
      query: { srv: serverName },
      headers: {
        ...VIDUKI_DEFAULT_HEADERS,
        "X-Altcha": altchaHeader,
        "X-Nonce": sessionNonce,
        "X-Client-Nonce": clientNonce,
        "X-Request-Id": requestId,
      },
    });

    if (!res.ok || res.data?.error) {
      throw new ExtractionError(
        "NO_STREAM",
        res.data?.error ?? `Viduki media HTTP ${res.status}`,
        { extractorId: VIDUKI_ID, layer: "extraction" },
      );
    }

    return { envelope: res.data, clientNonce, requestId };
  }
}
