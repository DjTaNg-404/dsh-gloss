#!/usr/bin/env node
/**
 * Regenerate market/index.json for the current package version.
 *
 * Usage:
 *   npm run market:sync
 *   npm run market:sync -- --timestamp=1763424000
 *
 * The publish timestamp is read from the npm registry for the current version.
 * Before the first publish, or when the registry is unreachable, pass
 * --timestamp or let the script fall back to the current time with a warning.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async path => JSON.parse(await readFile(join(root, path), 'utf8'))
const pkg = await readJson('package.json')
const en = await readJson('locale/en.json')
const zh = await readJson('locale/zh.json')

const dshRange = pkg.engines?.dsh
if (typeof dshRange !== 'string' || dshRange.trim() === '') {
  console.error('package.json must declare engines.dsh')
  process.exit(1)
}
const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string' || typeof repository !== 'string') {
  console.error('package.json needs name, version, and repository')
  process.exit(1)
}
const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
const webUrl = repository.replace(/^git\+/, '').replace(/\.git$/, '')
const title = { en: en.meta.title, zh: zh.meta.title }
const description = { en: en.meta.description, zh: zh.meta.description }

const timestampArg = process.argv.find(arg => arg.startsWith('--timestamp='))
const explicit = timestampArg === undefined ? undefined : Number(timestampArg.slice('--timestamp='.length))
if (explicit !== undefined && (!Number.isSafeInteger(explicit) || explicit < 0)) {
  console.error('--timestamp must be a non-negative integer (Unix seconds)')
  process.exit(1)
}
const published = explicit ?? await npmPublishedAt()
if (published === undefined) {
  console.warn(`warning: ${pkg.name}@${pkg.version} is not on the npm registry yet; using the current time`)
}
const publishTimestamp = published ?? Math.floor(Date.now() / 1000)

const index = {
  format: 1,
  title,
  description,
  plugins: [{
    name: pkg.name,
    title,
    description,
    icon: 'icon.svg',
    ...(author === undefined ? {} : { author }),
    ...(pkg.homepage === undefined ? {} : { homepage: pkg.homepage }),
    repository: { url: webUrl },
    metadata: { keywords: pkg.keywords ?? [] },
    'dist-tags': { latest: pkg.version },
    versions: [{
      version: pkg.version,
      publishTimestamp,
      source: { type: 'npm' },
      engines: { dsh: dshRange },
    }],
  }],
}

await mkdir(join(root, 'market'), { recursive: true })
await writeFile(join(root, 'market/index.json'), `${JSON.stringify(index, null, 2)}\n`)
await copyFile(join(root, 'icon.svg'), join(root, 'market/icon.svg'))
console.log(`market/index.json: ${pkg.name}@${pkg.version}, publishTimestamp ${publishTimestamp}`)
if (published === undefined) {
  console.log('Run this again after publishing (or pass --timestamp) to record the npm publish time.')
}

/** @returns the npm publish time of the current version, in Unix seconds. */
async function npmPublishedAt() {
  const url = `https://registry.npmjs.org/${pkg.name.replace('/', '%2F')}`
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return undefined
    const document = await response.json()
    const time = document.time?.[pkg.version]
    if (typeof time !== 'string') return undefined
    const parsed = Date.parse(time)
    return Number.isSafeInteger(parsed) ? Math.floor(parsed / 1000) : undefined
  } catch {
    return undefined
  }
}
