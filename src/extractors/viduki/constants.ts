export const VIDUKI_ID = "viduki";
export const VIDUKI_VERSION = "1.0.0";

export const VIDUKI_DOMAINS = ["viduki.net", "www.viduki.net", "api.viduki.net"];

export const VIDUKI_API_BASE = "https://api.viduki.net";
export const VIDUKI_SITE = "https://www.viduki.net";
/** Must match viduki-decrypt.js DEFAULT_HEADERS exactly (CDN gates on both). */
export const VIDUKI_REFERER = "https://www.viduki.net/";
export const VIDUKI_ORIGIN = "https://www.viduki.net/";
export const VIDUKI_WASM_MANIFEST = "https://www.viduki.net/makima-manifest.json";

export const VIDUKI_DEFAULT_HEADERS = {
  Accept: "application/json",
  referer: VIDUKI_REFERER,
  origin: VIDUKI_ORIGIN,
} as const;
