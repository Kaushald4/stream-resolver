import type { HttpClient } from "../http/client.js";
import { ExtractionError } from "../core/errors.js";

export type WasmDecryptExports = {
  memory: WebAssembly.Memory;
  alloc: (size: number) => number;
  decrypt: (ptr: number, len: number) => number;
};

/**
 * Generic WASM decrypt primitive used by adapters that ship ciphertext + module.
 * Adapters supply the module URL / bytes; core does not know site crypto details.
 */
export async function loadWasmModule(
  http: HttpClient,
  wasmUrl: string,
): Promise<WebAssembly.Module> {
  const res = await http.get<ArrayBuffer>(wasmUrl, {
    responseType: "arrayBuffer",
    timeoutMs: 30_000,
  });
  if (!res.ok) {
    throw new ExtractionError(
      "SITE_UNAVAILABLE",
      `Failed to download WASM (${res.status})`,
      { layer: "extraction" },
    );
  }
  return WebAssembly.compile(res.data);
}

export async function instantiateDecryptor(
  module: WebAssembly.Module,
): Promise<WasmDecryptExports> {
  // When given a compiled Module, instantiate returns the Instance directly.
  const instance = await WebAssembly.instantiate(module, {});
  const exports = instance.exports as unknown as Partial<WasmDecryptExports>;
  if (!exports.memory || !exports.alloc || !exports.decrypt) {
    throw new ExtractionError(
      "PLAYER_CHANGED",
      `WASM missing exports (got: ${Object.keys(instance.exports).join(", ")})`,
      { layer: "extraction" },
    );
  }
  return exports as WasmDecryptExports;
}

/**
 * Vidsrc-style layout: ciphertext written at alloc'd ptr; plaintext at ptr + headerOffset.
 */
export function decryptWithWasm(
  exports: WasmDecryptExports,
  ciphertext: Uint8Array,
  headerOffset = 12,
): string {
  const { memory, alloc, decrypt } = exports;
  const ptr = alloc(ciphertext.length);
  new Uint8Array(memory.buffer).set(ciphertext, ptr);
  const outLen = decrypt(ptr, ciphertext.length);
  if (!outLen || outLen < 0) {
    throw new ExtractionError("DECRYPT_FAILED", `WASM decrypt returned ${outLen}`, {
      layer: "extraction",
    });
  }
  const plaintextBytes = new Uint8Array(memory.buffer, ptr + headerOffset, outLen);
  return new TextDecoder().decode(plaintextBytes);
}

export function decodeBase64(data: string): Uint8Array {
  return new Uint8Array(Buffer.from(data, "base64"));
}
