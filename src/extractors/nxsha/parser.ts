import type { RawStreamLike } from "../../core/normalizer.js";
import { ExtractionError } from "../../core/errors.js";
import type { StreamHeaders } from "../../core/types.js";
import {
  extractWrapperReferer,
  normalizePlaybackUrl,
  type PlaybackUrlParts,
} from "../../stream/playback-url.js";
import { NXSHA_ID, NXSHA_ORIGIN, NXSHA_REFERER, MBOX_PLAYBACK_ORIGIN, MBOX_PLAYBACK_REFERER } from "./constants.js";
import type { NxshaSource } from "./types.js";

export { unwrapProxyUrl } from "../../stream/playback-url.js";

export function assertTmdbId(
  tmdbId?: string | number,
): asserts tmdbId is string | number {
  if (tmdbId == null || String(tmdbId).length === 0) {
    throw new ExtractionError("UNSUPPORTED", "tmdbId is required for Nxsha", {
      extractorId: NXSHA_ID,
      layer: "discovery",
    });
  }
}

function isPlayableUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes(".m3u8") || lower.includes(".mp4") || lower.includes(".mkv")) {
    return true;
  }
  if (lower.includes("format=m3u8") || lower.includes("/hls")) return true;
  return false;
}

function isMboxSource(source: NxshaSource): boolean {
  const provider = source.provider?.toLowerCase();
  const id = source.id?.toLowerCase();
  return provider === "mbox" || (id?.startsWith("mbox-") ?? false);
}

/** Playback referer the CDN checks — varies by federated provider, not the nitrox wrapper. */
function resolveProviderReferer(
  source: NxshaSource,
): Pick<StreamHeaders, "referer" | "origin"> | undefined {
  if (isMboxSource(source)) {
    return { referer: MBOX_PLAYBACK_REFERER, origin: MBOX_PLAYBACK_ORIGIN };
  }
  return undefined;
}

function resolvePlayableUrl(source: NxshaSource): PlaybackUrlParts | null {
  const providerReferer = resolveProviderReferer(source);
  const wrapperReferer =
    providerReferer?.referer ??
    (source.url ? extractWrapperReferer(source.url) : undefined);

  // Nxsha returns two URLs: org_uri = direct CDN stream, url = proxy/wrapper page.
  if (source.org_uri) {
    const normalized = normalizePlaybackUrl(source.org_uri, { wrapperReferer });
    if (isPlayableUrl(normalized.url)) {
      if (providerReferer) normalized.headers = providerReferer;
      return normalized;
    }
  }

  for (const candidate of [source.url, source.file].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  )) {
    const normalized = normalizePlaybackUrl(candidate, { wrapperReferer });
    if (isPlayableUrl(normalized.url)) {
      if (providerReferer) normalized.headers = providerReferer;
      return normalized;
    }
  }
  return null;
}

function buildPlaybackHeaders(
  source: NxshaSource,
  streamUrl: string,
  embedded: Pick<StreamHeaders, "referer" | "origin">,
): NonNullable<RawStreamLike["headers"]> {
  const headers: NonNullable<RawStreamLike["headers"]> = {
    siteReferer: true,
  };

  if (source.headers) {
    for (const [key, value] of Object.entries(source.headers)) {
      if (typeof value !== "string" || !value) continue;
      headers[key.toLowerCase()] = value;
    }
  }

  // Normalized wrapper/CDN headers win over API-provided referer/origin noise.
  if (embedded.referer) headers.referer = embedded.referer;
  if (embedded.origin) headers.origin = embedded.origin;

  // Provider-specific referer (e.g. mbox → 123movienow) wins over wrapper/CDN defaults.
  const providerReferer = resolveProviderReferer(source);
  if (providerReferer) {
    headers.referer = providerReferer.referer;
    headers.origin = providerReferer.origin;
  }

  const lower = streamUrl.toLowerCase();
  if (lower.includes(".mp4") && lower.includes("sign=")) {
    headers.omitOrigin = true;
  }

  if (!headers.referer || typeof headers.referer !== "string") {
    try {
      const origin = new URL(streamUrl).origin;
      headers.referer = `${origin}/`;
      headers.origin = origin;
    } catch {
      headers.referer = NXSHA_REFERER;
      headers.origin = NXSHA_ORIGIN;
    }
  } else if (!headers.origin || typeof headers.origin !== "string") {
    try {
      headers.origin = new URL(String(headers.referer)).origin;
    } catch {
      headers.origin = NXSHA_ORIGIN;
    }
  }

  return headers;
}

export function nxshaSourceToRawStream(source: NxshaSource): RawStreamLike | null {
  const resolved = resolvePlayableUrl(source);
  if (!resolved) return null;

  const qualityLabel = source.label ?? source.quality;
  const debug = [source.provider, source.id].filter(Boolean).join(" · ");

  return {
    url: resolved.url,
    quality: qualityLabel,
    label: debug || undefined,
    type: source.type,
    headers: {
      ...buildPlaybackHeaders(source, resolved.url, resolved.headers),
      ...(debug ? { xDebug: debug } : {}),
    },
  };
}

export function toRawStreams(sources: NxshaSource[]): RawStreamLike[] {
  const raws: RawStreamLike[] = [];
  for (const source of sources) {
    const raw = nxshaSourceToRawStream(source);
    if (raw) raws.push(raw);
  }

  if (raws.length === 0) {
    throw new ExtractionError("NO_STREAM", "Nxsha returned no playable streams", {
      extractorId: NXSHA_ID,
      layer: "extraction",
    });
  }

  return raws;
}
