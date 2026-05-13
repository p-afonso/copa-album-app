'use client'

type Props = {
  search: string
  onSearchChange: (s: string) => void
  onScan?: () => void
}

export function FilterBar({ search, onSearchChange, onScan }: Props) {
  return (
    <div style={{
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      padding: '10px 12px',
      display: 'flex', gap: 8, alignItems: 'center',
    }}>
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

      {onScan && (
        <button
          onClick={onScan}
          title="Modo leitura — marcar página por página"
          style={{
            height: 38, width: 44, borderRadius: 10, flexShrink: 0,
            background: 'var(--green-dim)',
            border: '1.5px solid var(--green)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="4" width="14" height="2" rx="1" fill="var(--green)" />
            <rect x="2" y="8" width="10" height="2" rx="1" fill="var(--green)" />
            <rect x="2" y="12" width="12" height="2" rx="1" fill="var(--green)" />
          </svg>
        </button>
      )}
    </div>
  )
}
