#!/usr/bin/env node
/**
 * Regenerate market/index.json for the current package version.
 *
 * A Git source is the default: it pins HEAD, so commit or stash first.
 *   npm run market:sync
 * A registry source:
 *   npm run market:sync -- --source=npm
 * Override the recorded publish time:
 *   npm run market:sync -- --timestamp=1763424000
 * Pin HEAD despite uncommitted changes:
 *   npm run market:sync -- --allow-dirty
 */
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async path => JSON.parse(await readFile(join(root, path), 'utf8'))
const pkg = await readJson('package.json')
const en = await readJson('locale/en.json')
const zh = await readJson('locale/zh.json')

const fail = message => {
  console.error(message)
  process.exit(1)
}

const dshRange = pkg.engines?.dsh
if (typeof dshRange !== 'string' || dshRange.trim() === '') {
  fail('package.json must declare engines.dsh')
}
const repository = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
if (typeof pkg.name !== 'string' || typeof pkg.version !== 'string' || typeof repository !== 'string') {
  fail('package.json needs name, version, and repository')
}
const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
const webUrl = repository.replace(/^git\+/, '').replace(/\.git$/, '')
const title = { en: en.meta.title, zh: zh.meta.title }
const description = { en: en.meta.description, zh: zh.meta.description }

const sourceArg = process.argv.find(arg => arg.startsWith('--source='))
const sourceType = sourceArg === undefined ? 'git' : sourceArg.slice('--source='.length)
if (sourceType !== 'git' && sourceType !== 'npm') {
  fail('--source must be git or npm')
}
const allowDirty = process.argv.includes('--allow-dirty')
const timestampArg = process.argv.find(arg => arg.startsWith('--timestamp='))
const explicit = timestampArg === undefined ? undefined : Number(timestampArg.slice('--timestamp='.length))
if (explicit !== undefined && (!Number.isSafeInteger(explicit) || explicit < 0)) {
  fail('--timestamp must be a non-negative integer (Unix seconds)')
}

let source
let publishTimestamp
if (sourceType === 'git') {
  const runGit = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  try {
    if (!allowDirty && runGit(['status', '--porcelain']) !== '') {
      fail('working tree is dirty; commit or stash first, or pass --allow-dirty to pin HEAD anyway')
    }
    const commit = runGit(['rev-parse', 'HEAD'])
    if (!/^[0-9a-f]{40}$/.test(commit)) fail(`unexpected commit id: ${commit}`)
    const commitTime = Number(runGit(['show', '-s', '--format=%ct', 'HEAD']))
    if (!Number.isSafeInteger(commitTime)) fail('could not read the commit time')
    source = { type: 'git', url: webUrl, commit }
    publishTimestamp = explicit ?? commitTime
  } catch (error) {
    fail(`git source generation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
} else {
  source = { type: 'npm' }
  const published = explicit ?? await npmPublishedAt()
  if (published === undefined) {
    console.warn(`warning: ${pkg.name}@${pkg.version} is not on the npm registry yet; using the current time`)
    publishTimestamp = Math.floor(Date.now() / 1000)
  } else {
    publishTimestamp = published
  }
}

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
      source,
      engines: { dsh: dshRange },
    }],
  }],
}

await mkdir(join(root, 'market'), { recursive: true })
await writeFile(join(root, 'market/index.json'), `${JSON.stringify(index, null, 2)}\n`)
await copyFile(join(root, 'icon.svg'), join(root, 'market/icon.svg'))
const label = source.type === 'git' ? `git ${source.commit.slice(0, 7)}` : 'npm'
console.log(`market/index.json: ${pkg.name}@${pkg.version}, ${label}, publishTimestamp ${publishTimestamp}`)

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
