# Fase 1 — Username + Aba Repetidas + Export CSV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar username único com onboarding obrigatório, aba de repetidas com remoção unitária, export CSV, optimistic updates instantâneos no ActionSheet e skeleton loading no StickerGrid.

**Architecture:** Nova tabela `profiles` (username único) + tRPC router `profile` + tela `OnboardingScreen` bloqueante + navegação por duas abas (`AlbumApp` → TabBar) + `RepeatedView` com optimistic update + export CSV client-side + optimistic update no `ActionSheet` (fecha imediato, reverte em erro) + `StickerGridSkeleton` com shimmer.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Supabase (Postgres + RLS), React 19, TypeScript, inline styles (padrão do projeto)

---

## File Map

| Ação | Arquivo | Responsabilidade |
|---|---|---|
| Create | `supabase/migrations/004_profiles.sql` | Tabela profiles + RLS |
| Create | `server/routers/profile.ts` | tRPC: get, checkUsername, create |
| Modify | `server/routers/index.ts` | Registrar profileRouter no appRouter |
| Modify | `server/routers/stickers.ts` | Adicionar decrementRepeated |
| Create | `lib/export-csv.ts` | Geração de CSV client-side |
| Create | `components/OnboardingScreen.tsx` | Tela de escolha de username |
| Create | `components/TabBar.tsx` | Abas Álbum / Repetidas |
| Create | `components/RepeatedView.tsx` | Lista de repetidas + botão −1 + export |
| Modify | `components/AlbumApp.tsx` | Gate de onboarding + tabs + @username no header |
| Modify | `components/ActionSheet.tsx` | Optimistic update: fecha imediato + reverte em erro |
| Create | `components/StickerGridSkeleton.tsx` | Skeleton com shimmer para loading do grid |
| Modify | `components/AlbumApp.tsx` (2ª passagem) | Usar StickerGridSkeleton em vez do spinner de loading |
| Modify | `app/globals.css` | Adicionar animação shimmer |

---

## Task 1: Migration — tabela profiles

**Files:**
- Create: `supabase/migrations/004_profiles.sql`

- [ ] **Criar o arquivo de migration**

```sql
-- supabase/migrations/004_profiles.sql
create table profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  created_at timestamptz default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

create unique index profiles_username_idx on profiles (lower(username));

alter table profiles enable row level security;

-- Qualquer autenticado pode ler (necessário para busca nas trocas — Fase 3)
create policy "select_any" on profiles
  for select using (auth.role() = 'authenticated');

-- Só o próprio usuário insere/atualiza
create policy "insert_own" on profiles
  for insert with check (auth.uid() = user_id);

create policy "update_own" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Aplicar via Supabase MCP**

Use a ferramenta `mcp__plugin_supabase_supabase__apply_migration` com o conteúdo acima. Confirme que a migration aparece em `list_migrations` após aplicar.

- [ ] **Commit**

```bash
git add supabase/migrations/004_profiles.sql
git commit -m "feat: migration profiles — username único com RLS"
```

---

## Task 2: tRPC profile router

**Files:**
- Create: `server/routers/profile.ts`
- Modify: `server/routers/index.ts`

- [ ] **Criar `server/routers/profile.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'

const usernameSchema = z.string().regex(
  /^[a-zA-Z0-9_]{3,20}$/,
  'Username inválido: 3–20 caracteres, letras, números e _',
)

export const profileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('user_id', ctx.userId)
      .maybeSingle()
    return data ? { username: data.username } : null
  }),

  checkUsername: protectedProcedure
    .input(z.object({ username: z.string() }))
    .query(async ({ input }) => {
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(input.username)) {
        return { available: false }
      }
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .ilike('username', input.username)
        .maybeSingle()
      return { available: data === null }
    }),

  create: protectedProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert({ user_id: ctx.userId, username: input.username })
      if (error) {
        if (error.code === '23505') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Username já existe' })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      }
      return { username: input.username }
    }),
})
```

- [ ] **Registrar no appRouter em `server/routers/index.ts`**

```typescript
import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Commit**

```bash
git add server/routers/profile.ts server/routers/index.ts
git commit -m "feat: tRPC profile router — get, checkUsername, create"
```

---

## Task 3: tRPC stickers.decrementRepeated

**Files:**
- Modify: `server/routers/stickers.ts`

- [ ] **Adicionar procedure no final do `stickersRouter` (antes do fechamento `})`)**

Adicionar após `listDuplicates`:

```typescript
  decrementRepeated: protectedProcedure
    .input(z.object({ stickerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { data, error: fetchError } = await supabaseAdmin
        .from('user_stickers')
        .select('quantity')
        .eq('user_id', ctx.userId)
        .eq('sticker_id', input.stickerId)
        .maybeSingle()

      if (fetchError) throw new Error(fetchError.message)
      if (!data) throw new Error('Figurinha não encontrada')

      const qty = data.quantity

      if (qty <= 1) {
        const { error } = await supabaseAdmin
          .from('user_stickers')
          .delete()
          .eq('user_id', ctx.userId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing' as const, quantity: 0 }
      }

      if (qty === 2) {
        const { error } = await supabaseAdmin
          .from('user_stickers')
          .update({ status: 'obtained', quantity: 1, updated_at: new Date().toISOString() })
          .eq('user_id', ctx.userId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'obtained' as const, quantity: 1 }
      }

      const { error } = await supabaseAdmin
        .from('user_stickers')
        .update({ quantity: qty - 1, updated_at: new Date().toISOString() })
        .eq('user_id', ctx.userId)
        .eq('sticker_id', input.stickerId)
      if (error) throw new Error(error.message)
      return { status: 'repeated' as const, quantity: qty - 1 }
    }),
```

- [ ] **Commit**

```bash
git add server/routers/stickers.ts
git commit -m "feat: tRPC stickers.decrementRepeated — lógica de -1 com downgrade automático"
```

---

## Task 4: Utilitário de export CSV

**Files:**
- Create: `lib/export-csv.ts`

- [ ] **Criar `lib/export-csv.ts`**

```typescript
type StickerEntry = {
  id: string
  countryName: string
  section: string
  status: 'missing' | 'obtained' | 'repeated'
  quantity: number
}

function csvRow(fields: string[]): string {
  return fields
    .map((f) => (f.includes(',') || f.includes('"') ? `"${f.replace(/"/g, '""')}"` : f))
    .join(',')
}

export function generateCSV(stickers: StickerEntry[], username: string): void {
  const rows: string[] = ['tipo,id,nome,secao,quantidade']

  for (const s of stickers) {
    if (s.status === 'repeated') {
      rows.push(csvRow(['repetida', s.id, s.countryName, s.section, String(s.quantity)]))
    }
  }

  for (const s of stickers) {
    if (s.status === 'missing') {
      rows.push(csvRow(['faltando', s.id, s.countryName, s.section, '']))
    }
  }

  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().split('T')[0]
  const a = document.createElement('a')
  a.href = url
  a.download = `copa2026-@${username}-${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Commit**

```bash
git add lib/export-csv.ts
git commit -m "feat: utilitário generateCSV — export client-side de repetidas e faltando"
```

---

## Task 5: OnboardingScreen

**Files:**
- Create: `components/OnboardingScreen.tsx`

- [ ] **Criar `components/OnboardingScreen.tsx`**

```typescript
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
```

- [ ] **Commit**

```bash
git add components/OnboardingScreen.tsx
git commit -m "feat: OnboardingScreen — escolha de username com validação em tempo real"
```

---

## Task 6: TabBar

**Files:**
- Create: `components/TabBar.tsx`

- [ ] **Criar `components/TabBar.tsx`**

```typescript
export type Tab = 'album' | 'repeated'

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ activeTab, onChange }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'album', label: 'Álbum' },
    { id: 'repeated', label: 'Repetidas' },
  ]

  return (
    <div style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {tabs.map(({ id, label }) => {
        const active = activeTab === id
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1,
              height: 42,
              border: 'none',
              borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: active ? 700 : 500,
              fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
              letterSpacing: active ? '0.06em' : 'normal',
              color: active ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add components/TabBar.tsx
git commit -m "feat: TabBar — navegação Álbum / Repetidas"
```

---

## Task 7: RepeatedView

**Files:**
- Create: `components/RepeatedView.tsx`

- [ ] **Criar `components/RepeatedView.tsx`**

```typescript
'use client'
import { trpc } from '@/lib/trpc'
import { generateCSV } from '@/lib/export-csv'

type Props = { username: string }

export function RepeatedView({ username }: Props) {
  const { data: stickers = [] } = trpc.stickers.list.useQuery()
  const utils = trpc.useUtils()

  const decrement = trpc.stickers.decrementRepeated.useMutation({
    onMutate: async ({ stickerId }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData()
      utils.stickers.list.setData(undefined, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          if (s.quantity <= 1) return { ...s, status: 'missing' as const, quantity: 0 }
          if (s.quantity === 2) return { ...s, status: 'obtained' as const, quantity: 1 }
          return { ...s, quantity: s.quantity - 1 }
        }),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData(undefined, ctx.prev)
    },
    onSettled: () => {
      utils.stickers.list.invalidate()
      utils.stickers.getProgress.invalidate()
      utils.stickers.listDuplicates.invalidate()
    },
  })

  const repeated = stickers.filter((s) => s.status === 'repeated')
  const totalExtras = repeated.reduce((sum, s) => sum + (s.quantity - 1), 0)

  // Group by section
  const groups = repeated.reduce<Record<string, typeof repeated>>((acc, s) => {
    if (!acc[s.section]) acc[s.section] = []
    acc[s.section].push(s)
    return acc
  }, {})

  if (repeated.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px', gap: 8, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>✓</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Nenhuma figurinha repetida</div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {repeated.length} figurinha{repeated.length !== 1 ? 's' : ''} ·{' '}
          {totalExtras} extra{totalExtras !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => generateCSV(stickers, username)}
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            border: '1.5px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Exportar CSV
        </button>
      </div>

      {/* Groups */}
      {Object.entries(groups).map(([section, items]) => (
        <div key={section}>
          <div style={{
            padding: '5px 16px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
          }}>
            {section}
          </div>
          {items.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 14, letterSpacing: '0.04em',
                  color: 'var(--gold)', minWidth: 52,
                }}>
                  {s.id}
                </span>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {s.countryName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    ×{s.quantity - 1} extra{s.quantity - 1 !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => decrement.mutate({ stickerId: s.id })}
                disabled={decrement.isPending}
                style={{
                  width: 32, height: 32,
                  borderRadius: 8,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  fontSize: 20, lineHeight: 1,
                  cursor: decrement.isPending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'inherit',
                }}
              >
                −
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add components/RepeatedView.tsx
git commit -m "feat: RepeatedView — lista de repetidas com -1 optimistic + export CSV"
```

---

## Task 8: AlbumApp — onboarding gate + tabs + @username

**Files:**
- Modify: `components/AlbumApp.tsx`

Esta é a integração final. Substituir o arquivo inteiro pelo conteúdo abaixo:

- [ ] **Substituir `components/AlbumApp.tsx`**

```typescript
'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Session } from '@supabase/supabase-js'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { StickerGrid } from './StickerGrid'
import { ProgressPanel } from './ProgressPanel'
import { FilterBar } from './FilterBar'
import { ActionSheet } from './ActionSheet'
import { LoginScreen } from './LoginScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { TabBar, type Tab } from './TabBar'
import { RepeatedView } from './RepeatedView'

function LoadingSpinner() {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 48, letterSpacing: '0.05em', color: 'var(--green)', lineHeight: 1,
      }}>COPA 2026</div>
      <div style={{ width: 120, height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: '40%', background: 'var(--green)',
          borderRadius: 99, animation: 'loading-bar 1.2s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

export function AlbumApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [activeSection, setActiveSection] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('album')

  // Auth state
  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Profile
  const profile = trpc.profile.get.useQuery(undefined, { enabled: !!session })

  const { data: stickers = [], isLoading } = trpc.stickers.list.useQuery(
    undefined,
    { enabled: !!session && !!profile.data },
  )
  const utils = trpc.useUtils()

  // Supabase Realtime — sync entre dispositivos
  useEffect(() => {
    if (!session) return
    const channel = supabaseBrowser
      .channel('user_stickers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stickers' }, () => {
        utils.stickers.list.invalidate()
        utils.stickers.getProgress.invalidate()
        utils.stickers.listDuplicates.invalidate()
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [utils, session])

  const handleAction = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  // session === undefined → verificando
  if (session === undefined) return <LoadingSpinner />

  // não autenticado
  if (!session) return <LoginScreen />

  // perfil carregando
  if (profile.isLoading) return <LoadingSpinner />

  // sem username → onboarding
  if (profile.data === null) {
    return <OnboardingScreen onComplete={() => profile.refetch()} />
  }

  // stickers carregando
  if (isLoading) return <LoadingSpinner />

  const username = profile.data.username

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>

      {/* ─── Sticky header ─── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        {/* Logo bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          borderTop: '3px solid var(--green)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, minWidth: 60 }}>
            @{username}
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 26, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
          }}>
            COPA <span style={{ color: 'var(--green)' }}>2026</span>
          </div>
          <button
            onClick={() => supabaseBrowser.auth.signOut()}
            title="Sair"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', fontSize: 18, borderRadius: 8, minWidth: 32,
            }}
          >
            ⎋
          </button>
        </div>

        {/* Tabs */}
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {/* Album-only header content */}
        {activeTab === 'album' && (
          <>
            <ProgressPanel />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
            />
          </>
        )}
      </div>

      {/* ─── Content ─── */}
      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          <StickerGrid
            stickers={stickers}
            activeSection={activeSection}
            search={search}
            onAction={handleAction}
          />
        ) : (
          <RepeatedView username={username} />
        )}
      </div>

      {/* ─── Action sheet ─── */}
      {selectedId && (
        <ActionSheet
          stickerId={selectedId}
          status={stickers.find(s => s.id === selectedId)?.status ?? 'missing'}
          quantity={stickers.find(s => s.id === selectedId)?.quantity ?? 0}
          onClose={handleClose}
        />
      )}
    </div>
  )
}
```

- [ ] **Verificar no dev server**

```bash
npm run dev
```

Testar o fluxo completo:
1. Logout → login com magic link → deve aparecer `OnboardingScreen`
2. Tentar username inválido → feedback vermelho imediato
3. Tentar username já existente → "Username indisponível"
4. Confirmar username válido → app abre com `@username` no header
5. Ir na aba "Repetidas" → lista aparece ou estado vazio
6. Clicar em `−` numa figurinha repetida → quantidade diminui (optimistic)
7. Clicar em "Exportar CSV" → arquivo baixado com nome `copa2026-@username-YYYY-MM-DD.csv`

- [ ] **Commit final**

```bash
git add components/AlbumApp.tsx
git commit -m "feat: AlbumApp — onboarding gate, tabs álbum/repetidas, @username no header"
```

---

## Task 9: Optimistic update no ActionSheet

**Files:**
- Modify: `components/ActionSheet.tsx`

Substituir o bloco `useMutation` atual (linhas 16–23) pelo código abaixo. A mudança central: o ActionSheet fecha **imediatamente** em `onMutate` e já atualiza o cache local — o servidor confirma de forma assíncrona. Se o servidor falhar, o cache reverte.

- [ ] **Substituir o `useMutation` em `components/ActionSheet.tsx`**

Substituir:
```typescript
  const update = trpc.stickers.updateStatus.useMutation({
    onSuccess: () => {
      utils.stickers.list.invalidate()
      utils.stickers.getProgress.invalidate()
      utils.stickers.listDuplicates.invalidate()
      onClose()
    },
  })
```

Por:
```typescript
  const update = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ stickerId, status, quantity }) => {
      onClose()
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData()
      utils.stickers.list.setData(undefined, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          const newQty =
            status === 'repeated' ? (quantity ?? 2)
            : status === 'obtained' ? 1
            : 0
          return { ...s, status, quantity: newQty }
        }),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData(undefined, ctx.prev)
    },
    onSettled: () => {
      utils.stickers.list.invalidate()
      utils.stickers.getProgress.invalidate()
      utils.stickers.listDuplicates.invalidate()
    },
  })
```

- [ ] **Verificar comportamento no dev server**

```bash
npm run dev
```

1. Marcar uma figurinha como "obtida" → ActionSheet fecha instantaneamente, card muda de cor sem esperar resposta do servidor
2. Marcar como "repetida" → mesmo comportamento
3. Remover → mesmo comportamento

- [ ] **Commit**

```bash
git add components/ActionSheet.tsx
git commit -m "feat: ActionSheet — optimistic update, UI atualiza instantaneamente"
```

---

## Task 10: Skeleton loading no StickerGrid

**Files:**
- Create: `components/StickerGridSkeleton.tsx`
- Modify: `app/globals.css`
- Modify: `components/AlbumApp.tsx`

O objetivo é substituir o spinner full-screen durante o carregamento das figurinhas por um skeleton que preserva o layout do app — o usuário já vê a estrutura antes dos dados chegarem.

- [ ] **Adicionar animação shimmer em `app/globals.css`**

Adicionar ao final do arquivo:
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--border) 50%,
    var(--surface-2) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}
```

- [ ] **Criar `components/StickerGridSkeleton.tsx`**

```typescript
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
```

- [ ] **Atualizar `components/AlbumApp.tsx` — trocar o spinner de stickers pelo skeleton**

Na seção `{/* ─── Content ─── */}`, substituir:
```typescript
      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          <StickerGrid
            stickers={stickers}
            activeSection={activeSection}
            search={search}
            onAction={handleAction}
          />
        ) : (
          <RepeatedView username={username} />
        )}
      </div>
```

Por:
```typescript
      <div style={{ flex: 1, paddingTop: activeTab === 'album' ? 16 : 0 }}>
        {activeTab === 'album' ? (
          isLoading
            ? <StickerGridSkeleton />
            : <StickerGrid
                stickers={stickers}
                activeSection={activeSection}
                search={search}
                onAction={handleAction}
              />
        ) : (
          <RepeatedView username={username} />
        )}
      </div>
```

E remover o bloco `if (isLoading) return <LoadingSpinner />` que existia antes do `return` principal (o spinner full-screen de stickers não é mais necessário — o skeleton substitui).

Também adicionar o import no topo do arquivo:
```typescript
import { StickerGridSkeleton } from './StickerGridSkeleton'
```

- [ ] **Verificar no dev server**

```bash
npm run dev
```

1. Com conexão lenta (DevTools → Network → Slow 3G), ao carregar o app deve aparecer o skeleton com shimmer no lugar do grid, sem o spinner full-screen
2. Quando os dados chegarem, o skeleton é substituído pelo grid real

- [ ] **Commit**

```bash
git add app/globals.css components/StickerGridSkeleton.tsx components/AlbumApp.tsx
git commit -m "feat: skeleton loading no StickerGrid com animação shimmer"
```
