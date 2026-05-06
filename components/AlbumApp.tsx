'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { StickerGrid } from './StickerGrid'
import { ProgressPanel } from './ProgressPanel'
import { FilterBar } from './FilterBar'
import { ActionSheet } from './ActionSheet'
import { LoginScreen } from './LoginScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { TabBar, type Tab } from './TabBar'
import { RepeatedView } from './RepeatedView'
import { StickerGridSkeleton } from './StickerGridSkeleton'

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

export function AlbumApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [activeSection, setActiveSection] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('album')
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('copa_active_album_id')
  })

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

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
  if (!session) return <LoginScreen />
  if (profile.isLoading) return <LoadingSpinner />
  if (profile.data === null || profile.data === undefined) {
    if (profile.data === null) return <OnboardingScreen onComplete={() => profile.refetch()} />
    return <LoadingSpinner />
  }

  const username = profile.data.username

  if (albums.isLoading) return <LoadingSpinner />

  // No active album or invalid activeAlbumId → placeholder (will be replaced in Task 5)
  if (!activeAlbum) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--green)' }}>
          COPA 2026
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>@{username}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
          {(albums.data ?? []).map((a) => (
            <button
              key={a.id}
              onClick={() => selectAlbum(a.id)}
              style={{
                padding: '14px 16px', borderRadius: 14, background: 'var(--surface)',
                border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {a.progress.obtained}/{a.progress.total}
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 32, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
        </div>

        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'album' && (
          <>
            <ProgressPanel albumId={activeAlbumId!} />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
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
              />
        ) : (
          <RepeatedView albumId={activeAlbumId!} username={username} />
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
    </div>
  )
}
