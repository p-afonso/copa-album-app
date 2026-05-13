'use client'
import { trpc } from '@/lib/trpc'
import { useCountUp } from '@/hooks/useCountUp'

type Props = { albumId: string }

export function ProgressPanel({ albumId }: Props) {
  const { data } = trpc.stickers.getProgress.useQuery({ albumId })

  const collected = data?.collected ?? 0
  const repeated = data?.repeated ?? 0
  const missing = data?.missing ?? 994
  const total = data?.total ?? 994
  const pct = Math.round((collected / total) * 100)

  const displayedCollected = useCountUp(collected)

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 38, lineHeight: 1, color: 'var(--text)', letterSpacing: '0.01em',
          }}>{displayedCollected}</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500, paddingBottom: 2 }}>
            / {total}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1,
            color: pct > 0 ? 'var(--green)' : 'var(--text-dim)',
          }}>{pct}%</span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            completo
          </span>
        </div>
      </div>

      <div style={{
        height: 8, background: 'var(--surface-2)', borderRadius: 99,
        overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 10,
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
        <Pill label="faltando" value={missing} color="var(--text-dim)" bg="var(--surface-2)" />
        {repeated > 0 && (
          <Pill label="repetidas" value={repeated} color="var(--gold)" bg="var(--gold-dim)" />
        )}
      </div>
    </div>
  )
}

function Pill({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99,
      background: bg, border: `1px solid ${color}22`,
    }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, lineHeight: 1, color }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}
