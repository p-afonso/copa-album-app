-- Adiciona user_id à tabela user_stickers e habilita RLS por usuário.
-- Execute DEPOIS de 001_initial.sql e 002_seed.sql.

-- 1. Remover PK antiga (sticker_id sozinho)
alter table user_stickers drop constraint user_stickers_pkey;

-- 2. Adicionar coluna user_id
alter table user_stickers
  add column user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;

-- 3. Nova PK composta
alter table user_stickers add primary key (user_id, sticker_id);

-- 4. Remover valor default (apenas para migration; app sempre envia explicitamente)
alter table user_stickers alter column user_id drop default;

-- 5. Habilitar RLS
alter table user_stickers enable row level security;

-- 6. Policies
create policy "select_own" on user_stickers
  for select using (auth.uid() = user_id);

create policy "insert_own" on user_stickers
  for insert with check (auth.uid() = user_id);

create policy "update_own" on user_stickers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "delete_own" on user_stickers
  for delete using (auth.uid() = user_id);
