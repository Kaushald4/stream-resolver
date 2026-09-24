import { readFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { HttpClient } from "../http/client.js"
import type { SiteAdapter } from "../core/extractor.js"
import type { AdapterRegistry } from "../core/registry.js"
import {
  validateAdapterManifest,
  type ExternalAdapterManifest,
} from "./manifest.js"

export type LoadedExternalAdapter = {
  manifest: ExternalAdapterManifest
  dir: string
}

type AdapterModule = {
  createAdapter?: (http: HttpClient) => SiteAdapter
  default?: new (http: HttpClient) => SiteAdapter
}

/** Runtime ESM import — Next/Turbopack cannot statically analyze Function-wrapped import(). */
function importEsModule(specifier: string): Promise<AdapterModule> {
  const load = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<AdapterModule>
  return load(specifier)
}

export async function readAdapterManifest(
  adapterDir: string,
): Promise<ExternalAdapterManifest> {
  const manifestPath = join(adapterDir, "manifest.json")
  const raw = JSON.parse(await readFile(manifestPath, "utf8")) as unknown
  return validateAdapterManifest(raw)
}

export async function loadExternalAdapter(
  adapterDir: string,
  http: HttpClient,
): Promise<{ adapter: SiteAdapter; manifest: ExternalAdapterManifest }> {
  const manifest = await readAdapterManifest(adapterDir)
  const entryPath = resolve(adapterDir, manifest.entry)

  let mod: AdapterModule
  try {
    mod = await importEsModule(pathToFileURL(entryPath).href)
  } catch (err) {
    throw new Error(
      `Failed to import adapter entry ${manifest.entry}: ${err instanceof Error ? err.message : err}`,
    )
  }

  let adapter: SiteAdapter | undefined
  if (typeof mod.createAdapter === "function") {
    adapter = mod.createAdapter(http)
  } else if (mod.default) {
    adapter = new mod.default(http)
  }

  if (!adapter) {
    throw new Error(
      `Adapter ${manifest.id} must export createAdapter(http) or default class`,
    )
  }

  if (adapter.metadata.id !== manifest.id) {
    throw new Error(
      `Adapter metadata.id (${adapter.metadata.id}) must match manifest.id (${manifest.id})`,
    )
  }

  return { adapter, manifest }
}

export async function registerExternalAdapters(
  registry: AdapterRegistry,
  http: HttpClient,
  adapterDirs: string[],
  options?: { reservedIds?: string[] },
): Promise<LoadedExternalAdapter[]> {
  const reserved = new Set(options?.reservedIds ?? [])
  const loaded: LoadedExternalAdapter[] = []

  for (const dir of adapterDirs) {
    const manifest = await readAdapterManifest(dir)
    if (reserved.has(manifest.id)) {
      throw new Error(
        `Adapter id "${manifest.id}" is reserved by a built-in adapter`,
      )
    }
    if (registry.get(manifest.id)) {
      throw new Error(`Duplicate adapter id: ${manifest.id}`)
    }

    const { adapter } = await loadExternalAdapter(dir, http)
    registry.register(adapter)
    loaded.push({ manifest, dir })
  }

  return loaded
}

export async function scanAdapterRoot(rootDir: string): Promise<string[]> {
  const { readdir, stat } = await import("node:fs/promises")
  let entries: string[]
  try {
    entries = await readdir(rootDir)
  } catch {
    return []
  }

  const dirs: string[] = []
  for (const name of entries) {
    const full = join(rootDir, name)
    try {
      const st = await stat(full)
      if (st.isDirectory()) dirs.push(full)
    } catch {
      // skip
    }
  }
  return dirs
}
