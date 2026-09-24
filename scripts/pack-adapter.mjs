#!/usr/bin/env node
/**
 * Bundle, minify, and obfuscate extractor adapters into zips for the
 * Streamflow companion (QuickJS).
 *
 * Usage:
 *   node scripts/pack-adapter.mjs cineby
 *   node scripts/pack-adapter.mjs cineby vidsrc2 nxsha
 */
import { readFile, mkdir, writeFile, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import * as esbuild from "esbuild"
import JavaScriptObfuscator from "javascript-obfuscator"
import AdmZip from "adm-zip"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const ADAPTERS = {
  cineby: {
    entry: join(ROOT, "scripts/adapter-entries/cineby.ts"),
    manifest: join(ROOT, "adapters/cineby/manifest.json"),
    idConstant: "CINEBY_ID",
    legacyId: "cineby",
  },
  vidsrc2: {
    entry: join(ROOT, "scripts/adapter-entries/vidsrc2.ts"),
    manifest: join(ROOT, "adapters/vidsrc2/manifest.json"),
    idConstant: "VIDSRC2_ID",
    legacyId: "vidsrc2",
  },
  nxsha: {
    entry: join(ROOT, "scripts/adapter-entries/nxsha.ts"),
    manifest: join(ROOT, "adapters/nxsha/manifest.json"),
    idConstant: "NXSHA_ID",
    legacyId: "nxsha",
  },
  viduki: {
    entry: join(ROOT, "scripts/adapter-entries/viduki.ts"),
    manifest: join(ROOT, "adapters/viduki/manifest.json"),
    idConstant: "VIDUKI_ID",
    legacyId: "viduki",
  },
  primeflix: {
    entry: join(ROOT, "scripts/adapter-entries/primeflix.ts"),
    manifest: join(ROOT, "adapters/primeflix/manifest.json"),
    idConstant: "PRIMEFLIX_ID",
    legacyId: "primeflix",
  },
}

function parseArgs(argv) {
  const positional = []
  let outDir = join(ROOT, "dist/packages")

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--out") outDir = resolve(argv[++i] ?? outDir)
    else if (!arg.startsWith("-")) positional.push(arg)
  }

  return { names: positional, outDir }
}

function adapterIdPlugin(manifestId, idConstant, legacyId) {
  const idPattern = new RegExp(
    `export const ${idConstant} = "${legacyId}"`,
    "g",
  )
  return {
    name: "adapter-id",
    setup(build) {
      build.onLoad({ filter: /constants\.ts$/ }, async (args) => {
        if (!args.path.includes(legacyId)) return null
        let contents = await readFile(args.path, "utf8")
        contents = contents.replace(
          idPattern,
          `export const ${idConstant} = "${manifestId}"`,
        )
        return { contents, loader: "ts" }
      })
    },
  }
}

function obfuscateBundle(source) {
  return JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    simplify: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    rotateStringArray: true,
    selfDefending: false,
    debugProtection: false,
    disableConsoleOutput: false,
    target: "browser",
    identifierNamesGenerator: "hexadecimal",
  }).getObfuscatedCode()
}

async function packAdapter(name, outDir) {
  const spec = ADAPTERS[name]
  if (!spec) {
    throw new Error(
      `Unknown adapter "${name}". Available: ${Object.keys(ADAPTERS).join(", ")}`,
    )
  }

  const manifestRaw = await readFile(spec.manifest, "utf8")
  const manifest = JSON.parse(manifestRaw)
  const manifestId = manifest.id

  const staging = join(ROOT, "dist/adapters", name)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })

  const bundledJs = join(staging, "index.bundled.js")
  const outJs = join(staging, "index.js")
  await esbuild.build({
    entryPoints: [spec.entry],
    outfile: bundledJs,
    bundle: true,
    platform: "neutral",
    format: "esm",
    minify: true,
    treeShaking: true,
    legalComments: "none",
    external: ["*wasm-decrypt.js", "*viduki-wasm.js"],
    plugins: [adapterIdPlugin(manifestId, spec.idConstant, spec.legacyId)],
    logLevel: "info",
  })

  const bundled = await readFile(bundledJs, "utf8")
  const obfuscated = obfuscateBundle(bundled)
  await writeFile(outJs, obfuscated)

  await writeFile(join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`)

  await mkdir(outDir, { recursive: true })
  const zipPath = join(outDir, `${manifestId}.zip`)
  const zip = new AdmZip()
  zip.addLocalFile(outJs, "", "index.js")
  zip.addLocalFile(join(staging, "manifest.json"), "", "manifest.json")
  zip.writeZip(zipPath)

  const kb = (Buffer.byteLength(obfuscated) / 1024).toFixed(1)
  console.log(`\nPacked ${name} → ${zipPath}`)
  console.log(`  manifest id: ${manifestId}`)
  console.log(`  bundle: ${kb} KB (obfuscated)`)
}

const args = parseArgs(process.argv.slice(2))
if (args.names.length === 0) {
  console.error(
    `Usage: node scripts/pack-adapter.mjs <${Object.keys(ADAPTERS).join("|")}> [more...] [--out dir]`,
  )
  process.exit(1)
}

for (const name of args.names) {
  await packAdapter(name, args.outDir)
}
