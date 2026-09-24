export type NxshaMediaType = "movie" | "tv";

export type NxshaRequestPayload = {
  tmdbId: string;
  imdb_id?: string;
  type: NxshaMediaType;
  season?: number;
  episode?: number;
  ex_lang?: boolean;
  provider?: string;
};

export type NxshaServer = {
  scraper: string;
  name?: string;
  [key: string]: unknown;
};

export type NxshaSource = {
  id?: string;
  provider?: string;
  url?: string;
  org_uri?: string;
  headers?: Record<string, string>;
  quality?: string;
  label?: string;
  isEmbed?: boolean;
  type?: string;
  file?: string;
};

export type NxshaDiscoveryMeta = {
  payload: NxshaRequestPayload;
  servers: NxshaServer[];
};
