'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'

type Mode = 'login' | 'register'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function switchMode(m: Mode) {
    setMode(m)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password })
      if (error) setError(translateError(error.message))
    } else {
      const { error } = await supabaseBrowser.auth.signUp({ email, password })
      if (error) {
        setError(translateError(error.message))
      } else {
        setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
      }
    }

    setLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 10,
    border: '1.5px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: 15,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  const isDisabled = loading || !email || !password || (mode === 'register' && !confirmPassword)

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 20px',
      background: 'var(--bg)',
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 52,
          letterSpacing: '0.06em',
          color: 'var(--text)',
          lineHeight: 1,
        }}>
          COPA <span style={{ color: 'var(--green)' }}>2026</span>
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginTop: 6,
          letterSpacing: '0.04em',
        }}>
          Álbum de Figurinhas
        </div>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 360,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '24px 24px 28px',
      }}>
        {/* Mode tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 24,
        }}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: 7,
                border: 'none',
                background: mode === m ? 'var(--surface)' : 'transparent',
                color: mode === m ? 'var(--text)' : 'var(--text-muted)',
                fontSize: 14,
                fontWeight: mode === m ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {m === 'login' ? 'Entrar' : 'Cadastrar'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--green)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />

          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--green)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />

          {mode === 'register' && (
            <input
              type="password"
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--green)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
          )}

          {error && (
            <div style={{
              fontSize: 13, color: 'var(--red)',
              padding: '8px 12px', background: '#fef2f2', borderRadius: 8,
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              fontSize: 13, color: 'var(--green)',
              padding: '8px 12px', background: '#f0fdf4', borderRadius: 8,
            }}>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isDisabled}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: isDisabled ? 'var(--border)' : 'var(--green)',
              color: isDisabled ? 'var(--text-muted)' : '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
              marginTop: 4,
            }}
          >
            {loading ? (mode === 'login' ? 'Entrando…' : 'Criando conta…') : (mode === 'login' ? 'Entrar' : 'Criar conta')}
          </button>
        </form>
      </div>
    </div>
  )
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (msg.includes('User already registered')) return 'Este e-mail já está cadastrado.'
  if (msg.includes('Password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde um momento.'
  return msg
}
