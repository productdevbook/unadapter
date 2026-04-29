#!/usr/bin/env node
/**
 * Walk every emitted `.mjs` / `.d.mts` file and verify each `from "./..."`
 * specifier resolves to a real file. obuild's transform mode silently
 * skips emitting files when isolatedDeclarations can't infer a return
 * type, leaving barrels that re-export ghosts. CI never noticed because
 * the bundler stays quiet — but the published package fails at import
 * time.
 *
 * Run via `pnpm build:verify` (chained after `pnpm build` in CI).
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, join, resolve } from "node:path"
import process from "node:process"

const ROOT = resolve(process.cwd(), "dist")

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      yield* walk(full)
    } else if (entry.endsWith(".mjs") || entry.endsWith(".d.mts")) {
      yield full
    }
  }
}

const IMPORT_RE = /from\s+["']([^"']+)["']/g

const missing = []

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf-8")
  for (const match of src.matchAll(IMPORT_RE)) {
    const spec = match[1]
    if (!spec.startsWith(".")) continue
    const ext = extname(spec)
    if (ext !== ".mjs" && ext !== ".mts") continue
    const target = resolve(dirname(file), spec)
    try {
      statSync(target)
    } catch {
      missing.push({ file, spec, target })
    }
  }
}

if (missing.length > 0) {
  console.error(
    `\n[verify-build] Found ${missing.length} broken relative import(s) in dist/:\n`,
  )
  for (const { file, spec, target } of missing) {
    console.error(`  ${file.replace(ROOT, "dist")}`)
    console.error(`    → "${spec}" (resolved: ${target.replace(ROOT, "dist")})`)
  }
  console.error(
    `\nLikely cause: obuild silently skipped emit for those files. Add an explicit return type to the offending exported function.\n`,
  )
  process.exit(1)
}

console.log(`[verify-build] OK — every relative import in dist/ resolves.`)
