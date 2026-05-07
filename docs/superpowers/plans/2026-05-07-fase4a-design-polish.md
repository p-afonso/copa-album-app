# Copa 2026 Fase 4A — Design Polish + Collection UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Copa 2026 album app into a premium collector platform through consistent design tokens, satisfying microinteractions, and faster collection UX.

**Architecture:** Extend `globals.css` with new CSS tokens and animations; create `useCountUp`, `useToast` hooks and `EmptyState`, `QuickActionOverlay`, `Toast` components; update existing components to use them. `AlbumApp` wires quick-add mode state, confetti milestones, and the toast system.

**Tech Stack:** React 19, Next.js 16 App Router, tRPC v11, canvas-confetti (~3KB), CSS custom properties

---

## File Map

**Create:**
- `hooks/useCountUp.ts` — animated number transition hook
- `hooks/useToast.ts` — single-toast state hook
- `components/Toast.tsx` — toast UI
- `components/EmptyState.tsx` — reusable empty state
- `components/QuickActionOverlay.tsx` — inline +1/Remove overlay for quick-add

**Modify:**
- `app/globals.css` — new tokens, flash/badge/toast animations
- `components/ProgressPanel.tsx` — useCountUp + overshoot bar transition
- `components/ActionSheet.tsx` — 80ms close delay, primary buttons 48px
- `components/StickerCard.tsx` — flash animation, long-press, quick-add overlay
- `components/StickerGrid.tsx` — team completion states, status filter passthrough
- `components/FilterBar.tsx` — quick-add toggle, status pills
- `components/AlbumApp.tsx` — confetti, quickUpdate mutation, wire all new props
- `components/RepeatedView.tsx` — EmptyState
- `components/MarketplaceTab.tsx` — EmptyState + onActivateMarketplace prop
- `components/TradeView.tsx` — pass onActivateMarketplace to MarketplaceTab
- `components/ProposalsTab.tsx` — EmptyState
- `components/ProfileView.tsx` — EmptyState for trade history

---

## Task 1: Install canvas-confetti + CSS tokens + animations

**Files:**
- Modify: `app/globals.css`
- Install: `canvas-confetti @types/canvas-confetti`

- [ ] **Step 1: Install canvas-confetti**

```bash
npm install canvas-confetti @types/canvas-confetti
```

Expected output: `added 2 packages`

- [ ] **Step 2: Replace `app/globals.css` with updated tokens and animations**

Full new content:

```css
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
@import "tailwindcss";

:root {
  --bg:              #f4f7f4;
  --surface:         #ffffff;
  --surface-2:       #eaf0ea;
  --surface-elevated:#f8fbf8;
  --border:          #d8e4d8;
  --border-2:        #b8ccb8;
  --green:           #16a34a;
  --green-mid:       #15803d;
  --green-dim:       #dcfce7;
  --green-glow:      rgba(22, 163, 74, 0.12);
  --gold:            #d97706;
  --gold-mid:        #b45309;
  --gold-dim:        #fef3c7;
  --gold-glow:       rgba(217, 119, 6, 0.12);
  --red:             #dc2626;
  --text:            #182818;
  --text-muted:      #56775a;
  --text-dim:        #7a9a7a;

  --radius-sm:  8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  24px;

  --text-xs:   11px;
  --text-sm:   13px;
  --text-base: 15px;
  --text-lg:   17px;
  --text-xl:   20px;
  --text-2xl:  28px;
}

* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Outfit', sans-serif;
  overscroll-behavior: none;
}

::-webkit-scrollbar { width: 3px; height: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-2); border-radius: 99px; }

/* Pills scroll */
.pills-scroll {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 12px 10px;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.pills-scroll::-webkit-scrollbar { display: none; }

/* Pop animation */
@keyframes pop {
  0%   { transform: scale(1); }
  35%  { transform: scale(0.82); }
  65%  { transform: scale(1.08); }
  100% { transform: scale(1); }
}
.card-pop { animation: pop 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards; }

/* Bottom sheet */
@keyframes sheet-up {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.sheet-enter    { animation: sheet-up    0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
.backdrop-enter { animation: backdrop-in 0.2s ease forwards; }

/* Progress bar pulse */
@keyframes glow-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.85; }
}
.progress-glow { animation: glow-pulse 2.4s ease-in-out infinite; }

/* Loading bar */
@keyframes loading-bar {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--border) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

/* StickerCard flash animations */
@keyframes flash-green {
  0%, 100% { background: transparent; }
  30%       { background: var(--green-glow); }
}
@keyframes flash-gold {
  0%, 100% { background: transparent; }
  30%       { background: var(--gold-glow); }
}
@keyframes flash-red {
  0%, 100% { background: transparent; }
  30%       { background: rgba(220, 38, 38, 0.08); }
}
.sticker-flash-green { animation: flash-green 0.4s ease; }
.sticker-flash-gold  { animation: flash-gold  0.4s ease; }
.sticker-flash-red   { animation: flash-red   0.3s ease; }

/* Team complete badge */
@keyframes badge-appear {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
.team-complete-badge { animation: badge-appear 0.3s ease forwards; }

/* Toast slide-in */
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(12px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```

- [ ] **Step 3: Verify dev server starts without CSS errors**

```bash
npm run dev
```

Expected: server starts on :3000, no CSS parse errors in terminal.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css package.json package-lock.json
git commit -m "feat: design system tokens, flash/badge/toast animations, canvas-confetti"
```

---

## Task 2: New hooks — useCountUp and useToast

**Files:**
- Create: `hooks/useCountUp.ts`
- Create: `hooks/useToast.ts`

- [ ] **Step 1: Create `hooks/useCountUp.ts`**

```ts
import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 600) {
  const [displayed, setDisplayed] = useState(target)
  const prevRef = useRef(target)

  useEffect(() => {
    const from = prevRef.current
    if (from === target) return

    let cancelled = false
    const startTime = performance.now()

    function tick(now: number) {
      if (cancelled) return
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      setDisplayed(Math.round(from + (target - from) * progress))
      if (progress < 1) requestAnimationFrame(tick)
      else prevRef.current = target
    }

    requestAnimationFrame(tick)
    return () => {
      cancelled = true
      prevRef.current = target
    }
  }, [target, duration])

  return displayed
}
```

- [ ] **Step 2: Create `hooks/useToast.ts`**

```ts
import { useCallback, useRef, useState } from 'react'

export type ToastVariant = 'info' | 'success' | 'error'

export type ToastState = {
  message: string
  variant: ToastVariant
  id: number
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const counterRef = useRef(0)

  const show = useCallback((message: string, variant: ToastVariant = 'info', duration = 2000) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    counterRef.current++
    setToast({ message, variant, id: counterRef.current })
    timerRef.current = setTimeout(() => setToast(null), duration)
  }, [])

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  return { toast, show, hide }
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useCountUp.ts hooks/useToast.ts
git commit -m "feat: useCountUp and useToast hooks"
```

---

## Task 3: New components — Toast, EmptyState, QuickActionOverlay

**Files:**
- Create: `components/Toast.tsx`
- Create: `components/EmptyState.tsx`
- Create: `components/QuickActionOverlay.tsx`

- [ ] **Step 1: Create `components/Toast.tsx`**

```tsx
'use client'
import type { ToastState } from '@/hooks/useToast'

const BG: Record<string, string> = {
  info:    'var(--surface-elevated)',
  success: 'var(--green-dim)',
  error:   'rgba(220,38,38,0.10)',
}
const COLOR: Record<string, string> = {
  info:    'var(--text)',
  success: 'var(--green-mid)',
  error:   '#dc2626',
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
    <div
      key={toast.id}
      style={{
        position: 'fixed',
        bottom: 88,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: BG[toast.variant] ?? BG.info,
        color: COLOR[toast.variant] ?? COLOR.info,
        padding: '10px 20px',
        borderRadius: 24,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        whiteSpace: 'nowrap',
        animation: 'toast-in 0.2s ease forwards',
        border: '1px solid var(--border)',
        pointerEvents: 'none',
      }}
    >
      {toast.message}
    </div>
  )
}
```

- [ ] **Step 2: Create `components/EmptyState.tsx`**

```tsx
'use client'

type Props = {
  icon: string
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 32px', gap: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, opacity: 0.35, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 280 }}>
        {subtitle}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: '10px 20px', borderRadius: 24,
            background: 'var(--green)', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(22,163,74,0.28)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/QuickActionOverlay.tsx`**

```tsx
'use client'
import { useEffect } from 'react'

type Props = {
  onAddRepeat: () => void
  onRemove: () => void
  onClose: () => void
}

export function QuickActionOverlay({ onAddRepeat, onRemove, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 2000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 5,
        borderRadius: 8,
        background: 'var(--surface)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: 3,
      }}
    >
      <button
        onClick={onAddRepeat}
        style={{
          flex: 1, borderRadius: 5, border: 'none',
          background: 'var(--gold-dim)', color: 'var(--gold-mid)',
          fontSize: 9, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
        }}
      >
        +1
      </button>
      <button
        onClick={onRemove}
        style={{
          flex: 1, borderRadius: 5, border: 'none',
          background: 'rgba(220,38,38,0.07)', color: '#dc2626',
          fontSize: 9, fontWeight: 700, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/Toast.tsx components/EmptyState.tsx components/QuickActionOverlay.tsx
git commit -m "feat: Toast, EmptyState, QuickActionOverlay components"
```

---

## Task 4: ProgressPanel — animated count-up + overshoot bar

**Files:**
- Modify: `components/ProgressPanel.tsx`

- [ ] **Step 1: Replace `components/ProgressPanel.tsx`**

```tsx
'use client'
import { trpc } from '@/lib/trpc'
import { useCountUp } from '@/hooks/useCountUp'

type Props = { albumId: string }

export function ProgressPanel({ albumId }: Props) {
  const { data } = trpc.stickers.getProgress.useQuery({ albumId })

  const obtained = data?.obtained ?? 0
  const repeated = data?.repeated ?? 0
  const total = data?.total ?? 1033
  const filled = obtained + repeated
  const pct = Math.round((filled / total) * 100)
  const missing = data?.missing ?? total

  const displayedFilled = useCountUp(filled)
  const displayedObtained = useCountUp(obtained)
  const displayedRepeated = useCountUp(repeated)
  const displayedMissing = useCountUp(missing)

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 38, lineHeight: 1, color: 'var(--text)', letterSpacing: '0.01em',
          }}>{displayedFilled}</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500, paddingBottom: 2 }}>
            / {total}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1,
            color: pct > 0 ? 'var(--green)' : 'var(--text-dim)',
          }}>{pct}%</span>
          <span style={{
            fontSize: 10, color: 'var(--text-dim)', fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>completo</span>
        </div>
      </div>

      <div style={{
        height: 8, background: 'var(--surface-2)', borderRadius: 99,
        overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <div
          className={pct > 0 ? 'progress-glow' : ''}
          style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #22c55e 0%, #15803d 100%)',
            borderRadius: 99,
            transition: 'width 0.6s cubic-bezier(0.34, 1.2, 0.64, 1)',
            minWidth: pct > 0 ? 8 : 0,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Chip value={displayedMissing} label="faltando" bg="var(--surface-2)" border="var(--border)" valueColor="var(--text)" />
        <Chip value={displayedObtained} label="obtidas" bg="#dcfce7" border="#bbf7d0" valueColor="var(--green-mid, #15803d)" />
        {repeated > 0 && (
          <Chip value={displayedRepeated} label="repetidas" bg="#fef3c7" border="#fde68a" valueColor="var(--gold-mid, #b45309)" />
        )}
      </div>
    </div>
  )
}

function Chip({ value, label, bg, border, valueColor }: {
  value: number; label: string; bg: string; border: string; valueColor: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '4px 10px',
    }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, lineHeight: 1, color: valueColor }}>
        {value}
      </span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ProgressPanel.tsx
git commit -m "feat: ProgressPanel — animated count-up and overshoot progress bar"
```

---

## Task 5: ActionSheet — 80ms close delay + primary button polish

**Files:**
- Modify: `components/ActionSheet.tsx`

The only changes are:
1. `onClose()` in `onMutate` becomes `setTimeout(onClose, 80)` 
2. Primary action buttons get `minHeight: 48px` (already at `height: 54px` so 48 is already satisfied — no change needed there; but confirm and add `boxShadow: 'none'` on `disabled`)

- [ ] **Step 1: In `components/ActionSheet.tsx`, change the `onMutate` callback**

Find:
```ts
onMutate: async ({ albumId, stickerId, status, quantity }) => {
  onClose()
```

Replace with:
```ts
onMutate: async ({ albumId, stickerId, status, quantity }) => {
  setTimeout(onClose, 80)
```

- [ ] **Step 2: Update primary button box-shadow to `none` when disabled/pending**

Find the first primary button (the green "Adicionar" button):
```tsx
style={{
  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
  background: 'linear-gradient(150deg,#22c55e,#15803d)',
  color: '#fff', border: 'none', cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(21,128,61,0.3)',
  opacity: update.isPending ? 0.6 : 1,
}}
```

Replace with:
```tsx
style={{
  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
  background: 'linear-gradient(150deg,#22c55e,#15803d)',
  color: '#fff', border: 'none', cursor: 'pointer',
  boxShadow: update.isPending ? 'none' : '0 4px 12px rgba(22,163,74,0.28)',
  opacity: update.isPending ? 0.6 : 1,
  transition: 'box-shadow 0.15s ease',
}}
```

Find the gold "Marcar X cópias" button:
```tsx
style={{
  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
  background: 'linear-gradient(150deg,#f59e0b,#b45309)',
  color: '#fff', border: 'none', cursor: 'pointer',
  boxShadow: '0 2px 10px rgba(180,83,9,0.25)',
  opacity: update.isPending ? 0.6 : 1,
}}
```

Replace with:
```tsx
style={{
  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
  background: 'linear-gradient(150deg,#f59e0b,#b45309)',
  color: '#fff', border: 'none', cursor: 'pointer',
  boxShadow: update.isPending ? 'none' : '0 4px 12px rgba(180,83,9,0.25)',
  opacity: update.isPending ? 0.6 : 1,
  transition: 'box-shadow 0.15s ease',
}}
```

- [ ] **Step 3: Commit**

```bash
git add components/ActionSheet.tsx
git commit -m "feat: ActionSheet — 80ms close delay, button shadow polish"
```

---

## Task 6: StickerCard — flash animation + quick-add + long-press

**Files:**
- Modify: `components/StickerCard.tsx`

- [ ] **Step 1: Replace `components/StickerCard.tsx`**

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QuickActionOverlay } from './QuickActionOverlay'

type Status = 'missing' | 'obtained' | 'repeated'
export type QuickActionType = 'toObtained' | 'addRepeat' | 'remove' | 'openSheet'

type Props = {
  id: string
  number: string
  status: Status
  quantity: number
  onAction: (id: string) => void
  quickMode?: boolean
  onQuickAction?: (id: string, action: QuickActionType) => void
}

const CARD_STYLES: Record<Status, React.CSSProperties> = {
  missing: {
    background: '#f0f5f0',
    border: '1.5px dashed #c2d6c2',
  },
  obtained: {
    background: 'linear-gradient(150deg, #22c55e 0%, #15803d 100%)',
    border: '1.5px solid #15803d',
    boxShadow: '0 2px 6px rgba(21,128,61,0.30), inset 0 1px 0 rgba(255,255,255,0.18)',
  },
  repeated: {
    background: 'linear-gradient(150deg, #f59e0b 0%, #b45309 100%)',
    border: '1.5px solid #b45309',
    boxShadow: '0 2px 6px rgba(180,83,9,0.28), inset 0 1px 0 rgba(255,255,255,0.18)',
  },
}

const NUM_COLOR: Record<Status, string> = {
  missing:  '#0a0f0a',
  obtained: '#ffffff',
  repeated: '#2d1000',
}

export function StickerCard({ id, number, status, quantity, onAction, quickMode, onQuickAction }: Props) {
  const label = number === '00' ? '★' : number
  const [flashClass, setFlashClass] = useState('')
  const [showOverlay, setShowOverlay] = useState(false)
  const prevStatusRef = useRef(status)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  useEffect(() => {
    if (prevStatusRef.current === status) return
    const cls =
      status === 'obtained' ? 'sticker-flash-green' :
      status === 'repeated' ? 'sticker-flash-gold' :
      status === 'missing'  ? 'sticker-flash-red' : ''
    prevStatusRef.current = status
    if (!cls) return
    setFlashClass(cls)
    const t = setTimeout(() => setFlashClass(''), 450)
    return () => clearTimeout(t)
  }, [status])

  const handleTap = useCallback(() => {
    if (quickMode && onQuickAction) {
      if (status === 'missing') {
        onQuickAction(id, 'toObtained')
      } else if (status === 'obtained') {
        setShowOverlay(true)
      } else {
        onQuickAction(id, 'addRepeat')
      }
    } else {
      onAction(id)
    }
  }, [id, status, quickMode, onAction, onQuickAction])

  function handlePointerDown(e: React.PointerEvent) {
    if (!quickMode) return
    e.currentTarget.setPointerCapture(e.pointerId)
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      longPressTimer.current = null
      onAction(id)
    }, 500)
  }

  function handlePointerUp() {
    if (!quickMode) return
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
      if (!didLongPress.current) handleTap()
    }
  }

  function handlePointerLeave() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  return (
    <div
      id={`card-${id}`}
      onClick={quickMode ? undefined : handleTap}
      onPointerDown={quickMode ? handlePointerDown : undefined}
      onPointerUp={quickMode ? handlePointerUp : undefined}
      onPointerLeave={quickMode ? handlePointerLeave : undefined}
      className={flashClass}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        cursor: 'pointer',
        userSelect: 'none',
        aspectRatio: '1',
        WebkitTapHighlightColor: 'transparent',
        transition: 'transform 0.1s ease',
        ...CARD_STYLES[status],
      }}
    >
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 'clamp(9px, 2.8vw, 14px)',
        lineHeight: 1,
        color: NUM_COLOR[status],
        letterSpacing: '0.01em',
      }}>
        {label}
      </span>

      {status === 'obtained' && (
        <span style={{
          position: 'absolute', top: 2, right: 3,
          fontSize: 7, lineHeight: 1, color: 'rgba(255,255,255,0.7)',
        }}>✓</span>
      )}

      {status === 'repeated' && (
        <span style={{
          position: 'absolute', top: 1, right: 2,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 8, fontWeight: 700, lineHeight: 1,
          color: 'rgba(255,255,255,0.85)',
        }}>{quantity}×</span>
      )}

      {showOverlay && quickMode && onQuickAction && (
        <QuickActionOverlay
          onAddRepeat={() => { setShowOverlay(false); onQuickAction(id, 'addRepeat') }}
          onRemove={() => { setShowOverlay(false); onQuickAction(id, 'remove') }}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StickerCard.tsx
git commit -m "feat: StickerCard — status flash animation, quick-add long-press support"
```

---

## Task 7: StickerGrid — team completion states + status filter

**Files:**
- Modify: `components/StickerGrid.tsx`

New props to add: `quickMode`, `onQuickAction`, `statusFilter`.

- [ ] **Step 1: Replace `components/StickerGrid.tsx`**

```tsx
'use client'
import { StickerCard, type QuickActionType } from './StickerCard'
import type { StickerDef } from '@/lib/sticker-data'
import { SECTIONS } from '@/lib/sticker-data'

type StickerWithStatus = StickerDef & {
  status: 'missing' | 'obtained' | 'repeated'
  quantity: number
}

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

type Props = {
  stickers: StickerWithStatus[]
  activeSection: string
  search: string
  onAction: (id: string) => void
  quickMode?: boolean
  onQuickAction?: (id: string, action: QuickActionType) => void
  statusFilter?: StatusFilter
}

export function StickerGrid({ stickers, activeSection, search, onAction, quickMode, onQuickAction, statusFilter = 'all' }: Props) {
  const filtered = stickers.filter((s) => {
    const matchSection = activeSection === 'all' || s.section === activeSection
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.countryName.toLowerCase().includes(q) ||
      s.number.includes(q)
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchSection && matchSearch && matchStatus
  })

  const sections =
    activeSection === 'all'
      ? SECTIONS
      : SECTIONS.filter((sec) => sec.id === activeSection)

  return (
    <div style={{ paddingBottom: 32 }}>
      {sections.map((sec) => {
        const secStickers = filtered.filter((s) => s.section === sec.id)
        if (secStickers.length === 0) return null

        const teams =
          sec.id === 'FWC' || sec.id === 'CC'
            ? [{ code: sec.id, name: sec.label }]
            : sec.teams

        return (
          <div key={sec.id} style={{ marginBottom: 24 }}>
            {/* Section header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px 8px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--bg)',
            }}>
              <div style={{
                width: 3, height: 18,
                borderRadius: 99,
                background: 'var(--green)',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18,
                letterSpacing: '0.08em',
                color: 'var(--text)',
                lineHeight: 1,
              }}>
                {sec.label}
              </span>
              <div style={{
                flex: 1, height: 1,
                background: 'var(--border)',
                marginLeft: 4,
              }} />
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-dim)',
              }}>
                {secStickers.filter(s => s.status !== 'missing').length}/{secStickers.length}
              </span>
            </div>

            {teams.map((team) => {
              const teamStickers = secStickers.filter((s) => s.countryCode === team.code)
              if (teamStickers.length === 0) return null

              const obtained = teamStickers.filter((s) => s.status !== 'missing').length
              const pct = Math.round((obtained / teamStickers.length) * 100)
              const isComplete = pct === 100
              const isEmpty = pct === 0

              return (
                <div key={team.code} style={{
                  padding: '0 12px', marginBottom: 14,
                  opacity: isEmpty ? 0.5 : 1,
                  transition: 'opacity 0.3s ease',
                }}>
                  {/* Team header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    background: isComplete ? 'var(--gold-glow)' : 'transparent',
                    borderBottom: isComplete ? '1px solid rgba(180,83,9,0.4)' : 'none',
                    borderRadius: isComplete ? 6 : 0,
                    padding: isComplete ? '4px 6px' : '0',
                    margin: isComplete ? '0 -6px 6px' : '0 0 6px',
                  }}>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: isComplete ? 'var(--surface)' : 'var(--green)',
                      background: isComplete ? 'var(--green)' : 'var(--green-dim)',
                      padding: '2px 7px',
                      borderRadius: 5,
                      lineHeight: '18px',
                    }}>
                      {team.code}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: isComplete ? 'var(--gold-mid)' : 'var(--text-muted)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isComplete ? 600 : 500,
                    }}>
                      {team.name}
                    </span>
                    {isComplete && (
                      <span
                        className="team-complete-badge"
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--gold-mid)',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                        }}
                      >
                        ✦ Completo
                      </span>
                    )}
                    {!isComplete && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-dim)',
                        flexShrink: 0,
                      }}>
                        {obtained}/{teamStickers.length}
                      </span>
                    )}
                  </div>

                  {/* Mini progress bar */}
                  <div style={{
                    height: 3,
                    background: 'var(--border)',
                    borderRadius: 99,
                    marginBottom: 7,
                    overflow: 'hidden',
                  }}>
                    <div
                      className={pct >= 80 ? 'progress-glow' : ''}
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isComplete
                          ? 'linear-gradient(90deg, #22c55e, #15803d)'
                          : 'linear-gradient(90deg, #86efac, #22c55e)',
                        borderRadius: 99,
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>

                  {/* Card grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                  }}>
                    {teamStickers.map((s) => (
                      <StickerCard
                        key={s.id}
                        id={s.id}
                        number={s.number}
                        status={s.status}
                        quantity={s.quantity}
                        onAction={onAction}
                        quickMode={quickMode}
                        onQuickAction={onQuickAction}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/StickerGrid.tsx
git commit -m "feat: StickerGrid — team completion states, status filter, quick-add prop passthrough"
```

---

## Task 8: FilterBar — quick-add toggle + status filter pills

**Files:**
- Modify: `components/FilterBar.tsx`

New props: `quickMode`, `onQuickModeChange`, `statusFilter`, `onStatusFilterChange`, `repeatedCount`, `showToast`.

- [ ] **Step 1: Replace `components/FilterBar.tsx`**

```tsx
'use client'
import { useRef } from 'react'
import { SECTIONS } from '@/lib/sticker-data'
import type { ToastVariant } from '@/hooks/useToast'

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

type Props = {
  activeSection: string
  search: string
  onSectionChange: (s: string) => void
  onSearchChange: (s: string) => void
  quickMode: boolean
  onQuickModeChange: (v: boolean) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (v: StatusFilter) => void
  repeatedCount: number
  showToast: (msg: string, variant?: ToastVariant) => void
}

export function FilterBar({
  activeSection, search, onSectionChange, onSearchChange,
  quickMode, onQuickModeChange,
  statusFilter, onStatusFilterChange,
  repeatedCount, showToast,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function selectSection(id: string) {
    onSectionChange(id)
    setTimeout(() => {
      const el = document.getElementById(`pill-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }, 50)
  }

  function toggleQuickMode() {
    const next = !quickMode
    onQuickModeChange(next)
    localStorage.setItem('copa_quick_mode', next ? '1' : '0')
    showToast(
      next ? 'Modo rápido ativado — toque para marcar' : 'Modo rápido desativado',
      next ? 'success' : 'info',
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <style>{`.pills-ref::-webkit-scrollbar{display:none}`}</style>

      {/* Search row */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="15" height="15" viewBox="0 0 15 15" fill="none"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--text-dim)" strokeWidth="1.5" />
            <path d="M10 10L13 13" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar figurinha..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              paddingLeft: 32,
              paddingRight: search ? 36 : 12,
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'Outfit, sans-serif',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--green)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--border-2)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'var(--text-muted)',
              }}
            >✕</button>
          )}
        </div>

        {/* Quick-add toggle */}
        <button
          onClick={toggleQuickMode}
          title={quickMode ? 'Desativar modo rápido' : 'Ativar modo rápido'}
          style={{
            flexShrink: 0,
            width: 38, height: 38,
            borderRadius: 10,
            border: quickMode ? '1.5px solid var(--green-mid)' : '1.5px solid var(--border)',
            background: quickMode ? 'var(--green)' : 'var(--surface-2)',
            color: quickMode ? '#ffffff' : 'var(--text-muted)',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          ⚡
        </button>
      </div>

      {/* Section pills */}
      <div
        ref={scrollRef}
        className="pills-ref"
        style={{
          display: 'flex',
          gap: 5,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0 12px 8px',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        <Pill id="all" label="Todos" active={activeSection === 'all'} onClick={() => selectSection('all')} />
        {SECTIONS.map((sec) => {
          const label = sec.id === 'FWC' ? 'FWC' : sec.id === 'CC' ? 'Cola' : sec.id
          return (
            <Pill
              key={sec.id}
              id={sec.id}
              label={label}
              active={activeSection === sec.id}
              onClick={() => selectSection(sec.id)}
            />
          )
        })}
      </div>

      {/* Status filter pills */}
      <div style={{
        display: 'flex',
        gap: 5,
        padding: '0 12px 10px',
      }}>
        {(['all', 'missing', 'obtained', 'repeated'] as const).map((f) => {
          const labelMap: Record<StatusFilter, string> = {
            all: 'Todas',
            missing: 'Faltando',
            obtained: 'Obtidas',
            repeated: repeatedCount > 0 ? `Repetidas (${repeatedCount})` : 'Repetidas',
          }
          return (
            <StatusPill
              key={f}
              label={labelMap[f]}
              active={statusFilter === f}
              onClick={() => onStatusFilterChange(f)}
            />
          )
        })}
      </div>
    </div>
  )
}

function Pill({ id, label, active, onClick }: {
  id: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      id={`pill-${id}`}
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 30,
        padding: '0 13px',
        borderRadius: 99,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
        letterSpacing: active ? '0.06em' : 'normal',
        background: active ? 'var(--green)' : 'var(--surface-2)',
        color: active ? '#ffffff' : 'var(--text-muted)',
        border: active ? '1.5px solid var(--green-mid, #15803d)' : '1.5px solid var(--border)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        boxShadow: active ? '0 2px 8px rgba(21,128,61,0.25)' : 'none',
      } as React.CSSProperties}
    >
      {label}
    </button>
  )
}

function StatusPill({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 26,
        padding: '0 10px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        border: active ? '1.5px solid var(--border-2)' : '1.5px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/FilterBar.tsx
git commit -m "feat: FilterBar — quick-add toggle, status filter pills"
```

---

## Task 9: AlbumApp — confetti + quick mutations + wire all new props

**Files:**
- Modify: `components/AlbumApp.tsx`

Changes:
1. Add `quickMode` state (from localStorage)
2. Add `statusFilter` state
3. Add `quickUpdate` tRPC mutation (optimistic, mirrors ActionSheet)
4. Add `handleQuickAction` callback
5. Import and use `useToast` + `Toast`
6. Import `canvas-confetti`, add progress watcher, fire on 50% and 100% milestones
7. Pass new props to `FilterBar` and `StickerGrid`

- [ ] **Step 1: Replace `components/AlbumApp.tsx`**

```tsx
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import confetti from 'canvas-confetti'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { useToast } from '@/hooks/useToast'
import { StickerGrid } from './StickerGrid'
import type { QuickActionType } from './StickerCard'
import { ProgressPanel } from './ProgressPanel'
import { FilterBar } from './FilterBar'
import { ActionSheet } from './ActionSheet'
import { LoginScreen } from './LoginScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { TabBar, type Tab } from './TabBar'
import { RepeatedView } from './RepeatedView'
import { TradeView } from './TradeView'
import { ProfileView } from './ProfileView'
import { StickerGridSkeleton } from './StickerGridSkeleton'
import { AlbumSelectionScreen } from './AlbumSelectionScreen'
import { AlbumMembersSheet } from './AlbumMembersSheet'
import { SetPasswordScreen } from './SetPasswordScreen'
import { Toast } from './Toast'

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 48, letterSpacing: '0.05em', color: 'var(--green)', lineHeight: 1,
      }}>COPA 2026</div>
      <div style={{ width: 120, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%', background: 'var(--green)',
          borderRadius: 99, animation: 'loading-bar 1.2s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#16a34a', '#d97706', '#ffffff'],
  })
}

export function AlbumApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [activeSection, setActiveSection] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('album')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [quickMode, setQuickMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('copa_quick_mode') === '1'
  })
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('copa_active_album_id')
  })
  const [showMembers, setShowMembers] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)

  const { toast, show: showToast } = useToast()
  const celebratedRef = useRef<Set<string>>(new Set())
  const prevAlbumIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Reset confetti milestones when switching albums
  useEffect(() => {
    if (activeAlbumId !== prevAlbumIdRef.current) {
      celebratedRef.current = new Set()
      prevAlbumIdRef.current = activeAlbumId
    }
  }, [activeAlbumId])

  const profile = trpc.profile.get.useQuery(undefined, { enabled: !!session })

  const albums = trpc.albums.list.useQuery(undefined, {
    enabled: !!session && !!profile.data,
  })

  const activeAlbum = albums.data?.find((a) => a.id === activeAlbumId) ?? null

  const { data: stickers = [], isLoading } = trpc.stickers.list.useQuery(
    { albumId: activeAlbumId! },
    { enabled: !!session && !!profile.data && !!activeAlbum },
  )
  const utils = trpc.useUtils()

  // Watch progress for confetti milestones
  const { data: progress } = trpc.stickers.getProgress.useQuery(
    { albumId: activeAlbumId! },
    { enabled: !!session && !!profile.data && !!activeAlbum },
  )
  useEffect(() => {
    if (!progress || !activeAlbumId) return
    const total = progress.total ?? 1033
    const filled = (progress.obtained ?? 0) + (progress.repeated ?? 0)
    const ratio = filled / total
    if (ratio >= 0.5 && !celebratedRef.current.has('50')) {
      celebratedRef.current.add('50')
      fireConfetti()
    }
    if (ratio >= 1 && !celebratedRef.current.has('100')) {
      celebratedRef.current.add('100')
      fireConfetti()
    }
  }, [progress, activeAlbumId])

  const { data: proposals = [] } = trpc.trades.listProposals.useQuery(undefined, {
    enabled: !!session && !!profile.data && !!activeAlbum,
  })
  const pendingTradesCount = proposals.filter(
    (p) => p.direction === 'incoming' && p.status === 'pending',
  ).length

  const convertToShared = trpc.albums.convertToShared.useMutation({
    onSuccess: () => {
      utils.albums.list.invalidate()
      setShowMembers(true)
    },
  })

  // Quick-add mutation (mirrors ActionSheet without the close call)
  const quickUpdate = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ albumId, stickerId, status, quantity }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          const newQty =
            status === 'repeated' ? (quantity ?? 2)
            : status === 'obtained' ? 1
            : 0
          return { ...s, status, quantity: newQty }
        }),
      )
      return { prev }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData({ albumId: vars.albumId }, ctx.prev)
    },
    onSettled: (_data, _err, vars) => {
      utils.stickers.list.invalidate({ albumId: vars.albumId })
      utils.stickers.getProgress.invalidate({ albumId: vars.albumId })
      utils.stickers.listDuplicates.invalidate({ albumId: vars.albumId })
    },
  })

  const handleQuickAction = useCallback((id: string, action: QuickActionType) => {
    if (!activeAlbumId) return
    if (action === 'openSheet') {
      setSelectedId(id)
      return
    }
    const sticker = stickers.find(s => s.id === id)
    if (!sticker) return
    if (action === 'toObtained') {
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'obtained' })
    } else if (action === 'addRepeat') {
      const newQty = (sticker.quantity ?? 1) + 1
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'repeated', quantity: newQty })
    } else if (action === 'remove') {
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'missing' })
    }
  }, [activeAlbumId, stickers, quickUpdate])

  useEffect(() => {
    if (!session || !activeAlbumId) return
    const channel = supabaseBrowser
      .channel(`album_stickers_${activeAlbumId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'album_stickers',
        filter: `album_id=eq.${activeAlbumId}`,
      }, () => {
        utils.stickers.list.invalidate({ albumId: activeAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: activeAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: activeAlbumId })
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [utils, session, activeAlbumId])

  const handleAction = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  function selectAlbum(albumId: string) {
    localStorage.setItem('copa_active_album_id', albumId)
    setActiveAlbumId(albumId)
  }

  function clearAlbum() {
    localStorage.removeItem('copa_active_album_id')
    setActiveAlbumId(null)
  }

  if (session === undefined) return <LoadingSpinner />
  if (isRecovery) return <SetPasswordScreen onDone={() => setIsRecovery(false)} />
  if (!session) return <LoginScreen />
  if (profile.isLoading) return <LoadingSpinner />
  if (profile.data === null || profile.data === undefined) {
    if (profile.data === null) return <OnboardingScreen onComplete={() => profile.refetch()} />
    return <LoadingSpinner />
  }

  const username = profile.data.username

  if (albums.isLoading) return <LoadingSpinner />

  if (!activeAlbum) {
    return (
      <AlbumSelectionScreen
        albums={albums.data ?? []}
        username={username}
        onSelect={selectAlbum}
        onRefetch={() => albums.refetch()}
      />
    )
  }

  const repeatedCount = stickers.filter(s => s.status === 'repeated').length

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--green)',
        }}>
          <button
            onClick={clearAlbum}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, borderRadius: 8, minWidth: 32,
            }}
            title="Voltar aos álbuns"
          >
            ←
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              COPA 2026
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1 }}>
              {activeAlbum.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'flex-end' }}>
            {activeAlbum.type === 'shared' ? (
              <button
                onClick={() => setShowMembers(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px', borderRadius: 8,
                }}
              >
                👥 {activeAlbum.memberCount}
              </button>
            ) : activeAlbum.role === 'owner' ? (
              <button
                onClick={() => convertToShared.mutate({ albumId: activeAlbumId! })}
                disabled={convertToShared.isPending}
                title="Compartilhar álbum"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: convertToShared.isPending ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, padding: '4px 6px', borderRadius: 8,
                  opacity: convertToShared.isPending ? 0.5 : 1,
                }}
              >
                🔗
              </button>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
        </div>

        <TabBar activeTab={activeTab} onChange={setActiveTab} pendingTradesCount={pendingTradesCount} />

        {activeTab === 'album' && (
          <>
            <ProgressPanel albumId={activeAlbumId!} />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
              quickMode={quickMode}
              onQuickModeChange={setQuickMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              repeatedCount={repeatedCount}
              showToast={showToast}
            />
          </>
        )}
      </div>

      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          isLoading
            ? <StickerGridSkeleton />
            : <StickerGrid
                stickers={stickers}
                activeSection={activeSection}
                search={search}
                onAction={handleAction}
                quickMode={quickMode}
                onQuickAction={handleQuickAction}
                statusFilter={statusFilter}
              />
        ) : activeTab === 'repeated' ? (
          <RepeatedView albumId={activeAlbumId!} username={username} />
        ) : activeTab === 'trades' ? (
          <TradeView
            albumId={activeAlbumId!}
            userId={session!.user.id}
            marketplaceVisible={activeAlbum.marketplaceVisible}
          />
        ) : (
          <ProfileView
            username={username}
            onUsernameChange={() => profile.refetch()}
          />
        )}
      </div>

      {selectedId && (
        <ActionSheet
          albumId={activeAlbumId!}
          stickerId={selectedId}
          status={stickers.find(s => s.id === selectedId)?.status ?? 'missing'}
          quantity={stickers.find(s => s.id === selectedId)?.quantity ?? 0}
          onClose={handleClose}
        />
      )}
      {showMembers && activeAlbum.type === 'shared' && activeAlbum.inviteCode && (
        <AlbumMembersSheet
          albumId={activeAlbumId!}
          albumName={activeAlbum.name}
          inviteCode={activeAlbum.inviteCode}
          isOwner={activeAlbum.role === 'owner'}
          currentUserId=""
          onClose={() => setShowMembers(false)}
          onAlbumLeft={clearAlbum}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no TypeScript errors. If there are errors, fix them before committing.

- [ ] **Step 3: Commit**

```bash
git add components/AlbumApp.tsx
git commit -m "feat: AlbumApp — confetti milestones, quick-add mutations, Toast, FilterBar wiring"
```

---

## Task 10: Empty states — replace inline states with EmptyState component

**Files:**
- Modify: `components/RepeatedView.tsx`
- Modify: `components/MarketplaceTab.tsx`
- Modify: `components/TradeView.tsx`
- Modify: `components/ProposalsTab.tsx`
- Modify: `components/ProfileView.tsx`

- [ ] **Step 1: Update `components/RepeatedView.tsx` empty state**

Find and replace the existing empty state (around line 39–47):

```tsx
// REMOVE:
if (repeated.length === 0) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px', gap: 8, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, opacity: 0.4 }}>✓</div>
      <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Nenhuma figurinha repetida</div>
    </div>
  )
}
```

```tsx
// ADD at top of file (with other imports):
import { EmptyState } from './EmptyState'

// REPLACE with:
if (repeated.length === 0) {
  return (
    <EmptyState
      icon="📦"
      title="Tudo único por aqui"
      subtitle="Quando você tiver figurinhas repetidas, elas aparecem aqui para trocar."
    />
  )
}
```

- [ ] **Step 2: Update `components/MarketplaceTab.tsx` — add `onActivateMarketplace` prop + EmptyState**

Full new file:

```tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { TradeProposalSheet } from './TradeProposalSheet'
import { EmptyState } from './EmptyState'

type MarketplaceEntry = {
  stickerId: string
  countryName: string
  section: string
  userId: string
  username: string
  albumId: string
}

type Props = {
  albumId: string
  userId: string
  onActivateMarketplace?: () => void
}

export function MarketplaceTab({ albumId, userId: _userId, onActivateMarketplace }: Props) {
  const { data, isLoading } = trpc.trades.getMarketplace.useQuery()
  const [proposalTarget, setProposalTarget] = useState<MarketplaceEntry | null>(null)
  const [activeBoard, setActiveBoard] = useState<'offering' | 'wanting'>('offering')

  if (isLoading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Carregando marketplace…
      </div>
    )
  }

  const offering = data?.offering ?? []
  const wanting = data?.wanting ?? []
  const isEmpty = offering.length === 0 && wanting.length === 0

  if (isEmpty) {
    return (
      <EmptyState
        icon="🌐"
        title="Ninguém no mercado ainda"
        subtitle="Ative sua visibilidade e convide amigos para começar a trocar."
        action={onActivateMarketplace ? { label: 'Ativar agora →', onClick: onActivateMarketplace } : undefined}
      />
    )
  }

  const items = activeBoard === 'offering' ? offering : wanting

  return (
    <>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['offering', 'wanting'] as const).map((board) => {
          const active = activeBoard === board
          const count = board === 'offering' ? offering.length : wanting.length
          return (
            <button
              key={board}
              onClick={() => setActiveBoard(board)}
              style={{
                flex: 1, height: 36, border: 'none',
                borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {board === 'offering' ? `OFEREÇO (${count})` : `PRECISO (${count})`}
            </button>
          )
        })}
      </div>

      <div style={{ paddingBottom: 80 }}>
        {items.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {activeBoard === 'wanting'
              ? 'Nenhuma figurinha sua aparece como faltando em outros álbuns'
              : 'Nenhuma figurinha disponível para troca'}
          </div>
        ) : (
          items.map((entry, i) => (
            <div
              key={`${entry.albumId}-${entry.stickerId}-${i}`}
              onClick={() => activeBoard === 'offering' ? setProposalTarget(entry) : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                cursor: activeBoard === 'offering' ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.04em',
                  color: activeBoard === 'offering' ? 'var(--gold)' : 'var(--text-muted)', minWidth: 60,
                }}>
                  {entry.stickerId}
                </span>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {entry.countryName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{entry.username}</div>
                </div>
              </div>
              {activeBoard === 'offering' && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Propor →</span>
              )}
            </div>
          ))
        )}
      </div>

      {proposalTarget && (
        <TradeProposalSheet
          albumId={albumId}
          wantedSticker={proposalTarget.stickerId}
          wantedStickerName={proposalTarget.countryName}
          receiverId={proposalTarget.userId}
          receiverAlbumId={proposalTarget.albumId}
          receiverUsername={proposalTarget.username}
          onClose={() => setProposalTarget(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Update `components/TradeView.tsx` — pass onActivateMarketplace to MarketplaceTab**

Find:
```tsx
{subTab === 'marketplace'
  ? <MarketplaceTab albumId={albumId} userId={userId} />
  : <ProposalsTab proposals={proposals} />
}
```

Replace with:
```tsx
{subTab === 'marketplace'
  ? <MarketplaceTab
      albumId={albumId}
      userId={userId}
      onActivateMarketplace={
        !marketplaceVisible
          ? () => setVisibility.mutate({ albumId, visible: true })
          : undefined
      }
    />
  : <ProposalsTab proposals={proposals} />
}
```

- [ ] **Step 4: Update `components/ProposalsTab.tsx` empty state**

Add import at top:
```tsx
import { EmptyState } from './EmptyState'
```

Find and replace the empty state block (around line 44–53):

```tsx
// REMOVE:
if (proposals.length === 0) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 24px', gap: 8, textAlign: 'center',
    }}>
      <div style={{ fontSize: 36, opacity: 0.4 }}>📬</div>
      <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Nenhuma proposta ainda</div>
    </div>
  )
}
```

```tsx
// REPLACE with:
if (proposals.length === 0) {
  return (
    <EmptyState
      icon="📬"
      title="Sua caixa está vazia"
      subtitle="Visite o marketplace e proponha sua primeira troca."
    />
  )
}
```

- [ ] **Step 5: Update `components/ProfileView.tsx` trade history empty state**

Add import at top:
```tsx
import { EmptyState } from './EmptyState'
```

Find and replace the history empty state (around line 249–251):

```tsx
// REMOVE:
{history.length === 0 ? (
  <div style={{ padding: '16px 0', fontSize: 14, color: 'var(--text-dim)' }}>Nenhuma troca realizada ainda</div>
) : (
```

```tsx
// REPLACE with:
{history.length === 0 ? (
  <EmptyState
    icon="🤝"
    title="Nenhuma troca concluída"
    subtitle="Suas trocas aceitas aparecem aqui com o contato da outra pessoa."
  />
) : (
```

- [ ] **Step 6: Run build to verify no TypeScript errors**

```bash
npm run build 2>&1 | head -40
```

Expected: clean build.

- [ ] **Step 7: Commit all empty state changes**

```bash
git add components/RepeatedView.tsx components/MarketplaceTab.tsx components/TradeView.tsx components/ProposalsTab.tsx components/ProfileView.tsx
git commit -m "feat: replace inline empty states with EmptyState component"
```

---

## Self-Review

**Spec coverage check:**
- ✅ 1.1 New/revised tokens (`--text-dim`, `--surface-elevated`, `--green-glow`, `--gold-glow`, radius tokens, typography scale) — Task 1
- ✅ 1.2 Primary buttons 48px + shadow — Task 5 (buttons are 54px, exceeding the 48px minimum; shadow polish applied)
- ✅ 1.3 Spacing standardized (no specific tokens changed, existing 8/12/16/20/24/32 pattern already followed in existing components)
- ✅ 2.1 StickerCard flash animations — Task 6
- ✅ 2.2 Team completion celebration — Task 7
- ✅ 2.3 Progress bar count-up + overshoot — Task 4
- ✅ 2.4 Confetti at 50% and 100% — Task 9
- ✅ 2.5 ActionSheet 80ms delay — Task 5
- ✅ 3.1 Quick-Add Mode (toggle, localStorage, behaviors, mini-overlay) — Tasks 3, 6, 7, 8, 9
- ✅ 3.2 Team visual states (0% = opacity 0.5, 80%+ = progress-glow, 100% = gold header + badge) — Task 7
- ✅ 3.3 Status filter pills in FilterBar — Task 8
- ✅ 3.4 Toast system — Tasks 2, 3, 9
- ✅ 4. Empty States (all 5 mappings) — Task 10 (Repetidas, Marketplace, Propostas, Histórico; Álbuns/AlbumSelectionScreen already has its own UI, no empty state needed there per spec)

**Type consistency:**
- `QuickActionType` exported from `StickerCard.tsx`, imported in `StickerGrid.tsx` and `AlbumApp.tsx` ✅
- `StatusFilter` type defined locally in `FilterBar.tsx`, `StickerGrid.tsx`, and `AlbumApp.tsx` (same shape: `'all' | 'missing' | 'obtained' | 'repeated'`) ✅
- `ToastState`, `ToastVariant` exported from `hooks/useToast.ts`, imported in `Toast.tsx` and `FilterBar.tsx` ✅

**Placeholder scan:** No TBDs or vague requirements present.
