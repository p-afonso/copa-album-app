export type Tab = 'album' | 'repeated'

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ activeTab, onChange }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'album', label: 'Álbum' },
    { id: 'repeated', label: 'Repetidas' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {tabs.map(({ id, label }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              height: 42,
              border: 'none',
              borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
              letterSpacing: active ? '0.06em' : 'normal',
              color: active ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
