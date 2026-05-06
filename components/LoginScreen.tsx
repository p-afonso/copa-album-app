'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-client'

type Step = 'form' | 'sent'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setStep('sent')
    }
  }

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
        padding: '28px 24px',
      }}>
        {step === 'form' ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Entrar
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Enviaremos um link para o seu e-mail.
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: '1.5px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  fontSize: 15,
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
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
                disabled={loading || !email}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: 'none',
                  background: loading || !email ? 'var(--border)' : 'var(--green)',
                  color: loading || !email ? 'var(--text-muted)' : '#fff',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: loading || !email ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✉️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Link enviado!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Verifique seu e-mail <strong>{email}</strong> e clique no link para entrar.
            </div>
            <button
              onClick={() => { setStep('form'); setEmail('') }}
              style={{
                marginTop: 20,
                fontSize: 13,
                color: 'var(--green)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Usar outro e-mail
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
