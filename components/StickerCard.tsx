'use client'
import { useCallback } from 'react'

type Status = 'missing' | 'obtained' | 'repeated'

type Props = {
  id: string
  number: string
  status: Status
  quantity: number
  onAction: (id: string) => void
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

export function StickerCard({ id, number, status, quantity, onAction }: Props) {
  const label = number === '00' ? '★' : number

  const handleTap = useCallback(() => {
    onAction(id)
  }, [id, onAction])

  return (
    <div
      id={`card-${id}`}
      onClick={handleTap}
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
          position: 'absolute',
          top: 2, right: 3,
          fontSize: 7,
          lineHeight: 1,
          color: 'rgba(255,255,255,0.7)',
        }}>✓</span>
      )}

      {status === 'repeated' && (
        <span style={{
          position: 'absolute',
          top: 1, right: 2,
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 8,
          fontWeight: 700,
          lineHeight: 1,
          color: 'rgba(255,255,255,0.85)',
        }}>{quantity}×</span>
      )}
    </div>
  )
}
