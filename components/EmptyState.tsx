'use client'

type Props = {
  icon: string
  title: string
  subtitle: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 32px', gap: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40, opacity: 0.35, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 280 }}>
        {subtitle}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: '10px 20px', borderRadius: 24,
            background: 'var(--green)', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(22,163,74,0.28)',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
