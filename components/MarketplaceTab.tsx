'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { TradeProposalSheet } from './TradeProposalSheet'
import { EmptyState } from './EmptyState'

type MarketplaceEntry = {
  stickerId: string
  countryName: string
  section: string
  userId: string
  username: string
  albumId: string
}

type Props = {
  albumId: string
  userId: string
  onActivateMarketplace?: () => void
}

export function MarketplaceTab({ albumId, userId: _userId, onActivateMarketplace }: Props) {
  const { data, isLoading } = trpc.trades.getMarketplace.useQuery()
  const [proposalTarget, setProposalTarget] = useState<MarketplaceEntry | null>(null)
  const [activeBoard, setActiveBoard] = useState<'offering' | 'wanting'>('offering')

  if (isLoading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Carregando marketplace…
      </div>
    )
  }

  const offering = data?.offering ?? []
  const wanting = data?.wanting ?? []
  const isEmpty = offering.length === 0 && wanting.length === 0

  if (isEmpty) {
    return (
      <EmptyState
        icon="🌐"
        title="Ninguém no mercado ainda"
        subtitle="Ative sua visibilidade e convide amigos para começar a trocar."
        action={onActivateMarketplace ? { label: 'Ativar agora →', onClick: onActivateMarketplace } : undefined}
      />
    )
  }

  const items = activeBoard === 'offering' ? offering : wanting

  return (
    <>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['offering', 'wanting'] as const).map((board) => {
          const active = activeBoard === board
          const count = board === 'offering' ? offering.length : wanting.length
          return (
            <button
              key={board}
              onClick={() => setActiveBoard(board)}
              style={{
                flex: 1, height: 36, border: 'none',
                borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {board === 'offering' ? `OFEREÇO (${count})` : `PRECISO (${count})`}
            </button>
          )
        })}
      </div>

      <div style={{ paddingBottom: 80 }}>
        {items.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {activeBoard === 'wanting'
              ? 'Nenhuma figurinha sua aparece como faltando em outros álbuns'
              : 'Nenhuma figurinha disponível para troca'}
          </div>
        ) : (
          items.map((entry, i) => (
            <div
              key={`${entry.albumId}-${entry.stickerId}-${i}`}
              onClick={() => activeBoard === 'offering' ? setProposalTarget(entry) : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                cursor: activeBoard === 'offering' ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.04em',
                  color: activeBoard === 'offering' ? 'var(--gold)' : 'var(--text-muted)', minWidth: 60,
                }}>
                  {entry.stickerId}
                </span>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {entry.countryName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{entry.username}</div>
                </div>
              </div>
              {activeBoard === 'offering' && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Propor →</span>
              )}
            </div>
          ))
        )}
      </div>

      {proposalTarget && (
        <TradeProposalSheet
          albumId={albumId}
          wantedSticker={proposalTarget.stickerId}
          wantedStickerName={proposalTarget.countryName}
          receiverId={proposalTarget.userId}
          receiverAlbumId={proposalTarget.albumId}
          receiverUsername={proposalTarget.username}
          onClose={() => setProposalTarget(null)}
        />
      )}
    </>
  )
}
