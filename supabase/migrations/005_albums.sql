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

create index album_members_user_id_idx on album_members (user_id);

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
  for insert with check (auth.role() = 'authenticated' and owner_id = auth.uid());

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
    or (user_id = auth.uid() and role = 'member')
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

alter publication supabase_realtime add table album_stickers;
