# Copa 2026 — Fase 3: Trocas e Perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticker trading marketplace, in-app trade proposals with automatic status updates, and a profile tab with username editing, password change, and trade history.

**Architecture:** New `trade_proposals` table + `marketplace_visible` flag on `albums`. New `trades` tRPC router with 6 procedures. Four new React components (TradeView, MarketplaceTab, ProposalsTab, TradeProposalSheet) plus ProfileView. TabBar expands to 4 tabs with a pending-badge on Trocas.

**Tech Stack:** Next.js 16 App Router, tRPC v11, Supabase Postgres + Realtime, React 19, TypeScript

---

## File Map

**Create:**
- `supabase/migrations/007_marketplace_trades.sql` — DB schema + RLS + realtime
- `server/routers/trades.ts` — 6 tRPC procedures for the trading system
- `components/TradeView.tsx` — Trocas tab container (sub-tabs + visibility toggle + realtime)
- `components/MarketplaceTab.tsx` — OFEREÇO / PRECISO boards
- `components/TradeProposalSheet.tsx` — bottom sheet to select offered sticker and send proposal
- `components/ProposalsTab.tsx` — incoming (accept/reject) + outgoing (cancel) proposals
- `components/ProfileView.tsx` — username edit, password change, trade history, sign out

**Modify:**
- `server/routers/albums.ts` — add `marketplaceVisible` field to `list` return type
- `server/routers/profile.ts` — add `updateUsername` + `getTradeHistory` procedures
- `server/routers/index.ts` — register `tradesRouter`
- `components/TabBar.tsx` — add `trades`/`profile` tabs + pending badge
- `components/AlbumApp.tsx` — render TradeView/ProfileView, add pending count query

---

## Task 1: DB Migration 007

**Files:**
- Create: `supabase/migrations/007_marketplace_trades.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/007_marketplace_trades.sql

ALTER TABLE albums ADD COLUMN marketplace_visible boolean NOT NULL DEFAULT false;

CREATE TABLE trade_proposals (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposer_album   uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  offered_sticker  text NOT NULL,
  receiver_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_album   uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  wanted_sticker   text NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trade_proposals_proposer_idx ON trade_proposals(proposer_id);
CREATE INDEX trade_proposals_receiver_idx ON trade_proposals(receiver_id);

ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_proposals_select" ON trade_proposals
  FOR SELECT USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

CREATE POLICY "trade_proposals_insert" ON trade_proposals
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "trade_proposals_update" ON trade_proposals
  FOR UPDATE USING (auth.uid() = proposer_id OR auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE trade_proposals;
```

- [ ] **Step 2: Apply migration in Supabase dashboard**

Open Supabase Dashboard → SQL Editor → paste the SQL above → Run.
Expected: no errors, `trade_proposals` table appears in Table Editor, `albums` table shows new `marketplace_visible` column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_marketplace_trades.sql
git commit -m "feat: migration 007 — trade_proposals table + marketplace_visible"
```

---

## Task 2: trades tRPC router + albums.ts update + appRouter

**Files:**
- Create: `server/routers/trades.ts`
- Modify: `server/routers/albums.ts` (lines 14, 20, 40–51)
- Modify: `server/routers/index.ts`

- [ ] **Step 1: Update `server/routers/albums.ts` — add `marketplaceVisible` to list**

Change line 14 (AlbumRow type):
```ts
type AlbumRow = { id: string; name: string; type: string; invite_code: string | null; marketplace_visible: boolean }
```

Change line 20 (select):
```ts
.select('album_id, role, albums(id, name, type, invite_code, marketplace_visible)')
```

Change the return object inside `albums.map` (after `memberCount`), add the new field:
```ts
return {
  id: album.id,
  name: album.name,
  type: album.type as 'personal' | 'shared',
  role: m.role as 'owner' | 'member',
  inviteCode: album.invite_code,
  memberCount: memberCount ?? 0,
  marketplaceVisible: album.marketplace_visible,
  progress: { obtained, total },
}
```

- [ ] **Step 2: Create `server/routers/trades.ts`**

```ts
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

async function assertMember(albumId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('album_members')
    .select('user_id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })
}

async function adjustSticker(
  albumId: string, stickerId: string,
  action: 'decrement' | 'gain', updatedBy: string,
) {
  if (action === 'decrement') {
    const { data } = await supabaseAdmin
      .from('album_stickers').select('quantity')
      .eq('album_id', albumId).eq('sticker_id', stickerId).maybeSingle()
    if (!data) throw new TRPCError({ code: 'CONFLICT', message: `Figurinha ${stickerId} não encontrada` })
    const qty = data.quantity
    if (qty <= 1) {
      await supabaseAdmin.from('album_stickers').delete()
        .eq('album_id', albumId).eq('sticker_id', stickerId)
    } else {
      await supabaseAdmin.from('album_stickers')
        .update({ quantity: qty - 1, status: qty === 2 ? 'obtained' : 'repeated',
          updated_at: new Date().toISOString(), updated_by: updatedBy })
        .eq('album_id', albumId).eq('sticker_id', stickerId)
    }
  } else {
    const { data } = await supabaseAdmin
      .from('album_stickers').select('quantity')
      .eq('album_id', albumId).eq('sticker_id', stickerId).maybeSingle()
    if (!data) {
      await supabaseAdmin.from('album_stickers').insert({
        album_id: albumId, sticker_id: stickerId, status: 'obtained', quantity: 1,
        updated_by: updatedBy, updated_at: new Date().toISOString(),
      })
    } else {
      const newQty = data.quantity + 1
      await supabaseAdmin.from('album_stickers')
        .update({ quantity: newQty, status: newQty >= 2 ? 'repeated' : 'obtained',
          updated_at: new Date().toISOString(), updated_by: updatedBy })
        .eq('album_id', albumId).eq('sticker_id', stickerId)
    }
  }
}

export const tradesRouter = router({
  setVisibility: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { data: album } = await supabaseAdmin
        .from('albums').select('owner_id').eq('id', input.albumId).maybeSingle()
      if (!album || album.owner_id !== ctx.userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o dono pode alterar visibilidade' })
      const { error } = await supabaseAdmin
        .from('albums').update({ marketplace_visible: input.visible }).eq('id', input.albumId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { visible: input.visible }
    }),

  getMarketplace: protectedProcedure.query(async ({ ctx }) => {
    const { data: myMemberships } = await supabaseAdmin
      .from('album_members').select('album_id').eq('user_id', ctx.userId)
    const myAlbumIds = (myMemberships ?? []).map(m => m.album_id)

    const myRepeatedIds = new Set<string>()
    if (myAlbumIds.length > 0) {
      const { data: myRepeated } = await supabaseAdmin
        .from('album_stickers').select('sticker_id')
        .in('album_id', myAlbumIds).eq('status', 'repeated')
      for (const r of myRepeated ?? []) myRepeatedIds.add(r.sticker_id)
    }

    let albumQuery = supabaseAdmin
      .from('albums').select('id, name, owner_id').eq('marketplace_visible', true)
    if (myAlbumIds.length > 0)
      albumQuery = albumQuery.not('id', 'in', `(${myAlbumIds.join(',')})`)

    const { data: visibleAlbums, error } = await albumQuery
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (!visibleAlbums?.length) return { offering: [], wanting: [] }

    const visibleAlbumIds = visibleAlbums.map(a => a.id)
    const ownerIds = [...new Set(visibleAlbums.map(a => a.owner_id))]

    const [{ data: allStickers }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from('album_stickers').select('album_id, sticker_id, status').in('album_id', visibleAlbumIds),
      supabaseAdmin.from('profiles').select('user_id, username').in('user_id', ownerIds),
    ])

    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.username]))
    const albumMap = new Map(visibleAlbums.map(a => [a.id, { ownerId: a.owner_id }]))
    const stickerInfoMap = new Map(ALL_STICKERS.map(s => [s.id, { countryName: s.countryName, section: s.section }]))
    const allStickerIds = ALL_STICKERS.map(s => s.id)

    const stickersByAlbum = new Map<string, { sticker_id: string; status: string }[]>()
    for (const id of visibleAlbumIds) stickersByAlbum.set(id, [])
    for (const s of (allStickers ?? [])) stickersByAlbum.get(s.album_id)?.push(s)

    type Entry = { stickerId: string; countryName: string; section: string; userId: string; username: string; albumId: string }
    const offering: Entry[] = []
    const wanting: Entry[] = []

    for (const [albumId, stickers] of stickersByAlbum) {
      const userId = albumMap.get(albumId)!.ownerId
      const username = profileMap.get(userId) ?? '?'
      const obtainedOrRepeated = new Set(stickers.map(s => s.sticker_id))
      const repeated = new Set(stickers.filter(s => s.status === 'repeated').map(s => s.sticker_id))

      for (const stickerId of repeated) {
        const info = stickerInfoMap.get(stickerId)
        if (info) offering.push({ stickerId, ...info, userId, username, albumId })
      }
      for (const stickerId of allStickerIds) {
        if (!obtainedOrRepeated.has(stickerId) && myRepeatedIds.has(stickerId)) {
          const info = stickerInfoMap.get(stickerId)
          if (info) wanting.push({ stickerId, ...info, userId, username, albumId })
        }
      }
    }

    return { offering, wanting }
  }),

  propose: protectedProcedure
    .input(z.object({
      proposerAlbumId: z.string().uuid(),
      offeredSticker: z.string(),
      receiverId: z.string().uuid(),
      receiverAlbumId: z.string().uuid(),
      wantedSticker: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.userId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não pode propor troca para si mesmo' })

      await assertMember(input.proposerAlbumId, ctx.userId)

      const { data: offeredRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', input.proposerAlbumId).eq('sticker_id', input.offeredSticker).maybeSingle()
      if (!offeredRow || offeredRow.status !== 'repeated')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Figurinha oferecida não está na lista de repetidas' })

      const { data: wantedRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', input.receiverAlbumId).eq('sticker_id', input.wantedSticker).maybeSingle()
      if (!wantedRow || wantedRow.status !== 'repeated')
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Figurinha solicitada não está disponível' })

      const { data: existing } = await supabaseAdmin
        .from('trade_proposals').select('id')
        .eq('proposer_id', ctx.userId).eq('offered_sticker', input.offeredSticker)
        .eq('receiver_id', input.receiverId).eq('wanted_sticker', input.wantedSticker)
        .eq('status', 'pending').maybeSingle()
      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Proposta idêntica já pendente' })

      const { data: proposal, error } = await supabaseAdmin
        .from('trade_proposals')
        .insert({
          proposer_id: ctx.userId, proposer_album: input.proposerAlbumId,
          offered_sticker: input.offeredSticker, receiver_id: input.receiverId,
          receiver_album: input.receiverAlbumId, wanted_sticker: input.wantedSticker,
        })
        .select('id').single()
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { proposalId: proposal.id }
    }),

  respond: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid(), action: z.enum(['accept', 'reject']) }))
    .mutation(async ({ ctx, input }) => {
      const { data: proposal } = await supabaseAdmin
        .from('trade_proposals').select('*')
        .eq('id', input.proposalId).eq('receiver_id', ctx.userId).eq('status', 'pending').maybeSingle()
      if (!proposal)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada ou já respondida' })

      if (input.action === 'reject') {
        await supabaseAdmin.from('trade_proposals')
          .update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', input.proposalId)
        return { status: 'rejected' as const, proposerAlbumId: '', receiverAlbumId: '' }
      }

      const { data: offeredRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', proposal.proposer_album).eq('sticker_id', proposal.offered_sticker).maybeSingle()
      if (!offeredRow || offeredRow.status !== 'repeated')
        throw new TRPCError({ code: 'CONFLICT', message: 'Figurinha oferecida não está mais disponível' })

      const { data: wantedRow } = await supabaseAdmin
        .from('album_stickers').select('status')
        .eq('album_id', proposal.receiver_album).eq('sticker_id', proposal.wanted_sticker).maybeSingle()
      if (!wantedRow || wantedRow.status !== 'repeated')
        throw new TRPCError({ code: 'CONFLICT', message: 'Figurinha solicitada não está mais disponível' })

      await adjustSticker(proposal.proposer_album, proposal.offered_sticker, 'decrement', proposal.proposer_id)
      await adjustSticker(proposal.proposer_album, proposal.wanted_sticker, 'gain', proposal.proposer_id)
      await adjustSticker(proposal.receiver_album, proposal.wanted_sticker, 'decrement', ctx.userId)
      await adjustSticker(proposal.receiver_album, proposal.offered_sticker, 'gain', ctx.userId)

      await supabaseAdmin.from('trade_proposals')
        .update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', input.proposalId)

      return {
        status: 'accepted' as const,
        proposerAlbumId: proposal.proposer_album as string,
        receiverAlbumId: proposal.receiver_album as string,
      }
    }),

  cancel: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: proposal } = await supabaseAdmin
        .from('trade_proposals').select('id')
        .eq('id', input.proposalId).eq('proposer_id', ctx.userId).eq('status', 'pending').maybeSingle()
      if (!proposal)
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposta não encontrada' })
      await supabaseAdmin.from('trade_proposals')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', input.proposalId)
      return { success: true }
    }),

  listProposals: protectedProcedure.query(async ({ ctx }) => {
    const { data: proposals, error } = await supabaseAdmin
      .from('trade_proposals').select('*')
      .or(`proposer_id.eq.${ctx.userId},receiver_id.eq.${ctx.userId}`)
      .order('created_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const otherUserIds = [...new Set(
      (proposals ?? []).map(p => p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id),
    )]
    if (otherUserIds.length === 0) return []

    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('user_id, username').in('user_id', otherUserIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.username]))
    const stickerMap = new Map(ALL_STICKERS.map(s => [s.id, { countryName: s.countryName, section: s.section }]))

    return (proposals ?? []).map(p => ({
      id: p.id as string,
      direction: (p.proposer_id === ctx.userId ? 'outgoing' : 'incoming') as 'outgoing' | 'incoming',
      offeredSticker: { id: p.offered_sticker as string, ...(stickerMap.get(p.offered_sticker) ?? { countryName: p.offered_sticker, section: '' }) },
      wantedSticker: { id: p.wanted_sticker as string, ...(stickerMap.get(p.wanted_sticker) ?? { countryName: p.wanted_sticker, section: '' }) },
      otherUserId: (p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id) as string,
      otherUsername: profileMap.get(p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id) ?? '?',
      proposerAlbumId: p.proposer_album as string,
      receiverAlbumId: p.receiver_album as string,
      status: p.status as 'pending' | 'accepted' | 'rejected' | 'cancelled',
      createdAt: p.created_at as string,
      updatedAt: p.updated_at as string,
    }))
  }),
})
```

- [ ] **Step 3: Update `server/routers/index.ts`**

Replace the file content:
```ts
import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'
import { albumsRouter } from './albums'
import { tradesRouter } from './trades'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
  albums: albumsRouter,
  trades: tradesRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```
Expected: exit 0, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add server/routers/trades.ts server/routers/index.ts server/routers/albums.ts
git commit -m "feat: trades tRPC router + marketplaceVisible on albums"
```

---

## Task 3: profile router extensions

**Files:**
- Modify: `server/routers/profile.ts`

- [ ] **Step 1: Add `updateUsername` and `getTradeHistory` to `server/routers/profile.ts`**

First, add this import at the top of the file (after the existing imports):
```ts
import { ALL_STICKERS } from '@/lib/sticker-data'
```

At the bottom of the `profileRouter` object (before the closing `})`), add two procedures:

```ts
  updateUsername: protectedProcedure
    .input(z.object({ username: usernameSchema }))
    .mutation(async ({ ctx, input }) => {
      const { data: conflict } = await supabaseAdmin
        .from('profiles').select('user_id')
        .ilike('username', input.username).neq('user_id', ctx.userId).maybeSingle()
      if (conflict)
        throw new TRPCError({ code: 'CONFLICT', message: 'Username já existe' })
      const { error } = await supabaseAdmin
        .from('profiles').update({ username: input.username }).eq('user_id', ctx.userId)
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { username: input.username }
    }),

  getTradeHistory: protectedProcedure.query(async ({ ctx }) => {
    const { data: proposals, error } = await supabaseAdmin
      .from('trade_proposals').select('*')
      .or(`proposer_id.eq.${ctx.userId},receiver_id.eq.${ctx.userId}`)
      .eq('status', 'accepted')
      .order('updated_at', { ascending: false })
    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
    if (!proposals?.length) return []

    const otherUserIds = [...new Set(
      proposals.map(p => p.proposer_id === ctx.userId ? p.receiver_id : p.proposer_id),
    )]
    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('user_id, username').in('user_id', otherUserIds)
    const profileMap = new Map((profiles ?? []).map(p => [p.user_id, p.username]))
    const stickerMap = new Map(ALL_STICKERS.map(s => [s.id, s.countryName]))

    return proposals.map(p => {
      const isProposer = p.proposer_id === ctx.userId
      return {
        id: p.id as string,
        gave: {
          id: (isProposer ? p.offered_sticker : p.wanted_sticker) as string,
          countryName: stickerMap.get(isProposer ? p.offered_sticker : p.wanted_sticker) ?? '',
        },
        received: {
          id: (isProposer ? p.wanted_sticker : p.offered_sticker) as string,
          countryName: stickerMap.get(isProposer ? p.wanted_sticker : p.offered_sticker) ?? '',
        },
        otherUsername: profileMap.get(isProposer ? p.receiver_id : p.proposer_id) ?? '?',
        date: p.updated_at as string,
      }
    })
  }),
```


- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add server/routers/profile.ts
git commit -m "feat: profile.updateUsername + profile.getTradeHistory"
```

---

## Task 4: TabBar + AlbumApp wiring

**Files:**
- Modify: `components/TabBar.tsx`
- Modify: `components/AlbumApp.tsx`

- [ ] **Step 1: Replace `components/TabBar.tsx` entirely**

```tsx
export type Tab = 'album' | 'repeated' | 'trades' | 'profile'

type Props = {
  activeTab: Tab
  onChange: (tab: Tab) => void
  pendingTradesCount?: number
}

export function TabBar({ activeTab, onChange, pendingTradesCount = 0 }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'album', label: 'Álbum' },
    { id: 'repeated', label: 'Repetidas' },
    { id: 'trades', label: 'Trocas' },
    { id: 'profile', label: 'Perfil' },
  ]

  return (
    <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {tabs.map(({ id, label }) => {
        const active = activeTab === id
        const badge = id === 'trades' && pendingTradesCount > 0 ? pendingTradesCount : 0
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              flex: 1, height: 42, border: 'none',
              borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 13,
              fontWeight: active ? 700 : 500,
              fontFamily: active ? "'Bebas Neue', sans-serif" : 'Outfit, sans-serif',
              letterSpacing: active ? '0.06em' : 'normal',
              color: active ? 'var(--green)' : 'var(--text-muted)',
              transition: 'all 0.15s ease', position: 'relative',
            }}
          >
            {label}
            {badge > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: '16%',
                background: 'var(--red)', color: '#fff',
                fontSize: 10, fontWeight: 700, borderRadius: 99,
                minWidth: 16, height: 16, lineHeight: '16px',
                textAlign: 'center', padding: '0 4px',
              }}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Update `components/AlbumApp.tsx` imports**

Add these two imports at the top of the existing import block:
```tsx
import { TradeView } from './TradeView'
import { ProfileView } from './ProfileView'
```

(These components will be created in later tasks. The build will fail until Tasks 7–9 are done — that is expected. You can stub them temporarily with empty components if needed.)

- [ ] **Step 3: Update `components/AlbumApp.tsx` — add pending count query and realtime**

After the existing `utils` line (line 73), add:

```tsx
const { data: proposals = [] } = trpc.trades.listProposals.useQuery(undefined, {
  enabled: !!session && !!profile.data && !!activeAlbum,
})
const pendingTradesCount = proposals.filter(
  (p) => p.direction === 'incoming' && p.status === 'pending',
).length
```

- [ ] **Step 4: Update `components/AlbumApp.tsx` — pass `pendingTradesCount` to TabBar**

Find the `<TabBar>` usage (line 193) and update it:
```tsx
<TabBar activeTab={activeTab} onChange={setActiveTab} pendingTradesCount={pendingTradesCount} />
```

- [ ] **Step 5: Update `components/AlbumApp.tsx` — conditional rendering**

Find the `{activeTab === 'album' && (` block (line 195) and update it — the ProgressPanel and FilterBar only show for album tab, which is already the case. No change needed there.

Find the main content `<div>` (line 208). Replace the entire inner conditional:

```tsx
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
  ) : activeTab === 'repeated' ? (
    <RepeatedView albumId={activeAlbumId!} username={username} />
  ) : activeTab === 'trades' ? (
    <TradeView
      albumId={activeAlbumId!}
      userId={session!.user.id}
      marketplaceVisible={activeAlbum.marketplaceVisible}
    />
  ) : (
    <ProfileView
      username={username}
      onUsernameChange={() => profile.refetch()}
    />
  )}
</div>
```

Also update the sticky header so ProgressPanel/FilterBar only appear for the `album` tab — this is already gated by `{activeTab === 'album' && (...)}` at line 195, so no change.

- [ ] **Step 6: Verify build (stubs for TradeView and ProfileView)**

If TradeView/ProfileView don't exist yet, create temporary stubs:

`components/TradeView.tsx`:
```tsx
export function TradeView(_props: { albumId: string; userId: string; marketplaceVisible: boolean }) {
  return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Trocas — em breve</div>
}
```

`components/ProfileView.tsx`:
```tsx
export function ProfileView(_props: { username: string; onUsernameChange: () => void }) {
  return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Perfil — em breve</div>
}
```

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add components/TabBar.tsx components/AlbumApp.tsx components/TradeView.tsx components/ProfileView.tsx
git commit -m "feat: 4-tab navigation + pending badge wiring"
```

---

## Task 5: MarketplaceTab component

**Files:**
- Create: `components/MarketplaceTab.tsx`

- [ ] **Step 1: Create `components/MarketplaceTab.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { TradeProposalSheet } from './TradeProposalSheet'

type MarketplaceEntry = {
  stickerId: string
  countryName: string
  section: string
  userId: string
  username: string
  albumId: string
}

type Props = { albumId: string; userId: string }

export function MarketplaceTab({ albumId, userId }: Props) {
  const { data, isLoading } = trpc.trades.getMarketplace.useQuery()
  const [proposalTarget, setProposalTarget] = useState<MarketplaceEntry | null>(null)
  const [activeBoard, setActiveBoard] = useState<'offering' | 'wanting'>('offering')

  if (isLoading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Carregando marketplace…
      </div>
    )
  }

  const offering = data?.offering ?? []
  const wanting = data?.wanting ?? []
  const isEmpty = offering.length === 0 && wanting.length === 0

  if (isEmpty) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px', gap: 8, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>🌐</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Nenhum álbum visível no marketplace</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Ative a visibilidade no seu álbum e convide outros usuários</div>
      </div>
    )
  }

  const items = activeBoard === 'offering' ? offering : wanting

  return (
    <>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['offering', 'wanting'] as const).map((board) => {
          const active = activeBoard === board
          const count = board === 'offering' ? offering.length : wanting.length
          return (
            <button
              key={board}
              onClick={() => setActiveBoard(board)}
              style={{
                flex: 1, height: 36, border: 'none',
                borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {board === 'offering' ? `OFEREÇO (${count})` : `PRECISO (${count})`}
            </button>
          )
        })}
      </div>

      <div style={{ paddingBottom: 80 }}>
        {items.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            {activeBoard === 'wanting'
              ? 'Nenhuma figurinha sua aparece como faltando em outros álbuns'
              : 'Nenhuma figurinha disponível para troca'}
          </div>
        ) : (
          items.map((entry, i) => (
            <div
              key={`${entry.albumId}-${entry.stickerId}-${i}`}
              onClick={() => activeBoard === 'offering' ? setProposalTarget(entry) : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                cursor: activeBoard === 'offering' ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.04em',
                  color: activeBoard === 'offering' ? 'var(--gold)' : 'var(--text-muted)', minWidth: 60,
                }}>
                  {entry.stickerId}
                </span>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {entry.countryName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>@{entry.username}</div>
                </div>
              </div>
              {activeBoard === 'offering' && (
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Propor →</span>
              )}
            </div>
          ))
        )}
      </div>

      {proposalTarget && (
        <TradeProposalSheet
          albumId={albumId}
          wantedSticker={proposalTarget.stickerId}
          wantedStickerName={proposalTarget.countryName}
          receiverId={proposalTarget.userId}
          receiverAlbumId={proposalTarget.albumId}
          receiverUsername={proposalTarget.username}
          onClose={() => setProposalTarget(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0. (TradeProposalSheet doesn't exist yet — create a stub if needed.)

---

## Task 6: TradeProposalSheet component

**Files:**
- Create: `components/TradeProposalSheet.tsx`

- [ ] **Step 1: Create `components/TradeProposalSheet.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type Props = {
  albumId: string
  wantedSticker: string
  wantedStickerName: string
  receiverId: string
  receiverAlbumId: string
  receiverUsername: string
  onClose: () => void
}

export function TradeProposalSheet({
  albumId, wantedSticker, wantedStickerName,
  receiverId, receiverAlbumId, receiverUsername, onClose,
}: Props) {
  const [selectedOffered, setSelectedOffered] = useState<string | null>(null)
  const utils = trpc.useUtils()

  const { data: stickers = [] } = trpc.stickers.list.useQuery({ albumId })
  const myRepeated = stickers.filter(s => s.status === 'repeated')

  const propose = trpc.trades.propose.useMutation({
    onSuccess: () => {
      utils.trades.listProposals.invalidate()
      onClose()
    },
  })

  function handleSend() {
    if (!selectedOffered) return
    propose.mutate({
      proposerAlbumId: albumId,
      offeredSticker: selectedOffered,
      receiverId,
      receiverAlbumId,
      wantedSticker,
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(24,40,24,0.45)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div style={{
        position: 'relative', background: 'var(--surface)',
        borderTop: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
        maxHeight: '80dvh', display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 20px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4, flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>

        <div style={{ padding: '12px 20px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            Propor troca com @{receiverUsername}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Você quer:{' '}
            <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 14 }}>
              {wantedSticker}
            </span>{' '}
            {wantedStickerName}
          </div>
        </div>

        <div style={{ padding: '12px 16px 4px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Escolha o que oferecer
          </div>
        </div>

        {myRepeated.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            Você não tem figurinhas repetidas neste álbum
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {myRepeated.map(s => {
              const selected = selectedOffered === s.id
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedOffered(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selected ? 'rgba(22,163,74,0.08)' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${selected ? 'var(--green)' : 'var(--border-2)'}`,
                    background: selected ? 'var(--green)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {selected && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <span style={{
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--gold)', minWidth: 60,
                  }}>
                    {s.id}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{s.countryName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>×{s.quantity - 1} extras</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ padding: '12px 16px 8px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {propose.error && (
            <div style={{ fontSize: 13, color: 'var(--red)', padding: '8px 12px', background: 'rgba(220,38,38,0.07)', borderRadius: 8 }}>
              {propose.error.message}
            </div>
          )}
          <button
            onClick={handleSend}
            disabled={!selectedOffered || propose.isPending}
            style={{
              height: 50, borderRadius: 14, fontSize: 15, fontWeight: 700,
              background: !selectedOffered ? 'var(--border)' : 'linear-gradient(150deg,#22c55e,#15803d)',
              color: !selectedOffered ? 'var(--text-muted)' : '#fff',
              border: 'none', cursor: !selectedOffered ? 'not-allowed' : 'pointer',
              opacity: propose.isPending ? 0.6 : 1,
            }}
          >
            {propose.isPending ? 'Enviando…' : 'Enviar proposta'}
          </button>
          <button
            onClick={onClose}
            style={{
              height: 44, borderRadius: 14, fontSize: 14, fontWeight: 600,
              color: 'var(--text-muted)', background: 'var(--surface-2)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/MarketplaceTab.tsx components/TradeProposalSheet.tsx
git commit -m "feat: MarketplaceTab + TradeProposalSheet components"
```

---

## Task 7: ProposalsTab component

**Files:**
- Create: `components/ProposalsTab.tsx`

- [ ] **Step 1: Create `components/ProposalsTab.tsx`**

```tsx
'use client'
import { trpc } from '@/lib/trpc'

type Proposal = {
  id: string
  direction: 'incoming' | 'outgoing'
  offeredSticker: { id: string; countryName: string }
  wantedSticker: { id: string; countryName: string }
  otherUsername: string
  proposerAlbumId: string
  receiverAlbumId: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  createdAt: string
}

type Props = { proposals: Proposal[] }

export function ProposalsTab({ proposals }: Props) {
  const utils = trpc.useUtils()

  const respond = trpc.trades.respond.useMutation({
    onSuccess: (data) => {
      utils.trades.listProposals.invalidate()
      if (data.status === 'accepted') {
        utils.stickers.list.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.list.invalidate({ albumId: data.receiverAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.getProgress.invalidate({ albumId: data.receiverAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: data.proposerAlbumId })
        utils.stickers.listDuplicates.invalidate({ albumId: data.receiverAlbumId })
        utils.trades.getMarketplace.invalidate()
      }
    },
  })

  const cancel = trpc.trades.cancel.useMutation({
    onSuccess: () => utils.trades.listProposals.invalidate(),
  })

  const incoming = proposals.filter(p => p.direction === 'incoming')
  const outgoing = proposals.filter(p => p.direction === 'outgoing')

  if (proposals.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 24px', gap: 8, textAlign: 'center',
      }}>
        <div style={{ fontSize: 36, opacity: 0.4 }}>📬</div>
        <div style={{ fontSize: 15, color: 'var(--text-muted)' }}>Nenhuma proposta ainda</div>
      </div>
    )
  }

  function statusLabel(status: Proposal['status']) {
    if (status === 'accepted') return { text: 'Aceita ✓', color: 'var(--green)' }
    if (status === 'rejected') return { text: 'Recusada', color: 'var(--red)' }
    if (status === 'cancelled') return { text: 'Cancelada', color: 'var(--text-dim)' }
    return null
  }

  function StickerPair({ offered, wanted }: { offered: { id: string; countryName: string }; wanted: { id: string; countryName: string } }) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
        <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{offered.id}</span>
        {' '}{offered.countryName}
        <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>⇄</span>
        <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{wanted.id}</span>
        {' '}{wanted.countryName}
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      {incoming.length > 0 && (
        <>
          <div style={{
            padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            Recebidas ({incoming.length})
          </div>
          {incoming.map(p => {
            const label = statusLabel(p.status)
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                  @{p.otherUsername} quer trocar
                </div>
                <StickerPair offered={p.offeredSticker} wanted={p.wantedSticker} />
                {p.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => respond.mutate({ proposalId: p.id, action: 'accept' })}
                      disabled={respond.isPending}
                      style={{
                        flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(150deg,#22c55e,#15803d)', color: '#fff',
                        fontSize: 13, fontWeight: 700, opacity: respond.isPending ? 0.6 : 1,
                      }}
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => respond.mutate({ proposalId: p.id, action: 'reject' })}
                      disabled={respond.isPending}
                      style={{
                        flex: 1, height: 38, borderRadius: 10, border: '1.5px solid var(--border)',
                        background: 'var(--surface-2)', color: 'var(--text-muted)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: respond.isPending ? 0.6 : 1,
                      }}
                    >
                      Recusar
                    </button>
                  </div>
                ) : label ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: label.color, fontWeight: 600 }}>
                    {label.text}
                  </div>
                ) : null}
              </div>
            )
          })}
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <div style={{
            padding: '8px 16px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            color: 'var(--text-muted)', textTransform: 'uppercase', background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}>
            Enviadas ({outgoing.length})
          </div>
          {outgoing.map(p => {
            const label = statusLabel(p.status)
            return (
              <div key={p.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>
                  Para @{p.otherUsername}
                </div>
                <StickerPair offered={p.offeredSticker} wanted={p.wantedSticker} />
                {p.status === 'pending' ? (
                  <div style={{ marginTop: 10 }}>
                    <button
                      onClick={() => cancel.mutate({ proposalId: p.id })}
                      disabled={cancel.isPending}
                      style={{
                        height: 34, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                        border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                        color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                        opacity: cancel.isPending ? 0.6 : 1,
                      }}
                    >
                      Cancelar proposta
                    </button>
                  </div>
                ) : label ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: label.color, fontWeight: 600 }}>
                    {label.text}
                  </div>
                ) : null}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/ProposalsTab.tsx
git commit -m "feat: ProposalsTab component"
```

---

## Task 8: TradeView component

**Files:**
- Replace stub: `components/TradeView.tsx`

- [ ] **Step 1: Replace `components/TradeView.tsx` with full implementation**

```tsx
'use client'
import { useEffect } from 'react'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'
import { MarketplaceTab } from './MarketplaceTab'
import { ProposalsTab } from './ProposalsTab'
import { useState } from 'react'

type Props = { albumId: string; userId: string; marketplaceVisible: boolean }

export function TradeView({ albumId, userId, marketplaceVisible }: Props) {
  const [subTab, setSubTab] = useState<'marketplace' | 'proposals'>('marketplace')
  const utils = trpc.useUtils()

  const { data: proposals = [] } = trpc.trades.listProposals.useQuery()
  const pendingCount = proposals.filter(p => p.direction === 'incoming' && p.status === 'pending').length

  const setVisibility = trpc.trades.setVisibility.useMutation({
    onSuccess: () => utils.albums.list.invalidate(),
  })

  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`trade_proposals_tv_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trade_proposals',
        filter: `proposer_id=eq.${userId}`,
      }, () => {
        utils.trades.listProposals.invalidate()
        utils.trades.getMarketplace.invalidate()
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'trade_proposals',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        utils.trades.listProposals.invalidate()
        utils.trades.getMarketplace.invalidate()
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [userId, utils])

  return (
    <div style={{ paddingBottom: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aparecer no marketplace</span>
        <button
          onClick={() => setVisibility.mutate({ albumId, visible: !marketplaceVisible })}
          disabled={setVisibility.isPending}
          title={marketplaceVisible ? 'Desativar visibilidade' : 'Ativar visibilidade'}
          style={{
            width: 44, height: 24, borderRadius: 99, border: 'none',
            background: marketplaceVisible ? 'var(--green)' : 'var(--border)',
            cursor: setVisibility.isPending ? 'not-allowed' : 'pointer',
            position: 'relative', transition: 'background 0.2s',
            opacity: setVisibility.isPending ? 0.5 : 1,
          }}
        >
          <span style={{
            position: 'absolute', top: 3,
            left: marketplaceVisible ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', display: 'block',
          }} />
        </button>
      </div>

      <div style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {(['marketplace', 'proposals'] as const).map((tab) => {
          const active = subTab === tab
          const label = tab === 'marketplace'
            ? 'Marketplace'
            : `Propostas${pendingCount > 0 ? ` (${pendingCount})` : ''}`
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              style={{
                flex: 1, height: 38, border: 'none',
                borderBottom: active ? '2px solid var(--green)' : '2px solid transparent',
                background: 'none', cursor: 'pointer', fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--green)' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {subTab === 'marketplace'
        ? <MarketplaceTab albumId={albumId} userId={userId} />
        : <ProposalsTab proposals={proposals} />
      }
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/TradeView.tsx
git commit -m "feat: TradeView container with realtime subscription"
```

---

## Task 9: ProfileView component

**Files:**
- Replace stub: `components/ProfileView.tsx`

- [ ] **Step 1: Replace `components/ProfileView.tsx` with full implementation**

```tsx
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'
import { supabaseBrowser } from '@/lib/supabase-client'

type Props = { username: string; onUsernameChange: () => void }

export function ProfileView({ username, onUsernameChange }: Props) {
  const [editingUsername, setEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState(username)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  const utils = trpc.useUtils()
  const { data: history = [] } = trpc.profile.getTradeHistory.useQuery()

  const updateUsername = trpc.profile.updateUsername.useMutation({
    onSuccess: (data) => {
      utils.profile.get.invalidate()
      onUsernameChange()
      setEditingUsername(false)
      setNewUsername(data.username)
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
          <div style={{ padding: '16px 0', fontSize: 14, color: 'var(--text-dim)' }}>Nenhuma troca realizada ainda</div>
        ) : (
          history.map(h => (
            <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>@{h.otherUsername}</div>
              <div>
                <span style={{ color: 'var(--gold)', fontFamily: "'Bebas Neue', sans-serif" }}>{h.gave.id}</span>
                {' '}{h.gave.countryName}
                <span style={{ margin: '0 6px', color: 'var(--text-dim)' }}>→</span>
                <span style={{ color: 'var(--green)', fontFamily: "'Bebas Neue', sans-serif" }}>{h.received.id}</span>
                {' '}{h.received.countryName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                {new Date(h.date).toLocaleDateString('pt-BR')}
              </div>
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
```

- [ ] **Step 2: Verify full build**

```bash
npm run build
```
Expected: exit 0, no TypeScript errors anywhere.

- [ ] **Step 3: Add `.superpowers/` to `.gitignore`**

Open `.gitignore` and add:
```
.superpowers/
```

- [ ] **Step 4: Final commit**

```bash
git add components/ProfileView.tsx .gitignore
git commit -m "feat: ProfileView — username edit, password change, trade history, sign out"
```

---

## Smoke Test Checklist

After all tasks complete, verify manually in `npm run dev`:

- [ ] 4 tabs appear in TabBar (Álbum, Repetidas, Trocas, Perfil)
- [ ] Toggle "aparecer no marketplace" persists when navigating away and back
- [ ] Marketplace shows OFEREÇO entries when another user has repeated stickers + visible album
- [ ] Clicking a sticker in OFEREÇO opens TradeProposalSheet with user's repeated stickers listed
- [ ] Sending a proposal creates a pending entry in the sender's "Propostas" sub-tab
- [ ] Recipient sees incoming proposal; accepting auto-updates both albums and shows "Aceita ✓"
- [ ] Rejecting shows "Recusada" label
- [ ] Cancelling a pending outgoing proposal removes it from pending
- [ ] TabBar badge increments when incoming proposals arrive, disappears after accept/reject
- [ ] ProfileView shows correct username, history updates after a completed trade
- [ ] Alterar username validates uniqueness; updates header `@username` after refetch
- [ ] Alterar senha shows success after valid input
- [ ] Sair da conta redirects to LoginScreen
