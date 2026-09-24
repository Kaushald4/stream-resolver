import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import {
  VIDSRC2_API_BASE,
  VIDSRC2_ID,
  VIDSRC2_TOKEN_URL,
} from "./constants.js";

export type Vidsrc2ApiResponse = {
  /** Base64 ciphertext of newline-separated stream URLs. */
  stream_urls?: string;
  /** Absolute or relative WASM decryptor URL. */
  vs: {
    wasm_url: string;
    w: number;
  }
  /** Some responses nest payload. */
  data?: Vidsrc2ApiResponse;
  [key: string]: unknown;
};

export type Vidsrc2EncryptedPayload = {
  encryptedStreamUrls: string;
  wasmUrl: string;
};

function resolveWasmUrl(raw: Vidsrc2ApiResponse): string | undefined {
  return raw.vs?.wasm_url;
}

function resolveEncrypted(raw: Vidsrc2ApiResponse): string | undefined {
  if (typeof raw.stream_urls === "string" && raw.stream_urls.length > 0) {
    return raw.stream_urls;
  }
  if (raw.data && typeof raw.data === "object") {
    return resolveEncrypted(raw.data);
  }
  return undefined;
}

/**
 * Network layer for vidsrc2 — no parsing/decrypt here.
 */
export class Vidsrc2Api {
  constructor(private readonly http: HttpClient) {}

  async fetchMovieStreams(imdbId: string): Promise<Vidsrc2EncryptedPayload> {
    return this.fetchEncrypted({
      type: "movie",
      imdb: imdbId,
      stream_urls: "",
    });
  }

  async fetchEpisodeStreams(params: {
    tmdbId: string | number;
    season: number;
    episode: number;
    imdbId?: string;
  }): Promise<Vidsrc2EncryptedPayload> {
    const query: Record<string, string | number> = {
      type: "tv",
      season: params.season,
      episode: params.episode,
      stream_urls: "",
    };
    if (params.tmdbId != null) query.tmdb = params.tmdbId;
    if (params.imdbId) query.imdb = params.imdbId;
    return this.fetchEncrypted(query);
  }

  async fetchEncrypted(
    query: Record<string, string | number>,
  ): Promise<Vidsrc2EncryptedPayload> {
    let res;
    try {
      res = await this.http.get<Vidsrc2ApiResponse>(VIDSRC2_API_BASE, {
        query,
        responseType: "json",
        headers: {
          accept: "application/json, text/plain, */*",
          referer: "https://vidsrc2.ru/",
        },
      });
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `vidsrc2 API request failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: VIDSRC2_ID, layer: "discovery", cause: err },
      );
    }

    if (!res.ok) {
      const code = res.status === 403 ? "CLOUDFLARE" : "SITE_UNAVAILABLE";
      throw new ExtractionError(
        code,
        `vidsrc2 API HTTP ${res.status}`,
        { extractorId: VIDSRC2_ID, layer: "discovery" },
      );
    }

    const body = res.data;
    if (!body || typeof body !== "object") {
      throw new ExtractionError("API_CHANGED", "vidsrc2 API returned non-object", {
        extractorId: VIDSRC2_ID,
        layer: "discovery",
      });
    }

    const encryptedStreamUrls = resolveEncrypted(body);
    const wasmUrl = resolveWasmUrl(body);

    if (!encryptedStreamUrls) {
      throw new ExtractionError(
        "API_CHANGED",
        "vidsrc2 response missing stream_urls",
        { extractorId: VIDSRC2_ID, layer: "discovery" },
      );
    }
    if (!wasmUrl) {
      throw new ExtractionError(
        "API_CHANGED",
        "vidsrc2 response missing wasm module URL",
        { extractorId: VIDSRC2_ID, layer: "discovery" },
      );
    }

    return { encryptedStreamUrls, wasmUrl };
  }

  /** Token required as ?token= on decrypted stream URLs. */
  async generateToken(): Promise<string> {
    let res;
    try {
      res = await this.http.get<string>(VIDSRC2_TOKEN_URL, {
        responseType: "text",
        timeoutMs: 10_000,
      });
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Token generation failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: VIDSRC2_ID, layer: "extraction", cause: err },
      );
    }

    if (!res.ok) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Token endpoint HTTP ${res.status}`,
        { extractorId: VIDSRC2_ID, layer: "extraction" },
      );
    }

    const token = (res.text ?? String(res.data)).trim();
    if (!token) {
      throw new ExtractionError("API_CHANGED", "Empty token from generate.php", {
        extractorId: VIDSRC2_ID,
        layer: "extraction",
      });
    }
    return token;
  }
}
