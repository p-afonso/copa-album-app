export type Tab = 'album' | 'repeated' | 'trades' | 'profile'

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
  pendingTradesCount?: number
}

export function TabBar({ activeTab, onChange, pendingTradesCount = 0 }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'album', label: 'Álbum' },
    { id: 'repeated', label: 'Repetidas' },
    { id: 'trades', label: 'Trocas' },
    { id: 'profile', label: 'Perfil' },
  ]

  return (
    <div className="glass" style={{ display: 'flex', gap: 6, borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
      {tabs.map(({ id, label }) => {
        const active = activeTab === id
        const badge = id === 'trades' && pendingTradesCount > 0 ? pendingTradesCount : 0
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1, height: 40, border: 'none',
              borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: active ? 600 : 400,
              fontFamily: 'Outfit, sans-serif',
              color: active ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s ease', position: 'relative',
            }}
          >
            {label}
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: '18%',
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 700, borderRadius: 99,
                minWidth: 14, height: 14, lineHeight: '14px',
                textAlign: 'center', padding: '0 3px',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
