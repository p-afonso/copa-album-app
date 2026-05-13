'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { trpc } from '@/lib/trpc'
import { GROUPS, SECTIONS } from '@/lib/sticker-data'
import type { StickerDef } from '@/lib/sticker-data'

type Status = 'missing' | 'obtained' | 'repeated'
type StickerWithStatus = StickerDef & { status: Status; quantity: number }
type TeamPage = { code: string; name: string; group: string; groupLabel: string }
type ScanResult = { obtained: string[]; missing: string[] }

function buildTeamPages(): TeamPage[] {
  const pages: TeamPage[] = []
  for (const { group, teams } of GROUPS) {
    const sec = SECTIONS.find(s => s.id === group)
    for (const t of teams) {
      pages.push({ code: t.code, name: t.name, group, groupLabel: sec?.label ?? `Grupo ${group}` })
    }
  }
  pages.push({ code: 'FWC', name: 'FWC History', group: 'FWC', groupLabel: 'FWC' })
  pages.push({ code: 'CC',  name: 'Coca-Cola',   group: 'CC',  groupLabel: 'CC'  })
  return pages
}

const ALL_PAGES = buildTeamPages()

/** Returns grid cols/rows based on sticker count. 20 → 5×4, 14 → 7×2. */
function getGrid(count: number) {
  if (count === 20) return { cols: 5, rows: 4 }
  if (count === 14) return { cols: 7, rows: 2 }
  const cols = 5
  return { cols, rows: Math.ceil(count / cols) }
}

const HEADER = 'rgba(20,28,20,0.88)'
const BLUR   = 'blur(12px)'

type Props = { albumId: string; stickers: StickerWithStatus[]; onClose: () => void }

export function ScanMode({ albumId, stickers, onClose }: Props) {
  const [pageIndex, setPageIndex]   = useState(0)
  const [showPicker, setShowPicker] = useState(false)
  const [scanState, setScanState]   = useState<'idle' | 'scanning' | 'confirm'>('idle')
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [scanPreview, setScanPreview] = useState<string | null>(null)
  const [scanError, setScanError]   = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const utils   = trpc.useUtils()

  const update = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ stickerId, status, quantity }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, old =>
        old?.map(s => {
          if (s.id !== stickerId) return s
          const qty = status === 'repeated' ? (quantity ?? 2) : status === 'obtained' ? 1 : 0
          return { ...s, status, quantity: qty }
        }),
      )
      return { prev }
    },
    onError: (_e, vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData({ albumId: vars.albumId }, ctx.prev)
    },
    onSettled: (_d, _e, vars) => {
      utils.stickers.list.invalidate({ albumId: vars.albumId })
      utils.stickers.getProgress.invalidate({ albumId: vars.albumId })
      utils.stickers.listDuplicates.invalidate({ albumId: vars.albumId })
    },
  })

  const page         = ALL_PAGES[pageIndex]
  const teamStickers = stickers.filter(s => s.countryCode === page.code && s.section === page.group)
  const obtained     = teamStickers.filter(s => s.status !== 'missing').length
  const pct          = teamStickers.length > 0 ? Math.round((obtained / teamStickers.length) * 100) : 0

  const handleTap = useCallback((s: StickerWithStatus) => {
    if (update.isPending) return
    if (s.status === 'missing')  update.mutate({ albumId, stickerId: s.id, status: 'obtained' })
    if (s.status === 'obtained') update.mutate({ albumId, stickerId: s.id, status: 'missing' })
  }, [albumId, update])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (scanState !== 'idle') return
      if (e.key === 'Escape')     onClose()
      if (e.key === 'ArrowRight') setPageIndex(i => Math.min(i + 1, ALL_PAGES.length - 1))
      if (e.key === 'ArrowLeft')  setPageIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose, scanState])

  function openCamera() { setScanError(null); fileRef.current?.click() }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl  = reader.result as string
      const base64   = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'
      const { cols, rows } = getGrid(teamStickers.length)

      setScanPreview(dataUrl)
      setScanState('scanning')
      setScanError(null)

      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType,
            teamName: page.name,
            stickerNumbers: teamStickers.map(s => s.number),
            pageIndex,
            gridCols: cols,
            gridRows: rows,
          }),
        })
        const data = await res.json() as ScanResult & { error?: string }
        if (!res.ok || data.error) {
          setScanError(data.error ?? 'Erro ao escanear.')
          setScanState('idle')
          return
        }
        setScanResult(data)
        setScanState('confirm')
      } catch {
        setScanError('Erro de conexão.')
        setScanState('idle')
      }
    }
    reader.readAsDataURL(file)
  }

  async function confirmScan() {
    if (!scanResult || confirming) return
    setConfirming(true)
    for (const number of scanResult.obtained) {
      const s = teamStickers.find(t => t.number === number)
      if (s && s.status === 'missing') {
        await new Promise<void>(resolve =>
          update.mutate({ albumId, stickerId: s.id, status: 'obtained' }, { onSettled: () => resolve() })
        )
      }
    }
    setConfirming(false)
    setScanState('idle')
    setScanResult(null)
    setScanPreview(null)
  }

  function cancelScan() {
    setScanState('idle'); setScanResult(null); setScanPreview(null); setScanError(null)
  }

  /* ─── SCANNING overlay ─────────────────────────────────────────── */
  if (scanState === 'scanning') return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(5,12,5,0.95)', backdropFilter: BLUR,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      {scanPreview && (
        <div style={{ position: 'relative' }}>
          <img src={scanPreview} alt="" style={{
            maxWidth: '78vw', maxHeight: '38vh', borderRadius: 14,
            objectFit: 'contain', opacity: 0.4, display: 'block',
          }} />
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 14,
            background: 'linear-gradient(135deg,rgba(22,163,74,0.08),transparent)',
            border: '1.5px solid rgba(22,163,74,0.25)',
          }} />
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: '0.08em', color: 'var(--green)' }}>
          ANALISANDO
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
          {page.name}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--green)',
            animation: `pulse-dot 1.2s ease-in-out ${i*0.22}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )

  /* ─── CONFIRM screen ───────────────────────────────────────────── */
  if (scanState === 'confirm' && scanResult) {
    const newObtained  = scanResult.obtained.filter(n => teamStickers.find(t => t.number === n)?.status === 'missing')
    const alreadyHad   = scanResult.obtained.filter(n => teamStickers.find(t => t.number === n)?.status !== 'missing')

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: HEADER, backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button onClick={cancelScan} style={btnIcon}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              Resultado · {page.name}
            </div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, lineHeight: 1.1, color: 'var(--text)' }}>
              {newObtained.length > 0
                ? `${newObtained.length} figurinha${newObtained.length !== 1 ? 's' : ''} nova${newObtained.length !== 1 ? 's' : ''}`
                : 'Nenhuma novidade'}
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {scanPreview && (
            <img src={scanPreview} alt="" style={{
              width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10,
            }} />
          )}

          {newObtained.length > 0 && (
            <ResultGroup
              label={`Serão marcadas como obtidas`}
              count={newObtained.length}
              accent="var(--green)"
              bg="rgba(22,163,74,0.1)"
              border="rgba(22,163,74,0.25)"
              numbers={newObtained}
            />
          )}

          {alreadyHad.length > 0 && (
            <ResultGroup
              label="Já estavam marcadas"
              count={alreadyHad.length}
              accent="var(--text-dim)"
              bg="var(--surface-2)"
              border="var(--border)"
              numbers={alreadyHad}
            />
          )}

          {scanResult.missing.length > 0 && (
            <ResultGroup
              label="Detectadas como faltando"
              count={scanResult.missing.length}
              accent="rgba(220,38,38,0.7)"
              bg="rgba(220,38,38,0.06)"
              border="rgba(220,38,38,0.18)"
              numbers={scanResult.missing}
            />
          )}

          {newObtained.length === 0 && (
            <div style={{
              padding: 16, borderRadius: 12, textAlign: 'center',
              background: 'var(--surface)', border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--text-muted)',
            }}>
              Nenhuma figurinha nova detectada nesta página.
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{
          background: HEADER, backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '10px 14px', paddingBottom: 'env(safe-area-inset-bottom,10px)',
          display: 'flex', gap: 8,
        }}>
          <button onClick={cancelScan} style={{
            ...btnBase, flex: 1, background: 'var(--surface-2)',
            border: '1.5px solid var(--border)', color: 'var(--text-muted)',
          }}>
            Cancelar
          </button>
          <button
            onClick={confirmScan}
            disabled={confirming || newObtained.length === 0}
            style={{
              ...btnBase, flex: 2,
              background: newObtained.length === 0 ? 'var(--surface-2)' : 'linear-gradient(135deg,#22c55e,#15803d)',
              border: newObtained.length === 0 ? '1.5px solid var(--border)' : 'none',
              color: newObtained.length === 0 ? 'var(--text-dim)' : '#fff',
              opacity: confirming ? 0.65 : 1,
              cursor: newObtained.length === 0 || confirming ? 'not-allowed' : 'pointer',
            }}
          >
            {confirming
              ? 'Salvando…'
              : newObtained.length === 0
                ? 'Nada a salvar'
                : `Confirmar ${newObtained.length}`}
          </button>
        </div>
      </div>
    )
  }

  /* ─── MAIN view ────────────────────────────────────────────────── */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />

      {/* Header – frosted glass */}
      <div style={{
        background: HEADER, backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Back */}
        <button onClick={onClose} style={btnIcon}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Group badge */}
        <div style={{
          fontFamily: "'Bebas Neue',sans-serif", fontSize: 11,
          color: 'var(--green)', background: 'var(--green-dim)',
          padding: '3px 7px', borderRadius: 5, letterSpacing: '0.06em', flexShrink: 0,
          border: '1px solid rgba(22,163,74,0.2)',
        }}>
          {page.groupLabel}
        </div>

        {/* Team name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, lineHeight: 1.05,
            letterSpacing: '0.03em', color: 'var(--text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {page.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, marginTop: 1 }}>
            {pageIndex + 1} / {ALL_PAGES.length}
          </div>
        </div>

        {/* Scan camera button */}
        <button
          onClick={openCamera}
          title="Escanear página com IA"
          style={{
            ...btnIcon,
            background: 'var(--green-dim)',
            border: '1.5px solid rgba(22,163,74,0.4)',
            color: 'var(--green)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5.5 4l1-2h3l1 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Progress */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, lineHeight: 1, color: pct === 100 ? 'var(--gold)' : pct > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
            {pct}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600 }}>{obtained}/{teamStickers.length}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: pct === 100 ? 'linear-gradient(90deg,#f59e0b,#b45309)' : 'linear-gradient(90deg,#22c55e,#15803d)',
          transition: 'width 0.35s ease',
        }} />
      </div>

      {/* Scan error inline */}
      {scanError && (
        <div style={{
          margin: '8px 14px 0', padding: '8px 12px', borderRadius: 8,
          background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)',
          fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14 }}>⚠</span>
          <span style={{ flex: 1 }}>{scanError}</span>
          <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(248,113,113,0.7)', fontSize: 14, padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Sticker grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${getGrid(teamStickers.length).cols}, 1fr)`,
          gap: 6,
        }}>
          {teamStickers.map(s => <ScanCard key={s.id} sticker={s} onTap={handleTap} />)}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
          Toque para marcar · segure para desmarcar
        </div>
      </div>

      {/* Bottom nav */}
      <div style={{
        background: HEADER, backdropFilter: BLUR, WebkitBackdropFilter: BLUR,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 14px', paddingBottom: 'env(safe-area-inset-bottom,10px)',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={() => setPageIndex(i => Math.max(i - 1, 0))}
          disabled={pageIndex === 0}
          style={{
            ...btnBase, flex: 1,
            background: 'var(--surface-2)', border: '1.5px solid var(--border)',
            color: pageIndex === 0 ? 'var(--text-dim)' : 'var(--text)',
            opacity: pageIndex === 0 ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 13 }}>Anterior</span>
        </button>

        <button
          onClick={() => setShowPicker(true)}
          style={{
            height: 44, width: 44, borderRadius: 10, flexShrink: 0,
            background: 'var(--green-dim)', border: '1.5px solid rgba(22,163,74,0.4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--green)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="1.8" rx="0.9" fill="currentColor"/>
            <rect x="2" y="7.1" width="8"  height="1.8" rx="0.9" fill="currentColor"/>
            <rect x="2" y="11.2" width="10" height="1.8" rx="0.9" fill="currentColor"/>
          </svg>
        </button>

        <button
          onClick={() => setPageIndex(i => Math.min(i + 1, ALL_PAGES.length - 1))}
          disabled={pageIndex === ALL_PAGES.length - 1}
          style={{
            ...btnBase, flex: 1,
            background: pageIndex === ALL_PAGES.length - 1 ? 'var(--surface-2)' : 'linear-gradient(135deg,#22c55e,#15803d)',
            border: pageIndex === ALL_PAGES.length - 1 ? '1.5px solid var(--border)' : 'none',
            color: pageIndex === ALL_PAGES.length - 1 ? 'var(--text-dim)' : '#fff',
            opacity: pageIndex === ALL_PAGES.length - 1 ? 0.4 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <span style={{ fontFamily: 'Outfit,sans-serif', fontSize: 13 }}>Próximo</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {showPicker && (
        <TeamPicker
          pages={ALL_PAGES}
          stickers={stickers}
          currentIndex={pageIndex}
          onSelect={i => { setPageIndex(i); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

/* ─── Shared button styles ─────────────────────────────────────── */
const btnBase: React.CSSProperties = {
  height: 44, borderRadius: 10, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'Outfit,sans-serif', transition: 'opacity 0.15s',
}
const btnIcon: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-muted)',
}

/* ─── ResultGroup ──────────────────────────────────────────────── */
function ResultGroup({ label, count, accent, bg, border, numbers }: {
  label: string; count: number; accent: string; bg: string; border: string; numbers: string[]
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label} <span style={{ opacity: 0.7 }}>({count})</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {numbers.map(n => (
          <div key={n} style={{
            padding: '3px 11px', borderRadius: 7,
            background: bg, border: `1px solid ${border}`,
            color: accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: 15,
          }}>{n}</div>
        ))}
      </div>
    </div>
  )
}

/* ─── ScanCard ─────────────────────────────────────────────────── */
function ScanCard({ sticker, onTap }: { sticker: StickerWithStatus; onTap: (s: StickerWithStatus) => void }) {
  const isObtained = sticker.status === 'obtained'
  const isRepeated = sticker.status === 'repeated'
  const isMissing  = sticker.status === 'missing'

  return (
    <div
      onClick={() => onTap(sticker)}
      style={{
        aspectRatio: '1', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        background: isObtained ? 'linear-gradient(150deg,#22c55e,#15803d)'
                   : isRepeated ? 'linear-gradient(150deg,#f59e0b,#b45309)'
                   : 'var(--surface)',
        border: isMissing
          ? '1.5px dashed rgba(255,255,255,0.1)'
          : isObtained ? '1.5px solid #15803d' : '1.5px solid #b45309',
        boxShadow: isObtained ? '0 2px 8px rgba(21,128,61,0.3)'
                 : isRepeated ? '0 2px 8px rgba(180,83,9,0.25)' : 'none',
        transition: 'transform 0.1s',
      }}
    >
      <span style={{
        fontFamily: "'Bebas Neue',sans-serif",
        fontSize: 18, lineHeight: 1,
        color: isMissing ? 'var(--text-dim)' : '#fff',
        letterSpacing: '0.02em',
      }}>
        {sticker.number}
      </span>
      {isObtained && (
        <span style={{ position: 'absolute', top: 2, right: 3, fontSize: 7, color: 'rgba(255,255,255,0.65)' }}>✓</span>
      )}
      {isRepeated && (
        <span style={{ position: 'absolute', top: 2, right: 3, fontFamily: "'Bebas Neue',sans-serif", fontSize: 8, color: 'rgba(255,255,255,0.8)' }}>
          {sticker.quantity}×
        </span>
      )}
    </div>
  )
}

/* ─── TeamPicker ───────────────────────────────────────────────── */
function TeamPicker({ pages, stickers, currentIndex, onSelect, onClose }: {
  pages: TeamPage[]; stickers: StickerWithStatus[]; currentIndex: number
  onSelect: (i: number) => void; onClose: () => void
}) {
  const byTeam = new Map<string, StickerWithStatus[]>()
  for (const s of stickers) {
    const k = `${s.countryCode}-${s.section}`
    if (!byTeam.has(k)) byTeam.set(k, [])
    byTeam.get(k)!.push(s)
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(5,12,5,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />
      <div className="sheet-enter" style={{
        position: 'relative', background: 'var(--surface)',
        borderTop: '1px solid rgba(255,255,255,0.08)', borderRadius: '18px 18px 0 0',
        maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom,16px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 32, height: 3, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>
        <div style={{ padding: '4px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: '0.06em', color: 'var(--text)' }}>
            Escolher Time
          </span>
          <button onClick={onClose} style={{ ...btnIcon, width: 30, height: 30, borderRadius: 7 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {GROUPS.map(g => {
            const sec = SECTIONS.find(s => s.id === g.group)
            return (
              <div key={g.group}>
                <div style={{
                  padding: '5px 16px', fontSize: 9, fontWeight: 700,
                  color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: 'rgba(255,255,255,0.02)',
                }}>
                  {sec?.label ?? `Grupo ${g.group}`}
                </div>
                {g.teams.map(t => {
                  const idx = pages.findIndex(p => p.code === t.code && p.group === g.group)
                  const ts  = byTeam.get(`${t.code}-${g.group}`) ?? []
                  const pct = ts.length > 0 ? Math.round((ts.filter(s => s.status !== 'missing').length / ts.length) * 100) : 0
                  const active = idx === currentIndex
                  return (
                    <PickerRow key={t.code} code={t.code} name={t.name} pct={pct} active={active}
                      onClick={() => idx >= 0 && onSelect(idx)} />
                  )
                })}
              </div>
            )
          })}

          {[
            { code: 'FWC', name: 'FWC History', group: 'FWC' },
            { code: 'CC',  name: 'Coca-Cola',   group: 'CC'  },
          ].map(t => {
            const idx = pages.findIndex(p => p.code === t.code)
            const ts  = byTeam.get(`${t.code}-${t.group}`) ?? []
            const pct = ts.length > 0 ? Math.round((ts.filter(s => s.status !== 'missing').length / ts.length) * 100) : 0
            return (
              <PickerRow key={t.code} code={t.code} name={t.name} pct={pct} active={idx === currentIndex}
                onClick={() => idx >= 0 && onSelect(idx)} />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PickerRow({ code, name, pct, active, onClick }: {
  code: string; name: string; pct: number; active: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '9px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      background: active ? 'var(--green-dim)' : 'transparent',
      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{
        fontFamily: "'Bebas Neue',sans-serif", fontSize: 11,
        color: active ? '#fff' : 'var(--green)',
        background: active ? 'var(--green)' : 'var(--green-dim)',
        padding: '2px 7px', borderRadius: 4, lineHeight: '17px', minWidth: 44, textAlign: 'center',
        border: '1px solid rgba(22,163,74,0.2)',
      }}>
        {code}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'Outfit,sans-serif' }}>{name}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, flexShrink: 0,
        color: pct === 100 ? 'var(--gold)' : pct > 0 ? 'var(--green)' : 'var(--text-dim)',
      }}>
        {pct === 100 ? '✦' : pct > 0 ? `${pct}%` : '—'}
      </span>
    </button>
  )
}
