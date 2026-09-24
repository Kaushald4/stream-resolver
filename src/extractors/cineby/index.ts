import type { HttpClient } from "../../http/client.js";
import type { AdapterRegistry } from "../../core/registry.js";
import { CinebyAdapter } from "./extractor.js";

export { CinebyAdapter } from "./extractor.js";
export { CINEBY_ID, CINEBY_VERSION, CINEBY_DOMAINS } from "./constants.js";
export { decryptCinebyPayload } from "./decrypt.js";
export {
  parseCinebySourcesJson,
  toRawStreams,
  normalizeSubtitles,
} from "./parser.js";

export function createCinebyAdapter(http: HttpClient): CinebyAdapter {
  return new CinebyAdapter(http);
}

export function registerCineby(
  registry: AdapterRegistry,
  http: HttpClient,
): CinebyAdapter {
  const adapter = createCinebyAdapter(http);
  registry.register(adapter);
  return adapter;
}
