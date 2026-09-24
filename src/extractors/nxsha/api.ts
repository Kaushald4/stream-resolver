import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import {
  NXSHA_API_BASE,
  NXSHA_ID,
  NXSHA_ORIGIN,
  NXSHA_REFERER,
} from "./constants.js";
import { decryptPayload, encryptPayload } from "./crypto.js";
import type {
  NxshaRequestPayload,
  NxshaServer,
  NxshaSource,
} from "./types.js";

const API_HEADERS = {
  accept: "application/json, text/plain, */*",
  origin: NXSHA_ORIGIN,
  referer: NXSHA_REFERER,
};

type HashEnvelope = { _hash?: string };

function parseDecrypted<T>(encrypted: string): T {
  const plaintext = decryptPayload(encrypted);
  if (!plaintext) {
    throw new ExtractionError("API_CHANGED", "Nxsha decrypt returned empty payload", {
      extractorId: NXSHA_ID,
      layer: "extraction",
    });
  }
  try {
    return JSON.parse(plaintext) as T;
  } catch (err) {
    throw new ExtractionError(
      "API_CHANGED",
      `Nxsha decrypted payload is not JSON: ${err instanceof Error ? err.message : err}`,
      { extractorId: NXSHA_ID, layer: "extraction" },
    );
  }
}

/**
 * Network layer for web.nxsha.app encrypted API.
 */
export class NxshaApi {
  constructor(private readonly http: HttpClient) {}

  async fetchServers(payload: NxshaRequestPayload): Promise<NxshaServer[]> {
    const q = encryptPayload(payload);
    let res;
    try {
      res = await this.http.get<HashEnvelope>(`${NXSHA_API_BASE}/api/servers`, {
        query: { q },
        responseType: "json",
        headers: API_HEADERS,
      });
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Nxsha servers request failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: NXSHA_ID, layer: "discovery", cause: err },
      );
    }

    if (!res.ok || !res.data?._hash) {
      throw new ExtractionError(
        res.status === 403 ? "CLOUDFLARE" : "SITE_UNAVAILABLE",
        `Nxsha servers HTTP ${res.status}`,
        { extractorId: NXSHA_ID, layer: "discovery" },
      );
    }

    const parsed = parseDecrypted<{ servers?: NxshaServer[] }>(res.data._hash);
    const servers = parsed.servers ?? [];
    if (servers.length === 0) {
      throw new ExtractionError("NO_STREAM", "Nxsha returned no scraper providers", {
        extractorId: NXSHA_ID,
        layer: "discovery",
      });
    }
    return servers;
  }

  async fetchSources(payload: NxshaRequestPayload): Promise<NxshaSource[]> {
    const q = encryptPayload({ ...payload, ex_lang: false });
    let res;
    try {
      res = await this.http.get<HashEnvelope>(`${NXSHA_API_BASE}/api/sources`, {
        query: { q },
        responseType: "json",
        headers: API_HEADERS,
      });
    } catch (err) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Nxsha sources request failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: NXSHA_ID, layer: "extraction", cause: err },
      );
    }

    if (!res.ok || !res.data?._hash) {
      throw new ExtractionError(
        "SITE_UNAVAILABLE",
        `Nxsha sources HTTP ${res.status}`,
        { extractorId: NXSHA_ID, layer: "extraction" },
      );
    }

    const parsed = parseDecrypted<{ sources?: NxshaSource[] }>(res.data._hash);
    const provider = payload.provider;
    const sources = (parsed.sources ?? []).map((source) => ({
      ...source,
      provider: source.provider ?? provider,
    }));
    return this.resolveEmbeds(sources);
  }

  async fetchAllProviderSources(
    payload: NxshaRequestPayload,
    servers: NxshaServer[],
  ): Promise<NxshaSource[]> {
    const batches = await Promise.all(
      servers.map(async (server) => {
        try {
          return await this.fetchSources({
            ...payload,
            provider: server.scraper,
          });
        } catch {
          return [] as NxshaSource[];
        }
      }),
    );
    return batches.flat();
  }

  private async resolveEmbeds(sources: NxshaSource[]): Promise<NxshaSource[]> {
    const resolved: NxshaSource[] = [];

    for (const source of sources) {
      if (source.isEmbed && source.url?.includes("gemma")) {
        const gemmaStreams = await this.extractGemmaEmbed(source);
        resolved.push(...gemmaStreams);
        continue;
      }

      if (source.isEmbed) continue;
      resolved.push(source);
    }

    return resolved;
  }

  private async extractGemmaEmbed(source: NxshaSource): Promise<NxshaSource[]> {
    if (!source.url) return [];

    let page;
    try {
      page = await this.http.get<string>(source.url, { responseType: "text" });
    } catch {
      return [];
    }

    const html = page.text ?? String(page.data ?? "");
    const fileMatch = html.match(/"file"\s*:\s*"([^"]+)"/);
    const keyMatch = html.match(/"key"\s*:\s*"([^"]+)"/);
    if (!fileMatch || !keyMatch) return [];

    let file = fileMatch[1].replace(/\\\//g, "/");
    const gemmaOrigin = new URL(source.url).origin;
    if (file.includes("playlist")) {
      file = `${gemmaOrigin}/${file.replace(/^\//, "")}`;
    }

    let playlistRes;
    try {
      playlistRes = await this.http.post<unknown>(file, null, {
        responseType: "json",
        headers: {
          referer: `${gemmaOrigin}/`,
          "x-csrf-token": keyMatch[1],
        },
      });
    } catch {
      return [];
    }

    const entries = Array.isArray(playlistRes.data)
      ? playlistRes.data.filter(
          (item): item is Record<string, unknown> =>
            item != null && !Array.isArray(item) && typeof item === "object",
        )
      : [];

    const out: NxshaSource[] = [];
    for (const entry of entries) {
      const filePath = typeof entry.file === "string" ? entry.file : null;
      if (!filePath) continue;

      const playlistUrl = `${gemmaOrigin}/playlist/${filePath.substring(1)}.txt`;
      let streamRes;
      try {
        streamRes = await this.http.get<string>(playlistUrl, {
          responseType: "text",
          headers: {
            referer: `${gemmaOrigin}/`,
            "x-csrf-token": keyMatch[1],
          },
        });
      } catch {
        continue;
      }

      const streamUrl = (streamRes.text ?? String(streamRes.data ?? "")).trim();
      if (!streamUrl) continue;

      out.push({
        ...source,
        url: streamUrl,
        org_uri: streamUrl,
        isEmbed: false,
        quality: typeof entry.label === "string" ? entry.label : source.quality,
        label: typeof entry.label === "string" ? entry.label : source.label,
        type: "m3u8",
        headers: {
          referer: `${gemmaOrigin}/`,
          origin: gemmaOrigin,
        },
      });
    }

    return out;
  }
}
