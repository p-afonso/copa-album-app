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
    return () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }
  }, [])

  useEffect(() => {
    if (!quickMode || status !== 'obtained') setShowOverlay(false)
  }, [quickMode, status])

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
  }, [id, status, quickMode, onAction, onQuickAction, setShowOverlay])

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
