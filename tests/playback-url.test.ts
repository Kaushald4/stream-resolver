import assert from "node:assert/strict";
import {
  normalizePlaybackUrl,
  unwrapProxyUrl,
} from "../src/stream/playback-url.js";

{
  const wrapped =
    "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2Fclip.mp4%3Fsign%3Dx";
  assert.equal(
    unwrapProxyUrl(wrapped),
    "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x",
  );
}

{
  const wrapped =
    "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2Fclip.mp4%3Fsign%3Dx%26referer%3Dhttps%253A%252F%252Fbcdn.com%252F";
  const { url, headers } = normalizePlaybackUrl(wrapped);
  assert.equal(url, "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x");
  assert.equal(headers.referer, "https://bkl.itsnitrox.tech/");
}

{
  const raw =
    "https://bcdnxw.hakunaymatata.com/cms/9efada9430a2316aeca6498466de88c1.mp4?sign=abc&t=123&referer=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2F&origin=https%3A%2F%2Fbcdnxw.hakunaymatata.com&siteReferer=1&rand=0.1";
  const { url, headers } = normalizePlaybackUrl(raw);
  assert.equal(
    url,
    "https://bcdnxw.hakunaymatata.com/cms/9efada9430a2316aeca6498466de88c1.mp4?sign=abc&t=123",
  );
  assert.equal(headers.referer, "https://bcdnxw.hakunaymatata.com/");
  assert.equal(headers.origin, "https://bcdnxw.hakunaymatata.com");
}

console.log("playback-url tests passed");
