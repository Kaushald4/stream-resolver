import type { HttpClient } from "../../http/client.js";
import type { RawStreamLike } from "../../core/normalizer.js";
import { normalizeQuality } from "../../core/normalizer.js";
import {
  PRIMEFLIX_DEFAULT_HEADERS,
  PRIMEFLIX_ORIGIN,
  PRIMEFLIX_REFERER,
} from "./constants.js";

const PLAYBACK_HEADERS = {
  referer: PRIMEFLIX_REFERER,
  origin: PRIMEFLIX_ORIGIN,
  siteReferer: true,
} as const;

type StreamrkPlaylistEntry = {
  resolution?: number;
  url?: string;
};

export function isStreamrkPlaylistUrl(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname.endsWith("streamrk.site") && pathname.includes("/playlist/");
  } catch {
    return false;
  }
}

/** GET streamrk playlist JSON → one raw stream per quality (Primeflix referer/origin). */
export async function fetchStreamrkPlaylist(
  http: HttpClient,
  playlistUrl: string,
  baseLabel?: string,
): Promise<RawStreamLike[]> {
  const res = await http.get<StreamrkPlaylistEntry[]>(playlistUrl, {
    responseType: "json",
    headers: PRIMEFLIX_DEFAULT_HEADERS,
  });

  if (!res.ok || !Array.isArray(res.data)) return [];

  const raws: RawStreamLike[] = [];
  for (const entry of res.data) {
    if (!entry?.url) continue;
    const quality = normalizeQuality(entry.resolution);
    const label = [baseLabel, quality].filter(Boolean).join(" · ");
    raws.push({
      url: entry.url,
      quality,
      label: label || undefined,
      type: "mp4",
      headers: { ...PLAYBACK_HEADERS, xDebug: label || baseLabel },
    });
  }
  return raws;
}

/** Expand streamrk playlist indirections; pass through direct URLs unchanged. */
export async function expandPlaylistUrls(
  http: HttpClient,
  raws: RawStreamLike[],
): Promise<RawStreamLike[]> {
  const out: RawStreamLike[] = [];
  for (const raw of raws) {
    const url = raw.url;
    if (url && isStreamrkPlaylistUrl(url)) {
      const resolved = await fetchStreamrkPlaylist(http, url, raw.label);
      if (resolved.length > 0) out.push(...resolved);
      continue;
    }
    out.push(raw);
  }
  return out;
}
