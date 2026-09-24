import CryptoJS from "crypto-js";

/** AES passphrase used by web.nxsha.app request/response envelopes. */
const PASSWORD = String.fromCharCode(
  83, 56, 120, 33, 74, 107, 52, 90, 80, 49, 117, 71, 56, 36, 109, 121,
);

export function encryptPayload(payload: Record<string, unknown>): string {
  const body = {
    ...payload,
    _req_ts: Date.now(),
    _req_salt: Math.random().toString(36).substring(2, 12),
  };
  return CryptoJS.AES.encrypt(JSON.stringify(body), PASSWORD)
    .toString()
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function decryptPayload(encrypted: string): string {
  let normalized = encrypted.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  return CryptoJS.AES.decrypt(normalized, PASSWORD).toString(CryptoJS.enc.Utf8);
}
