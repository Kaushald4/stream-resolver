import assert from "node:assert/strict";
import { assertTmdbId, apiResponseToRawStreams } from "../src/extractors/primeflix/parser.js";
import { ExtractionError } from "../src/core/errors.js";

assert.throws(() => assertTmdbId(undefined), ExtractionError);

assert.throws(
  () => apiResponseToRawStreams({ Nova: null, Atlas: null }),
  ExtractionError,
);

console.log("primeflix parser tests passed");
