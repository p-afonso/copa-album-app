'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type Props = {
  albumId: string
  albumName: string
  inviteCode: string
  isOwner: boolean
  currentUserId: string
  onClose: () => void
  onAlbumLeft: () => void
}

export function AlbumMembersSheet({ albumId, albumName, inviteCode, isOwner, currentUserId, onClose, onAlbumLeft }: Props) {
  const utils = trpc.useUtils()
  const [localCode, setLocalCode] = useState(inviteCode)
  const [copied, setCopied] = useState(false)

  const { data: members = [], refetch } = trpc.albums.getMembers.useQuery({ albumId })

  const regenerate = trpc.albums.regenerateCode.useMutation({
    onSuccess: (result) => {
      setLocalCode(result.inviteCode)
      utils.albums.list.invalidate()
    },
  })

  const removeMember = trpc.albums.removeMember.useMutation({
    onSuccess: () => refetch(),
  })

  const leave = trpc.albums.leave.useMutation({
    onSuccess: () => {
      utils.albums.list.invalidate()
      onAlbumLeft()
    },
  })

  function copyCode() {
    navigator.clipboard.writeText(localCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(24,40,24,0.45)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        className="sheet-enter"
        style={{
          position: 'relative', background: 'var(--surface)',
          borderTop: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
          maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>

        {/* Title */}
        <div style={{ padding: '8px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--text)', letterSpacing: '0.03em' }}>
            {albumName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            {members.length} membro{members.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* Invite code section */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
              Código de Convite
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, padding: '10px 14px', borderRadius: 10,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
                letterSpacing: '0.15em', color: 'var(--green)', textAlign: 'center',
              }}>
                {localCode}
              </div>
              <button
                onClick={copyCode}
                style={{
                  padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                  background: copied ? 'var(--green-dim)' : 'var(--surface-2)',
                  color: copied ? 'var(--green)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              {isOwner && (
                <button
                  onClick={() => regenerate.mutate({ albumId })}
                  disabled={regenerate.isPending}
                  style={{
                    padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)',
                    background: 'var(--surface-2)', color: 'var(--text-muted)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    opacity: regenerate.isPending ? 0.5 : 1,
                  }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* Members list */}
          <div>
            {members.map((m) => (
              <div key={m.userId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: m.role === 'owner' ? 'var(--green-dim)' : 'var(--surface-2)',
                    border: `1.5px solid ${m.role === 'owner' ? '#86efac' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: m.role === 'owner' ? 'var(--green)' : 'var(--text-dim)',
                  }}>
                    {m.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                      @{m.username}
                    </div>
                    <div style={{ fontSize: 11, color: m.role === 'owner' ? 'var(--green)' : 'var(--text-dim)' }}>
                      {m.role === 'owner' ? 'Dono' : 'Membro'}
                    </div>
                  </div>
                </div>
                {isOwner && m.userId !== currentUserId && (
                  <button
                    onClick={() => removeMember.mutate({ albumId, targetUserId: m.userId })}
                    disabled={removeMember.isPending}
                    style={{
                      width: 30, height: 30, borderRadius: 8,
                      border: '1px solid rgba(220,38,38,0.2)',
                      background: 'rgba(220,38,38,0.07)',
                      color: '#dc2626', fontSize: 16, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: removeMember.isPending ? 0.5 : 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Leave button (non-owner only) */}
          {!isOwner && (
            <div style={{ padding: 16 }}>
              <button
                onClick={() => leave.mutate({ albumId })}
                disabled={leave.isPending}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, fontSize: 14, fontWeight: 600,
                  color: '#dc2626', background: 'rgba(220,38,38,0.07)',
                  border: '1.5px solid rgba(220,38,38,0.2)', cursor: 'pointer',
                  opacity: leave.isPending ? 0.5 : 1,
                }}
              >
                Sair do álbum
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
