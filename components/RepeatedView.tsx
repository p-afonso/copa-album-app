'use client'
import { trpc } from '@/lib/trpc'
import { generateCSV } from '@/lib/export-csv'

type Props = { username: string }

export function RepeatedView({ username }: Props) {
  const { data: stickers = [] } = trpc.stickers.list.useQuery()
  const utils = trpc.useUtils()

  const decrement = trpc.stickers.decrementRepeated.useMutation({
    onMutate: async ({ stickerId }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData()
      utils.stickers.list.setData(undefined, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          if (s.quantity <= 1) return { ...s, status: 'missing' as const, quantity: 0 }
          if (s.quantity === 2) return { ...s, status: 'obtained' as const, quantity: 1 }
          return { ...s, quantity: s.quantity - 1 }
        }),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData(undefined, ctx.prev)
    },
    onSettled: () => {
      utils.stickers.list.invalidate()
      utils.stickers.getProgress.invalidate()
      utils.stickers.listDuplicates.invalidate()
    },
  })

  const repeated = stickers.filter((s) => s.status === 'repeated')
  const totalExtras = repeated.reduce((sum, s) => sum + (s.quantity - 1), 0)

  // Group by section
  const groups = repeated.reduce<Record<string, typeof repeated>>((acc, s) => {
    if (!acc[s.section]) acc[s.section] = []
    acc[s.section].push(s)
    return acc
  }, {})

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

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {repeated.length} figurinha{repeated.length !== 1 ? 's' : ''} ·{' '}
          {totalExtras} extra{totalExtras !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => generateCSV(stickers, username)}
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            border: '1.5px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Exportar CSV
        </button>
      </div>

      {/* Groups */}
      {Object.entries(groups).map(([section, items]) => (
        <div key={section}>
          <div style={{
            padding: '5px 16px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}>
            {section}
          </div>
          {items.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 14, letterSpacing: '0.04em',
                  color: 'var(--gold)', minWidth: 52,
                }}>
                  {s.id}
                </span>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {s.countryName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    ×{s.quantity - 1} extra{s.quantity - 1 !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => decrement.mutate({ stickerId: s.id })}
                disabled={decrement.isPending}
                style={{
                  width: 32, height: 32,
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  fontSize: 20, lineHeight: 1,
                  cursor: decrement.isPending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >
                −
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
