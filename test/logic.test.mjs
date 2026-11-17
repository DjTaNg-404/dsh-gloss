/**
 * Regression tests for the Client half's pure logic and fork lifecycle.
 *
 * The browser artifact is a plain script (`window.__ModuleLoader__.load`), so the
 * harness writes an instrumented copy to the OS temp directory and exposes the
 * internal functions through a `__test` field. Run with `npm test` (or
 * `node --test test/logic.test.mjs`).
 */
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
const needle = "    return {\n      name: 'gloss',"
assert.equal(source.split(needle).length - 1, 1, 'client.js return shape changed; update the test harness')
const instrumented = source.replace(
  needle,
  "    return {\n      __test: { createRuntime, openDialog, closeDialog, lastDurableSeq, displayUserText, foldMessages },\n      name: 'gloss',",
)

globalThis.window = {
  __ModuleLoader__: { load(options) { globalThis.__glossModule = options } },
  innerWidth: 1440,
  innerHeight: 900,
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame() { return 0 },
  cancelAnimationFrame() {},
}
globalThis.document = { getSelection: () => null, addEventListener() {}, removeEventListener() {} }

const directory = mkdtempSync(join(tmpdir(), 'gloss-test-'))
const artifact = join(directory, 'client.mjs')
writeFileSync(artifact, instrumented)
await import(pathToFileURL(artifact).href)
// `memo` runs at factory time; the component bodies are never rendered here.
const plugin = globalThis.__glossModule.factory(() => ({
  createElement: () => null,
  memo: component => component,
}))
const { createRuntime, openDialog, closeDialog, lastDurableSeq, displayUserText, foldMessages } = plugin.__test

const durable = seq => ({ type: 'event', event: { seq } })
const transient = seq => ({ type: 'transient', event: { seq } })
const userMessage = (seq, text, source = { kind: 'user' }) => ({
  type: 'event',
  event: { seq, type: 'user/message', data: { source, content: [{ type: 'text', text }] } },
})
const assistantMessage = (seq, text) => ({
  type: 'event',
  event: { seq, type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } },
})
const chunk = text => ({
  type: 'transient',
  event: { type: 'assistant/live-chunk', data: { chunk: { type: 'text-delta', text } } },
})

/** @returns deps whose fork settles under test control. */
function harness(overrides = {}) {
  const calls = []
  const sessions = {
    binding: () => ({ eventSource: { getSnapshot: () => ({ entries: [durable(7), transient(7.5)] }) } }),
    fork: async options => { calls.push(['fork', options]); return 'child-1' },
    retain: () => ({ release: () => { calls.push(['release']) }, ready: Promise.resolve({}) }),
    ...overrides.sessions,
  }
  const deps = {
    sessions,
    uiWorkspace: { archiveSession: async (id, options) => { calls.push(['archive', id, options]) } },
    ...overrides.deps,
  }
  return { calls, deps }
}

test('a live-chunk seq never becomes a fork boundary', () => {
  assert.equal(lastDurableSeq({ entries: [durable(40), durable(41), transient(41.5), transient(41.33)] }), 41)
  assert.equal(lastDurableSeq({ entries: [transient(0.5)] }), 0)
})

test('the first prompt is stripped for every bundled locale', () => {
  assert.equal(displayUserText('请解释下面这段文字：\n\n「引文」\n\n为什么？'), '为什么？')
  assert.equal(displayUserText('Explain the following text:\n\n「q」\n\nwhy?'), 'why?')
  assert.equal(displayUserText('plain question'), 'plain question')
})

test('folded messages honour the boundary and settle the live text', () => {
  const folded = foldMessages({
    entries: [
      userMessage(2, 'inherited'),
      chunk('old'),
      userMessage(3, 'hello'),
      chunk('wor'),
      assistantMessage(4, 'world'),
    ],
  }, 2)
  assert.deepEqual(folded.items.map(item => `${item.kind}:${item.text}`), ['user:hello', 'assistant:world'])
  assert.equal(folded.live, '')
})

test('closing while the fork is in flight cancels it without resurrecting the dialog', async () => {
  const { calls, deps } = harness({
    sessions: {
      binding: () => ({ eventSource: { getSnapshot: () => ({ entries: [durable(7), transient(7.5)] }) } }),
      fork: async options => {
        calls.push(['fork', options])
        await new Promise(resolve => { globalThis.__releaseFork = resolve })
        return 'child-cancelled'
      },
      retain: () => { throw new Error('retain must not run after cancel') },
    },
  })
  const runtime = createRuntime()
  const opening = openDialog(runtime, deps, key => key, { sessionId: 's1', text: 'quote' })
  assert.equal(runtime.getSnapshot().dialog.phase, 'forking')
  closeDialog(runtime, deps)
  assert.equal(runtime.getSnapshot().dialog, null)
  globalThis.__releaseFork()
  await opening
  assert.equal(runtime.getSnapshot().dialog, null)
  const fork = calls.find(call => call[0] === 'fork')[1]
  assert.equal(fork.atSeq, 7)
  assert.equal(fork.increaseTitle, true)
  assert.deepEqual(calls.filter(call => call[0] === 'archive'), [['archive', 'child-cancelled', { stopActivity: true }]])
})

test('a failed retain/ready releases the reference and archives the child', async () => {
  const released = []
  const archived = []
  const { deps } = harness({
    sessions: {
      binding: () => ({ eventSource: { getSnapshot: () => ({ entries: [durable(3)] }) } }),
      fork: async () => 'child-broken',
      retain: () => ({ release: () => released.push('ref'), ready: Promise.reject(new Error('boom')) }),
    },
    deps: { uiWorkspace: { archiveSession: async id => archived.push(id) } },
  })
  const runtime = createRuntime()
  await openDialog(runtime, deps, key => key, { sessionId: 's1', text: 'quote' })
  assert.equal(runtime.getSnapshot().dialog.phase, 'error')
  assert.deepEqual(released, ['ref'])
  assert.deepEqual(archived, ['child-broken'])
})

test('a post-creation failure still archives the child it created', async () => {
  const archived = []
  const { deps } = harness({
    sessions: {
      binding: () => ({ eventSource: { getSnapshot: () => ({ entries: [durable(1)] }) } }),
      fork: async options => {
        options.onCreated('child-rename-failed')
        throw new Error('rename failed')
      },
      retain: () => { throw new Error('must not retain') },
    },
    deps: { uiWorkspace: { archiveSession: async id => archived.push(id) } },
  })
  const runtime = createRuntime()
  await openDialog(runtime, deps, key => key, { sessionId: 's1', text: 'quote' })
  assert.equal(runtime.getSnapshot().dialog.phase, 'error')
  assert.deepEqual(archived, ['child-rename-failed'])
})

test('the successful path forks at the durable seq and close releases plus archives', async () => {
  const calls = []
  const binding = { eventSource: { getSnapshot: () => ({ entries: [durable(9)] }) } }
  const { deps } = harness({
    sessions: {
      binding: () => binding,
      fork: async options => { calls.push(['fork', options]); return 'child-ok' },
      retain: () => ({ release: () => { calls.push(['release']) }, ready: Promise.resolve(binding) }),
    },
    deps: { uiWorkspace: { archiveSession: async id => { calls.push(['archive', id]) } } },
  })
  const runtime = createRuntime()
  await openDialog(runtime, deps, key => key, { sessionId: 's1', text: 'quote' })
  const dialog = runtime.getSnapshot().dialog
  assert.equal(dialog.phase, 'chat')
  assert.equal(dialog.boundary, 9)
  assert.equal(calls.find(call => call[0] === 'fork')[1].atSeq, 9)
  closeDialog(runtime, deps)
  assert.deepEqual(calls.filter(call => call[0] !== 'fork'), [['release'], ['archive', 'child-ok']])
  assert.equal(runtime.getSnapshot().dialog, null)
})

test('a missing parent binding falls back to the host completed-turn prefix', async () => {
  const forkCalls = []
  const binding = { eventSource: { getSnapshot: () => ({ entries: [durable(5)] }) } }
  const { deps } = harness({
    sessions: {
      binding: () => undefined,
      fork: async options => { forkCalls.push(options); return 'child-blank' },
      retain: () => ({ release: () => {}, ready: Promise.resolve(binding) }),
    },
  })
  const runtime = createRuntime()
  await openDialog(runtime, deps, key => key, { sessionId: 's1', text: 'quote' })
  assert.equal(forkCalls[0].atSeq, undefined)
  assert.equal(runtime.getSnapshot().dialog.boundary, 5)
  closeDialog(runtime, deps)
})
