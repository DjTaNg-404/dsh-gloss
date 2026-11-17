# Compatibility

Gloss is experimental and talks to DSH through a mix of public-looking Client services and a few private DOM attributes. This file records what it touches, so a DSH update can be diagnosed quickly.

## Tested against

- DSH `0.2.2-alpha.3`
- `package.json`: `"engines": { "dsh": ">=0.2.2-alpha.3 <0.3.0" }`

DSH evaluates `engines.dsh` with `includePrerelease: true`, so 0.2.x prereleases satisfy the range. Widen or move the range only after testing the release.

## Runtime contracts

| Contract | Used for | If it changes |
|---|---|---|
| `[data-text-interaction-source]` | Deciding whether a selection belongs to a conversation and which session owns it | The Ask chip stops appearing |
| `[data-text-interaction-surface]` | Anchoring the chip to the native quote bubble's row | The chip falls back to the selection corner |
| `[data-conversation-scroll]` | Mapping a session id to its scroll root, and testing containment | Selection ownership breaks |
| `window.__ModuleLoader__.load` | Registering the Client artifact | The plugin does not load |
| `ctx.slots.inject` / `ctx.slots.register` with `conversation.composer.dock` and `shell.overlay` | Scope marker and overlay | Slots missing or duplicated |
| `sessions.binding(id)` | Reading the parent's event window | Fork boundary falls back to the Host's latest completed turn |
| `sessions.fork({ sessionId, atSeq, increaseTitle, onCreated })` | Creating the child at a durable event boundary | Dialog cannot open |
| `sessions.retain(id, { source: 'gateway' })`, `reference.ready`, `reference.release()` | Holding the child binding while the dialog is open | Child may not open or may leak |
| `session.prompt(parts, 'queue')` / `session.cancel()` | Asking and stopping | Send/stop fail |
| `uiWorkspace.archiveSession(id, { stopActivity: true })` | Discarding the child | Child stays in the session list |
| `locale.register` / `locale.bind` / `locale.getSnapshot` / `locale.subscribe` | Localized UI and language switching | UI falls back to the bundled Chinese copy |
| `eventSource` windows: durable entries vs. `transient` live chunks | Fork boundary, live text | A fractional live-chunk seq must never be used as `atSeq` |

## Behavior that depends on DSH ordering

- The native quote bubble renders its surface after the pointer/keyboard gesture settles. Gloss hides its chip during the gesture and only measures the anchor afterwards.
- A fork cut inside an open turn is balanced by the Host with synthetic closers. Gloss always cuts at a durable event, so this is expected.
- `sessions.fork` can fail after creating the child when the optional title rename fails. Gloss captures the child id via `onCreated` and archives it.

## Smoke test after a DSH upgrade

1. Select text while the main answer is streaming, then click **Ask**. The dialog must open (no `SessionSeq` error).
2. While the dialog says "opening", press Escape. It must stay closed, and no new session should remain in the sidebar.
3. Select text by dragging. The chip must not appear mid-drag; it should appear once, next to the native quote bubble.
4. Ask a question, press **Stop** while it streams, then close. The main conversation must be unchanged.
5. In a non-Chinese UI, click **Ask** with an empty box. The model must receive the English instruction.
6. Switch sessions with the dialog open. The header hint must change to "From another conversation", and closing must still archive the child.

Report a break with the DSH version, the plugin version, and the browser console error in a GitHub issue.
