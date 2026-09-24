import type { RawStreamLike } from "../../core/normalizer.js";
import { ExtractionError } from "../../core/errors.js";
import {
  PRIMEFLIX_ID,
  PRIMEFLIX_ORIGIN,
  PRIMEFLIX_REFERER,
} from "./constants.js";
import { decryptVideoUrl } from "./crypto.js";
import type { PrimeflixApiResponse, PrimeflixServerEntry } from "./types.js";

const PLAYBACK_HEADERS = {
  referer: PRIMEFLIX_REFERER,
  origin: PRIMEFLIX_ORIGIN,
  siteReferer: true,
} as const;

export function assertTmdbId(
  tmdbId?: string | number,
): asserts tmdbId is string | number {
  if (tmdbId == null || String(tmdbId).length === 0) {
    throw new ExtractionError("UNSUPPORTED", "tmdbId is required for Primeflix", {
      extractorId: PRIMEFLIX_ID,
      layer: "discovery",
    });
  }
}

function entryToRawStream(
  serverName: string,
  entry: PrimeflixServerEntry,
): RawStreamLike | null {
  const url = decryptVideoUrl(entry.url);
  if (!url) return null;

  const label = [serverName, entry.language, entry.type?.toUpperCase()]
    .filter(Boolean)
    .join(" · ");

  return {
    url,
    label: label || serverName,
    type: entry.type?.toLowerCase(),
    headers: { ...PLAYBACK_HEADERS, xDebug: label || serverName },
  };
}

export function apiResponseToRawStreams(data: PrimeflixApiResponse): RawStreamLike[] {
  const raws: RawStreamLike[] = [];

  for (const [serverName, entry] of Object.entries(data)) {
    if (!entry || typeof entry !== "object" || !entry.url) continue;
    try {
      const raw = entryToRawStream(serverName, entry);
      if (raw) raws.push(raw);
    } catch {
      // Skip servers with bad ciphertext
    }
  }

  if (raws.length === 0) {
    throw new ExtractionError("NO_STREAM", "Primeflix returned no playable streams", {
      extractorId: PRIMEFLIX_ID,
      layer: "extraction",
    });
  }

  return raws;
}
