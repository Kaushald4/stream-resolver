export type HttpMethod = "GET" | "POST" | "HEAD" | "PUT" | "DELETE";

export type HttpRequestOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string | Buffer | ArrayBuffer | Uint8Array | null;
  timeoutMs?: number;
  retries?: number;
  /** Extra query params merged onto URL. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Return ArrayBuffer instead of text/json helpers. */
  responseType?: "text" | "json" | "arrayBuffer" | "raw";
};

export type HttpResponse<T = unknown> = {
  ok: boolean;
  status: number;
  headers: Headers;
  url: string;
  data: T;
  text?: string;
};

export type HttpClientOptions = {
  timeoutMs?: number;
  retries?: number;
  defaultHeaders?: Record<string, string>;
  /** Optional proxy URL (undici/ProxyAgent can be wired later). */
  proxyUrl?: string;
  userAgent?: string;
};

const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withQuery(
  url: string,
  query?: HttpRequestOptions["query"],
): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/**
 * Shared HTTP client — adapters must use this instead of ad-hoc fetch.
 */
export class HttpClient {
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: HttpClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
    this.defaultHeaders = {
      "user-agent": options.userAgent ?? DEFAULT_UA,
      ...options.defaultHeaders,
    };
  }

  async request<T = unknown>(
    url: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const method = options.method ?? "GET";
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const retries = options.retries ?? this.retries;
    const finalUrl = withQuery(url, options.query);
    const headers = { ...this.defaultHeaders, ...options.headers };

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(finalUrl, {
          method,
          headers,
          body: options.body as BodyInit | undefined,
          signal: controller.signal,
          redirect: "follow",
        });

        const responseType = options.responseType ?? "text";
        let data: unknown;
        let text: string | undefined;

        if (responseType === "arrayBuffer") {
          data = await response.arrayBuffer();
        } else if (responseType === "raw") {
          data = response;
        } else {
          text = await response.text();
          if (responseType === "json") {
            data = text ? JSON.parse(text) : null;
          } else {
            data = text;
          }
        }

        return {
          ok: response.ok,
          status: response.status,
          headers: response.headers,
          url: response.url,
          data: data as T,
          text,
        };
      } catch (err) {
        lastError = err;
        if (attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    const error = new Error(`HTTP request failed: ${message}`);
    error.name = "TimeoutError";
    throw error;
  }

  get<T = string>(url: string, options?: Omit<HttpRequestOptions, "method" | "body">) {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  head(url: string, options?: Omit<HttpRequestOptions, "method" | "body">) {
    return this.request(url, {
      ...options,
      method: "HEAD",
      responseType: "raw",
    });
  }

  post<T = string>(
    url: string,
    body?: HttpRequestOptions["body"],
    options?: Omit<HttpRequestOptions, "method" | "body">,
  ) {
    return this.request<T>(url, { ...options, method: "POST", body });
  }
}

export const defaultHttp = new HttpClient();
