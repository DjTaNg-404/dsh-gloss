# Changelog

## 0.2.0 — 2026-11-18

First public release, renamed from the local `quick-ask` prototype to **Gloss**.

- Selection-anchored **Ask** chip next to the native quote action; hidden during a selection gesture.
- Forked child session at the last durable event, with multi-turn follow-ups, Stop, and archive-on-close.
- Cancellation and cleanup for closing during the fork, a failed `retain`, and a post-creation title-rename failure.
- Localized prompt and first-question bubble; English UI no longer sends a Chinese instruction.
- Accessibility: dialog role and label, focus containment, live log region, labelled input, focus-visible outlines.
- Drag position is local UI state; settled answers are memoized so streaming and dragging stay cheap.
- Auto-follow only while the reader is at the bottom.
- MIT license, regression tests, compatibility notes, and a format-1 market index.
