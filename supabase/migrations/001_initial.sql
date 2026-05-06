-- Catálogo fixo de figurinhas (seed)
create table if not exists stickers (
  id           text primary key,
  section      text not null,
  country_code text not null,
  country_name text not null,
  number       text not null,
  position     integer not null
);

-- Estado do usuário por figurinha
create table if not exists user_stickers (
  sticker_id text primary key references stickers(id) on delete cascade,
  status     text not null check (status in ('obtained', 'repeated')),
  quantity   integer not null default 1 check (quantity >= 1),
  updated_at timestamptz not null default now()
);

-- Habilitar Realtime
alter publication supabase_realtime add table user_stickers;
