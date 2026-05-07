'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type Props = {
  albumId: string
  wantedSticker: string
  wantedStickerName: string
  receiverId: string
  receiverAlbumId: string
  receiverUsername: string
  onClose: () => void
}

export function TradeProposalSheet({
  albumId, wantedSticker, wantedStickerName,
  receiverId, receiverAlbumId, receiverUsername, onClose,
}: Props) {
  const [selectedOffered, setSelectedOffered] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const { data: stickers = [] } = trpc.stickers.list.useQuery({ albumId })
  const myRepeated = stickers.filter(s => s.status === 'repeated')

  const propose = trpc.trades.propose.useMutation({
    onSuccess: () => {
      utils.trades.listProposals.invalidate()
      onClose()
    },
  })

  function handleSend() {
    if (!selectedOffered) return
    propose.mutate({
      proposerAlbumId: albumId,
      offeredSticker: selectedOffered,
      receiverId,
      receiverAlbumId,
      wantedSticker,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(24,40,24,0.45)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', background: 'var(--surface)',
        borderTop: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>

        <div style={{ padding: '12px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Propor troca com @{receiverUsername}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Você quer:{' '}
            <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>
              {wantedSticker}
            </span>{' '}
            {wantedStickerName}
          </div>
        </div>

        <div style={{ padding: '12px 16px 4px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Escolha o que oferecer
          </div>
        </div>

        {myRepeated.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Você não tem figurinhas repetidas neste álbum
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {myRepeated.map(s => {
              const selected = selectedOffered === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedOffered(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected ? 'rgba(22,163,74,0.08)' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? 'var(--green)' : 'var(--border-2)'}`,
                    background: selected ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--gold)', minWidth: 60,
                  }}>
                    {s.id}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{s.countryName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>×{s.quantity - 1} extras</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ padding: '12px 16px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {propose.error && (
            <div style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
              {propose.error.message}
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={!selectedOffered || propose.isPending}
            style={{
              height: 50, borderRadius: 14, fontSize: 15, fontWeight: 700,
              background: !selectedOffered ? 'var(--border)' : 'linear-gradient(150deg,#22c55e,#15803d)',
              color: !selectedOffered ? 'var(--text-muted)' : '#fff',
              border: 'none', cursor: !selectedOffered ? 'not-allowed' : 'pointer',
              opacity: propose.isPending ? 0.6 : 1,
            }}
          >
            {propose.isPending ? 'Enviando…' : 'Enviar proposta'}
          </button>
          <button
            onClick={onClose}
            style={{
              height: 44, borderRadius: 14, fontSize: 14, fontWeight: 600,
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
