/**
 * Viduki WASM bridge — external module for companion packaging.
 * Node uses WebAssembly directly; QuickJS gets a native shim via js-host.
 */
import type { HttpClient } from "../http/client.js";
import { ExtractionError } from "../core/errors.js";
import {
  VIDUKI_ORIGIN,
  VIDUKI_REFERER,
  VIDUKI_WASM_MANIFEST,
} from "../extractors/viduki/constants.js";
import type { VidukiEnvelope, VidukiPepperKey } from "../extractors/viduki/types.js";

export type VidukiBridgeHandle = {
  reset(): void;
  decryptPepper(
    nonce: Uint8Array,
    bucket: number,
    iv: Uint8Array,
    ct: Uint8Array,
    tag: Uint8Array,
  ): void;
  decryptEnvelope(
    envelope: VidukiEnvelope,
    clientNonceHex: string,
    requestIdHex: string,
  ): string;
  dropPepper(): void;
};

type WasmExports = {
  memory: WebAssembly.Memory;
  _NUwd: (size: number) => number;
  _vxNZ: () => void;
  _E5Uu: (...args: number[]) => number;
  _RHMG: (...args: number[]) => number;
  _chDt: () => void;
};

class WasmBridge implements VidukiBridgeHandle {
  private memory: Uint8Array;

  constructor(private readonly exports: WasmExports) {
    this.memory = new Uint8Array(exports.memory.buffer);
  }

  private syncMemory(): void {
    this.memory = new Uint8Array(this.exports.memory.buffer);
  }

  private alloc(size: number): number {
    const ptr = this.exports._NUwd(size);
    this.syncMemory();
    return ptr;
  }

  private write(ptr: number, data: Uint8Array): void {
    this.syncMemory();
    this.memory.set(data, ptr);
  }

  private read(ptr: number, length: number): Uint8Array {
    this.syncMemory();
    return this.memory.slice(ptr, ptr + length);
  }

  reset(): void {
    this.exports._vxNZ();
    this.syncMemory();
  }

  decryptPepper(
    nonce: Uint8Array,
    bucket: number,
    iv: Uint8Array,
    ct: Uint8Array,
    tag: Uint8Array,
  ): void {
    const noncePtr = this.alloc(nonce.length);
    this.write(noncePtr, nonce);

    const bucketBuf = new Uint8Array(8);
    new DataView(bucketBuf.buffer).setBigUint64(0, BigInt(bucket), false);
    const bucketPtr = this.alloc(8);
    this.write(bucketPtr, bucketBuf);

    const ivPtr = this.alloc(iv.length);
    this.write(ivPtr, iv);

    const ctPtr = this.alloc(ct.length);
    this.write(ctPtr, ct);

    const tagPtr = this.alloc(tag.length);
    this.write(tagPtr, tag);

    const result = this.exports._E5Uu(
      noncePtr,
      nonce.length,
      bucketPtr,
      8,
      ivPtr,
      iv.length,
      ctPtr,
      ct.length,
      tagPtr,
      tag.length,
    );
    if (result === 0) {
      throw new ExtractionError("DECRYPT_FAILED", "Viduki decryptPepper failed", {
        layer: "extraction",
      });
    }
  }

  decryptEnvelope(
    envelope: VidukiEnvelope,
    clientNonceHex: string,
    requestIdHex: string,
  ): string {
    const clientNonce = hexToBytes(clientNonceHex);
    const serverNonce = hexToBytes(envelope.sn);
    const requestId = hexToBytes(requestIdHex);

    const iv1 = hexToBytes(envelope.iv1);
    const iv2 = hexToBytes(envelope.iv2);
    const wk = hexToBytes(envelope.wk);
    const tag1 = hexToBytes(envelope.tag1);
    const tag2 = hexToBytes(envelope.tag2);
    const ct = hexToBytes(envelope.ct);

    const clientNoncePtr = this.alloc(clientNonce.length);
    this.write(clientNoncePtr, clientNonce);

    const serverNoncePtr = this.alloc(serverNonce.length);
    this.write(serverNoncePtr, serverNonce);

    const tbBuf = new Uint8Array(8);
    new DataView(tbBuf.buffer).setBigUint64(0, BigInt(envelope.tb), false);
    const tbPtr = this.alloc(8);
    this.write(tbPtr, tbBuf);

    const requestIdPtr = this.alloc(requestId.length);
    this.write(requestIdPtr, requestId);

    const iv1Ptr = this.alloc(iv1.length);
    this.write(iv1Ptr, iv1);

    const iv2Ptr = this.alloc(iv2.length);
    this.write(iv2Ptr, iv2);

    const wkPtr = this.alloc(wk.length);
    this.write(wkPtr, wk);

    const tag1Ptr = this.alloc(tag1.length);
    this.write(tag1Ptr, tag1);

    const tag2Ptr = this.alloc(tag2.length);
    this.write(tag2Ptr, tag2);

    const ctPtr = this.alloc(ct.length);
    this.write(ctPtr, ct);

    const outputPtr = this.alloc(ct.length);

    const resultLen = this.exports._RHMG(
      clientNoncePtr,
      clientNonce.length,
      serverNoncePtr,
      serverNonce.length,
      tbPtr,
      8,
      requestIdPtr,
      requestId.length,
      iv2Ptr,
      iv2.length,
      wkPtr,
      wk.length,
      tag2Ptr,
      tag2.length,
      iv1Ptr,
      iv1.length,
      ctPtr,
      ct.length,
      tag1Ptr,
      tag1.length,
      outputPtr,
    );

    if (resultLen <= 0) {
      throw new ExtractionError("DECRYPT_FAILED", "Viduki decryptEnvelope failed", {
        layer: "extraction",
      });
    }

    return new TextDecoder().decode(this.read(outputPtr, resultLen));
  }

  dropPepper(): void {
    this.exports._chDt();
    this.syncMemory();
  }
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim();
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function loadVidukiBridge(http: HttpClient): Promise<VidukiBridgeHandle> {
  const manifestRes = await http.get<{ url?: string }>(VIDUKI_WASM_MANIFEST, {
    responseType: "json",
    headers: { referer: VIDUKI_REFERER, origin: VIDUKI_ORIGIN },
    timeoutMs: 30_000,
  });
  if (!manifestRes.ok || !manifestRes.data?.url) {
    throw new ExtractionError(
      "SITE_UNAVAILABLE",
      "Failed to load Viduki WASM manifest",
      { layer: "extraction" },
    );
  }

  const wasmUrl = new URL(manifestRes.data.url, VIDUKI_WASM_MANIFEST).href;
  const wasmRes = await http.get<ArrayBuffer>(wasmUrl, {
    responseType: "arrayBuffer",
    headers: { referer: VIDUKI_REFERER, origin: VIDUKI_ORIGIN },
    timeoutMs: 30_000,
  });
  if (!wasmRes.ok) {
    throw new ExtractionError(
      "SITE_UNAVAILABLE",
      `Failed to download Viduki WASM (${wasmRes.status})`,
      { layer: "extraction" },
    );
  }

  const instance = await WebAssembly.instantiate(wasmRes.data, {
    env: {
      abort: () => {
        throw new ExtractionError("DECRYPT_FAILED", "Viduki WASM abort", {
          layer: "extraction",
        });
      },
    },
  });

  return new WasmBridge(instance.instance.exports as unknown as WasmExports);
}

export function applyPepperKey(
  bridge: VidukiBridgeHandle,
  sessionNonce: string,
  pepper: VidukiPepperKey,
): void {
  bridge.reset();
  bridge.decryptPepper(
    hexToBytes(sessionNonce),
    pepper.bucket,
    hexToBytes(pepper.iv),
    hexToBytes(pepper.ct),
    hexToBytes(pepper.tag),
  );
}
