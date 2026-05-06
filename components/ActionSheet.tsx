'use client'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'

type Status = 'missing' | 'obtained' | 'repeated'

type Props = {
  stickerId: string
  status: Status
  quantity: number
  onClose: () => void
}

export function ActionSheet({ stickerId, status, quantity, onClose }: Props) {
  const utils = trpc.useUtils()
  const update = trpc.stickers.updateStatus.useMutation({
    onSuccess: () => {
      utils.stickers.list.invalidate()
      utils.stickers.getProgress.invalidate()
      utils.stickers.listDuplicates.invalidate()
      onClose()
    },
  })

  // Quantity state — starts at 1 for missing, current qty for repeated
  const [qty, setQty] = useState(status === 'repeated' ? quantity : 1)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function add() {
    const newStatus = qty > 1 ? 'repeated' : 'obtained'
    update.mutate({ stickerId, status: newStatus, quantity: qty > 1 ? qty : undefined })
  }

  function remove() {
    update.mutate({ stickerId, status: 'missing' })
  }

  function setRepeated(newQty: number) {
    if (newQty < 2) {
      update.mutate({ stickerId, status: 'obtained' })
    } else {
      update.mutate({ stickerId, status: 'repeated', quantity: newQty })
    }
  }

  const number = stickerId.match(/\d+$/)?.[0] ?? ''
  const countryCode = stickerId.replace(/\d+$/, '')
  const label = number === '00' ? '★' : number

  const cardGradient =
    status === 'obtained' ? 'linear-gradient(150deg,#22c55e,#15803d)'
    : status === 'repeated' ? 'linear-gradient(150deg,#f59e0b,#b45309)'
    : 'var(--surface-2)'
  const cardBorder =
    status === 'obtained' ? '#15803d'
    : status === 'repeated' ? '#b45309'
    : 'var(--border-2)'
  const numColor = status !== 'missing' ? 'rgba(255,255,255,0.95)' : 'var(--text-muted)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        className="backdrop-enter"
        style={{ position: 'absolute', inset: 0, background: 'rgba(24,40,24,0.45)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="sheet-enter"
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          overflow: 'hidden',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>

        {/* Sticker preview */}
        <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: cardGradient,
            border: `2px solid ${cardBorder}`,
            boxShadow: status !== 'missing' ? `0 4px 16px ${status === 'obtained' ? 'rgba(21,128,61,0.25)' : 'rgba(180,83,9,0.25)'}` : 'none',
          }}>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, lineHeight: 1, color: numColor }}>{label}</span>
            {countryCode && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: status !== 'missing' ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)', marginTop: 2 }}>
                {countryCode}
              </span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, lineHeight: 1, letterSpacing: '0.02em', color: 'var(--text)', margin: 0 }}>
              {stickerId}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {status === 'missing' ? 'Faltando' : status === 'obtained' ? 'Obtida' : `${quantity} cópias`}
            </p>
          </div>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── MISSING: add with quantity ── */}
          {status === 'missing' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--green-dim)', border: '1.5px solid #86efac',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
                  {qty === 1 ? 'Tenho esta figurinha' : `Tenho ${qty} cópias`}
                </span>
                <Stepper value={qty} min={1} max={99} accent="var(--green)" onChange={setQty} />
              </div>
              <button
                onClick={add}
                disabled={update.isPending}
                style={{
                  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(21,128,61,0.3)',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Adicionar {qty > 1 ? `${qty} figurinhas` : 'figurinha'}
              </button>
            </>
          )}

          {/* ── OBTAINED: add repeated or remove ── */}
          {status === 'obtained' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fef3c7', border: '1.5px solid #fde68a',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>
                  {qty <= 1 ? 'Tenho repetida' : `Tenho mais ${qty - 1}`}
                </span>
                <Stepper value={qty} min={1} max={99} accent="var(--gold)" onChange={setQty} />
              </div>
              {qty > 1 && (
                <button
                  onClick={() => update.mutate({ stickerId, status: 'repeated', quantity: qty })}
                  disabled={update.isPending}
                  style={{
                    height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(150deg,#f59e0b,#b45309)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(180,83,9,0.25)',
                    opacity: update.isPending ? 0.6 : 1,
                  }}
                >
                  Marcar {qty} cópias
                </button>
              )}
              <button
                onClick={remove}
                disabled={update.isPending}
                style={{
                  height: 50, borderRadius: 14, fontSize: 14, fontWeight: 600,
                  color: '#dc2626', background: 'rgba(220,38,38,0.07)',
                  border: '1.5px solid rgba(220,38,38,0.2)', cursor: 'pointer',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Remover figurinha
              </button>
            </>
          )}

          {/* ── REPEATED: adjust qty or remove ── */}
          {status === 'repeated' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fef3c7', border: '1.5px solid #fde68a',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>
                  Cópias
                </span>
                <Stepper value={qty} min={1} max={99} accent="var(--gold)" onChange={(v) => { setQty(v); setRepeated(v) }} />
              </div>
              <button
                onClick={remove}
                disabled={update.isPending}
                style={{
                  height: 50, borderRadius: 14, fontSize: 14, fontWeight: 600,
                  color: '#dc2626', background: 'rgba(220,38,38,0.07)',
                  border: '1.5px solid rgba(220,38,38,0.2)', cursor: 'pointer',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Remover figurinha
              </button>
            </>
          )}

          {/* Cancel */}
          <button
            onClick={onClose}
            style={{
              height: 48, borderRadius: 14, fontSize: 14, fontWeight: 600,
              color: 'var(--text-muted)', background: 'var(--surface-2)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

function Stepper({ value, min, max, accent, onChange }: {
  value: number; min: number; max: number; accent: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)',
          fontSize: 18, color: accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >−</button>
      <span style={{
        fontFamily: "'Bebas Neue'", fontSize: 26, lineHeight: 1,
        color: accent, minWidth: 32, textAlign: 'center',
      }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)',
          fontSize: 18, color: accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >+</button>
    </div>
  )
}
