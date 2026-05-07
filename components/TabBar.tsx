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
    <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {tabs.map(({ id, label }) => {
        const active = activeTab === id
        const badge = id === 'trades' && pendingTradesCount > 0 ? pendingTradesCount : 0
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1, height: 42, border: 'none',
              borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: active ? 700 : 500,
              fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
              letterSpacing: active ? '0.06em' : 'normal',
              color: active ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s ease', position: 'relative',
            }}
          >
            {label}
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '16%',
                background: 'var(--red)', color: '#fff',
                fontSize: 10, fontWeight: 700, borderRadius: 99,
                minWidth: 16, height: 16, lineHeight: '16px',
                textAlign: 'center', padding: '0 4px',
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
