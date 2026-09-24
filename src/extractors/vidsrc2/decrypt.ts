import type { HttpClient } from "../../http/client.js";
import { ExtractionError } from "../../core/errors.js";
import {
  decodeBase64,
  decryptWithWasm,
  instantiateDecryptor,
  loadWasmModule,
} from "../../primitives/wasm-decrypt.js";
import { VIDSRC2_ID } from "./constants.js";
import {
  attachToken,
  guessQualityFromUrl,
  parseDecryptedStreamList,
} from "./parser.js";
import type { Vidsrc2Api } from "./api.js";

export type DecryptedStreams = {
  urls: string[];
  token: string;
};

/**
 * Decrypt encrypted stream_urls via WASM, then stamp playback tokens.
 */
export class Vidsrc2Decryptor {
  constructor(
    private readonly http: HttpClient,
    private readonly api: Vidsrc2Api,
  ) {}

  async decryptAndTokenize(
    encryptedStreamUrls: string,
    wasmUrl: string,
  ): Promise<DecryptedStreams> {
    let module: WebAssembly.Module;
    try {
      module = await loadWasmModule(this.http, wasmUrl);
    } catch (err) {
      if (err instanceof ExtractionError) {
        err = new ExtractionError(err.code, err.message, {
          extractorId: VIDSRC2_ID,
          layer: "extraction",
          cause: err,
        });
        throw err;
      }
      throw new ExtractionError("DECRYPT_FAILED", String(err), {
        extractorId: VIDSRC2_ID,
        layer: "extraction",
        cause: err,
      });
    }

    let plaintext: string;
    try {
      const exports = await instantiateDecryptor(module);
      const ciphertext = decodeBase64(encryptedStreamUrls);
      plaintext = decryptWithWasm(exports, ciphertext, 12);
    } catch (err) {
      if (err instanceof ExtractionError) {
        throw new ExtractionError(err.code, err.message, {
          extractorId: VIDSRC2_ID,
          layer: "extraction",
          cause: err,
        });
      }
      throw new ExtractionError("DECRYPT_FAILED", String(err), {
        extractorId: VIDSRC2_ID,
        layer: "extraction",
        cause: err,
      });
    }

    const urls = parseDecryptedStreamList(plaintext);
    if (urls.length === 0) {
      throw new ExtractionError("NO_STREAM", "Decrypt produced no stream URLs", {
        extractorId: VIDSRC2_ID,
        layer: "extraction",
      });
    }

    const token = await this.api.generateToken();
    const tokenized = urls.map((u) => attachToken(u, token));

    return { urls: tokenized, token };
  }

  enrichQuality(url: string): string | undefined {
    return guessQualityFromUrl(url);
  }
}
