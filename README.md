# stream-resolver

A plugin-based engine for resolving playable media stream URLs from public web pages, with a CLI.

Everything site-specific (URLs, APIs, players, decryption, the headers a CDN expects) lives inside an **adapter**. The engine only talks to adapters through one small interface, so when a source changes shape you rewrite one adapter rather than the pipeline.

> **What this is not.** This package hosts and serves no media. It resolves URLs that a page already exposes publicly; the bytes come from whatever source an adapter talks to. Use it only against content you are allowed to access.

## Requirements

- Node 20 or newer
- pnpm, for development

## Consuming it

This package is not published to npm. Use it from a checkout or as a git dependency:

```bash
# as a git dependency
pnpm add github:kaushald4/stream-resolver#main

# or from a sibling checkout
pnpm add file:../stream-resolver
```

Both routes rely on the `prepare` script, which compiles `dist/` during install, since `dist` is not committed.

It is ESM only (`"type": "module"`) and ships compiled JavaScript plus type declarations.

## CLI

```bash
stream-resolver --movie tt1300854
stream-resolver --tmdb 969681
stream-resolver --tv 1399 --season 1 --episode 1
stream-resolver --extractor <id> --movie tt1300854
stream-resolver --movie tt1300854 --no-validate
```

| Flag | Meaning |
|---|---|
| `--movie <imdbId>` | Movie by IMDb id |
| `--tmdb <tmdbId>` | Movie by TMDB id |
| `--tv <tmdbId> --season <n> --episode <n>` | Episode |
| `--extractor <id>` | Run one adapter only |
| `--no-validate` | Skip HTTP reachability checks |

It prints the full `ExtractionResult` as JSON. Exit codes: `0` when streams were found, `1` when none were, `2` on a usage error.

## Library

```ts
import { createEngine } from "stream-resolver"

const engine = await createEngine()

const result = await engine.pipeline.run({ kind: "movie", imdbId: "tt1300854" })

for (const stream of result.streams) {
  console.log(stream.quality, stream.type, stream.url)
}
```

`createEngine()` wires the core plus every built-in adapter and returns `{ registry, resolver, pipeline, http, externalAdapters }`.

```ts
type CreateEngineOptions = {
  bare?: boolean                    // skip built-in adapters
  http?: HttpClient                 // supply your own client
  enableCache?: boolean             // default true
  enableValidation?: boolean        // default true
  externalAdapterDirs?: string[]    // dirs holding manifest.json + entry module
}
```

`pipeline.run(input, options)` takes `extractors`, `skipValidation`, `skipRanking` and `concurrency`.

### Result shape

```ts
type ExtractionResult = {
  input: ExtractionInput
  streams: Stream[]
  sources: SourcePage[]
  errors: ExtractionFailure[]
  durationMs: number
}

type Stream = {
  url: string
  quality?: string
  label?: string          // adapter display/debug label
  type: "mp4" | "hls" | "dash" | "unknown"
  headers?: StreamHeaders // referer / origin / userAgent / siteReferer / omitOrigin
  expiresAt?: Date
  subtitles?: SubtitleTrack[]
  source: { extractor: string; version: string }
}
```

A `SourcePage` is a discovery hit, not a playable stream: it carries an opaque `meta` payload that the adapter that produced it knows how to extract from.

## How it works

The pipeline runs in five stages, and failures are reported per stage so you can tell *where* a source broke:

1. **Discovery.** The adapter turns an input (IMDb/TMDB id, or a URL) into `SourcePage[]`.
2. **Extraction.** The adapter turns each source page into `Stream[]`.
3. **Normalization.** Stream type, quality label, and headers are made consistent, and duplicates are dropped.
4. **Validation.** Optional HTTP reachability check.
5. **Ranking.** Best-first ordering.

`ExtractionError` carries a code (`SITE_UNAVAILABLE`, `CLOUDFLARE`, `PAGE_CHANGED`, `API_CHANGED`, `PLAYER_CHANGED`, `DECRYPT_FAILED`, `NO_STREAM`, `TIMEOUT`, `UNSUPPORTED`, `VALIDATION_FAILED`, `RATE_LIMITED`, `UNKNOWN`) and the layer it came from.

## Writing an adapter

An adapter implements `SiteAdapter`:

```ts
interface SiteAdapter {
  readonly metadata: ExtractorMetadata
  readonly capabilities: Capabilities

  canHandle(url: URL): boolean
  resolveUrl?(url: URL): Promise<SourcePage[]>
  findMovie?(input: MovieInput): Promise<SourcePage[]>
  findEpisode?(input: EpisodeInput): Promise<SourcePage[]>
  findShortDrama?(input: ShortDramaInput): Promise<SourcePage[]>
  extract(source: SourcePage): Promise<Stream[]>
}
```

Then register it:

```ts
import { createEngine, type SiteAdapter } from "stream-resolver"

const engine = await createEngine({ bare: true })
engine.registry.register(myAdapter)
```

An external adapter is a directory containing `manifest.json` and an entry module. The module must export `createAdapter(http)`, or a default class taking `http`:

```ts
export function createAdapter(http) {
  return {
    metadata: { id: "my-adapter", /* ... */ },
    capabilities: { movie: true, series: false, episodes: false,
      shortDrama: false, subtitles: false, multipleQualities: false, directStreams: true },
    canHandle: () => false,
    async findMovie(input) { /* -> SourcePage[] */ },
    async extract(source) { /* -> Stream[] */ },
  }
}
```

Load those directories with `externalAdapterDirs`. The manifest `id` must match `metadata.id`, must be lowercase alphanumeric with hyphens, and must not collide with a built-in id.

```json
{
  "id": "my-adapter",
  "name": "My Adapter",
  "version": "0.1.0",
  "entry": "index.js",
  "capabilities": { "movie": true, "directStreams": true }
}
```

Optional manifest fields include `summary`, `description`, `author`, `transport`, `decryption`, `metadataBinding`, `idHint` (`imdb` | `tmdb` | `either`), `accent`, `status` and `adapterClass`.

## Packing adapters

Adapters can be packed into zips for a sandboxed host (such as the Streamflow companion, which runs them in QuickJS):

```bash
pnpm pack-adapter <name>          # one
pnpm pack-adapters                # all of them
```

Each adapter is bundled with esbuild, minified, then obfuscated, and written to `dist/packages/<manifest.id>.zip` containing exactly:

```
manifest.json
index.js
```

The two shared primitives (the generic WASM decryptor and the stateful WASM bridge) are deliberately left **external** in the bundle, so a host can swap in a native implementation instead of shipping WebAssembly into the sandbox.

## Health checks

`HealthChecker` runs each adapter through its stages and reports which one failed:

```ts
import { createEngine, HealthChecker } from "stream-resolver"

const engine = await createEngine()
const checker = new HealthChecker(engine.pipeline, engine.registry)

console.log(checker.formatReport(await checker.runAll()))
```

Steps reported per adapter are `discovery`, `player`, `extraction` and `stream_http`. Run it from the CLI with `pnpm health`.

## Built-in adapters

Five adapters ship in the box, one directory per source under `src/extractors/`, all registered in `create-engine.ts`. Between them they cover the resolution strategies this engine was built around:

- Direct manifests from one or more CDNs, in several qualities.
- Decrypting a payload with the target's own WebAssembly module.
- A federated adapter that aggregates several scraper providers, and is for that reason the slowest and the most nested.
- A stateful WASM bridge that holds per-session key material across calls.
- AES-256-GCM decryption of a URL field.

Zips are named after each adapter's `manifest.id`, which does not always match its source directory name.

## Scripts

| Script | Does |
|---|---|
| `pnpm build` | Compile to `dist` |
| `pnpm prepare` | Same as build; runs automatically on install |
| `pnpm dev` | `tsc --watch` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Parser and decryption suites |
| `pnpm extract` | Run the CLI from source via tsx |
| `pnpm health` | Run the health checker |
| `pnpm pack-adapter <name>` | Pack one adapter to a zip |
| `pnpm pack-adapters` | Pack all adapters |

## Layout

```
src/
  core/          pipeline, registry, resolver, normalizer, ranker, errors, types
  extractors/    one directory per built-in adapter
  adapters/      external adapter loading and manifest validation
  http/          shared HttpClient (retries, timeouts, browser-like headers)
  primitives/    sha256, generic WASM decrypt, stateful WASM bridge
  stream/        proxy-wrapper unwrapping and playback URL normalization
  validation/    stream reachability checks
  health/        staged health probes and the default catalog
  cache/         in-memory extraction cache
scripts/
  pack-adapter.mjs       bundle + obfuscate + zip
  adapter-entries/       entry modules that expose each adapter as createAdapter
adapters/                manifests for the built-in adapters
tests/                   parser and decrypt suites
```
