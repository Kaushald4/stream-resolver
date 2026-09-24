import type { HttpClient } from "../http/client.js";
import type { Stream } from "../core/types.js";

export type ValidationResult = {
  stream: Stream;
  ok: boolean;
  status?: number;
  reason?: string;
};

/**
 * Lightweight stream reachability check (HEAD, fall back to ranged GET).
 * Full media probing can be added later without changing adapters.
 */
export class StreamValidator {
  constructor(private readonly http: HttpClient) {}

  async validate(stream: Stream): Promise<ValidationResult> {
    const headers: Record<string, string> = {};
    if (stream.headers?.referer) headers.referer = stream.headers.referer;
    if (stream.headers?.origin) headers.origin = stream.headers.origin;
    if (stream.headers?.userAgent) {
      headers["user-agent"] = stream.headers.userAgent;
    }

    try {
      const head = await this.http.head(stream.url, {
        headers,
        timeoutMs: 8_000,
        retries: 0,
      });

      if (head.ok || head.status === 405 || head.status === 403) {
        // Some CDNs reject HEAD; treat 2xx/405 as usable signal.
        if (head.ok) {
          return { stream, ok: true, status: head.status };
        }
      }

      // Fallback: tiny ranged GET
      const get = await this.http.get(stream.url, {
        headers: { ...headers, range: "bytes=0-1" },
        timeoutMs: 8_000,
        retries: 0,
        responseType: "arrayBuffer",
      });

      if (get.ok || get.status === 206) {
        return { stream, ok: true, status: get.status };
      }

      return {
        stream,
        ok: false,
        status: get.status,
        reason: `HTTP ${get.status}`,
      };
    } catch (err) {
      return {
        stream,
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async filterValid(streams: Stream[]): Promise<{
    valid: Stream[];
    invalid: ValidationResult[];
  }> {
    const results = await Promise.all(streams.map((s) => this.validate(s)));
    return {
      valid: results.filter((r) => r.ok).map((r) => r.stream),
      invalid: results.filter((r) => !r.ok),
    };
  }
}
