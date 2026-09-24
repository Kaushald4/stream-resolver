import type { Stream, StreamType } from "./types.js";

const QUALITY_ALIASES: Record<string, string> = {
  "full hd": "1080p",
  fullhd: "1080p",
  fhd: "1080p",
  hd: "720p",
  sd: "480p",
  "4k": "2160p",
  uhd: "2160p",
};

/**
 * Converts heterogeneous site payloads into the engine Stream model.
 * Adapters should prefer calling this rather than inventing shapes.
 */
export function detectStreamType(url: string): StreamType {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes("format=m3u8")) return "hls";
  if (lower.includes(".mpd") || lower.includes("dash")) return "dash";
  if (lower.includes(".mp4") || lower.includes("mime=video/mp4")) return "mp4";
  return "unknown";
}

export function normalizeQuality(raw?: string | number | null): string | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim().toLowerCase();
  if (QUALITY_ALIASES[s]) return QUALITY_ALIASES[s];
  const match = s.match(/(\d{3,4})\s*p?/);
  if (match) return `${match[1]}p`;
  return String(raw).trim();
}

export type RawStreamLike = {
  url?: string;
  file?: string;
  src?: string;
  quality?: string | number;
  label?: string;
  type?: string;
  headers?: Stream["headers"];
  expiresAt?: Date | string | number;
  subtitles?: Stream["subtitles"];
};

export function normalizeStream(
  raw: RawStreamLike,
  source: Stream["source"],
): Stream | null {
  const url = raw.url ?? raw.file ?? raw.src;
  if (!url || typeof url !== "string") return null;

  let expiresAt: Date | undefined;
  if (raw.expiresAt != null) {
    expiresAt =
      raw.expiresAt instanceof Date
        ? raw.expiresAt
        : new Date(raw.expiresAt);
  }

  const typeFromRaw = raw.type?.toLowerCase();
  let type = detectStreamType(url);
  if (typeFromRaw === "hls" || typeFromRaw === "m3u8") type = "hls";
  if (typeFromRaw === "dash" || typeFromRaw === "mpd") type = "dash";
  if (typeFromRaw === "mp4") type = "mp4";

  return {
    url,
    quality: normalizeQuality(raw.quality ?? raw.label),
    label: raw.label,
    type,
    headers: raw.headers,
    expiresAt,
    subtitles: raw.subtitles,
    source,
  };
}

export function normalizeStreams(
  raws: RawStreamLike[],
  source: Stream["source"],
): Stream[] {
  const out: Stream[] = [];
  for (const raw of raws) {
    const stream = normalizeStream(raw, source);
    if (stream) out.push(stream);
  }
  return out;
}

/** Deduplicate by URL (ignore query token churn optionally via stripQuery). */
export function dedupeStreams(
  streams: Stream[],
  options?: { ignoreQuery?: boolean },
): Stream[] {
  const seen = new Set<string>();
  const result: Stream[] = [];
  for (const stream of streams) {
    let key = stream.url;
    if (options?.ignoreQuery) {
      try {
        const u = new URL(stream.url);
        u.search = "";
        key = u.toString();
      } catch {
        key = stream.url;
      }
    }
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(stream);
  }
  return result;
}
