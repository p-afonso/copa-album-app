'use client'
import { useState, useEffect } from 'react'
import { trpc } from '@/lib/trpc'

type Props = { onComplete: () => void }

export function OnboardingScreen({ onComplete }: Props) {
  const [input, setInput] = useState('')
  const [debouncedUsername, setDebouncedUsername] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedUsername(input.trim()), 400)
    return () => clearTimeout(id)
  }, [input])

  const isValidFormat = /^[a-zA-Z0-9_]{3,20}$/.test(debouncedUsername)

  const { data: checkData, isFetching: checking } = trpc.profile.checkUsername.useQuery(
    { username: debouncedUsername },
    { enabled: isValidFormat },
  )

  const createProfile = trpc.profile.create.useMutation({
    onSuccess: () => onComplete(),
    onError: (e) => {
      setSubmitError(
        e.message.toLowerCase().includes('existe')
          ? 'Username indisponível, tente outro'
          : e.message,
      )
    },
  })

  const isAvailable = checkData?.available === true
  const canSubmit = isValidFormat && isAvailable && !checking && !createProfile.isPending

  let statusMsg = ''
  let statusColor = 'var(--text-dim)'
  if (debouncedUsername.length >= 1) {
    if (!isValidFormat) {
      statusMsg = 'Apenas letras, números e _ (3–20 caracteres)'
      statusColor = 'var(--red)'
    } else if (checking) {
      statusMsg = 'Verificando…'
    } else if (isAvailable) {
      statusMsg = `@${debouncedUsername} está disponível`
      statusColor = 'var(--green)'
    } else if (checkData?.available === false) {
      statusMsg = 'Username indisponível'
      statusColor = 'var(--red)'
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitError(null)
    createProfile.mutate({ username: input.trim() })
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
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.04em' }}>
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
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Escolha seu username
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Será usado para identificar você nas trocas.
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 15, color: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none',
            }}>@</span>
            <input
              type="text"
              placeholder="seu_username"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSubmitError(null) }}
              maxLength={20}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '11px 14px 11px 28px',
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
          </div>

          <div style={{ fontSize: 12, color: submitError ? 'var(--red)' : statusColor, paddingLeft: 2, minHeight: 16 }}>
            {submitError ?? statusMsg ?? '3–20 caracteres, letras, números e _'}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: 4,
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              border: 'none',
              background: canSubmit ? 'var(--green)' : 'var(--border)',
              color: canSubmit ? '#fff' : 'var(--text-muted)',
              fontSize: 15,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {createProfile.isPending ? 'Salvando…' : 'Confirmar'}
          </button>
        </form>
      </div>
    </div>
  )
}
