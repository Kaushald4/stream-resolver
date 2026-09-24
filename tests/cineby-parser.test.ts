import assert from "node:assert/strict";
import {
  parseCinebySourcesJson,
  toRawStreams,
  normalizeSubtitles,
} from "../src/extractors/cineby/parser.ts";

const sample = {
  sources: [
    { quality: "1080p", url: "https://cdn.example.com/index-s1080p-v1-a1.m3u8" },
    { quality: "720p", url: "https://cdn.example.com/index-s720p-v1-a1.m3u8" },
  ],
  subtitles: [
    { lang: "eng", language: "eng", url: "https://cdn.example.com/subs/eng.vtt" },
  ],
  playlist: "https://cdn.example.com/master.m3u8",
};

const parsed = parseCinebySourcesJson(JSON.stringify(sample));
assert.equal(parsed.sources?.length, 2);

const subs = normalizeSubtitles(parsed.subtitles);
assert.equal(subs.length, 1);
assert.equal(subs[0]!.language, "eng");

const raws = toRawStreams(parsed);
assert.equal(raws.length, 3); // 2 qualities + master playlist
assert.ok(raws.every((r) => r.subtitles?.length === 1));

console.log("cineby parser tests ok");
