'use client'
import { useRef } from 'react'
import { SECTIONS } from '@/lib/sticker-data'

type Props = {
  activeSection: string
  search: string
  onSectionChange: (s: string) => void
  onSearchChange: (s: string) => void
}

export function FilterBar({ activeSection, search, onSectionChange, onSearchChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function selectSection(id: string) {
    onSectionChange(id)
    setTimeout(() => {
      const el = document.getElementById(`pill-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }, 50)
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <style>{`.pills-ref::-webkit-scrollbar{display:none}`}</style>
      {/* Search */}
      <div style={{ padding: '10px 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="15" height="15" viewBox="0 0 15 15" fill="none"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--text-dim)" strokeWidth="1.5" />
            <path d="M10 10L13 13" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar figurinha..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: 38,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1.5px solid var(--border)',
              paddingLeft: 32,
              paddingRight: search ? 36 : 12,
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'Outfit, sans-serif',
              transition: 'border-color 0.15s ease',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--green)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--border-2)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'var(--text-muted)',
              }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Section pills */}
      <div
        ref={scrollRef}
        className="pills-ref"
        style={{
          display: 'flex',
          gap: 5,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '0 12px 10px',
          touchAction: 'pan-x',
          overscrollBehaviorX: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } as React.CSSProperties}
      >
        <Pill id="all" label="Todos" active={activeSection === 'all'} onClick={() => selectSection('all')} />
        {SECTIONS.map((sec) => {
          const label = sec.id === 'FWC' ? 'FWC' : sec.id === 'CC' ? 'Cola' : sec.id
          return (
            <Pill
              key={sec.id}
              id={sec.id}
              label={label}
              active={activeSection === sec.id}
              onClick={() => selectSection(sec.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

function Pill({ id, label, active, onClick }: {
  id: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      id={`pill-${id}`}
      onClick={onClick}
      style={{
        flexShrink: 0,
        height: 30,
        padding: '0 13px',
        borderRadius: 99,
        fontSize: active ? 13 : 13,
        fontWeight: active ? 700 : 500,
        fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
        letterSpacing: active ? '0.06em' : 'normal',
        background: active ? 'var(--green)' : 'var(--surface-2)',
        color: active ? '#ffffff' : 'var(--text-muted)',
        border: active ? '1.5px solid var(--green-mid, #15803d)' : '1.5px solid var(--border)',
        transition: 'all 0.15s ease',
        cursor: 'pointer',
        boxShadow: active ? '0 2px 8px rgba(21,128,61,0.25)' : 'none',
      } as React.CSSProperties}
    >
      {label}
    </button>
  )
}
