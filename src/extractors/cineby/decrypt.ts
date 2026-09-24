import { ExtractionError } from "../../core/errors.js";
import { CINEBY_ID } from "./constants.js";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// Verbatim port of cineby/index.js decrypt — do not refactor; site crypto is fragile.

const I = [
  1116352408, 1899447441, 3049323471, 3921009573, 961987163, 1508970993,
  2453635748, 2870763221, 3624381080, 310598401, 607225278, 1426881987,
  1925078388, 2162078206, 2614888103, 3248222580,
];
const b = [109, 118, 109, 49];
const g = (e: number) => ((e * (e + 1)) & 1) == 0;
const f = (e: number) => ((e * (e + 1)) & 1) == 1;

function y(e: number) {
  return (
    (e >>>= 0),
    (e ^= e >>> 16),
    (e = Math.imul(e, 2246822507) >>> 0),
    (e ^= e >>> 13),
    (e = Math.imul(e, 3266489909) >>> 0),
    (e ^= e >>> 16) >>> 0
  );
}

function S(e: number, t: number) {
  return ((e >>>= 0), 0 == (t &= 31))
    ? e >>> 0
    : ((e << t) | (e >>> (32 - t))) >>> 0;
}

function process(e: string, t: string, a: number): string {
  let s: Uint8Array;
  const d = (function (input: string) {
    const normalized = input
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(4 * Math.ceil(input.length / 4), "=");
    return new Uint8Array(Buffer.from(normalized, "base64"));
  })(e);

  const o = (function (seed: string, mediaId: number, length: number) {
    const state = (function (seedKey: string, mediaKey: number) {
      if (f(seedKey.length)) {
        return {
          S: (function (key: string) {
            const table = Array(256);
            for (let i = 0; i < 256; i++) table[i] = i;
            let j = 0;
            for (let i = 0; i < 256; i++) {
              j = (j + table[i]! + key.charCodeAt(i % key.length)) & 255;
              const tmp = table[i]!;
              table[i] = table[j]!;
              table[j] = tmp;
            }
            return table;
          })(seedKey),
          acc: (function (key: string) {
            let acc = 1732584193;
            for (let i = 0; i < key.length; i++) {
              acc = S((acc ^ Math.imul(key.charCodeAt(i), I[15 & i]!)) >>> 0, 5);
            }
            return y(acc);
          })(seedKey),
        };
      }

      const table = Array(61);
      let acc =
        y(
          (function (key: string) {
            let hash = 2166136261;
            for (let i = 0; i < key.length; i++) {
              hash = Math.imul(hash ^ key.charCodeAt(i), 16777619) >>> 0;
            }
            return y(hash);
          })(seedKey) ^ y((mediaKey >>> 0) ^ 2654435769),
        ) >>> 0;

      for (let i = 0; i < 8; i++) {
        if (g(i)) {
          const idx = acc % 61;
          acc = S((acc + 2654435769) >>> 0, 7 + (7 & i));
          table[idx] = (acc ^ y(acc)) >>> 0;
          acc = y((acc + idx) >>> 0);
        } else {
          table[i] = I[15 & i]!;
        }
      }

      return {
        S: table,
        acc: y(2779096485 ^ acc) >>> 0,
      };
    })(seed, mediaId);

    const out = new Uint8Array(length);
    let counter = 0;
    for (let i = 0; i < length; ) {
      const word = (function (ctx: { S: any; acc: number }, t: number) {
        let a: number;
        let slotXor: number;
        const table = ctx.S;
        let acc = ctx.acc;
        const idx = acc % 61;
        const missing = 0 - Number(idx in table);
        const slot = table[idx] >>> 0;
        let mixed =
          ((((a = acc) ^
            (slotXor = (slot ^ (Math.imul(2654435769, t + 1) >>> 0)) >>> 0)) >>>
            0) |
            ((a & slotXor & missing) >>> 0)) >>>
          0;

        acc = y(
          ((mixed =
            (S((mixed + acc) >>> 0, 31 & idx) ^ S(acc, 31 & Math.imul(idx, 7))) >>>
              0) +
            2654435769) >>>
            0,
        );
        table[idx] = acc >>> 0;
        ctx.acc = acc;
        return acc >>> 0;
      })(state, counter++);

      out[i++] = word & 255;
      if (i < length) out[i++] = (word >>> 8) & 255;
      if (i < length) out[i++] = (word >>> 16) & 255;
      if (i < length) out[i++] = (word >>> 24) & 255;
    }
    return out;
  })(t, a, d.length);

  for (let i = 0; i < d.length; i++) d[i]! ^= o[i]!;
  for (let i = 0; i < b.length; i++) {
    if (d[i] !== b[i]) {
      throw new ExtractionError(
        "DECRYPT_FAILED",
        "Cineby decrypt failed: bad seed or tampered payload",
        { extractorId: CINEBY_ID, layer: "extraction" },
      );
    }
  }

  s = d.subarray(b.length);
  return new TextDecoder("utf-8").decode(s);
}

export function decryptCinebyPayload(
  ciphertext: string,
  seed: string,
  mediaId: string | number,
): string {
  return process(ciphertext, seed, Number(mediaId));
}
