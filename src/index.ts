export type {
  Capabilities,
  ContentKind,
  EpisodeInput,
  ExtractionFailure,
  ExtractionInput,
  ExtractionResult,
  ExtractorMetadata,
  MovieInput,
  PipelineOptions,
  SeriesInput,
  ShortDramaInput,
  SourcePage,
  Stream,
  StreamType,
  AdapterLifecycle,
  HealthProbeResult,
} from "./core/types.js";

export { ExtractionError, isExtractionError } from "./core/errors.js";
export type { ExtractionErrorCode } from "./core/errors.js";
export type { SiteAdapter, Extractor } from "./core/extractor.js";
export { AdapterRegistry, defaultRegistry } from "./core/registry.js";
export { SourceResolver } from "./core/resolver.js";
export { ExtractionPipeline } from "./core/pipeline.js";
export {
  normalizeStream,
  normalizeStreams,
  normalizeQuality,
  detectStreamType,
  dedupeStreams,
} from "./core/normalizer.js";
export { rankStreams, scoreStream } from "./core/ranker.js";

export { HttpClient, defaultHttp } from "./http/client.js";
export { StreamValidator } from "./validation/stream-validator.js";
export { MemoryCache } from "./cache/memory-cache.js";
export type { ExtractionCache } from "./cache/memory-cache.js";

export { createEngine } from "./create-engine.js";
export type { Engine, CreateEngineOptions } from "./create-engine.js";

export {
  readAdapterManifest,
  loadExternalAdapter,
  registerExternalAdapters,
  scanAdapterRoot,
} from "./adapters/load-external.js";
export {
  validateAdapterManifest,
  type ExternalAdapterManifest,
} from "./adapters/manifest.js";

export {
  Vidsrc2Adapter,
  registerVidsrc2,
  createVidsrc2Adapter,
  VIDSRC2_ID,
} from "./extractors/vidsrc2/index.js";

export {
  CinebyAdapter,
  registerCineby,
  createCinebyAdapter,
  CINEBY_ID,
} from "./extractors/cineby/index.js";

export {
  NxshaAdapter,
  registerNxsha,
  createNxshaAdapter,
  NXSHA_ID,
} from "./extractors/nxsha/index.js";

export {
  VidukiAdapter,
  registerViduki,
  createVidukiAdapter,
  VIDUKI_ID,
} from "./extractors/viduki/index.js";

export {
  PrimeflixAdapter,
  registerPrimeflix,
  createPrimeflixAdapter,
  PRIMEFLIX_ID,
} from "./extractors/primeflix/index.js";

export { ShortDramaAdapter } from "./extractors/short-drama/index.js";

export { HealthChecker } from "./health/checker.js";
export { DEFAULT_HEALTH_CATALOG } from "./health/catalog.js";
export type { HealthCatalogEntry } from "./health/catalog.js";
