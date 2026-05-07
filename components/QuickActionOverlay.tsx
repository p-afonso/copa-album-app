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
