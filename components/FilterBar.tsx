'use client'
import { useRef } from 'react'

type StatusFilter = 'all' | 'missing' | 'obtained' | 'repeated'

type Props = {
  search: string
  onSearchChange: (s: string) => void
  statusFilter?: StatusFilter
  onStatusFilterChange?: (v: StatusFilter) => void
  missingCount?: number
  obtainedCount?: number
  repeatedCount?: number
  onScan?: () => void
}

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'missing', label: 'Faltando' },
  { id: 'obtained', label: 'Obtidas' },
  { id: 'repeated', label: 'Repetidas' },
]

export function FilterBar({
  search,
  onSearchChange,
  statusFilter = 'all',
  onStatusFilterChange,
  missingCount,
  obtainedCount,
  repeatedCount,
  onScan,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div style={{ padding: '0 12px 12px' }}>
      <div style={{ position: 'relative', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}
            width="16" height="16" viewBox="0 0 16 16" fill="none"
          >
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Buscar figurinha..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              borderRadius: 12,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid var(--glass-border)',
              paddingLeft: 38,
              paddingRight: search ? 36 : 12,
              fontSize: 14,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'Outfit, sans-serif',
            }}
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--border)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--text-muted)',
              }}
            >✕</button>
          )}
        </div>

        {onScan && (
          <button
            onClick={onScan}
            title="Modo leitura — escanear página com IA"
            style={{
              height: 40, width: 44, borderRadius: 12, flexShrink: 0,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--green)',
              fontSize: 18,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="8" width="10" height="2" rx="1" fill="currentColor" />
              <rect x="2" y="12" width="12" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
        )}

        </div>

      {onStatusFilterChange && (
        <div
          ref={scrollRef}
          className="pills-scroll"
          style={{ margin: '0 -12px', padding: '0 12px' }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const active = statusFilter === opt.id
            const count =
              opt.id === 'all' ? null :
              opt.id === 'missing' ? missingCount :
              opt.id === 'obtained' ? obtainedCount :
              repeatedCount

            return (
              <button
                key={opt.id}
                onClick={() => onStatusFilterChange(opt.id)}
                className={active ? 'card-pop' : ''}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px',
                  borderRadius: 20,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'Outfit, sans-serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  background: active
                    ? opt.id === 'all' ? 'var(--text)' :
                      opt.id === 'missing' ? 'var(--text)' :
                      opt.id === 'obtained' ? 'var(--green)' : 'var(--gold)'
                    : 'var(--glass-bg)',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {opt.label}
                {count !== null && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    opacity: 0.8,
                  }}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
