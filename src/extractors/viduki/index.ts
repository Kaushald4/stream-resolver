import type { HttpClient } from "../../http/client.js";
import type { AdapterRegistry } from "../../core/registry.js";
import { VidukiAdapter } from "./extractor.js";

export { VidukiAdapter } from "./extractor.js";
export {
  VIDUKI_ID,
  VIDUKI_VERSION,
  VIDUKI_DOMAINS,
} from "./constants.js";
export type {
  VidukiServer,
  VidukiDiscoveryMeta,
} from "./types.js";

export function createVidukiAdapter(http: HttpClient): VidukiAdapter {
  return new VidukiAdapter(http);
}

export function registerViduki(
  registry: AdapterRegistry,
  http: HttpClient,
): VidukiAdapter {
  const adapter = createVidukiAdapter(http);
  registry.register(adapter);
  return adapter;
}
