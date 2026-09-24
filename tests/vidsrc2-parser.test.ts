import assert from "node:assert/strict";
import { attachToken, parseDecryptedStreamList, guessQualityFromUrl } from "../src/extractors/vidsrc2/parser.ts";

const sample = `
https://cdn.example.com/a/1080p/index.m3u8
https://cdn.example.com/b/720p/index.m3u8

not-a-url
`;

const urls = parseDecryptedStreamList(sample);
assert.equal(urls.length, 2);
assert.ok(urls[0]!.includes("1080p"));

const withToken = attachToken(urls[0]!, "abc123");
assert.ok(withToken.includes("token=abc123"));

assert.equal(guessQualityFromUrl(urls[0]!), "1080p");
assert.equal(guessQualityFromUrl(urls[1]!), "720p");

console.log("vidsrc2 parser tests ok");
