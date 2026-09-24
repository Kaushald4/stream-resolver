/** Common browser-like header presets. Adapters compose these. */

export const BROWSER_HEADERS = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
} as const;

export function withReferer(
  referer: string,
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    ...BROWSER_HEADERS,
    referer,
    ...extra,
  };
}

export function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    ...extra,
  };
}
