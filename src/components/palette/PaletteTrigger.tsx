'use client'

// ============================================================
// PaletteTrigger — Phase 12.11e
// Small sidebar button that dispatches a synthetic ⌘K event to
// open the CommandPalette. Shows the universal shortcut hint.
// The CommandPalette listener handles both Cmd (Mac) and Ctrl
// (Windows/Linux), so a single hint covers both.
// ============================================================

export default function PaletteTrigger() {
  function open() {
    // Dispatch a synthetic ⌘K keydown that CommandPalette's global listener handles.
    const evt = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      metaKey: true,
      ctrlKey: true,
      bubbles: true,
    })
    window.dispatchEvent(evt)
  }

  return (
    <button
      onClick={open}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition border border-slate-200"
      aria-label="Open command palette"
    >
      <span className="text-base">🔎</span>
      <span className="flex-1 text-left">Search…</span>
      <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-500">
        ⌘K
      </kbd>
    </button>
  )
}
