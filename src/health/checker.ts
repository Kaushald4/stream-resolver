import type { ExtractionPipeline } from "../core/pipeline.js";
import type { AdapterRegistry } from "../core/registry.js";
import type { HealthProbeResult } from "../core/types.js";
import {
  DEFAULT_HEALTH_CATALOG,
  type HealthCatalogEntry,
} from "./catalog.js";

export type HealthCheckerOptions = {
  catalog?: HealthCatalogEntry[];
  /** Validate stream HTTP reachability. */
  probeStreams?: boolean;
};

/**
 * Layered health checks so you know *which* stage broke.
 */
export class HealthChecker {
  constructor(
    private readonly pipeline: ExtractionPipeline,
    private readonly registry: AdapterRegistry,
    private readonly options: HealthCheckerOptions = {},
  ) {}

  async runAll(): Promise<HealthProbeResult[]> {
    const catalog = this.options.catalog ?? DEFAULT_HEALTH_CATALOG;
    const results: HealthProbeResult[] = [];
    for (const entry of catalog) {
      results.push(await this.runOne(entry));
    }
    return results;
  }

  async runOne(entry: HealthCatalogEntry): Promise<HealthProbeResult> {
    const checkedAt = new Date();
    const adapter = this.registry.get(entry.extractor);

    if (!adapter || !adapter.metadata.enabled) {
      return {
        extractorId: entry.extractor,
        ok: false,
        steps: { discovery: "fail" },
        error: "Adapter missing or disabled",
        checkedAt,
      };
    }

    const steps: HealthProbeResult["steps"] = {
      discovery: "skip",
      player: "skip",
      extraction: "skip",
      stream_http: "skip",
    };

    try {
      const result = await this.pipeline.run(entry.input, {
        extractors: [entry.extractor],
        skipValidation: !this.options.probeStreams,
        skipRanking: true,
      });

      const discoveryOk = result.sources.length > 0;
      steps.discovery = discoveryOk ? "pass" : "fail";

      // vidsrc-style: wasm + decrypt ≈ player + extraction
      const extracted = result.streams.length > 0;
      steps.player = discoveryOk ? (extracted ? "pass" : "fail") : "skip";
      steps.extraction = extracted ? "pass" : "fail";

      if (this.options.probeStreams) {
        steps.stream_http = extracted ? "pass" : "skip";
      }

      const ok = extracted;
      if (ok) this.registry.recordSuccess(entry.extractor);
      else this.registry.recordFailure(entry.extractor);

      return {
        extractorId: entry.extractor,
        ok,
        steps,
        error: ok
          ? undefined
          : result.errors.map((e) => `${e.code}: ${e.message}`).join("; ") ||
            "NO_STREAM",
        checkedAt,
      };
    } catch (err) {
      this.registry.recordFailure(entry.extractor);
      return {
        extractorId: entry.extractor,
        ok: false,
        steps: { ...steps, discovery: "fail" },
        error: err instanceof Error ? err.message : String(err),
        checkedAt,
      };
    }
  }

  formatReport(results: HealthProbeResult[]): string {
    const lines: string[] = [];
    for (const r of results) {
      lines.push(`${r.extractorId}  ${r.ok ? "✓" : "✗"}`);
      for (const [step, status] of Object.entries(r.steps)) {
        const mark =
          status === "pass" ? "✓" : status === "fail" ? "✗" : "-";
        lines.push(`  ${step.padEnd(14)} ${mark}`);
      }
      if (r.error) lines.push(`  error: ${r.error}`);
      lines.push("");
    }
    return lines.join("\n");
  }
}
