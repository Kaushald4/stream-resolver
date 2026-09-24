import type { HttpClient } from "../../http/client.js";
import type { AdapterRegistry } from "../../core/registry.js";
import { PrimeflixAdapter } from "./extractor.js";

export { PrimeflixAdapter } from "./extractor.js";
export {
  PRIMEFLIX_ID,
  PRIMEFLIX_VERSION,
  PRIMEFLIX_DOMAINS,
} from "./constants.js";
export { decryptVideoUrl } from "./crypto.js";
export type { PrimeflixDiscoveryMeta } from "./types.js";

export function createPrimeflixAdapter(http: HttpClient): PrimeflixAdapter {
  return new PrimeflixAdapter(http);
}

export function registerPrimeflix(
  registry: AdapterRegistry,
  http: HttpClient,
): PrimeflixAdapter {
  const adapter = createPrimeflixAdapter(http);
  registry.register(adapter);
  return adapter;
}
