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
