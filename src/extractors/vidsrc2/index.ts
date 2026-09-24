import type { HttpClient } from "../../http/client.js";
import type { AdapterRegistry } from "../../core/registry.js";
import { Vidsrc2Adapter } from "./extractor.js";

export { Vidsrc2Adapter } from "./extractor.js";
export { VIDSRC2_ID, VIDSRC2_VERSION, VIDSRC2_DOMAINS } from "./constants.js";
export { parseDecryptedStreamList, attachToken } from "./parser.js";

/** Factory + registry helper for this adapter. */
export function createVidsrc2Adapter(http: HttpClient): Vidsrc2Adapter {
  return new Vidsrc2Adapter(http);
}

export function registerVidsrc2(
  registry: AdapterRegistry,
  http: HttpClient,
): Vidsrc2Adapter {
  const adapter = createVidsrc2Adapter(http);
  registry.register(adapter);
  return adapter;
}
