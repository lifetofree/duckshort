#!/usr/bin/env node
// 7.4: Bundle-size gate. Fails CI when the SPA's main chunk grows past the
// agreed thresholds. Cheap (no extra dep) — runs after `vite build` in CI.
//
// Usage:
//   node scripts/check-bundle-size.mjs <dist-dir>
//   node scripts/check-bundle-size.mjs dist          (default)
//
// Thresholds (KB):
//   index.js           <= 250   main entry (the Admin + Home bundle)
//   any other chunk    <= 150   dynamically loaded views
//   total assets       <= 1500  everything in dist/assets
import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const distDir = resolve(process.argv[2] ?? 'dist')
const assetsDir = join(distDir, 'assets')

const ENTRY_LIMIT_KB = 250
const CHUNK_LIMIT_KB = 150
const TOTAL_LIMIT_KB = 1500

function kb(bytes) {
  return (bytes / 1024).toFixed(1)
}

let total = 0
const failures = []

try {
  const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
  for (const file of files) {
    const full = join(assetsDir, file)
    const size = statSync(full).size
    total += size
    const isEntry = file === 'index.js'
    const limit = isEntry ? ENTRY_LIMIT_KB : CHUNK_LIMIT_KB
    if (size / 1024 > limit) {
      failures.push(`${file}: ${kb(size)} KB (limit ${limit} KB)`)
    } else {
      console.log(`OK  ${file}: ${kb(size)} KB`)
    }
  }
} catch (err) {
  console.error(`Could not read ${assetsDir}:`, err.message)
  console.error('Did you run `vite build` first?')
  process.exit(1)
}

if (total / 1024 > TOTAL_LIMIT_KB) {
  failures.push(`Total bundle: ${kb(total)} KB (limit ${TOTAL_LIMIT_KB} KB)`)
}

if (failures.length > 0) {
  console.error('\nBundle-size check FAILED:')
  for (const msg of failures) console.error(' - ' + msg)
  process.exit(1)
}

console.log(`\nBundle-size check OK — total ${kb(total)} KB`)
