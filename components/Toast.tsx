'use client'
import type { ToastState } from '@/hooks/useToast'

const BG: Record<string, string> = {
  info:    'var(--surface-elevated)',
  success: 'var(--green-dim)',
  error:   'rgba(220,38,38,0.10)',
}
const COLOR: Record<string, string> = {
  info:    'var(--text)',
  success: 'var(--green-mid)',
  error:   '#dc2626',
}

export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null
  return (
    <div
      key={toast.id}
      style={{
        position: 'fixed',
        bottom: 88,
        left: '50%',
        zIndex: 100,
        background: BG[toast.variant] ?? BG.info,
        color: COLOR[toast.variant] ?? COLOR.info,
        padding: '10px 20px',
        borderRadius: 24,
        fontSize: 13,
        fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
        whiteSpace: 'nowrap',
        animation: 'toast-in 0.2s ease forwards',
        border: '1px solid var(--border)',
        pointerEvents: 'none',
      }}
    >
      {toast.message}
    </div>
  )
}
