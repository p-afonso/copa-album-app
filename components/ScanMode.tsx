'use client'
import { useState, useCallback, useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { GROUPS, SECTIONS } from '@/lib/sticker-data'
import type { StickerDef } from '@/lib/sticker-data'

type Status = 'missing' | 'obtained' | 'repeated'
type StickerWithStatus = StickerDef & { status: Status; quantity: number }

type TeamPage = { code: string; name: string; group: string; groupLabel: string }

function buildTeamPages(): TeamPage[] {
  const pages: TeamPage[] = []
  for (const { group, teams } of GROUPS) {
    const sec = SECTIONS.find(s => s.id === group)
    for (const t of teams) {
      pages.push({ code: t.code, name: t.name, group, groupLabel: sec?.label ?? `Grupo ${group}` })
    }
  }
  pages.push({ code: 'FWC', name: 'FIFA World Cup History', group: 'FWC', groupLabel: 'FWC History' })
  pages.push({ code: 'CC', name: 'Coca-Cola', group: 'CC', groupLabel: 'Coca-Cola' })
  return pages
}

const ALL_PAGES = buildTeamPages()

type Props = {
  albumId: string
  stickers: StickerWithStatus[]
  onClose: () => void
}

export function ScanMode({ albumId, stickers, onClose }: Props) {
  const [pageIndex, setPageIndex] = useState(0)
  const [showTeamPicker, setShowTeamPicker] = useState(false)
  const utils = trpc.useUtils()

  const update = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ stickerId, status, quantity }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          const newQty = status === 'repeated' ? (quantity ?? 2) : status === 'obtained' ? 1 : 0
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

  const page = ALL_PAGES[pageIndex]
  const teamStickers = stickers.filter(s =>
    s.countryCode === page.code && s.section === page.group
  )
  const obtained = teamStickers.filter(s => s.status !== 'missing').length
  const pct = teamStickers.length > 0 ? Math.round((obtained / teamStickers.length) * 100) : 0

  const handleTap = useCallback((sticker: StickerWithStatus) => {
    if (update.isPending) return
    if (sticker.status === 'missing') {
      update.mutate({ albumId, stickerId: sticker.id, status: 'obtained' })
    } else if (sticker.status === 'obtained') {
      update.mutate({ albumId, stickerId: sticker.id, status: 'missing' })
    } else {
      // repeated → keep repeated, do nothing (use main view to adjust quantity)
    }
  }, [albumId, update])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setPageIndex(i => Math.min(i + 1, ALL_PAGES.length - 1))
      if (e.key === 'ArrowLeft') setPageIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        borderTop: '3px solid var(--green)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 18, flexShrink: 0,
          }}
        >←</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {page.groupLabel} · {pageIndex + 1}/{ALL_PAGES.length}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1.1, letterSpacing: '0.04em', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {page.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, lineHeight: 1, color: pct > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
            {pct}%
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600 }}>{obtained}/{teamStickers.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct === 100 ? 'linear-gradient(90deg,#f59e0b,#b45309)' : 'linear-gradient(90deg,#22c55e,#15803d)',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Sticker grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 8,
        }}>
          {teamStickers.map((s) => (
            <ScanCard key={s.id} sticker={s} onTap={handleTap} />
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', fontWeight: 500 }}>
          Toque para marcar · Toque novamente para desmarcar
        </div>
        {teamStickers.some(s => s.status === 'repeated') && (
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--gold)', textAlign: 'center', fontWeight: 500 }}>
            Repetidas: use a tela principal para ajustar quantidade
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={() => setPageIndex(i => Math.max(i - 1, 0))}
          disabled={pageIndex === 0}
          style={{
            height: 48, borderRadius: 12, flex: 1, fontSize: 14, fontWeight: 600,
            background: pageIndex === 0 ? 'var(--surface-2)' : 'var(--surface-2)',
            border: `1.5px solid ${pageIndex === 0 ? 'var(--border)' : 'var(--border-2)'}`,
            color: pageIndex === 0 ? 'var(--text-dim)' : 'var(--text)',
            cursor: pageIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: pageIndex === 0 ? 0.5 : 1,
          }}
        >← Anterior</button>

        <button
          onClick={() => setShowTeamPicker(true)}
          style={{
            height: 48, width: 48, borderRadius: 12, flexShrink: 0,
            background: 'var(--green-dim)', border: '1.5px solid var(--green)',
            color: 'var(--green)', fontSize: 18, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title="Escolher time"
        >☰</button>

        <button
          onClick={() => setPageIndex(i => Math.min(i + 1, ALL_PAGES.length - 1))}
          disabled={pageIndex === ALL_PAGES.length - 1}
          style={{
            height: 48, borderRadius: 12, flex: 1, fontSize: 14, fontWeight: 600,
            background: pageIndex === ALL_PAGES.length - 1 ? 'var(--surface-2)' : 'linear-gradient(135deg,#22c55e,#15803d)',
            border: pageIndex === ALL_PAGES.length - 1 ? '1.5px solid var(--border)' : 'none',
            color: pageIndex === ALL_PAGES.length - 1 ? 'var(--text-dim)' : '#fff',
            cursor: pageIndex === ALL_PAGES.length - 1 ? 'not-allowed' : 'pointer',
            opacity: pageIndex === ALL_PAGES.length - 1 ? 0.5 : 1,
          }}
        >Próximo →</button>
      </div>

      {/* Team picker modal */}
      {showTeamPicker && (
        <TeamPicker
          pages={ALL_PAGES}
          stickers={stickers}
          currentIndex={pageIndex}
          onSelect={(i) => { setPageIndex(i); setShowTeamPicker(false) }}
          onClose={() => setShowTeamPicker(false)}
        />
      )}
    </div>
  )
}

function ScanCard({ sticker, onTap }: { sticker: StickerWithStatus; onTap: (s: StickerWithStatus) => void }) {
  const bg =
    sticker.status === 'obtained' ? 'linear-gradient(150deg,#22c55e,#15803d)'
    : sticker.status === 'repeated' ? 'linear-gradient(150deg,#f59e0b,#b45309)'
    : '#f0f5f0'
  const border =
    sticker.status === 'obtained' ? '#15803d'
    : sticker.status === 'repeated' ? '#b45309'
    : '#c2d6c2'
  const color =
    sticker.status === 'missing' ? 'var(--text)'
    : sticker.status === 'repeated' ? 'rgba(45,16,0,0.9)'
    : '#fff'

  return (
    <div
      onClick={() => onTap(sticker)}
      style={{
        aspectRatio: '1',
        borderRadius: 10,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        background: bg,
        border: `1.5px ${sticker.status === 'missing' ? 'dashed' : 'solid'} ${border}`,
        boxShadow: sticker.status !== 'missing' ? `0 2px 8px ${sticker.status === 'obtained' ? 'rgba(21,128,61,0.25)' : 'rgba(180,83,9,0.22)'}` : 'none',
        transition: 'transform 0.1s ease',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, lineHeight: 1, color, letterSpacing: '0.01em' }}>
        {sticker.number}
      </span>
      {sticker.status === 'obtained' && (
        <span style={{ position: 'absolute', top: 3, right: 4, fontSize: 8, color: 'rgba(255,255,255,0.75)' }}>✓</span>
      )}
      {sticker.status === 'repeated' && (
        <span style={{ position: 'absolute', top: 2, right: 3, fontFamily: "'Bebas Neue', sans-serif", fontSize: 9, color: 'rgba(255,255,255,0.85)' }}>
          {sticker.quantity}×
        </span>
      )}
    </div>
  )
}

function TeamPicker({
  pages, stickers, currentIndex, onSelect, onClose,
}: {
  pages: TeamPage[]
  stickers: StickerWithStatus[]
  currentIndex: number
  onSelect: (i: number) => void
  onClose: () => void
}) {
  const stickersByTeam = new Map<string, StickerWithStatus[]>()
  for (const s of stickers) {
    const key = `${s.countryCode}-${s.section}`
    if (!stickersByTeam.has(key)) stickersByTeam.set(key, [])
    stickersByTeam.get(key)!.push(s)
  }

  const groups = GROUPS.map(g => ({
    label: `Grupo ${g.group}`,
    teams: g.teams.map(t => ({
      code: t.code, name: t.name, group: g.group,
      index: pages.findIndex(p => p.code === t.code && p.group === g.group),
    })),
  }))

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(10,20,10,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div
        className="sheet-enter"
        style={{
          position: 'relative', background: 'var(--surface)',
          borderTop: '1px solid var(--border)', borderRadius: '20px 20px 0 0',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: '0.06em', color: 'var(--text)' }}>
            Escolher Time
          </span>
          <button onClick={onClose} style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {groups.map(g => (
            <div key={g.label} style={{ marginBottom: 8 }}>
              <div style={{
                padding: '6px 16px', fontSize: 10, fontWeight: 700,
                color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase',
                background: 'var(--surface-2)',
              }}>
                {g.label}
              </div>
              {g.teams.map(t => {
                const ts = stickersByTeam.get(`${t.code}-${t.group}`) ?? []
                const obt = ts.filter(s => s.status !== 'missing').length
                const pct = ts.length > 0 ? Math.round((obt / ts.length) * 100) : 0
                const isActive = t.index === currentIndex
                return (
                  <button
                    key={t.code}
                    onClick={() => t.index >= 0 && onSelect(t.index)}
                    style={{
                      width: '100%', padding: '10px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: isActive ? 'var(--green-dim)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 13,
                      color: isActive ? 'var(--surface)' : 'var(--green)',
                      background: isActive ? 'var(--green)' : 'var(--green-dim)',
                      padding: '2px 7px', borderRadius: 5, lineHeight: '18px', minWidth: 48, textAlign: 'center',
                    }}>
                      {t.code}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? 'var(--gold)' : pct > 0 ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0 }}>
                      {pct === 100 ? '✦' : `${pct}%`}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}

          {/* FWC and CC */}
          {[
            { code: 'FWC', name: 'FIFA World Cup History', group: 'FWC' },
            { code: 'CC', name: 'Coca-Cola', group: 'CC' },
          ].map(t => {
            const idx = pages.findIndex(p => p.code === t.code)
            const ts = stickersByTeam.get(`${t.code}-${t.group}`) ?? []
            const obt = ts.filter(s => s.status !== 'missing').length
            const pct = ts.length > 0 ? Math.round((obt / ts.length) * 100) : 0
            const isActive = idx === currentIndex
            return (
              <button
                key={t.code}
                onClick={() => idx >= 0 && onSelect(idx)}
                style={{
                  width: '100%', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: isActive ? 'var(--green-dim)' : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 12,
                  color: isActive ? 'var(--surface)' : 'var(--green)',
                  background: isActive ? 'var(--green)' : 'var(--green-dim)',
                  padding: '2px 6px', borderRadius: 5, lineHeight: '18px', minWidth: 48, textAlign: 'center',
                }}>
                  {t.code}
                </span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{t.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? 'var(--gold)' : pct > 0 ? 'var(--green)' : 'var(--text-dim)', flexShrink: 0 }}>
                  {pct === 100 ? '✦' : `${pct}%`}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
