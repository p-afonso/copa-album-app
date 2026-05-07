'use client'
import { useRef } from 'react'
import { SECTIONS } from '@/lib/sticker-data'
import type { ToastVariant } from '@/hooks/useToast'

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

type Props = {
  activeSection: string
  search: string
  onSectionChange: (s: string) => void
  onSearchChange: (s: string) => void
  quickMode: boolean
  onQuickModeChange: (v: boolean) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (v: StatusFilter) => void
  repeatedCount: number
  showToast: (msg: string, variant?: ToastVariant) => void
}

export function FilterBar({
  activeSection, search, onSectionChange, onSearchChange,
  quickMode, onQuickModeChange,
  statusFilter, onStatusFilterChange,
  repeatedCount, showToast,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function selectSection(id: string) {
    onSectionChange(id)
    setTimeout(() => {
      const el = document.getElementById(`pill-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }, 50)
  }

  function toggleQuickMode() {
    const next = !quickMode
    onQuickModeChange(next)
    localStorage.setItem('copa_quick_mode', next ? '1' : '0')
    showToast(
      next ? 'Modo rápido ativado — toque para marcar' : 'Modo rápido desativado',
      next ? 'success' : 'info',
    )
  }

  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <style>{`.pills-ref::-webkit-scrollbar{display:none}`}</style>

      {/* Search row */}
      <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
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

        {/* Quick-add toggle */}
        <button
          onClick={toggleQuickMode}
          title={quickMode ? 'Desativar modo rápido' : 'Ativar modo rápido'}
          style={{
            flexShrink: 0,
            width: 38, height: 38,
            borderRadius: 10,
            border: quickMode ? '1.5px solid var(--green-mid)' : '1.5px solid var(--border)',
            background: quickMode ? 'var(--green)' : 'var(--surface-2)',
            color: quickMode ? '#ffffff' : 'var(--text-muted)',
            fontSize: 16,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
        >
          ⚡
        </button>
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
          padding: '0 12px 8px',
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

      {/* Status filter pills */}
      <div style={{
        display: 'flex',
        gap: 5,
        padding: '0 12px 10px',
      }}>
        {(['all', 'missing', 'obtained', 'repeated'] as const).map((f) => {
          const labelMap: Record<StatusFilter, string> = {
            all: 'Todas',
            missing: 'Faltando',
            obtained: 'Obtidas',
            repeated: repeatedCount > 0 ? `Repetidas (${repeatedCount})` : 'Repetidas',
          }
          return (
            <StatusPill
              key={f}
              label={labelMap[f]}
              active={statusFilter === f}
              onClick={() => onStatusFilterChange(f)}
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
        fontSize: 13,
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

function StatusPill({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 26,
        padding: '0 10px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--surface-2)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        border: active ? '1.5px solid var(--border-2)' : '1.5px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  )
}
