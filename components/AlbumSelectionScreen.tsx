'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type Album = {
  id: string
  name: string
  type: 'personal' | 'shared'
  role: 'owner' | 'member'
  memberCount: number
  progress: { obtained: number; total: number }
}

type Props = {
  albums: Album[]
  username: string
  onSelect: (albumId: string) => void
  onRefetch: () => Promise<unknown>
}

export function AlbumSelectionScreen({ albums, username, onSelect, onRefetch }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'personal' | 'shared'>('personal')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = trpc.albums.create.useMutation({
    onSuccess: async (result) => {
      await onRefetch()
      onSelect(result.albumId)
    },
    onError: (err) => setError(err.message),
  })

  const join = trpc.albums.join.useMutation({
    onSuccess: async (result) => {
      await onRefetch()
      onSelect(result.albumId)
    },
    onError: (err) => setError(err.message),
  })

  function handleCreate() {
    if (!newName.trim()) return
    setError(null)
    create.mutate({ name: newName.trim(), type: newType })
  }

  function handleJoin() {
    if (joinCode.length !== 6) return
    setError(null)
    join.mutate({ inviteCode: joinCode.toUpperCase() })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--green)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 26, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
        }}>
          COPA <span style={{ color: 'var(--green)' }}>2026</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22, letterSpacing: '0.04em', color: 'var(--text)',
          }}>
            Seus Álbuns
          </div>
        </div>

        {/* Album list */}
        {albums.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '60px 24px', gap: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>📒</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>
              Nenhum álbum ainda
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: 8, padding: '12px 28px', borderRadius: 14,
                background: 'linear-gradient(150deg,#22c55e,#15803d)',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Criar meu primeiro álbum
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {albums.map((a) => {
              const pct = Math.round((a.progress.obtained / a.progress.total) * 100)
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 16, background: 'var(--surface)',
                    border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                        {a.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: a.type === 'shared' ? 'var(--gold)' : 'var(--green)',
                          background: a.type === 'shared' ? '#fef3c7' : 'var(--green-dim)',
                          border: `1px solid ${a.type === 'shared' ? '#fde68a' : '#86efac'}`,
                          borderRadius: 6, padding: '2px 6px',
                        }}>
                          {a.type === 'shared' ? 'Compartilhado' : 'Pessoal'}
                        </span>
                        {a.type === 'shared' && (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            👥 {a.memberCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: pct > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
                      {pct}%
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg,#22c55e,#15803d)',
                      minWidth: pct > 0 ? 4 : 0,
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                    {a.progress.obtained} de {a.progress.total} figurinhas
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Action buttons */}
        {albums.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); setError(null) }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                background: 'var(--green-dim)', border: '1.5px solid #86efac',
                color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              + Novo álbum
            </button>
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); setError(null) }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Entrar com código
            </button>
          </div>
        )}

        {/* Create modal inline */}
        {showCreate && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              Novo álbum
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do álbum"
              maxLength={50}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {(['personal', 'shared'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    background: newType === t ? (t === 'shared' ? '#fef3c7' : 'var(--green-dim)') : 'var(--surface-2)',
                    border: `1.5px solid ${newType === t ? (t === 'shared' ? '#fde68a' : '#86efac') : 'var(--border)'}`,
                    color: newType === t ? (t === 'shared' ? 'var(--gold)' : 'var(--green)') : 'var(--text-muted)',
                  }}
                >
                  {t === 'personal' ? 'Pessoal' : 'Compartilhado'}
                </button>
              ))}
            </div>
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setShowCreate(false); setError(null) }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || create.isPending}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: !newName.trim() || create.isPending ? 0.5 : 1,
                }}
              >
                {create.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        )}

        {/* Join modal inline */}
        {showJoin && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              Entrar com código de convite
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: '0.15em', textAlign: 'center', boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setShowJoin(false); setError(null) }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleJoin}
                disabled={joinCode.length !== 6 || join.isPending}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: joinCode.length !== 6 || join.isPending ? 0.5 : 1,
                }}
              >
                {join.isPending ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
