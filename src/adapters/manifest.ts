import type { Capabilities } from "../core/types.js"

/** On-disk manifest for a standalone adapter package. */
export type ExternalAdapterManifest = {
  id: string
  name: string
  version: string
  summary?: string
  description?: string
  author?: string
  entry: string
  capabilities: Capabilities
  /** Optional display fields for Streamflow UI. */
  transport?: string
  decryption?: string
  metadataBinding?: string
  idHint?: "imdb" | "tmdb" | "either"
  accent?: string
  status?: "stable" | "beta" | "experimental"
  adapterClass?: "site-adapter" | "network-adapter"
}

const ID_PATTERN = /^[a-z][a-z0-9-]{1,48}$/

export function validateAdapterManifest(raw: unknown): ExternalAdapterManifest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Adapter manifest must be a JSON object")
  }

  const m = raw as Record<string, unknown>
  const id = String(m.id ?? "")
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      "Adapter id must be lowercase alphanumeric + hyphens (2–49 chars)",
    )
  }

  const entry = String(m.entry ?? "index.js")
  if (!entry.endsWith(".js") && !entry.endsWith(".mjs")) {
    throw new Error("Adapter entry must be a .js or .mjs module")
  }

  const caps = m.capabilities
  if (!caps || typeof caps !== "object") {
    throw new Error("Adapter manifest missing capabilities object")
  }

  const c = caps as Record<string, unknown>
  const capabilities: Capabilities = {
    movie: Boolean(c.movie),
    series: Boolean(c.series),
    episodes: Boolean(c.episodes),
    shortDrama: Boolean(c.shortDrama),
    subtitles: Boolean(c.subtitles),
    multipleQualities: Boolean(c.multipleQualities),
    directStreams: Boolean(c.directStreams ?? true),
  }

  return {
    id,
    name: String(m.name ?? id),
    version: String(m.version ?? "0.0.0"),
    summary: m.summary != null ? String(m.summary) : undefined,
    description: m.description != null ? String(m.description) : undefined,
    author: m.author != null ? String(m.author) : undefined,
    entry,
    capabilities,
    transport: m.transport != null ? String(m.transport) : undefined,
    decryption: m.decryption != null ? String(m.decryption) : undefined,
    metadataBinding:
      m.metadataBinding != null ? String(m.metadataBinding) : undefined,
    idHint:
      m.idHint === "imdb" || m.idHint === "tmdb" || m.idHint === "either"
        ? m.idHint
        : "either",
    accent: m.accent != null ? String(m.accent) : undefined,
    status:
      m.status === "stable" || m.status === "beta" || m.status === "experimental"
        ? m.status
        : "experimental",
    adapterClass:
      m.adapterClass === "network-adapter" ? "network-adapter" : "site-adapter",
  }
}
