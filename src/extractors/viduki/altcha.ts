import { sha256Hex } from "../../primitives/sha256.js";
import type { AltchaChallenge } from "./types.js";

export function solveAltcha(salt: string, challenge: string, maxNumber: number): number {
  const host = (globalThis as Record<string, unknown>).__host_altcha_solve;
  if (typeof host === "function") {
    return (host as (s: string, c: string, m: number) => number)(salt, challenge, maxNumber);
  }

  const saltBytes = new TextEncoder().encode(salt);
  for (let n = 0; n <= maxNumber; n++) {
    const numStr = String(n);
    const combined = new Uint8Array(saltBytes.length + numStr.length);
    combined.set(saltBytes, 0);
    for (let i = 0; i < numStr.length; i++) {
      combined[saltBytes.length + i] = numStr.charCodeAt(i);
    }
    const hash = sha256Hex(combined);
    if (hash === challenge) return n;
  }
  throw new Error("ALTCHA solution not found");
}

export function createAltchaHeader(
  challenge: AltchaChallenge,
  solution: number,
  startTime: number,
): string {
  const payload = {
    algorithm: challenge.algorithm,
    challenge: challenge.challenge,
    number: solution,
    salt: challenge.salt,
    signature: challenge.signature,
    took: Math.max(0, Date.now() - startTime),
  };
  return base64EncodeUtf8(JSON.stringify(payload));
}

function base64EncodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;
    out += alphabet[(triplet >> 18) & 63];
    out += alphabet[(triplet >> 12) & 63];
    out += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? alphabet[triplet & 63] : "=";
  }
  return out;
}

export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
