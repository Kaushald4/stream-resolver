/** Content kinds the engine understands. */
export type ContentKind = "movie" | "series" | "episode" | "short_drama";

/** Stream container / delivery format. */
export type StreamType = "mp4" | "hls" | "dash" | "unknown";

/** Adapter lifecycle for ops / health. */
export type AdapterLifecycle = "ACTIVE" | "DEGRADED" | "BROKEN" | "DISABLED";

export type Capabilities = {
  movie: boolean;
  series: boolean;
  episodes: boolean;
  /** Short-form drama apps / sites (Reelshort-style). */
  shortDrama: boolean;
  subtitles: boolean;
  multipleQualities: boolean;
  directStreams: boolean;
};

export type MovieInput = {
  kind: "movie";
  imdbId?: string;
  tmdbId?: string | number;
  title?: string;
  year?: number;
};

export type EpisodeInput = {
  kind: "episode";
  imdbId?: string;
  tmdbId?: string | number;
  season: number;
  episode: number;
  title?: string;
};

export type SeriesInput = {
  kind: "series";
  imdbId?: string;
  tmdbId?: string | number;
  title?: string;
};

/** Short-drama identity is site-specific; adapters map these fields. */
export type ShortDramaInput = {
  kind: "short_drama";
  /** Site-native show / book id when known. */
  showId?: string;
  /** Episode index or id within the show. */
  episodeId?: string | number;
  /** Free-text title for discovery-based adapters. */
  title?: string;
  /** Optional deep-link / shelf URL the adapter can parse. */
  url?: string;
};

export type ExtractionInput =
  | MovieInput
  | EpisodeInput
  | SeriesInput
  | ShortDramaInput;

export type StreamHeaders = {
  referer?: string;
  origin?: string;
  userAgent?: string;
  /** Keep extractor referer on HLS segments instead of the parent playlist URL. */
  siteReferer?: boolean;
  /** Do not send Origin upstream (some signed MP4 CDNs 403 on it). */
  omitOrigin?: boolean;
  [key: string]: string | boolean | undefined;
};

export type Stream = {
  url: string;
  quality?: string;
  /** Adapter-specific debug / display label (e.g. nxsha provider + id). */
  label?: string;
  type: StreamType;
  headers?: StreamHeaders;
  expiresAt?: Date;
  subtitles?: SubtitleTrack[];
  source: {
    extractor: string;
    version: string;
  };
};

export type SubtitleTrack = {
  url: string;
  language?: string;
  label?: string;
};

/** Discovery hit — not yet a playable stream. */
export type SourcePage = {
  extractorId: string;
  url: string;
  kind: ContentKind;
  /** Opaque adapter-private payload (ids, tokens, raw API blobs). */
  meta?: Record<string, unknown>;
};

export type ExtractionResult = {
  input: ExtractionInput;
  streams: Stream[];
  sources: SourcePage[];
  errors: ExtractionFailure[];
  durationMs: number;
};

export type ExtractionFailure = {
  extractorId: string;
  code: string;
  message: string;
  layer?: "discovery" | "extraction" | "normalization" | "validation";
};

export type ExtractorMetadata = {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  lifecycle: AdapterLifecycle;
  capabilities: Capabilities;
  domains: string[];
  lastSuccessfulRun?: Date;
  lastFailure?: Date;
};

export type HealthProbeStep =
  | "discovery"
  | "player"
  | "extraction"
  | "stream_http";

export type HealthProbeResult = {
  extractorId: string;
  ok: boolean;
  steps: Partial<Record<HealthProbeStep, "pass" | "fail" | "skip">>;
  error?: string;
  checkedAt: Date;
};

export type PipelineOptions = {
  /** Limit which adapters run. Empty / omit = all enabled. */
  extractors?: string[];
  /** Skip HTTP stream validation. */
  skipValidation?: boolean;
  /** Skip ranking; return in discovery order. */
  skipRanking?: boolean;
  /** Max concurrent adapters. */
  concurrency?: number;
};
