/**
 * Gloss — select text in the conversation and ask about it in a throwaway dialog.
 *
 * The dialog talks to a forked child session: it inherits the main conversation up to
 * the fork point, and everything asked inside it stays in that child. Closing the
 * dialog archives the child, so the main conversation receives nothing.
 */
window.__ModuleLoader__.load({
  id: 'dsh-gloss',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const DICT = {
      zh: {
        trigger: '追问',
        title: '追问',
        hint: '分叉自当前对话 · 关闭即丢弃',
        close: '关闭',
        placeholder: '就这段文字提问…（Enter 发送，Shift+Enter 换行）',
        send: '发送',
        thinking: '正在回答…',
        forking: '正在打开小窗…',
        emptyHint: '直接回车，让它解释这段文字',
        failed: '没能打开小窗',
        sendFailed: '发送失败',
        stopFailed: '没能停止',
        stop: '停止',
        prompt: '请解释下面这段文字：',
        explain: '解释一下。',
        inputLabel: '追问内容',
        detached: '来自另一个对话 · 关闭即丢弃',
      },
      en: {
        trigger: 'Ask',
        title: 'Gloss',
        hint: 'Forked from this conversation · discarded on close',
        close: 'Close',
        placeholder: 'Ask about this text… (Enter to send, Shift+Enter for a new line)',
        send: 'Send',
        thinking: 'Answering…',
        forking: 'Opening the dialog…',
        emptyHint: 'Press Enter to ask for an explanation',
        failed: 'The dialog could not open',
        sendFailed: 'The message was not sent',
        stopFailed: 'Could not stop',
        stop: 'Stop',
        prompt: 'Explain the following text:',
        explain: 'Give me an explanation.',
        inputLabel: 'Question',
        detached: 'From another conversation · discarded on close',
      },
    }

    const CSS = `
.gloss-chip {
  position: fixed; z-index: 70; display: inline-flex; align-items: center; justify-content: center;
  height: 28px; padding: 0 10px; border: none; border-radius: 999px; corner-shape: round;
  background: var(--dsw-alias-button-floating-fill);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l3);
  box-shadow: var(--dsw-elevation-panel);
  color: var(--dsw-alias-label-primary); font: var(--dsw-font-xs-13); cursor: pointer;
  pointer-events: auto;
}
.gloss-chip:hover { background: var(--dsw-alias-button-floating-hover); }
.gloss-panel {
  position: fixed; z-index: 80; display: flex; flex-direction: column; overflow: hidden;
  width: min(420px, calc(100vw - 24px)); height: min(540px, calc(100vh - 24px));
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 14px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.24);
  pointer-events: auto; font: 13px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.gloss-header {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 8px 8px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1);
  cursor: grab; user-select: none; touch-action: none;
}
.gloss-panel[data-dragging="true"] .gloss-header { cursor: grabbing; }
.gloss-headings { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.gloss-title { font-size: 13px; font-weight: 500; }
.gloss-hint { font-size: 11px; line-height: 1.4; color: var(--dsw-alias-label-secondary); }
.gloss-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; cursor: pointer;
}
.gloss-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.gloss-quote {
  margin: 10px 14px 0; padding: 8px 10px; max-height: 92px; overflow: auto;
  white-space: pre-wrap; color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2); border-radius: 8px;
  font-size: 12px; line-height: 1.5; scrollbar-width: thin;
}
.gloss-list {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 10px; scrollbar-width: thin;
}
.gloss-list::-webkit-scrollbar { width: 8px; }
.gloss-list::-webkit-scrollbar-thumb { background: var(--dsw-alias-border-l1); border-radius: 999px; }
.gloss-list::-webkit-scrollbar-track { background: transparent; }
.gloss-user {
  align-self: flex-end; max-width: 85%; padding: 6px 10px; border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2); white-space: pre-wrap; word-break: break-word;
}
.gloss-assistant { align-self: stretch; word-break: break-word; }
.gloss-assistant p { margin: 0 0 8px; white-space: pre-wrap; }
.gloss-assistant p:last-child { margin-bottom: 0; }
.gloss-assistant ul, .gloss-assistant ol { margin: 4px 0 8px; padding-left: 20px; }
.gloss-assistant li { margin: 2px 0; }
.gloss-assistant a { color: var(--dsw-alias-brand-primary); text-decoration: none; }
.gloss-assistant a:hover { text-decoration: underline; }
.gloss-code {
  padding: 1px 5px; border-radius: 4px; background: var(--dsw-alias-bg-layer-2);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px;
}
.gloss-pre {
  margin: 6px 0; padding: 10px 12px; border-radius: 8px; overflow-x: auto;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1);
  scrollbar-width: thin;
}
.gloss-pre code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px; line-height: 1.5; white-space: pre;
}
.gloss-h { margin: 10px 0 4px; font-weight: 500; }
.gloss-h1 { font-size: 16px; }
.gloss-h2 { font-size: 15px; }
.gloss-h3 { font-size: 14px; }
.gloss-h4, .gloss-h5, .gloss-h6 { font-size: 13px; }
.gloss-blockquote {
  margin: 4px 0 8px; padding-left: 10px; border-left: 2px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary); white-space: pre-wrap;
}
.gloss-hr { border: none; border-top: 1px solid var(--dsw-alias-border-l1); margin: 8px 0; }
.gloss-note { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.gloss-error { color: var(--dsw-alias-state-error-primary); font-size: 12px; padding: 0 14px 8px; }
.gloss-composer {
  display: flex; align-items: flex-end; gap: 8px; padding: 10px 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.gloss-input {
  flex: 1 1 auto; min-height: 36px; max-height: 132px; resize: none;
  padding: 8px 10px; border-radius: 8px; outline: none;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary); font: 13px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.gloss-input:focus { border-color: var(--dsw-alias-brand-primary); }
.gloss-send {
  height: 32px; padding: 0 14px; border: none; border-radius: 8px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-foreground);
  font: 500 13px/1 system-ui, -apple-system, "Segoe UI", sans-serif; cursor: pointer;
}
.gloss-send:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.gloss-send:disabled { opacity: 0.4; cursor: not-allowed; }
.gloss-send.gloss-stop {
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
  border: 1px solid var(--dsw-alias-border-l1);
}
.gloss-send.gloss-stop:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.gloss-chip:focus-visible, .gloss-close:focus-visible, .gloss-send:focus-visible, .gloss-input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px;
}
`

    const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|~~[^~\n]+~~|\[[^\]\n]+\]\([^)\s]+\))/g
    /** Every localized instruction prefix used by the first prompt. */
    const QUESTION_PROMPTS = Object.values(DICT).map(dict => dict.prompt)

    /** @returns the shared, apply-scoped dialogue state. */
    function createRuntime() {
      const scopes = new Map()
      const listeners = new Set()
      let snapshot = { trigger: null, dialog: null, activeSession: null }
      return {
        scopes,
        /** Bumped to invalidate an openDialog that is still awaiting the fork. */
        openToken: 0,
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        patch(next) {
          snapshot = { ...snapshot, ...next }
          for (const listener of [...listeners]) listener()
        },
      }
    }

    /** @returns the localized text lookup, falling back to Chinese copy. */
    function createTranslate(locale) {
      let bound = null
      try {
        if (locale !== undefined && typeof locale.bind === 'function') bound = locale.bind('gloss')
      } catch {
        bound = null
      }
      return (key) => {
        try {
          const value = bound === null ? undefined : bound(key)
          if (typeof value === 'string' && value !== '' && value !== key) return value
        } catch {
          // Fall through to the bundled copy when the dictionary is unavailable.
        }
        return DICT.zh[key] ?? key
      }
    }

    /** @returns the text of a content-part array, ignoring non-text parts. */
    function partsText(parts) {
      if (!Array.isArray(parts)) return ''
      return parts
        .filter(part => part !== null && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string')
        .map(part => part.text)
        .join('\n')
        .trim()
    }

    /** @returns the last durable event seq in one window. */
    function lastDurableSeq(windowSnapshot) {
      let max = 0
      for (const entry of windowSnapshot.entries) {
        // Transient live chunks carry fractional seqs (cursor + 1 - 1/n); the
        // fork command only admits a real event seq, so they never count.
        if (entry.type !== 'event') continue
        const seq = entry.event?.seq
        if (typeof seq === 'number' && Number.isSafeInteger(seq) && seq > max) max = seq
      }
      return max
    }

    /** @returns the question part of our own first prompt, without the quoted selection. */
    function displayUserText(text) {
      if (!QUESTION_PROMPTS.some(prefix => text.startsWith(prefix))) return text
      const marker = '」\n\n'
      const index = text.lastIndexOf(marker)
      if (index < 0) return text
      return text.slice(index + marker.length).trim()
    }

    /** @returns settled bubbles plus the streaming assistant text after the fork boundary. */
    function foldMessages(windowSnapshot, boundary) {
      const items = []
      let live = ''
      for (const entry of windowSnapshot.entries) {
        const event = entry.event
        if (entry.type === 'transient') {
          const chunk = event.data?.chunk
          if (event.type === 'assistant/live-chunk' && chunk?.type === 'text-delta' && typeof chunk.text === 'string') {
            live += chunk.text
          }
          continue
        }
        if (typeof event.seq !== 'number' || event.seq <= boundary) continue
        if (event.type === 'user/message') {
          if (event.data?.source?.kind !== 'user') continue
          const text = displayUserText(partsText(event.data?.content))
          if (text !== '') items.push({ id: `u${event.seq}`, kind: 'user', text })
        } else if (event.type === 'assistant/message') {
          const text = partsText(event.data?.message?.content)
          if (text !== '') items.push({ id: `a${event.seq}`, kind: 'assistant', text })
          live = ''
        }
      }
      return { items, live }
    }

    /** @returns inline markdown as React nodes. */
    function renderInline(text, keyBase) {
      const nodes = []
      const parts = String(text).split(INLINE)
      parts.forEach((part, index) => {
        if (part === undefined || part === '') return
        const key = `${keyBase}:${index}`
        if (/^`[^`]*`$/.test(part)) {
          nodes.push(h('code', { key, className: 'gloss-code' }, part.slice(1, -1)))
        } else if (/^\*\*[^*]*\*\*$/.test(part) || /^__[^_]*__$/.test(part)) {
          nodes.push(h('strong', { key }, part.slice(2, -2)))
        } else if (/^\*[^*]*\*$/.test(part) || /^_[^_]*_$/.test(part)) {
          nodes.push(h('em', { key }, part.slice(1, -1)))
        } else if (/^~~[^~]*~~$/.test(part)) {
          nodes.push(h('del', { key }, part.slice(2, -2)))
        } else if (/^\[[^\]]*\]\([^)]*\)$/.test(part)) {
          const link = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(part)
          nodes.push(h('a', { key, href: link[2], target: '_blank', rel: 'noreferrer noopener' }, link[1]))
        } else {
          nodes.push(part)
        }
      })
      return nodes
    }

    /** @returns the block-level markdown rendering for one assistant message. */
    function renderMarkdown(text) {
      const lines = String(text).split('\n')
      const blocks = []
      let index = 0
      let key = 0
      const next = () => `b${key++}`
      while (index < lines.length) {
        const line = lines[index]
        if (/^\s*```/.test(line)) {
          const body = []
          index += 1
          while (index < lines.length && !/^\s*```/.test(lines[index])) {
            body.push(lines[index])
            index += 1
          }
          index += 1
          blocks.push(h('pre', { key: next(), className: 'gloss-pre' }, h('code', null, body.join('\n'))))
          continue
        }
        if (/^\s*$/.test(line)) { index += 1; continue }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          const level = heading[1].length
          blocks.push(h('div', { key: next(), className: `gloss-h gloss-h${level}` }, renderInline(heading[2], `h${key}`)))
          index += 1
          continue
        }
        const isBullet = /^\s*[-*+]\s+/.test(line)
        const isOrdered = /^\s*\d+\.\s+/.test(line)
        if (isBullet || isOrdered) {
          const items = []
          while (index < lines.length
            && (isOrdered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/).test(lines[index])) {
            const body = lines[index].replace(/^\s*([-*+]|\d+\.)\s+/, '')
            items.push(h('li', { key: `i${key++}` }, renderInline(body, `l${key}`)))
            index += 1
          }
          blocks.push(h(isOrdered ? 'ol' : 'ul', { key: next() }, items))
          continue
        }
        if (/^\s*>/.test(line)) {
          const quoted = []
          while (index < lines.length && /^\s*>/.test(lines[index])) {
            quoted.push(lines[index].replace(/^\s*>\s?/, ''))
            index += 1
          }
          blocks.push(h('blockquote', { key: next(), className: 'gloss-blockquote' },
            renderInline(quoted.join('\n'), `q${key}`)))
          continue
        }
        if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
          blocks.push(h('hr', { key: next(), className: 'gloss-hr' }))
          index += 1
          continue
        }
        const paragraph = []
        while (index < lines.length
          && !/^\s*$/.test(lines[index])
          && !/^\s*(```|#{1,6}\s|[-*+]\s|\d+\.\s|>|---|\*\*\*|___)/.test(lines[index])) {
          paragraph.push(lines[index])
          index += 1
        }
        blocks.push(h('p', { key: next() }, renderInline(paragraph.join('\n'), `p${key}`)))
      }
      return blocks
    }

    /** @returns the conversation scroll root tracked for one session, or null. */
    function scopeRoot(runtime, sessionId) {
      const locate = runtime.scopes.get(sessionId)
      return locate === undefined ? null : locate()
    }

    /** @returns the live selection inside a tracked conversation, or null. */
    function readSelection(runtime) {
      const selection = document.getSelection()
      if (selection === null || selection.rangeCount === 0 || selection.isCollapsed) return null
      const text = selection.toString().trim()
      if (text === '') return null
      const range = selection.getRangeAt(0)
      const start = range.startContainer
      const element = start.nodeType === Node.ELEMENT_NODE ? start : start.parentElement
      if (!(element instanceof Element)) return null
      const source = element.closest('[data-text-interaction-source]')
      if (source === null) return null
      let owner = null
      for (const [sessionId, locate] of runtime.scopes) {
        const root = locate()
        if (root === null || !root.contains(source) || root.getClientRects().length === 0) continue
        owner = sessionId
        break
      }
      if (owner === null) return null
      const rects = range.getClientRects()
      const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return null
      return {
        sessionId: owner,
        text,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      }
    }

    /** @returns the visible host selection-action bubble inside one conversation, or null. */
    function measureQuoteSurface(root) {
      const scope = root === undefined || root === null ? document : root
      const surface = scope.querySelector('[data-text-interaction-surface]')
      if (!(surface instanceof HTMLElement)) return null
      const style = window.getComputedStyle(surface)
      if (style.visibility === 'hidden' || style.display === 'none') return null
      const rect = surface.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      return { left: rect.left, right: rect.right, top: rect.top, height: rect.height }
    }

    /**
     * Place the chip in the host bubble's row, one gap to its right.
     * @returns fixed-position coordinates, flipped left when the right edge does not fit.
     */
    function chipPlacement(rect, anchor) {
      const width = 64
      const height = 28
      const gap = 6
      const margin = 8
      if (anchor !== undefined && anchor !== null) {
        const top = `${Math.max(margin, anchor.top + (anchor.height - height) / 2)}px`
        const match = { height: `${Math.round(anchor.height)}px` }
        const rightSide = anchor.right + gap
        if (rightSide + width <= window.innerWidth - margin) return { left: `${rightSide}px`, top, ...match }
        const leftSide = anchor.left - gap - width
        if (leftSide >= margin) return { left: `${leftSide}px`, top, ...match }
        return { left: `${Math.max(margin, Math.min(rightSide, window.innerWidth - width - margin))}px`, top, ...match }
      }
      const left = Math.max(margin, Math.min(rect.right + 8, window.innerWidth - width - margin))
      const below = rect.bottom + 8
      const top = below + height <= window.innerHeight - margin
        ? `${below}px`
        : `${Math.max(margin, rect.top - height - 8)}px`
      return { left: `${left}px`, top }
    }

    /** @returns the bottom-right default of the dialog, clamped to the viewport. */
    function defaultPanelPos() {
      const width = Math.min(420, window.innerWidth - 24)
      const height = Math.min(540, window.innerHeight - 24)
      return {
        left: Math.max(8, window.innerWidth - width - 16),
        top: Math.max(8, window.innerHeight - height - 16),
      }
    }

    /** Release a reference and archive a child that will never be shown. */
    async function discardChild(deps, childId, reference) {
      if (reference !== null) {
        try { reference.release() } catch { /* The reference is already gone. */ }
      }
      if (childId === null) return
      try {
        await deps.uiWorkspace?.archiveSession?.(childId, { stopActivity: true })
      } catch {
        // Archiving is best effort: the child still never writes back to the main line.
      }
    }

    /**
     * Open a forked child session and swap the dialog into its chat phase.
     * Every await is followed by a cancellation check: closing the dialog while
     * the fork is in flight must not resurrect it, and must not leak the child.
     * @param runtime - shared dialogue state.
     * @param deps - sessions and workspace services.
     * @param translate - localized copy lookup.
     * @param trigger - the admitted selection.
     */
    async function openDialog(runtime, deps, translate, trigger) {
      if (runtime.getSnapshot().dialog !== null) return
      const token = ++runtime.openToken
      const cancelled = () => runtime.openToken !== token || runtime.getSnapshot().dialog === null
      runtime.patch({
        trigger: null,
        dialog: { phase: 'forking', quote: trigger.text, sessionId: trigger.sessionId },
      })
      let childId = null
      /** Captures the child even when the optional title rename fails after creation. */
      let createdId = null
      let reference = null
      try {
        const parent = deps.sessions.binding(trigger.sessionId)
        const boundary = parent === undefined ? 0 : lastDurableSeq(parent.eventSource.getSnapshot())
        childId = await deps.sessions.fork({
          sessionId: trigger.sessionId,
          increaseTitle: true,
          onCreated: (id) => { createdId = id },
          ...(boundary > 0 ? { atSeq: boundary } : {}),
        })
        if (cancelled()) {
          await discardChild(deps, childId, null)
          return
        }
        reference = deps.sessions.retain(childId, { source: 'gateway' })
        const binding = await reference.ready
        if (cancelled()) {
          await discardChild(deps, childId, reference)
          return
        }
        const forkPoint = boundary > 0 ? boundary : lastDurableSeq(binding.eventSource.getSnapshot())
        runtime.patch({
          dialog: {
            phase: 'chat', quote: trigger.text, sessionId: trigger.sessionId,
            childId, reference, binding, boundary: forkPoint, error: null,
          },
        })
      } catch (error) {
        await discardChild(deps, childId ?? createdId, reference)
        if (cancelled()) return
        runtime.patch({
          dialog: {
            phase: 'error',
            quote: trigger.text,
            sessionId: trigger.sessionId,
            error: `${translate('failed')}: ${error instanceof Error ? error.message : String(error)}`,
          },
        })
      }
    }

    /**
     * Close the dialog: stop and archive the child, release its reference, and drop the state.
     * Bumping the token also cancels a fork that is still being opened.
     * @param runtime - shared dialogue state.
     * @param deps - sessions and workspace services.
     */
    function closeDialog(runtime, deps) {
      const dialog = runtime.getSnapshot().dialog
      runtime.openToken += 1
      runtime.patch({ dialog: null, trigger: null })
      if (dialog === null || dialog.phase !== 'chat') return
      try { dialog.reference.release() } catch { /* The reference is already gone. */ }
      try {
        deps.uiWorkspace?.archiveSession?.(dialog.childId, { stopActivity: true })?.catch(() => {
          // Archiving is best effort: the child still never writes back to the main line.
        })
      } catch {
        // A synchronous archive failure must not break the close handler.
      }
    }

    /** Hidden dock marker that tells the overlay which conversation a selection belongs to. */
    function ScopeMarker(props) {
      const { runtime, sessionId } = props
      const ref = React.useRef(null)
      React.useEffect(() => {
        if (typeof sessionId !== 'string') return () => {}
        runtime.scopes.set(sessionId, () => (ref.current === null ? null : ref.current.closest('[data-conversation-scroll]')))
        if (runtime.getSnapshot().activeSession !== sessionId) runtime.patch({ activeSession: sessionId })
        return () => {
          if (runtime.scopes.get(sessionId) !== undefined) runtime.scopes.delete(sessionId)
        }
      }, [runtime, sessionId])
      return h('span', { ref, style: { display: 'none' }, 'aria-hidden': 'true' })
    }

    /** One settled answer; memoized so streaming never re-parses earlier messages. */
    const AssistantBubble = React.memo(function AssistantBubble(props) {
      return h('div', { className: 'gloss-assistant' }, renderMarkdown(props.text))
    })

    /** The forked child conversation shown inside the dialog. */
    const MiniChat = React.memo(function MiniChat(props) {
      const { dialog, t } = props
      const getWindow = React.useCallback(() => dialog.binding.eventSource.getSnapshot(), [dialog.binding])
      const subscribeWindow = React.useCallback(fn => dialog.binding.eventSource.subscribe(fn), [dialog.binding])
      const getSession = React.useCallback(() => dialog.binding.session.getSnapshot(), [dialog.binding])
      const subscribeSession = React.useCallback(fn => dialog.binding.session.subscribe(fn), [dialog.binding])
      const windowSnapshot = React.useSyncExternalStore(subscribeWindow, getWindow)
      const sessionSnapshot = React.useSyncExternalStore(subscribeSession, getSession)
      const { items, live } = foldMessages(windowSnapshot, dialog.boundary)
      const [draft, setDraft] = React.useState('')
      const [sending, setSending] = React.useState(false)
      const [stopping, setStopping] = React.useState(false)
      const [error, setError] = React.useState(null)
      const listRef = React.useRef(null)
      const inputRef = React.useRef(null)
      /** Follow the tail only while the reader is already at the bottom. */
      const pinnedRef = React.useRef(true)
      /** The first question as the user saw it, so the bubble never parses the prompt back. */
      const firstAskedRef = React.useRef(null)
      const running = sessionSnapshot.running
      const busy = running || sending
      const firstUserId = items.find(item => item.kind === 'user')?.id

      React.useEffect(() => {
        const node = listRef.current
        if (node !== null && pinnedRef.current) node.scrollTop = node.scrollHeight
      }, [items.length, live, running])

      React.useEffect(() => {
        const node = inputRef.current
        if (node !== null) node.focus()
      }, [])

      const onListScroll = () => {
        const node = listRef.current
        if (node === null) return
        pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 24
      }

      const send = React.useCallback(async () => {
        if (busy) return
        const question = draft.trim()
        const first = items.length === 0
        if (question === '' && !first) return
        const asked = question === '' ? t('explain') : question
        if (first) firstAskedRef.current = asked
        const payload = first ? `${t('prompt')}\n\n「${dialog.quote}」\n\n${asked}` : question
        pinnedRef.current = true
        setSending(true)
        setError(null)
        setDraft('')
        try {
          const result = await dialog.binding.session.prompt([{ type: 'text', text: payload }], 'queue')
          if (result !== undefined && result !== null && result.ok === false) {
            setError(`${t('sendFailed')}: ${result.error?.message ?? ''}`.trim())
          }
        } catch (failure) {
          setError(`${t('sendFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`)
        } finally {
          setSending(false)
        }
      }, [busy, dialog.binding, dialog.quote, draft, items.length, t])

      const stop = React.useCallback(async () => {
        if (stopping) return
        setStopping(true)
        setError(null)
        try {
          const result = await dialog.binding.session.cancel()
          if (result !== undefined && result !== null && result.ok === false) {
            setError(`${t('stopFailed')}: ${result.error?.message ?? ''}`.trim())
          }
        } catch (failure) {
          setError(`${t('stopFailed')}: ${failure instanceof Error ? failure.message : String(failure)}`)
        } finally {
          setStopping(false)
        }
      }, [dialog.binding, stopping, t])

      const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
          event.preventDefault()
          void send()
        }
      }

      const bubbleText = item => (item.kind === 'user' && item.id === firstUserId
        && firstAskedRef.current !== null
        ? firstAskedRef.current
        : item.text)

      return h(React.Fragment, null,
        h('div', { className: 'gloss-quote', title: dialog.quote }, dialog.quote),
        h('div', {
          className: 'gloss-list', ref: listRef, onScroll: onListScroll,
          role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions text',
        },
          items.length === 0 && live === '' && !running
            ? h('div', { className: 'gloss-note' }, t('emptyHint'))
            : null,
          ...items.map(item => (item.kind === 'user'
            ? h('div', { key: item.id, className: 'gloss-user' }, bubbleText(item))
            : h(AssistantBubble, { key: item.id, text: item.text }))),
          live !== ''
            ? h('div', { className: 'gloss-assistant' }, renderMarkdown(live))
            : null,
          running && live === ''
            ? h('div', { className: 'gloss-note' }, t('thinking'))
            : null),
        error === null ? null : h('div', { className: 'gloss-error' }, error),
        h('div', { className: 'gloss-composer' },
          h('textarea', {
            ref: inputRef,
            className: 'gloss-input',
            rows: 1,
            value: draft,
            placeholder: t('placeholder'),
            'aria-label': t('inputLabel'),
            disabled: busy,
            onChange: event => setDraft(event.target.value),
            onKeyDown,
          }),
          h('button', {
            type: 'button',
            className: running ? 'gloss-send gloss-stop' : 'gloss-send',
            disabled: sending || stopping,
            onClick: () => { if (running) void stop(); else void send() },
          }, running ? t('stop') : t('send'))))
    })

    /** Root-scope overlay: the selection chip and the draggable throwaway dialog. */
    function GlossOverlay(props) {
      const { runtime, deps, t } = props
      const snapshot = React.useSyncExternalStore(runtime.subscribe, runtime.getSnapshot)
      const dialog = snapshot.dialog
      const getLocale = React.useCallback(() => {
        try { return deps.locale?.getSnapshot() ?? null } catch { return null }
      }, [deps.locale])
      const subscribeLocale = React.useCallback(
        fn => deps.locale?.subscribe?.(fn) ?? (() => {}),
        [deps.locale],
      )
      const localeSnapshot = React.useSyncExternalStore(subscribeLocale, getLocale)
      // Handed to the memoized MiniChat so a language switch still refreshes its labels.
      const localeKey = localeSnapshot === null ? 0 : localeSnapshot.revision
      const panelRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const [dragging, setDragging] = React.useState(false)
      const [pos, setPos] = React.useState(null)

      React.useEffect(() => {
        if (dialog === null || dialog.phase !== 'chat') {
          dragRef.current = null
          setDragging(false)
          setPos(null)
          return
        }
        setPos(current => current ?? defaultPanelPos())
      }, [dialog])

      React.useEffect(() => {
        let frame
        let anchorFrames = 0
        /** True while a primary-button gesture may still be extending the selection. */
        let pointerSelecting = false
        const clear = () => {
          if (runtime.getSnapshot().trigger !== null) runtime.patch({ trigger: null })
        }
        const schedule = () => {
          if (frame !== undefined) return
          frame = window.requestAnimationFrame(() => {
            frame = undefined
            if (runtime.getSnapshot().dialog !== null) return
            // The host renders its quote bubble only after the gesture settles.
            // Showing the chip mid-drag parks it at the selection corner and then
            // makes it jump to the bubble's row on release, so stay hidden.
            if (pointerSelecting) {
              clear()
              return
            }
            const next = readSelection(runtime)
            if (next === null) {
              clear()
              return
            }
            const anchor = measureQuoteSurface(scopeRoot(runtime, next.sessionId))
            anchorFrames = 0
            runtime.patch({ trigger: { ...next, anchor } })
            if (anchor === null) settleAnchor()
          })
        }
        /**
         * The host bubble renders a frame or two after the gesture; keep looking for it
         * so the chip joins its row instead of falling back to the selection corner.
         */
        const settleAnchor = () => {
          const current = runtime.getSnapshot().trigger
          if (current === null || current.anchor !== null || current.anchor === undefined) return
          const anchor = measureQuoteSurface(scopeRoot(runtime, current.sessionId))
          if (anchor !== null) {
            runtime.patch({ trigger: { ...current, anchor } })
            return
          }
          anchorFrames += 1
          if (anchorFrames < 40) window.requestAnimationFrame(settleAnchor)
        }
        const onPointerDown = (event) => {
          pointerSelecting = event.button === 0
          const path = typeof event.composedPath === 'function' ? event.composedPath() : []
          const inside = path.some(node => node instanceof Element && node.hasAttribute('data-gloss-surface'))
          if (!inside) clear()
        }
        const onPointerUp = () => {
          pointerSelecting = false
          schedule()
        }
        const onPointerCancel = () => {
          pointerSelecting = false
          clear()
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          if (runtime.getSnapshot().dialog !== null) closeDialog(runtime, deps)
          else clear()
        }
        const onScroll = () => clear()
        document.addEventListener('selectionchange', schedule)
        document.addEventListener('pointerup', onPointerUp)
        document.addEventListener('pointercancel', onPointerCancel)
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('scroll', onScroll, true)
        window.addEventListener('resize', onScroll)
        window.addEventListener('blur', onPointerCancel)
        return () => {
          if (frame !== undefined) window.cancelAnimationFrame(frame)
          document.removeEventListener('selectionchange', schedule)
          document.removeEventListener('pointerup', onPointerUp)
          document.removeEventListener('pointercancel', onPointerCancel)
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('scroll', onScroll, true)
          window.removeEventListener('resize', onScroll)
          window.removeEventListener('blur', onPointerCancel)
        }
      }, [runtime, deps])

      const onHeaderPointerDown = (event) => {
        if (dialog === null || dialog.phase !== 'chat') return
        const target = event.target
        if (target instanceof Element && target.closest('button') !== null) return
        const node = panelRef.current
        if (node === null) return
        const rect = node.getBoundingClientRect()
        dragRef.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
        setDragging(true)
        event.currentTarget.setPointerCapture?.(event.pointerId)
        event.preventDefault()
      }
      const onHeaderPointerMove = (event) => {
        const drag = dragRef.current
        const node = panelRef.current
        if (drag === null || node === null) return
        const width = node.offsetWidth
        const height = node.offsetHeight
        const left = Math.max(8, Math.min(event.clientX - drag.dx, window.innerWidth - width - 8))
        const top = Math.max(8, Math.min(event.clientY - drag.dy, window.innerHeight - height - 8))
        setPos({ left, top })
      }
      const onHeaderPointerUp = (event) => {
        dragRef.current = null
        setDragging(false)
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }
      /** Keep Tab inside the non-modal panel so it cannot walk into the page behind it. */
      const onPanelKeyDown = (event) => {
        if (event.key !== 'Tab') return
        const node = panelRef.current
        if (node === null) return
        const focusable = [...node.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href]')]
          .filter(element => element instanceof HTMLElement)
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }

      const trigger = snapshot.trigger
      const hoverPlacement = trigger === null ? null : chipPlacement(trigger, trigger.anchor)
      return h(React.Fragment, null,
        h('style', null, CSS),
        trigger === null || dialog !== null
          ? null
          : h('button', {
            type: 'button',
            'data-gloss-surface': '',
            'aria-haspopup': 'dialog',
            className: 'gloss-chip',
            style: {
              left: hoverPlacement.left,
              top: hoverPlacement.top,
              ...(hoverPlacement.height === undefined ? {} : { height: hoverPlacement.height }),
            },
            onPointerDown: event => event.preventDefault(),
            onClick: () => { void openDialog(runtime, deps, t, trigger) },
          }, t('trigger')),
        dialog === null
          ? null
          : h('div', {
            'data-gloss-surface': '',
            'data-dragging': dragging ? 'true' : 'false',
            className: 'gloss-panel',
            ref: panelRef,
            role: 'dialog',
            'aria-label': t('title'),
            onKeyDown: onPanelKeyDown,
            style: dialog.phase === 'chat' && pos !== null
              ? { left: `${pos.left}px`, top: `${pos.top}px`, right: 'auto', bottom: 'auto' }
              : { right: '16px', bottom: '16px' },
          },
          h('div', {
            className: 'gloss-header',
            onPointerDown: onHeaderPointerDown,
            onPointerMove: onHeaderPointerMove,
            onPointerUp: onHeaderPointerUp,
            onPointerCancel: onHeaderPointerUp,
          },
          h('div', { className: 'gloss-headings' },
            h('span', { className: 'gloss-title' }, t('title')),
            h('span', { className: 'gloss-hint' },
              snapshot.activeSession !== null && dialog.sessionId !== snapshot.activeSession
                ? t('detached')
                : t('hint'))),
          h('button', {
            type: 'button',
            className: 'gloss-close',
            onClick: () => closeDialog(runtime, deps),
            title: t('close'),
            'aria-label': t('close'),
          }, '✕')),
          dialog.phase === 'chat'
            ? h(MiniChat, { dialog, t, localeKey })
            : h('div', { className: 'gloss-note', style: { padding: '16px 14px' } },
              dialog.phase === 'error' ? (dialog.error ?? t('failed')) : t('forking'))),
      )
    }

    return {
      name: 'gloss',
      // The dialog cannot do anything without these; waiting on the services keeps a
      // boot-time activation from running before the session face exists.
      inject: ['slots', 'sessions', 'uiWorkspace', 'locale'],
      apply(ctx) {
        const sessions = ctx.get('sessions')
        const uiWorkspace = ctx.get('uiWorkspace')
        const locale = ctx.get('locale')
        if (sessions === undefined) return
        if (locale !== undefined) {
          try {
            ctx.effect(() => locale.register('gloss', DICT), 'gloss: dictionaries')
          } catch {
            // A namespace owned by an earlier apply falls back to the bundled copy.
          }
        }
        const runtime = createRuntime()
        const t = createTranslate(locale)
        const deps = { sessions, uiWorkspace, locale }
        // Unloading the Client half (HMR, disable, page teardown) must not leave a
        // forked child retained or an in-flight open alive.
        ctx.effect(() => () => { closeDialog(runtime, deps) }, 'gloss: teardown')

        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock', id: 'gloss-scope', order: 90,
        }, props => h(ScopeMarker, { runtime, sessionId: props.sessionId })))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'gloss', order: 60,
        }, () => h(GlossOverlay, { runtime, deps, t })))
      },
    }
  },
})
