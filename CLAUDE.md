# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on :3000
npm run build    # production build
npm run lint     # ESLint
```

No test suite exists yet.

## Stack

- **Next.js 16.2.4** (App Router) + React 19 — read `node_modules/next/dist/docs/` before touching Next.js APIs; v16 has breaking changes
- **tRPC v11** — API layer; all procedures currently `publicProcedure` (no auth)
- **Supabase** — Postgres + Realtime; browser client via `lib/supabase-client.ts`, server client via `server/db.ts`
- **Tailwind CSS v4** — config via `postcss.config.mjs`, not `tailwind.config.*`; v4 syntax differs from v3
- **Zod v4** — input validation on tRPC mutations

## Architecture

```
app/
  layout.tsx          → root layout (wraps with TrpcProvider)
  page.tsx            → renders <AlbumApp />
  api/trpc/[trpc]/    → tRPC fetch handler

components/AlbumApp   → root client component; owns state (activeSection, search, selectedId)
  ├─ ProgressPanel    → tRPC: stickers.getProgress
  ├─ FilterBar        → section pills + search input
  ├─ StickerGrid      → renders StickerCard grid, filtered/sorted
  ├─ StickerCard      → single card with tap → onAction
  ├─ ActionSheet      → bottom sheet for status change (missing/obtained/repeated)
  └─ DuplicatesList   → tRPC: stickers.listDuplicates

server/
  trpc.ts             → initTRPC, exports router + publicProcedure
  db.ts               → supabaseAdmin (server-only)
  routers/
    stickers.ts       → list, updateStatus, getProgress, listDuplicates
    index.ts          → appRouter (combines all routers)

lib/
  sticker-data.ts     → ALL_STICKERS: hardcoded catalog (Copa 2026 groups/teams, ~20 stickers/team × 48 teams)
  trpc.ts             → createTRPCReact client
  supabase-client.ts  → browser Supabase client (for Realtime subscriptions)

supabase/migrations/
  001_initial.sql     → stickers + user_stickers tables, Realtime enabled
  002_seed.sql        → sticker catalog seed
```

## Design System

CSS custom properties in `app/globals.css` — always use these, never hardcode colors:

```
--bg, --surface, --surface-2, --border, --border-2
--green, --green-mid, --green-dim   (primary action)
--gold, --gold-mid, --gold-dim      (repeated/duplicates)
--red                               (destructive)
--text, --text-muted, --text-dim
```

Fonts: `Bebas Neue` (headings/display) and `Outfit` (body). Both loaded via Google Fonts in globals.css.

## Auth

Supabase Auth with email magic link (OTP). Flow:
1. `LoginScreen` → `supabaseBrowser.auth.signInWithOtp({ email })`
2. User clicks link → Supabase sets session in browser
3. `AlbumApp` detects session via `onAuthStateChange`
4. `TrpcProvider` reads `session.access_token` and sends it as `Authorization: Bearer <token>` on every request
5. `app/api/trpc/[trpc]/route.ts` calls `supabaseAdmin.auth.getUser(token)` to extract `userId`
6. All procedures are `protectedProcedure` — throw `UNAUTHORIZED` if no token

Database: `user_stickers` has `user_id uuid` PK `(user_id, sticker_id)`, RLS enabled, policies in `supabase/migrations/003_add_user_auth.sql`.

## Known Issues

- **Temp files in `app/`**: Vários `*.tmp.jpg` e `chk_*.tmp.jpg` dentro de `app/` são artefatos.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # browser client + Realtime
SUPABASE_SERVICE_ROLE_KEY=         # server only (bypasses RLS)
```
