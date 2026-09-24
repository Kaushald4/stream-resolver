export type PrimeflixServerEntry = {
  url?: string;
  language?: string;
  flag?: string;
  type?: string;
};

export type PrimeflixApiResponse = Record<string, PrimeflixServerEntry | null>;

export type PrimeflixDiscoveryMeta = {
  tmdbId: string;
  kind: "movie" | "episode";
  season?: number;
  episode?: number;
};
