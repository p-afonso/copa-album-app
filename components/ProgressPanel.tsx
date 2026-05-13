'use client'
import { trpc } from '@/lib/trpc'
import { useCountUp } from '@/hooks/useCountUp'

type Props = { albumId: string }

export function ProgressPanel({ albumId }: Props) {
  const { data } = trpc.stickers.getProgress.useQuery({ albumId })

  const obtained = data?.obtained ?? 0
  const total = data?.total ?? 994
  const pct = Math.round((obtained / total) * 100)

  const displayedObtained = useCountUp(obtained)

  return (
    <div className="glass" style={{
      margin: '12px 12px 0',
      borderRadius: 16,
      padding: '16px 18px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 32, lineHeight: 1, color: 'var(--text)',
          }}>{displayedObtained}</span>
          <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            / {total}
          </span>
        </div>
        <span style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, lineHeight: 1,
          color: pct > 0 ? 'var(--green)' : 'var(--text-dim)',
        }}>{pct}%</span>
      </div>

      <div style={{
        height: 6, background: 'var(--surface-2)', borderRadius: 99,
        overflow: 'hidden',
      }}>
        <div
          style={{
            height: '100%', width: `${pct}%`,
            background: 'var(--green)',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  )
}
