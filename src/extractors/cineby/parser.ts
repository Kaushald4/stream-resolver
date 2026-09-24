import type { RawStreamLike } from "../../core/normalizer.js";
import type { SubtitleTrack } from "../../core/types.js";
import { ExtractionError } from "../../core/errors.js";
import { CINEBY_ID } from "./constants.js";

const SUBTITLE_LABELS: Record<string, string> = {
  en: "English",
  eng: "English",
  es: "Spanish",
  spa: "Spanish",
  fr: "French",
  fre: "French",
  fra: "French",
  de: "German",
  ger: "German",
  deu: "German",
  it: "Italian",
  ita: "Italian",
  pt: "Portuguese",
  por: "Portuguese",
  ru: "Russian",
  rus: "Russian",
  ar: "Arabic",
  ara: "Arabic",
  hi: "Hindi",
  hin: "Hindi",
  ja: "Japanese",
  jpn: "Japanese",
  ko: "Korean",
  kor: "Korean",
  zh: "Chinese",
  zho: "Chinese",
  chi: "Chinese",
};

export type CinebySourceEntry = {
  quality?: string;
  url?: string;
};

export type CinebySubtitleEntry = {
  lang?: string;
  language?: string;
  url?: string;
};

export type CinebySourcesResponse = {
  sources?: CinebySourceEntry[];
  subtitles?: CinebySubtitleEntry[];
  thumbnail?: string;
  playlist?: string;
};

export function parseCinebySourcesJson(raw: string): CinebySourcesResponse {
  try {
    const parsed = JSON.parse(raw) as CinebySourcesResponse;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("not an object");
    }
    return parsed;
  } catch (err) {
    throw new ExtractionError(
      "API_CHANGED",
      `Cineby response is not valid JSON: ${err instanceof Error ? err.message : err}`,
      { extractorId: CINEBY_ID, layer: "extraction" },
    );
  }
}

export function normalizeSubtitles(
  entries: CinebySubtitleEntry[] | undefined,
): SubtitleTrack[] {
  if (!entries?.length) return [];
  const out: SubtitleTrack[] = [];
  for (const entry of entries) {
    if (!entry.url) continue;
    const code = (entry.language ?? entry.lang ?? "").trim().toLowerCase();
    const label =
      SUBTITLE_LABELS[code] ??
      entry.language ??
      entry.lang ??
      "Subtitles";
    out.push({
      url: entry.url,
      language: entry.language ?? entry.lang,
      label,
    });
  }
  return out;
}

export function toRawStreams(
  response: CinebySourcesResponse,
  headers?: RawStreamLike["headers"],
): RawStreamLike[] {
  const subtitles = normalizeSubtitles(response.subtitles);
  const raws: RawStreamLike[] = [];

  for (const source of response.sources ?? []) {
    if (!source.url) continue;
    raws.push({
      url: source.url,
      quality: source.quality,
      type: "hls",
      headers,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    });
  }

  if (response.playlist) {
    raws.push({
      url: response.playlist,
      quality: "auto",
      type: "hls",
      headers,
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    });
  }

  if (raws.length === 0) {
    throw new ExtractionError("NO_STREAM", "Cineby response contained no streams", {
      extractorId: CINEBY_ID,
      layer: "extraction",
    });
  }

  return raws;
}

export function assertTmdbId(tmdbId?: string | number): asserts tmdbId is string | number {
  if (tmdbId == null || String(tmdbId).length === 0) {
    throw new ExtractionError("UNSUPPORTED", "tmdbId is required for Cineby", {
      extractorId: CINEBY_ID,
      layer: "discovery",
    });
  }
}
