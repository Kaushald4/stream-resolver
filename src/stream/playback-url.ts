import type { StreamHeaders } from "../core/types.js";

export type PlaybackUrlParts = {
  url: string;
  headers: Pick<StreamHeaders, "referer" | "origin">;
};

const WRAPPER_PARAMS = ["url", "uri", "src", "file", "link", "v", "stream"] as const;

const HEADER_QUERY_KEYS: Record<"referer" | "origin", readonly string[]> = {
  referer: ["referer", "ref", "referer_url"],
  origin: ["origin"],
};

/** Query keys that are proxy/player metadata — never part of the upstream CDN URL. */
const STRIP_QUERY_KEYS = new Set([
  "referer",
  "ref",
  "referer_url",
  "origin",
  "siteReferer",
  "site_referer",
  "omitOrigin",
  "omit_origin",
  "parent",
  "rand",
]);

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function normalizeReferer(value: string): string {
  if (!isHttpUrl(value)) return value;
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeOrigin(value: string): string {
  if (!isHttpUrl(value)) return value;
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function readNestedUrlParam(parsed: URL): string | null {
  for (const key of WRAPPER_PARAMS) {
    const value = parsed.searchParams.get(key);
    if (!value) continue;
    const decoded = safeDecode(value);
    if (isHttpUrl(decoded)) return decoded;
  }
  return null;
}

/** Referer of the outermost `?url=https://…` proxy (e.g. nitrox) when present. */
export function extractWrapperReferer(raw: string): string | undefined {
  try {
    const parsed = new URL(raw.trim());
    if (readNestedUrlParam(parsed)) return `${parsed.origin}/`;
  } catch {
    // ignore
  }
  return undefined;
}

/** Peel wrappers and return the inner URL plus the wrapper site referer. */
export function unwrapProxyUrlWithReferer(input: string): {
  url: string;
  wrapperReferer?: string;
} {
  let current = input.trim();
  let wrapperReferer: string | undefined;

  for (let depth = 0; depth < 5; depth++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      break;
    }
    const nested = readNestedUrlParam(parsed);
    if (!nested) break;
    wrapperReferer = `${parsed.origin}/`;
    current = nested;
  }

  return { url: current, wrapperReferer };
}

/** Peel `?url=https://…` proxy wrappers (nitrox, mbox, etc.) down to the CDN URL. */
export function unwrapProxyUrl(input: string): string {
  return unwrapProxyUrlWithReferer(input).url;
}

/**
 * Resolve a scraper URL to a clean CDN target plus any referer/origin encoded
 * in its query string. Auth params (`sign`, `t`, CDN `token`, etc.) are kept.
 */
export function normalizePlaybackUrl(
  raw: string,
  opts?: { wrapperReferer?: string },
): PlaybackUrlParts {
  const headers: Pick<StreamHeaders, "referer" | "origin"> = {};
  const unwrapped = unwrapProxyUrlWithReferer(raw);
  const wrapperReferer = opts?.wrapperReferer ?? unwrapped.wrapperReferer;

  let url: string;
  try {
    const parsed = new URL(unwrapped.url);

    for (const [field, keys] of Object.entries(HEADER_QUERY_KEYS) as Array<
      ["referer" | "origin", readonly string[]]
    >) {
      for (const key of keys) {
        const value = parsed.searchParams.get(key);
        if (!value) continue;
        const decoded = safeDecode(value);
        headers[field] =
          field === "referer" ? normalizeReferer(decoded) : normalizeOrigin(decoded);
        parsed.searchParams.delete(key);
        break;
      }
    }

    for (const key of [...parsed.searchParams.keys()]) {
      if (STRIP_QUERY_KEYS.has(key) || STRIP_QUERY_KEYS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    url = parsed.toString();
  } catch {
    url = unwrapped.url;
  }

  if (wrapperReferer) {
    headers.referer = wrapperReferer;
    headers.origin = normalizeOrigin(wrapperReferer);
  }

  return { url, headers };
}
