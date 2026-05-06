export function StickerGridSkeleton() {
  const fakeTeams = [
    { section: 'Grupo A', teams: ['MEX', 'RSA', 'KOR', 'CZE'] },
    { section: 'Grupo B', teams: ['CAN', 'BIH', 'QAT', 'SUI'] },
    { section: 'Grupo C', teams: ['BRA', 'MAR', 'HAI', 'SCO'] },
  ]

  return (
    <div style={{ paddingBottom: 32 }}>
      {fakeTeams.map((sec) => (
        <div key={sec.section} style={{ marginBottom: 24 }}>
          {/* Section header skeleton */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 16px 8px',
          }}>
            <div style={{ width: 3, height: 18, borderRadius: 99, background: 'var(--border)' }} />
            <div className="skeleton-shimmer" style={{ width: 80, height: 18, borderRadius: 6 }} />
            <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 4 }} />
          </div>

          {sec.teams.map((code) => (
            <div key={code} style={{ padding: '0 12px', marginBottom: 14 }}>
              {/* Team header skeleton */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div className="skeleton-shimmer" style={{ width: 36, height: 18, borderRadius: 5 }} />
                <div className="skeleton-shimmer" style={{ width: 100, height: 14, borderRadius: 4 }} />
              </div>

              {/* Progress bar skeleton */}
              <div style={{
                height: 3, background: 'var(--border)', borderRadius: 99, marginBottom: 7,
              }} />

              {/* Card grid skeleton — 7 cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
              }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="skeleton-shimmer"
                    style={{ aspectRatio: '1', borderRadius: 8 }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
