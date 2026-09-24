import assert from "node:assert/strict";
import type { HttpClient } from "../src/http/client.js";
import {
  expandPlaylistUrls,
  isStreamrkPlaylistUrl,
} from "../src/extractors/primeflix/playlist.js";

assert.equal(
  isStreamrkPlaylistUrl("https://streamrk.site/playlist/9a1b809a1904e24802bac85f"),
  true,
);
assert.equal(isStreamrkPlaylistUrl("https://example.com/video.mp4"), false);

const mockHttp = {
  get: async (url: string) => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    url,
    data: [
      { resolution: 360, url: "https://v1.streamrk.site/https%3A%2F%2Fcdn.example%2Fa.mp4" },
      { resolution: 480, url: "https://v1.streamrk.site/https%3A%2F%2Fcdn.example%2Fb.mp4" },
    ],
  }),
} as unknown as HttpClient;

const expanded = await expandPlaylistUrls(mockHttp, [
  {
    url: "https://streamrk.site/playlist/abc",
    label: "Astra · English · MP4",
    type: "mp4",
  },
  { url: "https://cdn.example.com/direct.m3u8", label: "Other", type: "hls" },
]);

assert.equal(expanded.length, 3);
assert.equal(expanded[0].quality, "360p");
assert.equal(expanded[0].type, "mp4");
assert.equal(expanded[0].label, "Astra · English · MP4 · 360p");
assert.equal(expanded[2].url, "https://cdn.example.com/direct.m3u8");

console.log("primeflix playlist tests passed");
