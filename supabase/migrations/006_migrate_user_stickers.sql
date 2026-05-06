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
