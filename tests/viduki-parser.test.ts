import assert from "node:assert/strict";
import { createAltchaHeader } from "../src/extractors/viduki/altcha.js";
import { decryptedToRawStream, parseDecryptedPayload } from "../src/extractors/viduki/parser.js";
import type { AltchaChallenge } from "../src/extractors/viduki/types.js";

{
  const challenge: AltchaChallenge = {
    algorithm: "SHA-256",
    salt: "streamflow-test",
    challenge: "abc123",
    signature: "sig",
    maxnumber: 1000,
  };
  const header = createAltchaHeader(challenge, 7, Date.now() - 10);
  const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  assert.equal(decoded.number, 7);
  assert.equal(decoded.salt, "streamflow-test");
  assert.ok(decoded.took >= 0);
}

{
  const raw = JSON.stringify({
    stream: { url: "https://cdn.example.com/movie.m3u8" },
  });
  const parsed = parseDecryptedPayload(raw);
  assert.ok(parsed.stream?.url?.includes(".m3u8"));

  const stream = decryptedToRawStream(
    { name: "Leon", language: "ENGLISH" },
    raw,
  );
  assert.ok(stream?.url?.includes("m3u8"));
  assert.equal(stream?.headers?.referer, "https://www.viduki.net/");
  assert.equal(stream?.headers?.origin, "https://www.viduki.net/");
  assert.equal(stream?.headers?.siteReferer, undefined);
  assert.equal(stream?.label, "Leon · ENGLISH");
}

{
  const raw = JSON.stringify({ error: "No valid stream found" });
  assert.equal(
    decryptedToRawStream({ name: "Chris", language: "HINDI" }, raw),
    null,
  );
}

console.log("viduki parser tests passed");
