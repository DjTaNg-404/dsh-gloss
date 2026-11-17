/**
 * Manifest consistency checks: the package name, Client loader id, bundle patch
 * row, display metadata, compatibility range, and market index must agree.
 * Run with `npm test`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const pkg = JSON.parse(read('package.json'))
const client = read('client.js')
const patch = read('cordis.patch.yml')
const en = JSON.parse(read('locale/en.json'))
const zh = JSON.parse(read('locale/zh.json'))

test('the package, loader id, and bundle row use the same name', () => {
  assert.ok(client.includes(`id: '${pkg.name}'`), 'client.js loader id must equal the package name')
  assert.ok(patch.includes(`name: '${pkg.name}'`), 'cordis.patch.yml row must use the package name')
  assert.match(patch, /- id: gloss\b/, 'the patch row id is the plugin entry id')
})

test('the bundle declares web Client injection and runtime files', () => {
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh?.client?.platform, 'web')
  assert.ok(Array.isArray(pkg.dsh?.client?.inject) && pkg.dsh.client.inject.length > 0)
  for (const file of ['client.js', 'index.js', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
    assert.ok(pkg.files.some(entry => entry === file || (entry.endsWith('/*.json') && file.endsWith('.json'))), `${file} must be shipped`)
  }
})

test('display metadata exists in English and Chinese', () => {
  for (const locale of [en, zh]) {
    assert.ok(typeof locale.meta?.title === 'string' && locale.meta.title.trim() !== '')
    assert.ok(typeof locale.meta?.description === 'string' && locale.meta.description.trim() !== '')
  }
  assert.notEqual(en.meta.title, zh.meta.title)
})

test('the DSH compatibility range is declared', () => {
  assert.equal(typeof pkg.engines?.dsh, 'string')
  assert.ok(pkg.engines.dsh.trim() !== '')
  assert.ok(/[<>=]/.test(pkg.engines.dsh), 'engines.dsh must be a range, not a single version')
})

test('the committed market index matches the package', () => {
  const index = JSON.parse(read('market/index.json'))
  assert.equal(index.format, 1)
  const plugin = index.plugins?.[0]
  assert.equal(plugin?.name, pkg.name)
  assert.equal(plugin?.versions?.[0]?.version, pkg.version)
  assert.equal(plugin?.versions?.[0]?.engines?.dsh, pkg.engines.dsh)
  assert.equal(plugin?.icon, 'icon.svg')
  const source = plugin?.versions?.[0]?.source
  assert.ok(source?.type === 'git' || source?.type === 'npm', `unexpected market source: ${source?.type}`)
  if (source.type === 'git') {
    assert.match(source.commit, /^[0-9a-f]{40}$/)
    assert.match(source.url, /^https:\/\/github\.com\//)
  }
})
