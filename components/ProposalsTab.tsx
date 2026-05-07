'use client'
import { trpc } from '@/lib/trpc'

type Proposal = {
  id: string
  direction: 'incoming' | 'outgoing'
  offeredSticker: { id: string; countryName: string }
  wantedSticker: { id: string; countryName: string }
  otherUsername: string
  otherPhone: string | null
  proposerAlbumId: string
  receiverAlbumId: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
}

type Props = { proposals: Proposal[] }

export function ProposalsTab({ proposals }: Props) {
  const utils = trpc.useUtils()

  const respond = trpc.trades.respond.useMutation({
    onSuccess: (data) => {
      utils.trades.listProposals.invalidate()
      if (data.status === 'accepted' && data.proposerAlbumId && data.receiverAlbumId) {
        utils.stickers.list.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.list.invalidate({ albumId: data.receiverAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: data.receiverAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: data.receiverAlbumId })
        utils.trades.getMarketplace.invalidate()
      }
    },
  })

  const cancel = trpc.trades.cancel.useMutation({
    onSuccess: () => utils.trades.listProposals.invalidate(),
  })

  const incoming = proposals.filter(p => p.direction === 'incoming')
  const outgoing = proposals.filter(p => p.direction === 'outgoing')

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

  function statusLabel(status: Proposal['status']) {
    if (status === 'accepted') return { text: 'Aceita ✓', color: 'var(--green)' }
    if (status === 'rejected') return { text: 'Recusada', color: 'var(--red)' }
    if (status === 'cancelled') return { text: 'Cancelada', color: 'var(--text-dim)' }
    return null
  }

  function StickerPair({ offered, wanted }: { offered: { id: string; countryName: string }; wanted: { id: string; countryName: string } }) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
        <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{offered.id}</span>
        {' '}{offered.countryName}
        <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>⇄</span>
        <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{wanted.id}</span>
        {' '}{wanted.countryName}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {incoming.length > 0 && (
        <>
          <div style={{
            padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            Recebidas ({incoming.length})
          </div>
          {incoming.map(p => {
            const label = statusLabel(p.status)
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                  @{p.otherUsername} quer trocar
                </div>
                <StickerPair offered={p.offeredSticker} wanted={p.wantedSticker} />
                {p.status === 'accepted' && p.otherPhone && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    Contato: <a href={`tel:${p.otherPhone}`} style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>{p.otherPhone}</a>
                  </div>
                )}
                {p.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => respond.mutate({ proposalId: p.id, action: 'accept' })}
                      disabled={respond.isPending}
                      style={{
                        flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(150deg,#22c55e,#15803d)', color: '#fff',
                        fontSize: 13, fontWeight: 700, opacity: respond.isPending ? 0.6 : 1,
                      }}
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => respond.mutate({ proposalId: p.id, action: 'reject' })}
                      disabled={respond.isPending}
                      style={{
                        flex: 1, height: 38, borderRadius: 10, border: '1.5px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: respond.isPending ? 0.6 : 1,
                      }}
                    >
                      Recusar
                    </button>
                  </div>
                ) : label ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: label.color, fontWeight: 600 }}>
                    {label.text}
                  </div>
                ) : null}
              </div>
            )
          })}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <div style={{
            padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            Enviadas ({outgoing.length})
          </div>
          {outgoing.map(p => {
            const label = statusLabel(p.status)
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                  Para @{p.otherUsername}
                </div>
                <StickerPair offered={p.offeredSticker} wanted={p.wantedSticker} />
                {p.status === 'accepted' && p.otherPhone && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    Contato: <a href={`tel:${p.otherPhone}`} style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: 600 }}>{p.otherPhone}</a>
                  </div>
                )}
                {p.status === 'pending' ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => cancel.mutate({ proposalId: p.id })}
                      disabled={cancel.isPending}
                      style={{
                        height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                        border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                        color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                        opacity: cancel.isPending ? 0.6 : 1,
                      }}
                    >
                      Cancelar proposta
                    </button>
                  </div>
                ) : label ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: label.color, fontWeight: 600 }}>
                    {label.text}
                  </div>
                ) : null}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
