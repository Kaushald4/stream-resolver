#!/usr/bin/env node
/**
 * Minimal CLI for manual extraction.
 *
 *   stream-resolver --movie tt1300854
 *   stream-resolver --tmdb 969681
 *   stream-resolver --tv 1399 --season 1 --episode 1
 *   stream-resolver --extractor vidsrc2 --movie tt1300854
 */
import { createEngine } from "./create-engine.js";
import type { ExtractionInput } from "./core/types.js";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const extractor = arg("extractor");
  const movie = arg("movie");
  const tmdb = arg("tmdb");
  const tv = arg("tv");
  const season = arg("season");
  const episode = arg("episode");

  let input: ExtractionInput | undefined;

  if (tmdb) {
    input = { kind: "movie", tmdbId: Number(tmdb) || tmdb };
  } else if (movie) {
    input = { kind: "movie", imdbId: movie };
  } else if (tv && season && episode) {
    input = {
      kind: "episode",
      tmdbId: Number(tv) || tv,
      season: Number(season),
      episode: Number(episode),
    };
  }

  if (!input) {
    console.error(`Usage:
  stream-resolver --movie <imdbId>
  stream-resolver --tmdb <tmdbId>
  stream-resolver --tv <tmdbId> --season <n> --episode <n>
  optional: --extractor <id>  --no-validate`);
    process.exit(2);
  }

  const engine = await createEngine({
    enableValidation: !hasFlag("no-validate"),
  });

  const result = await engine.pipeline.run(input, {
    extractors: extractor ? [extractor] : undefined,
    skipValidation: hasFlag("no-validate"),
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.streams.length > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
