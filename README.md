# Gloss

Ask about any passage in a DeepSeek Harness conversation without derailing the main thread.

Select text in the conversation, click **Ask**, and a small throwaway dialog opens. It is backed by a forked child session, so follow-up questions inherit the conversation up to the selected passage, while every question and answer stays in the child. Close the dialog and the main conversation has received nothing.

English | [中文](README.zh.md)

```
main conversation                         Gloss dialog
┌────────────────────────────┐   ┌─────────────────────────────┐
│ … the paragraph …  [Quote] │   │ Gloss                  ✕   │
│                      [Ask] │   │ 「… the paragraph …」       │
│                            │   │ Q: what does this mean?     │
│                            │   │ A: …                        │
└────────────────────────────┘   └─────────────────────────────┘
```

## Status

Experimental. Tested against DeepSeek Harness `0.2.2-alpha.3`. Gloss uses a few Client APIs and private DOM attributes that may change between DSH releases; see [COMPATIBILITY.md](COMPATIBILITY.md).

Available from GitHub now. The market index pins a Git commit, so no npm account is needed; npm publishing is deferred.

## Features

- **Selection-first** — the "Ask" chip appears next to the native Quote action after a selection gesture settles, not mid-drag.
- **Forked context** — the child session inherits the main conversation up to the last durable event, so the answer sees everything the conversation saw.
- **Throwaway** — closing releases the child reference and archives it; the main conversation's transcript, queue, and agent are untouched.
- **Multi-turn** — ask several follow-ups in the same dialog, stop a long answer, and keep the quoted passage in view.
- **Client-only** — no Host services, no npm dependencies, no build step. `client.js` is loaded directly by the DSH Client module loader.

## Install

### From GitHub

```sh
git clone https://github.com/DjTaNg-404/dsh-gloss.git
dsh plugin --profile <profile> add /absolute/path/to/dsh-gloss
```

Or install the Git source directly:

```sh
dsh plugin --profile <profile> add "git+https://github.com/DjTaNg-404/dsh-gloss.git"
```

Or in the Web GUI: **Plugins → install → absolute local directory**, pointing at the cloned directory. Restart DSH once to prove the bundle persists.

### From a plugin index

Enable **Experimental plugins → Custom plugin indexes** in the Plugins page, add this index URL, then install **Gloss** from Discover:

```
https://djtang-404.github.io/dsh-gloss/market/index.json
```

The index installs a pinned Git commit; it does not use npm. GitHub Pages must be enabled for this repository (Settings → Pages → `main` / root) for the URL to resolve.

## Usage

1. Select text in an assistant reply, a user message, or a reasoning block.
2. Click **Ask** next to the native Quote action.
3. Ask a question, or press Enter with an empty box to ask for an explanation.
4. Use **Stop** to cancel a long answer, **✕** or Escape to close the dialog.

Closing archives the child session. It is not a secure delete: archived sessions can be recovered from the workspace.

## How it works

- A hidden marker in `conversation.composer.dock` maps the current session to its scroll root.
- The selection chip and the dialog live in `shell.overlay`; the chip is positioned one gap to the right of the host's native quote bubble.
- Opening the dialog calls `sessions.fork({ atSeq })` at the last **durable** event sequence (transient live chunks carry fractional sequences and are never used as a fork boundary), then `sessions.retain` and `session.prompt` in the child.
- Closing releases the reference and calls `uiWorkspace.archiveSession(childId, { stopActivity: true })`. Closing while the fork is still opening cancels it, releases anything already created, and archives the child so it cannot resurrect the dialog.
- The child inherits the parent's agent preset. Provider and model come from the global default model selection at fork time, not from a per-session override.

## Privacy and data

Gloss is local UI code with no telemetry, analytics, or network calls of its own. It does change where conversation data goes:

- Opening the dialog **copies the conversation prefix** into a new child session log on disk and sends that prefix, plus the selected passage, to the model provider configured in DSH on every question.
- Closing archives the child. Archived sessions remain on disk and are recoverable; Gloss does not securely delete them.
- The child is a normal agent with the parent's preset. A follow-up question can call tools and modify files in the workspace; closing the dialog does not roll those changes back.
- Do not select secrets or content you would not send to that provider.

## Compatibility

Tested against DSH `0.2.2-alpha.3`. The package declares:

```json
{ "engines": { "dsh": ">=0.2.2-alpha.3 <0.3.0" } }
```

The private DOM attributes and Client APIs this plugin relies on are listed in [COMPATIBILITY.md](COMPATIBILITY.md). If a DSH update removes one, the chip or the dialog can stop appearing; that file explains what to check first.

## Limitations

- The native Quote action and Gloss's Ask chip are two adjacent pills. Merging them into one action row needs a change to the conversation interaction dispatch contract (one surface per gesture).
- The child is a real fork: it appears briefly in the session list and duplicates the conversation prefix on disk.
- Each question sends the inherited history to the model, so a long conversation costs about as much as a main-conversation turn.
- The markdown renderer is a local subset: headings, lists, code blocks, quotes, emphasis, inline code, links. No tables or images.
- Model output is rendered with React; links are not scheme-filtered by Gloss.
- No secure deletion, no encryption at rest beyond what DSH provides.

## Development

Node 24.9 or newer, the same floor DSH uses.

```sh
npm test          # node:test logic + fork lifecycle regression
npm run check     # node --check client.js + the market script
npm run market:sync   # regenerate the Git-sourced market/index.json after a commit
```

Layout:

- `client.js` — the whole Client half (slots, selection chip, dialog, markdown).
- `index.js` — empty Host half required by the bundle patch.
- `cordis.patch.yml` — inserts the `gloss` row.
- `test/logic.test.mjs` — instruments `client.js` in a temp copy and tests the pure logic plus fork/cancel/cleanup paths.
- `test/manifest.test.mjs` — keeps the package name, loader id, patch row, locales, engines range, and market index in sync.
- `market/` — a format-1 DSH plugin index entry and its icon.

No build step. Edit `client.js`, then reload the page or restart DSH.

## License

[MIT](LICENSE).
