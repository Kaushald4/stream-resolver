import type { RawStreamLike } from "../../core/normalizer.js";
import { ExtractionError } from "../../core/errors.js";
import { VIDUKI_ID, VIDUKI_ORIGIN, VIDUKI_REFERER } from "./constants.js";
import type { VidukiDecryptedPayload, VidukiServer } from "./types.js";

function pickStreamUrl(parsed: VidukiDecryptedPayload): string | null {
  const candidates = [
    parsed.stream?.url,
    parsed.stream?.file,
    parsed.stream?.src,
    parsed.url,
    parsed.file,
    parsed.src,
  ];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed.startsWith("//")) return `https:${trimmed}`;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Master manifest: Referer/Origin = viduki.net (no parent on first fetch).
 * HLS segments on sibling CDNs: parent playlist URL as Referer (siteReferer off).
 */
const PLAYBACK_HEADERS = {
  referer: VIDUKI_REFERER,
  origin: VIDUKI_ORIGIN,
} as const;

export function assertTmdbId(
  tmdbId?: string | number,
): asserts tmdbId is string | number {
  if (tmdbId == null || String(tmdbId).length === 0) {
    throw new ExtractionError("UNSUPPORTED", "tmdbId is required for Viduki", {
      extractorId: VIDUKI_ID,
      layer: "discovery",
    });
  }
}

export function parseDecryptedPayload(raw: string): VidukiDecryptedPayload {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed) as VidukiDecryptedPayload;
  } catch (err) {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("//")) {
      const url = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
      return { stream: { url } };
    }
    throw new ExtractionError(
      "API_CHANGED",
      `Viduki decrypted payload is not JSON: ${err instanceof Error ? err.message : err}`,
      { extractorId: VIDUKI_ID, layer: "extraction" },
    );
  }
}

export function decryptedToRawStream(
  server: VidukiServer,
  plaintext: string,
): RawStreamLike | null {
  const parsed = parseDecryptedPayload(plaintext);
  if (parsed.error) return null;
  const url = pickStreamUrl(parsed);
  if (!url) return null;

  const label = [server.name, server.language].filter(Boolean).join(" · ");
  const payloadHeaders = parsed.stream?.headers ?? parsed.headers;

  return {
    url,
    label: label || server.name,
    headers: { ...PLAYBACK_HEADERS, ...payloadHeaders, xDebug: label || server.name },
  };
}

export function toRawStreams(
  entries: Array<{ server: VidukiServer; plaintext: string }>,
): RawStreamLike[] {
  const raws: RawStreamLike[] = [];
  for (const entry of entries) {
    const raw = decryptedToRawStream(entry.server, entry.plaintext);
    if (raw) raws.push(raw);
  }

  if (raws.length === 0) {
    throw new ExtractionError("NO_STREAM", "Viduki returned no playable streams", {
      extractorId: VIDUKI_ID,
      layer: "extraction",
    });
  }

  return raws;
}
