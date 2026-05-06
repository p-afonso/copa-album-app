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

  // Auth state
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Profile
  const profile = trpc.profile.get.useQuery(undefined, { enabled: !!session })

  const { data: stickers = [], isLoading } = trpc.stickers.list.useQuery(
    undefined,
    { enabled: !!session && !!profile.data },
  )
  const utils = trpc.useUtils()

  // Supabase Realtime — sync entre dispositivos
  useEffect(() => {
    if (!session) return
    const channel = supabaseBrowser
      .channel('user_stickers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stickers' }, () => {
        utils.stickers.list.invalidate()
        utils.stickers.getProgress.invalidate()
        utils.stickers.listDuplicates.invalidate()
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [utils, session])

  const handleAction = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  // session === undefined → verificando
  if (session === undefined) return <LoadingSpinner />

  // não autenticado
  if (!session) return <LoginScreen />

  // perfil carregando
  if (profile.isLoading) return <LoadingSpinner />

  // sem username → onboarding
  if (profile.data === null || profile.data === undefined) {
    if (profile.data === null) {
      return <OnboardingScreen onComplete={() => profile.refetch()} />
    }
    return <LoadingSpinner />
  }

  // stickers carregando
  if (isLoading) return <LoadingSpinner />

  const username = profile.data.username

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>

      {/* ─── Sticky header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        {/* Logo bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          borderTop: '3px solid var(--green)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, minWidth: 60 }}>
            @{username}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 26, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
          }}>
            COPA <span style={{ color: 'var(--green)' }}>2026</span>
          </div>
          <button
            onClick={() => supabaseBrowser.auth.signOut()}
            title="Sair"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 18, borderRadius: 8, minWidth: 32,
            }}
          >
            ⎋
          </button>
        </div>

        {/* Tabs */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {/* Album-only header content */}
        {activeTab === 'album' && (
          <>
            <ProgressPanel />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
            />
          </>
        )}
      </div>

      {/* ─── Content ─── */}
      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          <StickerGrid
            stickers={stickers}
            activeSection={activeSection}
            search={search}
            onAction={handleAction}
          />
        ) : (
          <RepeatedView username={username} />
        )}
      </div>

      {/* ─── Action sheet ─── */}
      {selectedId && (
        <ActionSheet
          stickerId={selectedId}
          status={stickers.find(s => s.id === selectedId)?.status ?? 'missing'}
          quantity={stickers.find(s => s.id === selectedId)?.quantity ?? 0}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
