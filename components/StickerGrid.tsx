'use client'
import { StickerCard } from './StickerCard'
import type { StickerDef } from '@/lib/sticker-data'
import { SECTIONS } from '@/lib/sticker-data'

type StickerWithStatus = StickerDef & {
  status: 'missing' | 'obtained' | 'repeated'
  quantity: number
}

type Props = {
  stickers: StickerWithStatus[]
  activeSection: string
  search: string
  onAction: (id: string) => void
}

export function StickerGrid({ stickers, activeSection, search, onAction }: Props) {
  const filtered = stickers.filter((s) => {
    const matchSection = activeSection === 'all' || s.section === activeSection
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.id.toLowerCase().includes(q) ||
      s.countryName.toLowerCase().includes(q) ||
      s.number.includes(q)
    return matchSection && matchSearch
  })

  const sections =
    activeSection === 'all'
      ? SECTIONS
      : SECTIONS.filter((sec) => sec.id === activeSection)

  return (
    <div style={{ paddingBottom: 32 }}>
      {sections.map((sec) => {
        const secStickers = filtered.filter((s) => s.section === sec.id)
        if (secStickers.length === 0) return null

        const teams =
          sec.id === 'FWC' || sec.id === 'CC'
            ? [{ code: sec.id, name: sec.label }]
            : sec.teams

        return (
          <div key={sec.id} style={{ marginBottom: 24 }}>
            {/* Section header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px 8px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--bg)',
            }}>
              <div style={{
                width: 3, height: 18,
                borderRadius: 99,
                background: 'var(--green)',
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 18,
                letterSpacing: '0.08em',
                color: 'var(--text)',
                lineHeight: 1,
              }}>
                {sec.label}
              </span>
              <div style={{
                flex: 1, height: 1,
                background: 'var(--border)',
                marginLeft: 4,
              }} />
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-dim)',
              }}>
                {secStickers.filter(s => s.status !== 'missing').length}/{secStickers.length}
              </span>
            </div>

            {teams.map((team) => {
              const teamStickers = secStickers.filter((s) => s.countryCode === team.code)
              if (teamStickers.length === 0) return null

              const obtained = teamStickers.filter((s) => s.status !== 'missing').length
              const pct = Math.round((obtained / teamStickers.length) * 100)
              const isComplete = pct === 100

              return (
                <div key={team.code} style={{ padding: '0 12px', marginBottom: 14 }}>
                  {/* Team header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}>
                    <span style={{
                      fontFamily: "'Bebas Neue', sans-serif",
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: isComplete ? 'var(--surface)' : 'var(--green)',
                      background: isComplete ? 'var(--green)' : 'var(--green-dim)',
                      padding: '2px 7px',
                      borderRadius: 5,
                      lineHeight: '18px',
                    }}>
                      {team.code}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}>
                      {team.name}
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isComplete ? 'var(--green)' : 'var(--text-dim)',
                      flexShrink: 0,
                    }}>
                      {obtained}/{teamStickers.length}
                    </span>
                  </div>

                  {/* Mini progress bar */}
                  <div style={{
                    height: 3,
                    background: 'var(--border)',
                    borderRadius: 99,
                    marginBottom: 7,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isComplete
                        ? 'linear-gradient(90deg, #22c55e, #15803d)'
                        : 'linear-gradient(90deg, #86efac, #22c55e)',
                      borderRadius: 99,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>

                  {/* Card grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: 4,
                  }}>
                    {teamStickers.map((s) => (
                      <StickerCard
                        key={s.id}
                        id={s.id}
                        number={s.number}
                        status={s.status}
                        quantity={s.quantity}
                        onAction={onAction}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
