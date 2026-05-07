'use client'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { MarketplaceTab } from './MarketplaceTab'
import { ProposalsTab } from './ProposalsTab'

type Props = { albumId: string; userId: string; marketplaceVisible: boolean }

export function TradeView({ albumId, userId, marketplaceVisible }: Props) {
  const [subTab, setSubTab] = useState<'marketplace' | 'proposals'>('marketplace')
  const utils = trpc.useUtils()

  const { data: proposals = [] } = trpc.trades.listProposals.useQuery()
  const pendingCount = proposals.filter(p => p.direction === 'incoming' && p.status === 'pending').length

  const setVisibility = trpc.trades.setVisibility.useMutation({
    onSuccess: () => utils.albums.list.invalidate(),
  })

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`trade_proposals_tv_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trade_proposals',
        filter: `proposer_id=eq.${userId}`,
      }, () => {
        utils.trades.listProposals.invalidate()
        utils.trades.getMarketplace.invalidate()
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trade_proposals',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        utils.trades.listProposals.invalidate()
        utils.trades.getMarketplace.invalidate()
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [userId, utils])

  return (
    <div style={{ paddingBottom: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aparecer no marketplace</span>
        <button
          onClick={() => setVisibility.mutate({ albumId, visible: !marketplaceVisible })}
          disabled={setVisibility.isPending}
          title={marketplaceVisible ? 'Desativar visibilidade' : 'Ativar visibilidade'}
          style={{
            width: 44, height: 24, borderRadius: 99, border: 'none',
            background: marketplaceVisible ? 'var(--green)' : 'var(--border)',
            cursor: setVisibility.isPending ? 'not-allowed' : 'pointer',
            position: 'relative', transition: 'background 0.2s',
            opacity: setVisibility.isPending ? 0.5 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: marketplaceVisible ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', display: 'block',
          }} />
        </button>
      </div>

      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {(['marketplace', 'proposals'] as const).map((tab) => {
          const active = subTab === tab
          const label = tab === 'marketplace'
            ? 'Marketplace'
            : `Propostas${pendingCount > 0 ? ` (${pendingCount})` : ''}`
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{
                flex: 1, height: 38, border: 'none',
                borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {subTab === 'marketplace'
        ? <MarketplaceTab albumId={albumId} userId={userId} />
        : <ProposalsTab proposals={proposals} />
      }
    </div>
  )
}
