'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'

type Props = { onDone: () => void }

export function SetPasswordScreen({ onDone }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 10,
    border: '1.5px solid var(--border)', background: 'var(--bg)',
    color: 'var(--text)', fontSize: 15, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true)
    const { error } = await supabaseBrowser.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      onDone()
    }
    setLoading(false)
  }

  const disabled = loading || !password || !confirm

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px', background: 'var(--bg)',
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1 }}>
          COPA <span style={{ color: 'var(--green)' }}>2026</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
          Álbum de Figurinhas
        </div>
      </div>

      <div style={{
        width: '100%', maxWidth: 360, background: 'var(--surface)',
        border: '1px solid var(--border)', borderRadius: 16, padding: '24px 24px 28px',
      }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          Definir senha
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Escolha uma senha para acessar sua conta.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--green)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          <input
            type="password"
            placeholder="Confirmar senha"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--green)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: '#fef2f2', borderRadius: 8 }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={disabled}
            style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: disabled ? 'var(--border)' : 'var(--green)',
              color: disabled ? 'var(--text-muted)' : '#fff',
              fontSize: 15, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', marginTop: 4,
            }}
          >
            {loading ? 'Salvando…' : 'Salvar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
