import assert from "node:assert/strict";
import { encryptPayload, decryptPayload } from "../src/extractors/nxsha/crypto.js";
import { toRawStreams, unwrapProxyUrl } from "../src/extractors/nxsha/parser.js";
import type { NxshaSource } from "../src/extractors/nxsha/types.js";

{
  const payload = {
    tmdbId: "48866",
    imdb_id: "",
    type: "tv" as const,
    season: 1,
    episode: 1,
  };
  const encrypted = encryptPayload(payload);
  const decrypted = JSON.parse(decryptPayload(encrypted)) as typeof payload & {
    _req_ts: number;
    _req_salt: string;
  };
  assert.equal(decrypted.tmdbId, payload.tmdbId);
  assert.equal(decrypted.type, payload.type);
  assert.equal(decrypted.season, payload.season);
  assert.equal(decrypted.episode, payload.episode);
  assert.ok(typeof decrypted._req_ts === "number");
  assert.ok(typeof decrypted._req_salt === "string");
}

{
  const wrapped =
    "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2F9efada9430a2316aeca6498466de88c1.mp4%3Fsign%3Dabc%26t%3D123";
  const inner = unwrapProxyUrl(wrapped);
  assert.equal(
    inner,
    "https://bcdnxw.hakunaymatata.com/cms/9efada9430a2316aeca6498466de88c1.mp4?sign=abc&t=123",
  );
}

{
  const sample: NxshaSource[] = [
    {
      id: "nitro-0",
      provider: "nitro",
      url: "https://cdn.example/master.m3u8",
      quality: "Auto",
      label: "Auto",
      isEmbed: false,
      type: "m3u8",
    },
    {
      id: "mbox-0",
      provider: "mbox",
      url: "https://proxy.example/?url=https%3A%2F%2Fcdn.example%2Fmovie.mp4",
      org_uri: "https://cdn.example/movie.mp4",
      quality: "1080",
      label: "Original Audio : 1080",
      isEmbed: false,
      type: "mp4",
    },
    {
      id: "nitrox-0",
      provider: "nitro",
      url: "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2Fclip.mp4%3Fsign%3Dx",
      org_uri: "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x",
      quality: "720",
      label: "720",
      isEmbed: false,
      type: "mp4",
    },
    {
      id: "hub-0",
      provider: "k4khdhub",
      url: "https://hubcloud.cx/drive/admin",
      quality: "1080p",
      label: "1080p",
      isEmbed: false,
      type: "mp4",
    },
  ];

  const raws = toRawStreams(sample);
  assert.equal(raws.length, 3);
  assert.equal(raws[0].quality, "Auto");
  assert.equal(raws[0].headers?.xDebug, "nitro · nitro-0");
  assert.equal(raws[1].url, "https://cdn.example/movie.mp4");
  assert.equal(raws[1].type, "mp4");
  assert.equal(raws[1].headers?.referer, "https://123movienow.cc/");
  assert.equal(raws[1].headers?.origin, "https://123movienow.cc");
  assert.equal(
    raws[2].url,
    "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x",
  );
  assert.equal(raws[2].headers?.referer, "https://bkl.itsnitrox.tech/");
  assert.equal(raws[0].headers?.referer, "https://cdn.example/");
  assert.equal(raws[0].headers?.siteReferer, true);
}

{
  const sample: NxshaSource[] = [
    {
      id: "nitrox-embed-ref",
      provider: "nitro",
      url: "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2Fclip.mp4%3Fsign%3Dx",
      org_uri:
        "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x&referer=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2F&origin=https%3A%2F%2Fbcdnxw.hakunaymatata.com",
      quality: "720",
      label: "720",
      isEmbed: false,
      type: "mp4",
      headers: {
        referer: "https://bcdnxw.hakunaymatata.com/",
        origin: "https://bcdnxw.hakunaymatata.com",
      },
    },
  ];

  const raws = toRawStreams(sample);
  assert.equal(raws[0].url, "https://bcdnxw.hakunaymatata.com/cms/clip.mp4?sign=x");
  assert.equal(raws[0].headers?.referer, "https://bkl.itsnitrox.tech/");
  assert.equal(raws[0].headers?.omitOrigin, true);
}

{
  const mbox: NxshaSource[] = [
    {
      id: "mbox-0",
      provider: "mbox",
      url: "https://bkl.itsnitrox.tech/xbm//?url=https%3A%2F%2Fbcdnxw.hakunaymatata.com%2Fcms%2F9efada9430a2316aeca6498466de88c1.mp4%3Fsign%3Dfd27d618491d111d4df1fd12618ba102%26t%3D1788069552",
      org_uri:
        "https://bcdnxw.hakunaymatata.com/cms/9efada9430a2316aeca6498466de88c1.mp4?sign=fd27d618491d111d4df1fd12618ba102&t=1788069552",
      headers: {},
      quality: "Hindi dub : 1080",
      label: "Hindi dub : 1080",
      isEmbed: false,
      type: "mp4",
    },
  ];

  const raws = toRawStreams(mbox);
  assert.equal(
    raws[0].url,
    "https://bcdnxw.hakunaymatata.com/cms/9efada9430a2316aeca6498466de88c1.mp4?sign=fd27d618491d111d4df1fd12618ba102&t=1788069552",
  );
  assert.equal(raws[0].headers?.referer, "https://123movienow.cc/");
  assert.notEqual(raws[0].headers?.referer, "https://bkl.itsnitrox.tech/");
  assert.equal(raws[0].headers?.omitOrigin, true);
}

console.log("nxsha tests passed");
