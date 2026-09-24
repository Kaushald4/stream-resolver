import type { HttpClient } from "../../http/client.js";
import type { AdapterRegistry } from "../../core/registry.js";
import { NxshaAdapter } from "./extractor.js";

export { NxshaAdapter } from "./extractor.js";
export {
  NXSHA_ID,
  NXSHA_VERSION,
  NXSHA_DOMAINS,
} from "./constants.js";
export { encryptPayload, decryptPayload } from "./crypto.js";
export { toRawStreams, nxshaSourceToRawStream } from "./parser.js";
export type {
  NxshaSource,
  NxshaServer,
  NxshaRequestPayload,
} from "./types.js";

export function createNxshaAdapter(http: HttpClient): NxshaAdapter {
  return new NxshaAdapter(http);
}

export function registerNxsha(
  registry: AdapterRegistry,
  http: HttpClient,
): NxshaAdapter {
  const adapter = createNxshaAdapter(http);
  registry.register(adapter);
  return adapter;
}
