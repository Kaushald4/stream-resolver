import { ExtractionError } from "../../core/errors.js";
import { PRIMEFLIX_ID } from "./constants.js";

/**
 * AES-256-GCM decrypt for Primeflix `url` fields (base64url: iv(12) + ct + tag(16)).
 * Companion provides `__host_primeflix_decrypt_url` — QuickJS has no Node crypto.
 */
export function decryptVideoUrl(base64url: string | null | undefined): string | null {
  if (!base64url) return null;

  const host = (globalThis as Record<string, unknown>).__host_primeflix_decrypt_url;
  if (typeof host === "function") {
    try {
      return (host as (input: string) => string)(base64url);
    } catch (err) {
      throw new ExtractionError(
        "DECRYPT_FAILED",
        `Primeflix URL decrypt failed: ${err instanceof Error ? err.message : err}`,
        { extractorId: PRIMEFLIX_ID, layer: "extraction" },
      );
    }
  }

  throw new ExtractionError(
    "DECRYPT_FAILED",
    "Primeflix decrypt requires companion native crypto (__host_primeflix_decrypt_url)",
    { extractorId: PRIMEFLIX_ID, layer: "extraction" },
  );
}
