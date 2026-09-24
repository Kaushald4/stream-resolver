import type { Stream } from "./types.js";

const QUALITY_SCORE: Record<string, number> = {
  "2160p": 100,
  "1440p": 85,
  "1080p": 70,
  "720p": 50,
  "480p": 30,
  "360p": 15,
};

const TYPE_SCORE: Record<Stream["type"], number> = {
  hls: 20,
  mp4: 18,
  dash: 16,
  unknown: 5,
};

export type RankContext = {
  /** Historical success rate 0–1 keyed by extractor id. */
  reliability?: Record<string, number>;
};

function qualityScore(quality?: string): number {
  if (!quality) return 10;
  return QUALITY_SCORE[quality] ?? 10;
}

/**
 * Rank streams for multi-source results.
 * Higher score = preferred.
 */
export function scoreStream(stream: Stream, ctx: RankContext = {}): number {
  const reliability =
    ctx.reliability?.[stream.source.extractor] != null
      ? ctx.reliability[stream.source.extractor]! * 30
      : 15;

  return (
    qualityScore(stream.quality) +
    TYPE_SCORE[stream.type] +
    reliability
  );
}

export function rankStreams(
  streams: Stream[],
  ctx: RankContext = {},
): Stream[] {
  return [...streams].sort(
    (a, b) => scoreStream(b, ctx) - scoreStream(a, ctx),
  );
}
