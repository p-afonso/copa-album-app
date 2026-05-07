'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { EmptyState } from './EmptyState'

type Props = { username: string; onUsernameChange: () => void }

export function ProfileView({ username, onUsernameChange }: Props) {
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState(username)
  const [editingPhone, setEditingPhone] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  const utils = trpc.useUtils()
  const { data: profileData } = trpc.profile.get.useQuery()
  const { data: history = [] } = trpc.profile.getTradeHistory.useQuery()

  const updateUsername = trpc.profile.updateUsername.useMutation({
    onSuccess: (data) => {
      utils.profile.get.invalidate()
      onUsernameChange()
      setEditingUsername(false)
      setNewUsername(data.username)
    },
  })

  const updatePhone = trpc.profile.updatePhone.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate()
      setEditingPhone(false)
    },
  })

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (password.length < 6) { setPwError('Mínimo 6 caracteres'); return }
    if (password !== confirmPassword) { setPwError('As senhas não coincidem'); return }
    setPwLoading(true)
    const { error } = await supabaseBrowser.auth.updateUser({ password })
    if (error) { setPwError(error.message) } else { setPwSuccess(true); setPassword(''); setConfirmPassword('') }
    setPwLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
    background: 'var(--bg)', color: 'var(--text)', fontSize: 14,
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  }

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(newUsername) && newUsername !== username
  const currentPhone = profileData?.phone ?? null

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 22, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em', color: 'var(--text)' }}>
          @{username}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>Copa 2026 · Álbum de Figurinhas</div>
      </div>

      {/* Username section */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Nome de usuário
        </div>
        {!editingUsername ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: 15, color: 'var(--text)' }}>@{username}</span>
            <button
              onClick={() => { setNewUsername(username); setEditingUsername(true) }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Alterar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="novo_username"
              maxLength={20}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            {updateUsername.error && (
              <div style={{ fontSize: 12, color: 'var(--red)' }}>{updateUsername.error.message}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => updateUsername.mutate({ username: newUsername })}
                disabled={!usernameValid || updateUsername.isPending}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: 'none',
                  background: usernameValid ? 'var(--green)' : 'var(--border)',
                  color: usernameValid ? '#fff' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: 600, cursor: usernameValid ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
                }}
              >
                {updateUsername.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditingUsername(false)}
                style={{
                  padding: '0 16px', height: 38, borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--surface-2)', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Phone section */}
      <div style={{ padding: '16px 16px 0', borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Telefone para contato
        </div>
        {!editingPhone ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
            <span style={{ fontSize: 15, color: currentPhone ? 'var(--text)' : 'var(--text-dim)' }}>
              {currentPhone ?? 'Não informado'}
            </span>
            <button
              onClick={() => { setNewPhone(currentPhone ?? ''); setEditingPhone(true) }}
              style={{
                padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)',
                background: 'var(--surface-2)', color: 'var(--text-muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {currentPhone ? 'Alterar' : 'Adicionar'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="tel"
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Compartilhado só quando uma troca é aceita</div>
            {updatePhone.error && (
              <div style={{ fontSize: 12, color: 'var(--red)' }}>{updatePhone.error.message}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => updatePhone.mutate({ phone: newPhone.trim() || null })}
                disabled={updatePhone.isPending}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: 'none',
                  background: 'var(--green)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: updatePhone.isPending ? 0.6 : 1,
                }}
              >
                {updatePhone.isPending ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditingPhone(false)}
                style={{
                  padding: '0 16px', height: 38, borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--surface-2)', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Password section */}
      <div style={{ padding: '16px 16px 0', borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Senha
        </div>
        {!showChangePassword ? (
          <button
            onClick={() => { setShowChangePassword(true); setPwSuccess(false) }}
            style={{
              padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 15, color: 'var(--text)', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            {pwSuccess ? '✓ Senha alterada com sucesso' : 'Alterar senha →'}
          </button>
        ) : (
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="password" placeholder="Nova senha" value={password}
              onChange={e => setPassword(e.target.value)} required style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            <input type="password" placeholder="Confirmar senha" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }} />
            {pwError && <div style={{ fontSize: 12, color: 'var(--red)' }}>{pwError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={pwLoading}
                style={{
                  flex: 1, height: 38, borderRadius: 8, border: 'none',
                  background: 'var(--green)', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  opacity: pwLoading ? 0.6 : 1,
                }}>
                {pwLoading ? 'Salvando…' : 'Salvar senha'}
              </button>
              <button type="button" onClick={() => setShowChangePassword(false)}
                style={{
                  padding: '0 16px', height: 38, borderRadius: 8, border: '1.5px solid var(--border)',
                  background: 'var(--surface-2)', color: 'var(--text-muted)',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Trade history */}
      <div style={{ padding: '16px 16px 0', borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Histórico de trocas ({history.length})
        </div>
        {history.length === 0 ? (
          <EmptyState
            icon="🤝"
            title="Nenhuma troca concluída"
            subtitle="Suas trocas aceitas aparecem aqui com o contato da outra pessoa."
          />
        ) : (
          history.map(h => (
            <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>@{h.otherUsername}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(h.date).toLocaleDateString('pt-BR')}</span>
              </div>
              <div style={{ marginTop: 2 }}>
                <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{h.gave.id}</span>
                {' '}{h.gave.countryName}
                <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>→</span>
                <span style={{ color: 'var(--green)', fontFamily: "'Bebas Neue', sans-serif" }}>{h.received.id}</span>
                {' '}{h.received.countryName}
              </div>
              {h.otherPhone && (
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-dim)' }}>
                  Contato: <a href={`tel:${h.otherPhone}`} style={{ color: 'var(--green)', textDecoration: 'none' }}>{h.otherPhone}</a>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Sign out */}
      <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border)', marginTop: 16 }}>
        <button
          onClick={() => supabaseBrowser.auth.signOut()}
          style={{
            width: '100%', height: 46, borderRadius: 12, border: '1.5px solid rgba(220,38,38,0.3)',
            background: 'rgba(220,38,38,0.06)', color: '#dc2626',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Sair da conta
        </button>
      </div>
    </div>
  )
}
