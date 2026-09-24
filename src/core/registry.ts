import type { SiteAdapter } from "./extractor.js";
import type { AdapterLifecycle, ExtractorMetadata } from "./types.js";

/**
 * Central registry of site adapters.
 * Domain → adapter resolution lives here; nowhere else hardcodes hosts.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, SiteAdapter>();

  register(adapter: SiteAdapter): void {
    if (this.adapters.has(adapter.metadata.id)) {
      throw new Error(`Adapter already registered: ${adapter.metadata.id}`);
    }
    this.adapters.set(adapter.metadata.id, adapter);
  }

  unregister(id: string): boolean {
    return this.adapters.delete(id);
  }

  get(id: string): SiteAdapter | undefined {
    return this.adapters.get(id);
  }

  all(options?: { includeDisabled?: boolean }): SiteAdapter[] {
    const list = [...this.adapters.values()];
    if (options?.includeDisabled) return list;
    return list.filter(
      (a) =>
        a.metadata.enabled &&
        a.metadata.lifecycle !== "DISABLED" &&
        a.metadata.lifecycle !== "BROKEN",
    );
  }

  resolve(url: string | URL): SiteAdapter | undefined {
    const parsed = typeof url === "string" ? new URL(url) : url;
    return this.all().find((a) => a.canHandle(parsed));
  }

  byCapability(
    capability: keyof SiteAdapter["capabilities"],
  ): SiteAdapter[] {
    return this.all().filter((a) => a.capabilities[capability]);
  }

  setLifecycle(id: string, lifecycle: AdapterLifecycle): void {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unknown adapter: ${id}`);
    const meta = adapter.metadata as ExtractorMetadata;
    meta.lifecycle = lifecycle;
    // DISABLED is hard-off; BROKEN stays registered but skipped by all()
    // via lifecycle check; DEGRADED remains queryable for probing.
    if (lifecycle === "DISABLED") meta.enabled = false;
    if (lifecycle === "ACTIVE" || lifecycle === "DEGRADED") meta.enabled = true;
  }

  recordSuccess(id: string): void {
    const adapter = this.adapters.get(id);
    if (!adapter) return;
    (adapter.metadata as ExtractorMetadata).lastSuccessfulRun = new Date();
  }

  recordFailure(id: string): void {
    const adapter = this.adapters.get(id);
    if (!adapter) return;
    (adapter.metadata as ExtractorMetadata).lastFailure = new Date();
  }
}

export const defaultRegistry = new AdapterRegistry();
