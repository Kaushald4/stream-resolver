export const PRIMEFLIX_ID = "primeflix";
export const PRIMEFLIX_VERSION = "1.0.0";

export const PRIMEFLIX_DOMAINS = ["primeflix.ru", "www.primeflix.ru"];

export const PRIMEFLIX_API_BASE = "https://primeflix.ru/api";
export const PRIMEFLIX_SITE = "https://primeflix.ru";
/** Must match raw_movies_series/primeflix DEFAULT_HEADERS (CDN gates on both). */
export const PRIMEFLIX_REFERER = "https://primeflix.ru/";
export const PRIMEFLIX_ORIGIN = "https://primeflix.ru/";

export const PRIMEFLIX_DEFAULT_HEADERS = {
  Accept: "application/json",
  referer: PRIMEFLIX_REFERER,
  origin: PRIMEFLIX_ORIGIN,
} as const;
