# Fase 2 — Múltiplos Álbuns + Álbum Compartilhado

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `user_stickers` table with a multi-album system where users own multiple personal albums and collaborate on shared albums via 6-char invite codes.

**Architecture:** Three new DB tables (`albums`, `album_members`, `album_stickers`) replace `user_stickers`. All sticker tRPC procedures gain an `albumId` input. AlbumApp manages `activeAlbumId` in localStorage and renders `AlbumSelectionScreen` when no valid album is active.

**Tech Stack:** Next.js 16 App Router, tRPC v11 (`protectedProcedure`), Supabase Postgres + RLS (bypassed server-side via `supabaseAdmin`), React 19, TypeScript, Zod v4, inline styles (not Tailwind in main components).

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `supabase/migrations/005_albums.sql` | New tables + RLS |
| Create | `supabase/migrations/006_migrate_user_stickers.sql` | Data migration + drop user_stickers |
| Create | `server/routers/albums.ts` | 9 new tRPC procedures |
| Modify | `server/routers/index.ts` | Add albumsRouter |
| Modify | `server/routers/stickers.ts` | All procedures: albumId input + album_stickers |
| Modify | `components/ProgressPanel.tsx` | Accept albumId prop |
| Modify | `components/ActionSheet.tsx` | Accept albumId prop |
| Modify | `components/RepeatedView.tsx` | Accept albumId prop |
| Modify | `components/DuplicatesList.tsx` | Accept albumId prop (component unused but keep consistent) |
| Modify | `components/AlbumApp.tsx` | activeAlbumId state + full integration |
| Create | `components/AlbumSelectionScreen.tsx` | Album picker + create + join |
| Create | `components/AlbumMembersSheet.tsx` | Member management bottom sheet |

---

### Task 1: DB Migration 005 — Create album tables

**Files:**
- Create: `supabase/migrations/005_albums.sql`

- [ ] **Step 1: Write the migration file**

```sql
create table albums (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('personal', 'shared')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code text unique,
  created_at  timestamptz default now()
);

create table album_members (
  album_id  uuid not null references albums(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (album_id, user_id)
);

create table album_stickers (
  album_id   uuid not null references albums(id) on delete cascade,
  sticker_id text not null,
  status     text not null check (status in ('obtained', 'repeated')),
  quantity   int not null default 1 check (quantity >= 1),
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  primary key (album_id, sticker_id)
);

alter table albums enable row level security;
alter table album_members enable row level security;
alter table album_stickers enable row level security;

create policy "albums_select" on albums
  for select using (
    exists (select 1 from album_members where album_id = albums.id and user_id = auth.uid())
  );

create policy "albums_insert" on albums
  for insert with check (auth.role() = 'authenticated');

create policy "albums_update" on albums
  for update using (owner_id = auth.uid());

create policy "albums_delete" on albums
  for delete using (owner_id = auth.uid());

create policy "album_members_select" on album_members
  for select using (
    exists (
      select 1 from album_members am2
      where am2.album_id = album_members.album_id and am2.user_id = auth.uid()
    )
  );

create policy "album_members_insert" on album_members
  for insert with check (
    exists (select 1 from albums where id = album_id and owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "album_members_delete" on album_members
  for delete using (
    exists (select 1 from albums where id = album_id and owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "album_stickers_all" on album_stickers
  for all
  using (
    exists (select 1 from album_members where album_id = album_stickers.album_id and user_id = auth.uid())
  )
  with check (
    exists (select 1 from album_members where album_id = album_stickers.album_id and user_id = auth.uid())
  );
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP tool `apply_migration` with the SQL above, or paste into the Supabase dashboard SQL editor and run.

- [ ] **Step 3: Verify tables exist**

Run in Supabase dashboard SQL editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public'
and table_name in ('albums', 'album_members', 'album_stickers');
```
Expected: 3 rows returned.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_albums.sql
git commit -m "feat: migration 005 — albums, album_members, album_stickers tables"
```

---

### Task 2: DB Migration 006 — Migrate data + drop user_stickers

**Files:**
- Create: `supabase/migrations/006_migrate_user_stickers.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Create personal albums for every user who has stickers, migrate their data.
do $$
declare
  r record;
  new_album_id uuid;
begin
  for r in (select distinct user_id from user_stickers) loop
    insert into albums (name, type, owner_id)
    values ('Álbum Principal', 'personal', r.user_id)
    returning id into new_album_id;

    insert into album_members (album_id, user_id, role)
    values (new_album_id, r.user_id, 'owner');

    insert into album_stickers (album_id, sticker_id, status, quantity, updated_by, updated_at)
    select new_album_id, sticker_id, status, quantity, user_id, updated_at
    from user_stickers
    where user_id = r.user_id;
  end loop;
end $$;

drop table user_stickers;
```

- [ ] **Step 2: Apply the migration**

Use Supabase MCP `apply_migration` or paste into SQL editor.

- [ ] **Step 3: Verify migration**

```sql
select count(*) from albums;                              -- one per user
select count(*) from album_members where role = 'owner'; -- same count
select count(*) from album_stickers;                     -- same as old user_stickers count
```

Also confirm `user_stickers` table no longer exists:
```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'user_stickers';
```
Expected: 0 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/006_migrate_user_stickers.sql
git commit -m "feat: migration 006 — migrate user_stickers → album_stickers, drop user_stickers"
```

---

### Task 3: albums tRPC router + appRouter update

**Files:**
- Create: `server/routers/albums.ts`
- Modify: `server/routers/index.ts`

- [ ] **Step 1: Create `server/routers/albums.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

type AlbumRow = { id: string; name: string; type: string; invite_code: string | null }

export const albumsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const { data: memberships, error } = await supabaseAdmin
      .from('album_members')
      .select('album_id, role, albums(id, name, type, invite_code)')
      .eq('user_id', ctx.userId)

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

    const total = ALL_STICKERS.length

    const albums = await Promise.all(
      (memberships ?? []).map(async (m) => {
        const album = m.albums as unknown as AlbumRow

        const { count: memberCount } = await supabaseAdmin
          .from('album_members')
          .select('*', { count: 'exact', head: true })
          .eq('album_id', album.id)

        const { data: stickers } = await supabaseAdmin
          .from('album_stickers')
          .select('status')
          .eq('album_id', album.id)

        const obtained = (stickers ?? []).filter((s) => s.status === 'obtained').length

        return {
          id: album.id,
          name: album.name,
          type: album.type as 'personal' | 'shared',
          role: m.role as 'owner' | 'member',
          inviteCode: album.invite_code,
          memberCount: memberCount ?? 0,
          progress: { obtained, total },
        }
      }),
    )

    return albums
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(50), type: z.enum(['personal', 'shared']) }))
    .mutation(async ({ ctx, input }) => {
      const invite_code = input.type === 'shared' ? generateInviteCode() : null

      const { data: album, error } = await supabaseAdmin
        .from('albums')
        .insert({ name: input.name, type: input.type, owner_id: ctx.userId, invite_code })
        .select('id')
        .single()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      const { error: memberError } = await supabaseAdmin
        .from('album_members')
        .insert({ album_id: album.id, user_id: ctx.userId, role: 'owner' })

      if (memberError)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: memberError.message })

      return { albumId: album.id }
    }),

  join: protectedProcedure
    .input(z.object({ inviteCode: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const { data: album, error } = await supabaseAdmin
        .from('albums')
        .select('id')
        .eq('invite_code', input.inviteCode.toUpperCase())
        .maybeSingle()

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      if (!album) throw new TRPCError({ code: 'NOT_FOUND', message: 'Código inválido' })

      const { data: existing } = await supabaseAdmin
        .from('album_members')
        .select('user_id')
        .eq('album_id', album.id)
        .eq('user_id', ctx.userId)
        .maybeSingle()

      if (existing)
        throw new TRPCError({ code: 'CONFLICT', message: 'Você já é membro deste álbum' })

      const { error: insertError } = await supabaseAdmin
        .from('album_members')
        .insert({ album_id: album.id, user_id: ctx.userId, role: 'member' })

      if (insertError)
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: insertError.message })

      return { albumId: album.id }
    }),

  rename: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), name: z.string().min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('albums')
        .update({ name: input.name })
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  regenerateCode: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const newCode = generateInviteCode()

      const { error } = await supabaseAdmin
        .from('albums')
        .update({ invite_code: newCode })
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)
        .eq('type', 'shared')

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { inviteCode: newCode }
    }),

  getMembers: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from('album_members')
        .select('user_id')
        .eq('album_id', input.albumId)
        .eq('user_id', ctx.userId)
        .maybeSingle()

      if (!membership)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })

      const { data: members, error } = await supabaseAdmin
        .from('album_members')
        .select('user_id, role')
        .eq('album_id', input.albumId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })

      const membersWithUsername = await Promise.all(
        (members ?? []).map(async (m) => {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('username')
            .eq('user_id', m.user_id)
            .maybeSingle()
          return {
            userId: m.user_id,
            username: profile?.username ?? 'desconhecido',
            role: m.role as 'owner' | 'member',
          }
        }),
      )

      return membersWithUsername
    }),

  removeMember: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), targetUserId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetUserId === ctx.userId)
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não pode remover a si mesmo' })

      const { data: album } = await supabaseAdmin
        .from('albums')
        .select('owner_id')
        .eq('id', input.albumId)
        .maybeSingle()

      if (!album || album.owner_id !== ctx.userId)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Somente o dono pode remover membros' })

      const { error } = await supabaseAdmin
        .from('album_members')
        .delete()
        .eq('album_id', input.albumId)
        .eq('user_id', input.targetUserId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  leave: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: album } = await supabaseAdmin
        .from('albums')
        .select('owner_id')
        .eq('id', input.albumId)
        .maybeSingle()

      if (album?.owner_id === ctx.userId)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Dono não pode sair. Delete o álbum ou transfira a propriedade.',
        })

      const { error } = await supabaseAdmin
        .from('album_members')
        .delete()
        .eq('album_id', input.albumId)
        .eq('user_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),

  delete: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await supabaseAdmin
        .from('albums')
        .delete()
        .eq('id', input.albumId)
        .eq('owner_id', ctx.userId)

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
      return { success: true }
    }),
})
```

- [ ] **Step 2: Update `server/routers/index.ts`**

Replace entire file:
```typescript
import { router } from '../trpc'
import { stickersRouter } from './stickers'
import { profileRouter } from './profile'
import { albumsRouter } from './albums'

export const appRouter = router({
  stickers: stickersRouter,
  profile: profileRouter,
  albums: albumsRouter,
})

export type AppRouter = typeof appRouter
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: no TypeScript errors. (The stickers router still references `user_stickers` at this point — that's fine; the old procedures still exist and we'll swap them in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add server/routers/albums.ts server/routers/index.ts
git commit -m "feat: albums tRPC router (list, create, join, rename, regenerateCode, getMembers, removeMember, leave, delete)"
```

---

### Task 4: Atomic update — stickers router + all consumers

**IMPORTANT:** This task must be completed fully before committing. Updating the stickers router to require `albumId` breaks the build until all consumers are updated. Complete all steps in sequence, then run `npm run build` once at the end.

**Files:**
- Modify: `server/routers/stickers.ts`
- Modify: `components/ProgressPanel.tsx`
- Modify: `components/ActionSheet.tsx`
- Modify: `components/RepeatedView.tsx`
- Modify: `components/DuplicatesList.tsx`
- Modify: `components/AlbumApp.tsx`

- [ ] **Step 1: Replace `server/routers/stickers.ts`**

```typescript
import { z } from 'zod'
import { TRPCError } from '@trpc/server'
import { protectedProcedure, router } from '../trpc'
import { supabaseAdmin } from '../db'
import { ALL_STICKERS } from '@/lib/sticker-data'

const StatusEnum = z.enum(['missing', 'obtained', 'repeated'])

async function assertMember(albumId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('album_members')
    .select('user_id')
    .eq('album_id', albumId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new TRPCError({ code: 'FORBIDDEN', message: 'Não é membro deste álbum' })
}

export const stickersRouter = router({
  list: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('sticker_id, status, quantity, updated_at')
        .eq('album_id', input.albumId)

      if (error) throw new Error(error.message)

      const statusMap = new Map(
        (data ?? []).map((r) => [r.sticker_id, { status: r.status, quantity: r.quantity }]),
      )

      return ALL_STICKERS.map((s) => {
        const entry = statusMap.get(s.id)
        return {
          ...s,
          status: (entry?.status ?? 'missing') as 'missing' | 'obtained' | 'repeated',
          quantity: entry?.quantity ?? 0,
        }
      })
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        albumId: z.string().uuid(),
        stickerId: z.string(),
        status: StatusEnum,
        quantity: z.number().int().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      if (input.status === 'missing') {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .delete()
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing', quantity: 0 }
      }

      const quantity = input.status === 'repeated' ? (input.quantity ?? 2) : 1

      const { error } = await supabaseAdmin
        .from('album_stickers')
        .upsert(
          {
            album_id: input.albumId,
            sticker_id: input.stickerId,
            status: input.status,
            quantity,
            updated_by: ctx.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'album_id,sticker_id' },
        )
      if (error) throw new Error(error.message)
      return { status: input.status, quantity }
    }),

  getProgress: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const total = ALL_STICKERS.length

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('status, quantity')
        .eq('album_id', input.albumId)

      if (error) throw new Error(error.message)

      const obtained = (data ?? []).filter((r) => r.status === 'obtained').length
      const repeated = (data ?? []).filter((r) => r.status === 'repeated').length
      const missing = total - obtained - repeated
      const duplicateCount = (data ?? [])
        .filter((r) => r.status === 'repeated')
        .reduce((sum, r) => sum + (r.quantity - 1), 0)

      return { total, obtained, repeated, missing, duplicateCount }
    }),

  listDuplicates: protectedProcedure
    .input(z.object({ albumId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error } = await supabaseAdmin
        .from('album_stickers')
        .select('sticker_id, quantity')
        .eq('album_id', input.albumId)
        .eq('status', 'repeated')
        .order('sticker_id')

      if (error) throw new Error(error.message)

      const idSet = new Set((data ?? []).map((r) => r.sticker_id))
      const stickers = ALL_STICKERS.filter((s) => idSet.has(s.id))
      const qtyMap = new Map((data ?? []).map((r) => [r.sticker_id, r.quantity]))

      return stickers.map((s) => ({
        ...s,
        quantity: qtyMap.get(s.id) ?? 1,
        extras: (qtyMap.get(s.id) ?? 1) - 1,
      }))
    }),

  decrementRepeated: protectedProcedure
    .input(z.object({ albumId: z.string().uuid(), stickerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(input.albumId, ctx.userId)

      const { data, error: fetchError } = await supabaseAdmin
        .from('album_stickers')
        .select('quantity')
        .eq('album_id', input.albumId)
        .eq('sticker_id', input.stickerId)
        .maybeSingle()

      if (fetchError) throw new Error(fetchError.message)
      if (!data) throw new Error('Figurinha não encontrada')

      const qty = data.quantity

      if (qty <= 1) {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .delete()
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'missing' as const, quantity: 0 }
      }

      if (qty === 2) {
        const { error } = await supabaseAdmin
          .from('album_stickers')
          .update({ status: 'obtained', quantity: 1, updated_at: new Date().toISOString(), updated_by: ctx.userId })
          .eq('album_id', input.albumId)
          .eq('sticker_id', input.stickerId)
        if (error) throw new Error(error.message)
        return { status: 'obtained' as const, quantity: 1 }
      }

      const { error } = await supabaseAdmin
        .from('album_stickers')
        .update({ quantity: qty - 1, updated_at: new Date().toISOString(), updated_by: ctx.userId })
        .eq('album_id', input.albumId)
        .eq('sticker_id', input.stickerId)
      if (error) throw new Error(error.message)
      return { status: 'repeated' as const, quantity: qty - 1 }
    }),
})
```

- [ ] **Step 2: Replace `components/ProgressPanel.tsx`**

```typescript
'use client'
import { trpc } from '@/lib/trpc'

type Props = { albumId: string }

export function ProgressPanel({ albumId }: Props) {
  const { data } = trpc.stickers.getProgress.useQuery({ albumId })

  const obtained = data?.obtained ?? 0
  const repeated = data?.repeated ?? 0
  const total = data?.total ?? 1033
  const filled = obtained + repeated
  const pct = Math.round((filled / total) * 100)
  const missing = data?.missing ?? total

  return (
    <div style={{
      padding: '12px 16px 14px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 38, lineHeight: 1, color: 'var(--text)', letterSpacing: '0.01em',
          }}>{filled}</span>
          <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500, paddingBottom: 2 }}>
            / {total}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, lineHeight: 1,
            color: pct > 0 ? 'var(--green)' : 'var(--text-dim)',
          }}>{pct}%</span>
          <span style={{
            fontSize: 10, color: 'var(--text-dim)', fontWeight: 600,
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>completo</span>
        </div>
      </div>

      <div style={{
        height: 8, background: 'var(--surface-2)', borderRadius: 99,
        overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12,
      }}>
        <div
          className={pct > 0 ? 'progress-glow' : ''}
          style={{
            height: '100%', width: `${pct}%`,
            background: 'linear-gradient(90deg, #22c55e 0%, #15803d 100%)',
            borderRadius: 99, transition: 'width 0.7s ease', minWidth: pct > 0 ? 8 : 0,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <Chip value={missing} label="faltando" bg="var(--surface-2)" border="var(--border)" valueColor="var(--text)" />
        <Chip value={obtained} label="obtidas" bg="#dcfce7" border="#bbf7d0" valueColor="var(--green-mid, #15803d)" />
        {repeated > 0 && (
          <Chip value={repeated} label="repetidas" bg="#fef3c7" border="#fde68a" valueColor="var(--gold-mid, #b45309)" />
        )}
      </div>
    </div>
  )
}

function Chip({ value, label, bg, border, valueColor }: {
  value: number; label: string; bg: string; border: string; valueColor: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '4px 10px',
    }}>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, lineHeight: 1, color: valueColor }}>
        {value}
      </span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
```

- [ ] **Step 3: Replace `components/ActionSheet.tsx`**

The key changes: add `albumId` prop; pass it to `updateStatus.mutate`; use `{ albumId }` as cache key in optimistic updates.

```typescript
'use client'
import { useEffect, useState } from 'react'
import { trpc } from '@/lib/trpc'

type Status = 'missing' | 'obtained' | 'repeated'

type Props = {
  albumId: string
  stickerId: string
  status: Status
  quantity: number
  onClose: () => void
}

export function ActionSheet({ albumId, stickerId, status, quantity, onClose }: Props) {
  const utils = trpc.useUtils()
  const update = trpc.stickers.updateStatus.useMutation({
    onMutate: async ({ albumId, stickerId, status, quantity }) => {
      onClose()
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, (old) =>
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
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData({ albumId: vars.albumId }, ctx.prev)
    },
    onSettled: (_data, _err, vars) => {
      utils.stickers.list.invalidate({ albumId: vars.albumId })
      utils.stickers.getProgress.invalidate({ albumId: vars.albumId })
      utils.stickers.listDuplicates.invalidate({ albumId: vars.albumId })
    },
  })

  const [qty, setQty] = useState(status === 'repeated' ? quantity : 1)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function add() {
    const newStatus = qty > 1 ? 'repeated' : 'obtained'
    update.mutate({ albumId, stickerId, status: newStatus, quantity: qty > 1 ? qty : undefined })
  }

  function remove() {
    update.mutate({ albumId, stickerId, status: 'missing' })
  }

  function setRepeated(newQty: number) {
    if (newQty < 2) {
      update.mutate({ albumId, stickerId, status: 'obtained' })
    } else {
      update.mutate({ albumId, stickerId, status: 'repeated', quantity: newQty })
    }
  }

  const number = stickerId.match(/\d+$/)?.[0] ?? ''
  const countryCode = stickerId.replace(/\d+$/, '')
  const label = number === '00' ? '★' : number

  const cardGradient =
    status === 'obtained' ? 'linear-gradient(150deg,#22c55e,#15803d)'
    : status === 'repeated' ? 'linear-gradient(150deg,#f59e0b,#b45309)'
    : 'var(--surface-2)'
  const cardBorder =
    status === 'obtained' ? '#15803d'
    : status === 'repeated' ? '#b45309'
    : 'var(--border-2)'
  const numColor = status !== 'missing' ? 'rgba(255,255,255,0.95)' : 'var(--text-muted)'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        className="backdrop-enter"
        style={{ position: 'absolute', inset: 0, background: 'rgba(24,40,24,0.45)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div
        className="sheet-enter"
        style={{
          position: 'relative', background: 'var(--surface)',
          borderTop: '1px solid var(--border)', borderRadius: '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: 'var(--border-2)' }} />
        </div>

        <div style={{ padding: '12px 20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: cardGradient, border: `2px solid ${cardBorder}`,
            boxShadow: status !== 'missing' ? `0 4px 16px ${status === 'obtained' ? 'rgba(21,128,61,0.25)' : 'rgba(180,83,9,0.25)'}` : 'none',
          }}>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, lineHeight: 1, color: numColor }}>{label}</span>
            {countryCode && (
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', color: status !== 'missing' ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)', marginTop: 2 }}>
                {countryCode}
              </span>
            )}
          </div>
          <div>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: 28, lineHeight: 1, letterSpacing: '0.02em', color: 'var(--text)', margin: 0 }}>
              {stickerId}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '3px 0 0' }}>
              {status === 'missing' ? 'Faltando' : status === 'obtained' ? 'Obtida' : `${quantity} cópias`}
            </p>
          </div>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status === 'missing' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--green-dim)', border: '1.5px solid #86efac',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)' }}>
                  {qty === 1 ? 'Tenho esta figurinha' : `Tenho ${qty} cópias`}
                </span>
                <Stepper value={qty} min={1} max={99} accent="var(--green)" onChange={setQty} />
              </div>
              <button
                onClick={add}
                disabled={update.isPending}
                style={{
                  height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(21,128,61,0.3)',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Adicionar {qty > 1 ? `${qty} figurinhas` : 'figurinha'}
              </button>
            </>
          )}

          {status === 'obtained' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fef3c7', border: '1.5px solid #fde68a',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>
                  {qty <= 1 ? 'Tenho repetida' : `Tenho mais ${qty - 1}`}
                </span>
                <Stepper value={qty} min={1} max={99} accent="var(--gold)" onChange={setQty} />
              </div>
              {qty > 1 && (
                <button
                  onClick={() => update.mutate({ albumId, stickerId, status: 'repeated', quantity: qty })}
                  disabled={update.isPending}
                  style={{
                    height: 54, borderRadius: 14, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(150deg,#f59e0b,#b45309)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(180,83,9,0.25)',
                    opacity: update.isPending ? 0.6 : 1,
                  }}
                >
                  Marcar {qty} cópias
                </button>
              )}
              <button
                onClick={remove}
                disabled={update.isPending}
                style={{
                  height: 50, borderRadius: 14, fontSize: 14, fontWeight: 600,
                  color: '#dc2626', background: 'rgba(220,38,38,0.07)',
                  border: '1.5px solid rgba(220,38,38,0.2)', cursor: 'pointer',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Remover figurinha
              </button>
            </>
          )}

          {status === 'repeated' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#fef3c7', border: '1.5px solid #fde68a',
                borderRadius: 14, padding: '10px 16px', height: 58,
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>Cópias</span>
                <Stepper value={qty} min={1} max={99} accent="var(--gold)" onChange={(v) => { setQty(v); setRepeated(v) }} />
              </div>
              <button
                onClick={remove}
                disabled={update.isPending}
                style={{
                  height: 50, borderRadius: 14, fontSize: 14, fontWeight: 600,
                  color: '#dc2626', background: 'rgba(220,38,38,0.07)',
                  border: '1.5px solid rgba(220,38,38,0.2)', cursor: 'pointer',
                  opacity: update.isPending ? 0.6 : 1,
                }}
              >
                Remover figurinha
              </button>
            </>
          )}

          <button
            onClick={onClose}
            style={{
              height: 48, borderRadius: 14, fontSize: 14, fontWeight: 600,
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

function Stepper({ value, min, max, accent, onChange }: {
  value: number; min: number; max: number; accent: string; onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)',
          fontSize: 18, color: accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >−</button>
      <span style={{
        fontFamily: "'Bebas Neue'", fontSize: 26, lineHeight: 1,
        color: accent, minWidth: 32, textAlign: 'center',
      }}>{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)', border: '1.5px solid rgba(0,0,0,0.1)',
          fontSize: 18, color: accent, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
        }}
      >+</button>
    </div>
  )
}
```

- [ ] **Step 4: Replace `components/RepeatedView.tsx`**

```typescript
'use client'
import { trpc } from '@/lib/trpc'
import { generateCSV } from '@/lib/export-csv'

type Props = { albumId: string; username: string }

export function RepeatedView({ albumId, username }: Props) {
  const { data: stickers = [] } = trpc.stickers.list.useQuery({ albumId })
  const utils = trpc.useUtils()

  const decrement = trpc.stickers.decrementRepeated.useMutation({
    onMutate: async ({ albumId, stickerId }) => {
      await utils.stickers.list.cancel()
      const prev = utils.stickers.list.getData({ albumId })
      utils.stickers.list.setData({ albumId }, (old) =>
        old?.map((s) => {
          if (s.id !== stickerId) return s
          if (s.quantity <= 1) return { ...s, status: 'missing' as const, quantity: 0 }
          if (s.quantity === 2) return { ...s, status: 'obtained' as const, quantity: 1 }
          return { ...s, quantity: s.quantity - 1 }
        }),
      )
      return { prev }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) utils.stickers.list.setData({ albumId: vars.albumId }, ctx.prev)
    },
    onSettled: (_data, _err, vars) => {
      utils.stickers.list.invalidate({ albumId: vars.albumId })
      utils.stickers.getProgress.invalidate({ albumId: vars.albumId })
      utils.stickers.listDuplicates.invalidate({ albumId: vars.albumId })
    },
  })

  const repeated = stickers.filter((s) => s.status === 'repeated')
  const totalExtras = repeated.reduce((sum, s) => sum + (s.quantity - 1), 0)

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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {repeated.length} figurinha{repeated.length !== 1 ? 's' : ''} ·{' '}
          {totalExtras} extra{totalExtras !== 1 ? 's' : ''}
        </div>
        <button
          onClick={() => generateCSV(stickers, username)}
          style={{
            padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
            background: 'var(--surface-2)', color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Exportar CSV
        </button>
      </div>

      {Object.entries(groups).map(([section, items]) => (
        <div key={section}>
          <div style={{
            padding: '5px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
            background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          }}>
            {section}
          </div>
          {items.map((s) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: '0.04em',
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
                onClick={() => decrement.mutate({ albumId, stickerId: s.id })}
                disabled={decrement.isPending}
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text-muted)', fontSize: 20, lineHeight: 1,
                  cursor: decrement.isPending ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
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

- [ ] **Step 5: Update `components/DuplicatesList.tsx`**

```typescript
'use client'
import { trpc } from '@/lib/trpc'

type Props = { albumId: string }

export function DuplicatesList({ albumId }: Props) {
  const { data } = trpc.stickers.listDuplicates.useQuery({ albumId })

  if (!data || data.length === 0) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-amber-400 mb-3">
        Repetidas para troca ({data.reduce((s, r) => s + r.extras, 0)} extras)
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {data.map((s) => (
          <span
            key={s.id}
            className="bg-amber-900/40 border border-amber-700 text-amber-300 text-xs px-2 py-0.5 rounded"
          >
            {s.id} ×{s.extras}
          </span>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Replace `components/AlbumApp.tsx`**

This version adds `activeAlbumId` state + validation + passes `albumId` to all children. The album selection screen is a minimal inline placeholder here — it will be replaced by the full `AlbumSelectionScreen` component in Task 5.

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
import { StickerGridSkeleton } from './StickerGridSkeleton'

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
  const [activeAlbumId, setActiveAlbumId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('copa_active_album_id')
  })

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const profile = trpc.profile.get.useQuery(undefined, { enabled: !!session })

  const albums = trpc.albums.list.useQuery(undefined, {
    enabled: !!session && !!profile.data,
  })

  const activeAlbum = albums.data?.find((a) => a.id === activeAlbumId) ?? null

  const { data: stickers = [], isLoading } = trpc.stickers.list.useQuery(
    { albumId: activeAlbumId! },
    { enabled: !!session && !!profile.data && !!activeAlbum },
  )
  const utils = trpc.useUtils()

  useEffect(() => {
    if (!session || !activeAlbum) return
    const channel = supabaseBrowser
      .channel(`album_stickers_${activeAlbum.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'album_stickers',
        filter: `album_id=eq.${activeAlbum.id}`,
      }, () => {
        utils.stickers.list.invalidate({ albumId: activeAlbum.id })
        utils.stickers.getProgress.invalidate({ albumId: activeAlbum.id })
        utils.stickers.listDuplicates.invalidate({ albumId: activeAlbum.id })
      })
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [utils, session, activeAlbum])

  const handleAction = useCallback((id: string) => setSelectedId(id), [])
  const handleClose = useCallback(() => setSelectedId(null), [])

  function selectAlbum(albumId: string) {
    localStorage.setItem('copa_active_album_id', albumId)
    setActiveAlbumId(albumId)
  }

  function clearAlbum() {
    localStorage.removeItem('copa_active_album_id')
    setActiveAlbumId(null)
  }

  if (session === undefined) return <LoadingSpinner />
  if (!session) return <LoginScreen />
  if (profile.isLoading) return <LoadingSpinner />
  if (profile.data === null || profile.data === undefined) {
    if (profile.data === null) return <OnboardingScreen onComplete={() => profile.refetch()} />
    return <LoadingSpinner />
  }

  const username = profile.data.username

  if (albums.isLoading) return <LoadingSpinner />

  // No active album or invalid activeAlbumId → placeholder (replaced in Task 5)
  if (!activeAlbum) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--green)' }}>
          COPA 2026
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>@{username}</div>
        {(albums.data ?? []).length === 0 ? (
          <button
            onClick={async () => {
              // Quick create first album inline
              const result = await utils.client.albums.create.mutate({ name: 'Álbum Principal', type: 'personal' })
              await albums.refetch()
              selectAlbum(result.albumId)
            }}
            style={{
              padding: '12px 24px', borderRadius: 14, background: 'var(--green)',
              color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Criar meu primeiro álbum
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320 }}>
            {(albums.data ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => selectAlbum(a.id)}
                style={{
                  padding: '14px 16px', borderRadius: 14, background: 'var(--surface)',
                  border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{a.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                  {a.progress.obtained}/{a.progress.total}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--green)',
        }}>
          <button
            onClick={clearAlbum}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 20, borderRadius: 8, minWidth: 32,
            }}
            title="Voltar aos álbuns"
          >
            ←
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              COPA 2026
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: '0.04em', color: 'var(--text)', lineHeight: 1 }}>
              {activeAlbum.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 32, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
        </div>

        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'album' && (
          <>
            <ProgressPanel albumId={activeAlbumId!} />
            <FilterBar
              activeSection={activeSection}
              search={search}
              onSectionChange={setActiveSection}
              onSearchChange={setSearch}
            />
          </>
        )}
      </div>

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
          <RepeatedView albumId={activeAlbumId!} username={username} />
        )}
      </div>

      {selectedId && (
        <ActionSheet
          albumId={activeAlbumId!}
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

- [ ] **Step 7: Verify build passes**

```bash
npm run build
```
Expected: no TypeScript errors. If errors appear, check that all `albumId` props are threaded correctly.

- [ ] **Step 8: Start dev server and smoke-test**

```bash
npm run dev
```
Open http://localhost:3000. You should see either:
- The album selection placeholder (if no album) with "Criar meu primeiro álbum" button
- The normal album view if an album was already selected from a previous session

Tap a sticker card, change its status — the ActionSheet should close immediately and the card should update.

- [ ] **Step 9: Commit**

```bash
git add server/routers/stickers.ts components/ProgressPanel.tsx components/ActionSheet.tsx components/RepeatedView.tsx components/DuplicatesList.tsx components/AlbumApp.tsx
git commit -m "feat: migrate sticker procedures to albumId + album_stickers; wire activeAlbumId in AlbumApp"
```

---

### Task 5: AlbumSelectionScreen component

**Files:**
- Create: `components/AlbumSelectionScreen.tsx`
- Modify: `components/AlbumApp.tsx` (replace inline placeholder with `<AlbumSelectionScreen>`)

- [ ] **Step 1: Create `components/AlbumSelectionScreen.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { trpc } from '@/lib/trpc'

type Album = {
  id: string
  name: string
  type: 'personal' | 'shared'
  role: 'owner' | 'member'
  memberCount: number
  progress: { obtained: number; total: number }
}

type Props = {
  albums: Album[]
  username: string
  onSelect: (albumId: string) => void
  onRefetch: () => Promise<unknown>
}

export function AlbumSelectionScreen({ albums, username, onSelect, onRefetch }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'personal' | 'shared'>('personal')
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = trpc.albums.create.useMutation({
    onSuccess: async (result) => {
      await onRefetch()
      onSelect(result.albumId)
    },
    onError: (err) => setError(err.message),
  })

  const join = trpc.albums.join.useMutation({
    onSuccess: async (result) => {
      await onRefetch()
      onSelect(result.albumId)
    },
    onError: (err) => setError(err.message),
  })

  function handleCreate() {
    if (!newName.trim()) return
    setError(null)
    create.mutate({ name: newName.trim(), type: newType })
  }

  function handleJoin() {
    if (joinCode.length !== 6) return
    setError(null)
    join.mutate({ inviteCode: joinCode.toUpperCase() })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--green)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 26, letterSpacing: '0.06em', color: 'var(--text)', lineHeight: 1,
        }}>
          COPA <span style={{ color: 'var(--green)' }}>2026</span>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, padding: '20px 16px', overflowY: 'auto' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22, letterSpacing: '0.04em', color: 'var(--text)',
          }}>
            Seus Álbuns
          </div>
        </div>

        {/* Album list */}
        {albums.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '60px 24px', gap: 12, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>📒</div>
            <div style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 500 }}>
              Nenhum álbum ainda
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                marginTop: 8, padding: '12px 28px', borderRadius: 14,
                background: 'linear-gradient(150deg,#22c55e,#15803d)',
                color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Criar meu primeiro álbum
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {albums.map((a) => {
              const pct = Math.round((a.progress.obtained / a.progress.total) * 100)
              return (
                <button
                  key={a.id}
                  onClick={() => onSelect(a.id)}
                  style={{
                    padding: '14px 16px', borderRadius: 16, background: 'var(--surface)',
                    border: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 }}>
                        {a.name}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: a.type === 'shared' ? 'var(--gold)' : 'var(--green)',
                          background: a.type === 'shared' ? '#fef3c7' : 'var(--green-dim)',
                          border: `1px solid ${a.type === 'shared' ? '#fde68a' : '#86efac'}`,
                          borderRadius: 6, padding: '2px 6px',
                        }}>
                          {a.type === 'shared' ? 'Compartilhado' : 'Pessoal'}
                        </span>
                        {a.type === 'shared' && (
                          <span style={{ fontSize: 11, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            👥 {a.memberCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: pct > 0 ? 'var(--green)' : 'var(--text-dim)' }}>
                      {pct}%
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <div style={{
                      height: '100%', borderRadius: 99,
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg,#22c55e,#15803d)',
                      minWidth: pct > 0 ? 4 : 0,
                    }} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                    {a.progress.obtained} de {a.progress.total} figurinhas
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Actions */}
        {albums.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => { setShowCreate(true); setShowJoin(false); setError(null) }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                background: 'var(--green-dim)', border: '1.5px solid #86efac',
                color: 'var(--green)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              + Novo álbum
            </button>
            <button
              onClick={() => { setShowJoin(true); setShowCreate(false); setError(null) }}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 12,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Entrar com código
            </button>
          </div>
        )}

        {/* Create modal inline */}
        {showCreate && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              Novo álbum
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do álbum"
              maxLength={50}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              {(['personal', 'shared'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                    background: newType === t ? (t === 'shared' ? '#fef3c7' : 'var(--green-dim)') : 'var(--surface-2)',
                    border: `1.5px solid ${newType === t ? (t === 'shared' ? '#fde68a' : '#86efac') : 'var(--border)'}`,
                    color: newType === t ? (t === 'shared' ? 'var(--gold)' : 'var(--green)') : 'var(--text-muted)',
                  }}
                >
                  {t === 'personal' ? 'Pessoal' : 'Compartilhado'}
                </button>
              ))}
            </div>
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setShowCreate(false); setError(null) }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || create.isPending}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: !newName.trim() || create.isPending ? 0.5 : 1,
                }}
              >
                {create.isPending ? 'Criando...' : 'Criar'}
              </button>
            </div>
          </div>
        )}

        {/* Join modal inline */}
        {showJoin && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>
              Entrar com código de convite
            </div>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="XXXXXX"
              maxLength={6}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1.5px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 18, fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: '0.15em', textAlign: 'center', boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {error && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => { setShowJoin(false); setError(null) }}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleJoin}
                disabled={joinCode.length !== 6 || join.isPending}
                style={{
                  flex: 2, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'linear-gradient(150deg,#22c55e,#15803d)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: joinCode.length !== 6 || join.isPending ? 0.5 : 1,
                }}
              >
                {join.isPending ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `components/AlbumApp.tsx` — replace placeholder with `<AlbumSelectionScreen>`**

In `AlbumApp.tsx`, add the import at the top:
```typescript
import { AlbumSelectionScreen } from './AlbumSelectionScreen'
```

Find the inline placeholder block (the big `if (!activeAlbum)` return with the div containing "Seus Álbuns" text) and replace it with:
```typescript
  if (!activeAlbum) {
    return (
      <AlbumSelectionScreen
        albums={albums.data ?? []}
        username={username}
        onSelect={selectAlbum}
        onRefetch={() => albums.refetch()}
      />
    )
  }
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 4: Smoke-test AlbumSelectionScreen**

```bash
npm run dev
```
- Clear localStorage key `copa_active_album_id` in browser DevTools → Application → Local Storage
- Reload: should see AlbumSelectionScreen with album list
- Click an album: should enter the album view
- Press ← in header: should return to AlbumSelectionScreen
- If you have only one album, clear localStorage, reload, and test "+ Novo álbum" button — create a personal album, verify it appears in list and auto-selects

- [ ] **Step 5: Commit**

```bash
git add components/AlbumSelectionScreen.tsx components/AlbumApp.tsx
git commit -m "feat: AlbumSelectionScreen — album picker, create, join with invite code"
```

---

### Task 6: AlbumMembersSheet component

**Files:**
- Create: `components/AlbumMembersSheet.tsx`
- Modify: `components/AlbumApp.tsx` (add members icon in header for shared albums)

- [ ] **Step 1: Create `components/AlbumMembersSheet.tsx`**

```typescript
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
```

- [ ] **Step 2: Add members sheet to `components/AlbumApp.tsx`**

Add the import at the top of `AlbumApp.tsx`:
```typescript
import { AlbumMembersSheet } from './AlbumMembersSheet'
```

Add state near the other state declarations:
```typescript
const [showMembers, setShowMembers] = useState(false)
```

In the header section, after the album name `<div>` and before the `@{username}` div on the right, the right side already has `@{username}`. Update the right side to show a members button for shared albums:

Replace this fragment in the header:
```typescript
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 32, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
```

With:
```typescript
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 60, justifyContent: 'flex-end' }}>
            {activeAlbum.type === 'shared' && (
              <button
                onClick={() => setShowMembers(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 12, padding: '4px 6px', borderRadius: 8,
                }}
              >
                👥 {activeAlbum.memberCount}
              </button>
            )}
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>@{username}</span>
          </div>
```

Add the `AlbumMembersSheet` at the very end of the return, after the `ActionSheet`:
```typescript
      {showMembers && activeAlbum.type === 'shared' && activeAlbum.inviteCode && (
        <AlbumMembersSheet
          albumId={activeAlbumId!}
          albumName={activeAlbum.name}
          inviteCode={activeAlbum.inviteCode}
          isOwner={activeAlbum.role === 'owner'}
          currentUserId=""
          onClose={() => setShowMembers(false)}
          onAlbumLeft={clearAlbum}
        />
      )}
```

Note: `currentUserId` is empty string here because we don't currently expose userId from `profile.get`. The AlbumMembersSheet uses it to hide the remove-self button — since the owner is always `isOwner=true`, the only edge case is a member trying to remove themselves, which the server rejects anyway. For now pass an empty string; a future task could expose userId if needed.

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: no errors.

- [ ] **Step 4: Test AlbumMembersSheet**

```bash
npm run dev
```
- Create a shared album from AlbumSelectionScreen (or have one already)
- Enter the shared album — the header should show `👥 1` button on the right
- Tap it — the bottom sheet should slide up with the invite code and member list
- Tap "Copiar" — paste to verify the 6-char code is in clipboard
- Tap ↺ (regenerate) — code should update in the sheet and in the albums list

- [ ] **Step 5: Commit**

```bash
git add components/AlbumMembersSheet.tsx components/AlbumApp.tsx
git commit -m "feat: AlbumMembersSheet — members list, invite code copy/regenerate, leave album"
```

---

## Self-Review

### 1. Spec Coverage

| Spec requirement | Task |
|---|---|
| `albums`, `album_members`, `album_stickers` tables | Task 1 |
| RLS on all three tables | Task 1 |
| Migration of `user_stickers` → `album_stickers` per user | Task 2 |
| `drop table user_stickers` | Task 2 |
| `albums.list` with memberCount + progress | Task 3 |
| `albums.create` with invite_code for shared | Task 3 |
| `albums.join` via invite code | Task 3 |
| `albums.rename` (owner only) | Task 3 |
| `albums.regenerateCode` (owner only, shared only) | Task 3 |
| `albums.getMembers` (member auth) | Task 3 |
| `albums.removeMember` (owner only, not self) | Task 3 |
| `albums.leave` (non-owner only) | Task 3 |
| `albums.delete` (owner only, cascade) | Task 3 |
| All sticker procedures accept `albumId` | Task 4 |
| All sticker procedures query `album_stickers` | Task 4 |
| `activeAlbumId` in localStorage | Task 4 |
| Validate `activeAlbumId` against `albums.list` | Task 4 |
| AlbumSelectionScreen with list, create, join | Task 5 |
| AlbumMembersSheet with code + member management | Task 6 |
| Realtime channel updated to `album_stickers` with album_id filter | Task 4 |
| Header: back button, album name, COPA 2026 subtitle | Task 4 |
| Header: members icon for shared albums | Task 6 |

### 2. Type Consistency

- `AlbumRow` type defined in `albums.ts` — not exported; used only internally ✓
- `Album` type in `AlbumSelectionScreen.tsx` props matches shape returned by `albums.list` ✓
- `albumId` is `z.string().uuid()` in all Zod schemas ✓
- `assertMember` function signature: `(albumId: string, userId: string)` ✓
- All optimistic updates use `{ albumId }` as cache key matching the query input shape ✓
