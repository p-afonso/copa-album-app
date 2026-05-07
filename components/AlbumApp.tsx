'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import type { Session } from '@supabase/supabase-js'
import confetti from 'canvas-confetti'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { useToast } from '@/hooks/useToast'
import { StickerGrid } from './StickerGrid'
import type { QuickActionType } from './StickerCard'
import { ProgressPanel } from './ProgressPanel'
import { FilterBar } from './FilterBar'
import { ActionSheet } from './ActionSheet'
import { LoginScreen } from './LoginScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { TabBar, type Tab } from './TabBar'
import { RepeatedView } from './RepeatedView'
import { TradeView } from './TradeView'
import { ProfileView } from './ProfileView'
import { StickerGridSkeleton } from './StickerGridSkeleton'
import { AlbumSelectionScreen } from './AlbumSelectionScreen'
import { AlbumMembersSheet } from './AlbumMembersSheet'
import { SetPasswordScreen } from './SetPasswordScreen'
import { Toast } from './Toast'

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 48, letterSpacing: '0.05em', color: 'var(--green)', lineHeight: 1,
      }}>COPA 2026</div>
      <div style={{ width: 120, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%', background: 'var(--green)',
          borderRadius: 99, animation: 'loading-bar 1.2s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

function fireConfetti() {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#16a34a', '#d97706', '#ffffff'],
  })
}

export function AlbumApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [activeSection, setActiveSection] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('album')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [quickMode, setQuickMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('copa_quick_mode') === '1'
  })
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('copa_active_album_id')
  })
  const [showMembers, setShowMembers] = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)

  const { toast, show: showToast } = useToast()
  const celebratedRef = useRef<Set<string>>(new Set())
  const prevAlbumIdRef = useRef<string | null>(null)

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Reset confetti milestones when switching albums
  useEffect(() => {
    if (activeAlbumId !== prevAlbumIdRef.current) {
      celebratedRef.current = new Set()
      prevAlbumIdRef.current = activeAlbumId
    }
  }, [activeAlbumId])

  const profile = trpc.profile.get.useQuery(undefined, { enabled: !!session })

  const albums = trpc.albums.list.useQuery(undefined, {
    enabled: !!session && !!profile.data,
  })

  const activeAlbum = albums.data?.find((a) => a.id === activeAlbumId) ?? null

  const { data: stickers = [], isLoading } = trpc.stickers.list.useQuery(
    { albumId: activeAlbumId! },
    { enabled: !!session && !!profile.data && !!activeAlbum },
  )
  const utils = trpc.useUtils()

  // Watch progress for confetti milestones
  const { data: progress } = trpc.stickers.getProgress.useQuery(
    { albumId: activeAlbumId! },
    { enabled: !!session && !!profile.data && !!activeAlbum },
  )
  useEffect(() => {
    if (!progress || !activeAlbumId) return
    const total = progress.total ?? 1033
    const filled = (progress.obtained ?? 0) + (progress.repeated ?? 0)
    const ratio = filled / total
    if (ratio >= 0.5 && !celebratedRef.current.has('50')) {
      celebratedRef.current.add('50')
      fireConfetti()
    }
    if (ratio >= 1 && !celebratedRef.current.has('100')) {
      celebratedRef.current.add('100')
      fireConfetti()
    }
  }, [progress, activeAlbumId])

  const { data: proposals = [] } = trpc.trades.listProposals.useQuery(undefined, {
    enabled: !!session && !!profile.data && !!activeAlbum,
  })
  const pendingTradesCount = proposals.filter(
    (p) => p.direction === 'incoming' && p.status === 'pending',
  ).length

  const convertToShared = trpc.albums.convertToShared.useMutation({
    onSuccess: () => {
      utils.albums.list.invalidate()
      setShowMembers(true)
    },
  })

  // Quick-add mutation (mirrors ActionSheet without the close call)
  const quickUpdate = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ albumId, stickerId, status, quantity }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          const newQty =
            status === 'repeated' ? (quantity ?? 2)
            : status === 'obtained' ? 1
            : 0
          return { ...s, status, quantity: newQty }
        }),
      )
      return { prev }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData({ albumId: vars.albumId }, ctx.prev)
    },
    onSettled: (_data, _err, vars) => {
      utils.stickers.list.invalidate({ albumId: vars.albumId })
      utils.stickers.getProgress.invalidate({ albumId: vars.albumId })
      utils.stickers.listDuplicates.invalidate({ albumId: vars.albumId })
    },
  })

  const handleQuickAction = useCallback((id: string, action: QuickActionType) => {
    if (!activeAlbumId) return
    if (action === 'openSheet') {
      setSelectedId(id)
      return
    }
    const sticker = stickers.find(s => s.id === id)
    if (!sticker) return
    if (action === 'toObtained') {
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'obtained' })
    } else if (action === 'addRepeat') {
      const newQty = (sticker.quantity ?? 1) + 1
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'repeated', quantity: newQty })
    } else if (action === 'remove') {
      quickUpdate.mutate({ albumId: activeAlbumId, stickerId: id, status: 'missing' })
    }
  }, [activeAlbumId, stickers, quickUpdate])

  useEffect(() => {
    if (!session || !activeAlbumId) return
    const channel = supabaseBrowser
      .channel(`album_stickers_${activeAlbumId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'album_stickers',
        filter: `album_id=eq.${activeAlbumId}`,
      }, () => {
        utils.stickers.list.invalidate({ albumId: activeAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: activeAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: activeAlbumId })
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [utils, session, activeAlbumId])

  const handleAction = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  function selectAlbum(albumId: string) {
    localStorage.setItem('copa_active_album_id', albumId)
    setActiveAlbumId(albumId)
  }

  function clearAlbum() {
    localStorage.removeItem('copa_active_album_id')
    setActiveAlbumId(null)
  }

  if (session === undefined) return <LoadingSpinner />
  if (isRecovery) return <SetPasswordScreen onDone={() => setIsRecovery(false)} />
  if (!session) return <LoginScreen />
  if (profile.isLoading) return <LoadingSpinner />
  if (profile.data === null || profile.data === undefined) {
    if (profile.data === null) return <OnboardingScreen onComplete={() => profile.refetch()} />
    return <LoadingSpinner />
  }

  const username = profile.data.username

  if (albums.isLoading) return <LoadingSpinner />

  if (!activeAlbum) {
    return (
      <AlbumSelectionScreen
        albums={albums.data ?? []}
        username={username}
        onSelect={selectAlbum}
        onRefetch={() => albums.refetch()}
      />
    )
  }

  const repeatedCount = stickers.filter(s => s.status === 'repeated').length

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--green)',
        }}>
          <button
            onClick={clearAlbum}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, borderRadius: 8, minWidth: 32,
            }}
            title="Voltar aos álbuns"
          >
            ←
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              COPA 2026
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1 }}>
              {activeAlbum.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60, justifyContent: 'flex-end' }}>
            {activeAlbum.type === 'shared' ? (
              <button
                onClick={() => setShowMembers(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px', borderRadius: 8,
                }}
              >
                👥 {activeAlbum.memberCount}
              </button>
            ) : activeAlbum.role === 'owner' ? (
              <button
                onClick={() => convertToShared.mutate({ albumId: activeAlbumId! })}
                disabled={convertToShared.isPending}
                title="Compartilhar álbum"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: convertToShared.isPending ? 'not-allowed' : 'pointer',
                  color: 'var(--text-muted)', fontSize: 16, padding: '4px 6px', borderRadius: 8,
                  opacity: convertToShared.isPending ? 0.5 : 1,
                }}
              >
                🔗
              </button>
            ) : null}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
        </div>

        <TabBar activeTab={activeTab} onChange={setActiveTab} pendingTradesCount={pendingTradesCount} />

        {activeTab === 'album' && (
          <>
            <ProgressPanel albumId={activeAlbumId!} />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
              quickMode={quickMode}
              onQuickModeChange={setQuickMode}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              repeatedCount={repeatedCount}
              showToast={showToast}
            />
          </>
        )}
      </div>

      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          isLoading
            ? <StickerGridSkeleton />
            : <StickerGrid
                stickers={stickers}
                activeSection={activeSection}
                search={search}
                onAction={handleAction}
                quickMode={quickMode}
                onQuickAction={handleQuickAction}
                statusFilter={statusFilter}
              />
        ) : activeTab === 'repeated' ? (
          <RepeatedView albumId={activeAlbumId!} username={username} />
        ) : activeTab === 'trades' ? (
          <TradeView
            albumId={activeAlbumId!}
            userId={session!.user.id}
            marketplaceVisible={activeAlbum.marketplaceVisible}
          />
        ) : (
          <ProfileView
            username={username}
            onUsernameChange={() => profile.refetch()}
          />
        )}
      </div>

      {selectedId && (
        <ActionSheet
          albumId={activeAlbumId!}
          stickerId={selectedId}
          status={stickers.find(s => s.id === selectedId)?.status ?? 'missing'}
          quantity={stickers.find(s => s.id === selectedId)?.quantity ?? 0}
          onClose={handleClose}
        />
      )}
      {showMembers && activeAlbum.type === 'shared' && activeAlbum.inviteCode && (
        <AlbumMembersSheet
          albumId={activeAlbumId!}
          albumName={activeAlbum.name}
          inviteCode={activeAlbum.inviteCode}
          isOwner={activeAlbum.role === 'owner'}
          currentUserId=""
          onClose={() => setShowMembers(false)}
          onAlbumLeft={clearAlbum}
        />
      )}

      <Toast toast={toast} />
    </div>
  )
}
