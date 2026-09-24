import type { ExtractionInput } from "../core/types.js";

/**
 * Catalog of known-good probes for automated health checks.
 * Add an entry whenever you onboard a new adapter.
 */
export type HealthCatalogEntry = {
  extractor: string;
  label?: string;
  input: ExtractionInput;
};

export const DEFAULT_HEALTH_CATALOG: HealthCatalogEntry[] = [
  {
    extractor: "vidsrc2",
    label: "Iron Man 3 (movie)",
    input: {
      kind: "movie",
      imdbId: "tt1300854",
    },
  },
  {
    extractor: "vidsrc2",
    label: "Game of Thrones S1E1",
    input: {
      kind: "episode",
      tmdbId: 1399,
      season: 1,
      episode: 1,
    },
  },
  {
    extractor: "cineby",
    label: "Sample movie (tmdb 969681)",
    input: {
      kind: "movie",
      tmdbId: 969681,
    },
  },
  {
    extractor: "nxsha",
    label: "The 100 S1E1",
    input: {
      kind: "episode",
      tmdbId: 48866,
      season: 1,
      episode: 1,
    },
  },
];
