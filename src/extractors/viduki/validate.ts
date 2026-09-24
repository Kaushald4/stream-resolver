import type { HttpClient } from "../../http/client.js";
import type { Stream } from "../../core/types.js";

/** Skip CDN URLs that 404 before they reach the player. */
export async function isPlaybackReachable(
  http: HttpClient,
  url: string,
  headers?: Stream["headers"],
): Promise<boolean> {
  const reqHeaders: Record<string, string> = {};
  if (headers?.referer) reqHeaders.referer = headers.referer;
  if (headers?.origin) reqHeaders.origin = headers.origin;

  try {
    const head = await http.head(url, {
      headers: reqHeaders,
      timeoutMs: 12_000,
      responseType: "raw",
    });
    if (head.ok || head.status === 206) return true;
    if (head.status !== 405 && head.status !== 501) return false;

    const ranged = await http.get(url, {
      headers: { ...reqHeaders, Range: "bytes=0-0" },
      timeoutMs: 12_000,
      responseType: "raw",
    });
    return ranged.ok || ranged.status === 206;
  } catch {
    return false;
  }
}
