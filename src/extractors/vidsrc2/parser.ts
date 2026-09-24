import { ExtractionError } from "../../core/errors.js";
import { VIDSRC2_ID } from "./constants.js";

/**
 * Pure parsers — unit-testable with fixtures, no network.
 */

export function parseDecryptedStreamList(plaintext: string): string[] {
  return plaintext
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /^https?:\/\//i.test(line));
}

export function attachToken(streamUrl: string, token: string): string {
  const url = new URL(streamUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export function guessQualityFromUrl(url: string): string | undefined {
  const match = url.match(/(?:^|[^\d])(\d{3,4})p(?:[^\d]|$)/i);
  return match ? `${match[1]}p` : undefined;
}

export function assertHasIds(params: {
  imdbId?: string;
  tmdbId?: string | number;
  require: "imdb" | "tmdb" | "either";
}): void {
  const hasImdb = Boolean(params.imdbId);
  const hasTmdb = params.tmdbId != null && String(params.tmdbId).length > 0;

  if (params.require === "imdb" && !hasImdb) {
    throw new ExtractionError("UNSUPPORTED", "imdbId is required", {
      extractorId: VIDSRC2_ID,
      layer: "discovery",
    });
  }
  if (params.require === "tmdb" && !hasTmdb) {
    throw new ExtractionError("UNSUPPORTED", "tmdbId is required", {
      extractorId: VIDSRC2_ID,
      layer: "discovery",
    });
  }
  if (params.require === "either" && !hasImdb && !hasTmdb) {
    throw new ExtractionError(
      "UNSUPPORTED",
      "imdbId or tmdbId is required",
      { extractorId: VIDSRC2_ID, layer: "discovery" },
    );
  }
}
