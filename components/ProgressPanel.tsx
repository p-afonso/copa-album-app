'use client'
import { trpc } from '@/lib/trpc'

export function ProgressPanel() {
  const { data } = trpc.stickers.getProgress.useQuery()

  const obtained = (data?.obtained ?? 0)
  const repeated = (data?.repeated ?? 0)
  const total = data?.total ?? 1033
  const filled = obtained + repeated
  const pct = Math.round((filled / total) * 100)
  const missing = data?.missing ?? total

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Main count row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 38,
            lineHeight: 1,
            color: 'var(--text)',
            letterSpacing: '0.01em',
          }}>{filled}</span>
          <span style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            fontWeight: 500,
            paddingBottom: 2,
          }}>/ {total}</span>
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 1,
        }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 30,
            lineHeight: 1,
            color: pct > 0 ? 'var(--green)' : 'var(--text-dim)',
          }}>{pct}%</span>
          <span style={{
            fontSize: 10,
            color: 'var(--text-dim)',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>completo</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 8,
        background: 'var(--surface-2)',
        borderRadius: 99,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        marginBottom: 12,
      }}>
        <div
          className={pct > 0 ? 'progress-glow' : ''}
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #22c55e 0%, #15803d 100%)',
            borderRadius: 99,
            transition: 'width 0.7s ease',
            minWidth: pct > 0 ? 8 : 0,
          }}
        />
      </div>

      {/* Stats chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        <Chip
          value={missing}
          label="faltando"
          bg="var(--surface-2)"
          border="var(--border)"
          valueColor="var(--text)"
        />
        <Chip
          value={obtained}
          label="obtidas"
          bg="#dcfce7"
          border="#bbf7d0"
          valueColor="var(--green-mid, #15803d)"
        />
        {repeated > 0 && (
          <Chip
            value={repeated}
            label="repetidas"
            bg="#fef3c7"
            border="#fde68a"
            valueColor="var(--gold-mid, #b45309)"
          />
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
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 8,
      padding: '4px 10px',
    }}>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 16,
        lineHeight: 1,
        color: valueColor,
      }}>{value}</span>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--text-muted)',
      }}>{label}</span>
    </div>
  )
}
