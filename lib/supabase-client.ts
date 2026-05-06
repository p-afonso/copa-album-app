'use client'
import { createClient } from '@supabase/supabase-js'

// 'copa_remember_me' = '0' → sessionStorage (esquece ao fechar o browser)
// qualquer outro valor → localStorage (padrão, persiste 30+ dias)
function getAuthStorage(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  return window.localStorage.getItem('copa_remember_me') === '0'
    ? window.sessionStorage
    : window.localStorage
}

export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: getAuthStorage(),
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)
