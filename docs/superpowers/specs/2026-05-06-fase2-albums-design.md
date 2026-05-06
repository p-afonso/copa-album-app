# Design: Fase 2 — Múltiplos Álbuns + Álbum Compartilhado

**Data:** 2026-05-06  
**Escopo:** Fase 2 de 3 do roadmap de features sociais do Copa 2026 Album App.  
**Depende de:** Fase 1 (username único em `profiles`)

---

## Contexto

Atualmente cada usuário tem exatamente um conjunto de figurinhas em `user_stickers`. A Fase 2 introduz o conceito de **álbum** como unidade principal: um usuário pode ter vários álbuns pessoais e pertencer a álbuns compartilhados com outras pessoas. Toda operação de figurinha passa a ser contextualizada por um `album_id`.

---

## 1. Schema de Banco de Dados

### Novas tabelas — Migration `005_albums.sql`

```sql
-- Álbuns (pessoais e compartilhados)
create table albums (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('personal', 'shared')),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  invite_code text unique,           -- somente para type = 'shared'
  created_at  timestamptz default now()
);

-- Membros de cada álbum (inclui o owner)
create table album_members (
  album_id  uuid not null references albums(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner', 'member')),
  joined_at timestamptz default now(),
  primary key (album_id, user_id)
);

-- Figurinhas por álbum (substitui user_stickers)
create table album_stickers (
  album_id   uuid not null references albums(id) on delete cascade,
  sticker_id text not null,
  status     text not null check (status in ('obtained', 'repeated')),
  quantity   int not null default 1 check (quantity >= 1),
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  primary key (album_id, sticker_id)
);
```

**RLS em `albums`:**
- `select`: usuário é membro (`exists` em `album_members`)
- `insert`: qualquer autenticado (cria próprio álbum)
- `update/delete`: somente owner

**RLS em `album_members`:**
- `select`: usuário é membro do mesmo álbum
- `insert`: usuário é owner do álbum OU está se adicionando a si mesmo via invite_code (tratado no servidor via `supabaseAdmin`)
- `delete`: owner remove outros; membro remove a si mesmo

**RLS em `album_stickers`:**
- `select/insert/update/delete`: usuário é membro do álbum

### Migration de dados — `006_migrate_user_stickers.sql`

1. Para cada usuário distinto em `user_stickers`:
   - Inserir em `albums` um álbum pessoal com `name = 'Álbum Principal'`, `type = 'personal'`, `owner_id = user_id`
   - Inserir em `album_members` com `role = 'owner'`
   - Copiar linhas de `user_stickers` para `album_stickers` com o novo `album_id`
2. `drop table user_stickers`

---

## 2. tRPC

### Novo router: `server/routers/albums.ts`

| Procedure | Tipo | Descrição |
|---|---|---|
| `albums.list` | query | Lista todos os álbuns do usuário com `{ id, name, type, role, memberCount, progress: { obtained, total } }` |
| `albums.create` | mutation | Input: `{ name, type }`. Cria álbum + insere owner em `album_members`. Se `type='shared'`, gera `invite_code` de 6 chars aleatórios (A-Z0-9). |
| `albums.join` | mutation | Input: `{ inviteCode }`. Encontra álbum pelo código, adiciona usuário como `member`. Erro se já membro ou código inválido. |
| `albums.rename` | mutation | Input: `{ albumId, name }`. Owner only. |
| `albums.regenerateCode` | mutation | Input: `{ albumId }`. Owner only, shared only. Gera novo `invite_code`. |
| `albums.getMembers` | query | Input: `{ albumId }`. Retorna lista `{ userId, username, role }`. Usuário deve ser membro. |
| `albums.removeMember` | mutation | Input: `{ albumId, targetUserId }`. Owner only. Não pode remover a si mesmo. |
| `albums.leave` | mutation | Input: `{ albumId }`. Membro não-owner sai do álbum. Owner não pode sair — deve transferir ownership ou usar `albums.delete`. |
| `albums.delete` | mutation | Input: `{ albumId }`. Owner only. Remove álbum, membros e stickers (cascade). |

### Mudanças em `server/routers/stickers.ts`

Todos os procedures recebem `albumId: string` no input. Antes de operar, verificam que `ctx.userId` é membro de `albumId` (query em `album_members`). Todas as queries mudam de `user_stickers` para `album_stickers`.

| Procedure | Mudança |
|---|---|
| `stickers.list` | Input: `{ albumId }` |
| `stickers.updateStatus` | Input: `{ albumId, stickerId, status, quantity? }` |
| `stickers.getProgress` | Input: `{ albumId }` |
| `stickers.listDuplicates` | Input: `{ albumId }` |
| `stickers.decrementRepeated` | Input: `{ albumId, stickerId }` |

---

## 3. UI

### `AlbumSelectionScreen` (novo componente)

Renderizado quando não há `activeAlbumId` válido no localStorage. Substitui o app inteiro até um álbum ser selecionado.

**Estrutura:**
- Header: logo "COPA 2026" + `@username`
- Lista de álbuns: cada card mostra nome, badge "Pessoal"/"Compartilhado", barra de progresso, contagem de membros (compartilhados)
- Estado vazio (primeiro acesso): CTA "Criar meu primeiro álbum"
- Botão **"+ Novo álbum"** → modal inline com input de nome + toggle Pessoal/Compartilhado
- Botão **"Entrar com código"** → input de 6 chars do invite code

Ao selecionar álbum: salva `copa_active_album_id` no localStorage, o `AlbumApp` renderiza normalmente.

### Mudanças no `AlbumApp`

**Header:**
- `@username` permanece à esquerda
- Centro: nome do álbum (menor) com "COPA 2026" acima como subtítulo
- Botão `←` à esquerda abre `AlbumSelectionScreen` (limpa `activeAlbumId` do localStorage)
- Para álbuns compartilhados: ícone de pessoas + número de membros → abre `AlbumMembersSheet`

**Passagem de `albumId`:**
Todos os calls tRPC recebem o `activeAlbumId` como parâmetro.

**Realtime:**
Canal muda para `album_stickers_changes` com filtro `album_id=eq.{activeAlbumId}`.

### `AlbumMembersSheet` (novo, apenas álbuns compartilhados)

Bottom sheet com:
- Lista de membros: `@username` + badge "Dono"/"Membro"
- Código de convite visível + botão copiar + botão regenerar (owner only)
- Botão `×` para remover membros (owner only, exceto si mesmo)

---

## 4. Estado e Fluxo

**Fluxo completo de renderização do `AlbumApp`:**

```
session undefined → LoadingSpinner
session null     → LoginScreen
profile loading  → LoadingSpinner
profile null     → OnboardingScreen
album loading    → LoadingSpinner (query albums.list)
album null/vazio → AlbumSelectionScreen
                   (ou activeAlbumId inválido → AlbumSelectionScreen)
stickers loading → StickerGridSkeleton
→ App normal
```

**`activeAlbumId`:**
- Lido de `localStorage.getItem('copa_active_album_id')` na montagem
- Validado contra `albums.list` — se não aparece na lista, limpa e volta para `AlbumSelectionScreen`
- Salvo/atualizado via `localStorage.setItem` ao selecionar álbum

---

## 5. Fora de Escopo

- Deletar álbum (pode ser adicionado depois)
- Notificações de convite (Fase 3 ou futuro)
- Histórico de quem marcou qual figurinha (futuro)
- Fase 3: sistema de trocas virtuais

---

## Decisões Técnicas

- **`supabaseAdmin` para join via invite_code**: a busca pelo `invite_code` e inserção em `album_members` é feita server-side (tRPC `protectedProcedure`) para contornar RLS sem expor a service role key no cliente.
- **`invite_code` de 6 chars A-Z0-9**: ~2 bilhões de combinações, suficiente para o contexto. Regenerável pelo owner se comprometido.
- **Migration de dados via SQL**: criação de álbum "Álbum Principal" para usuários existentes feita diretamente no SQL da migration, sem depender de chamadas tRPC — mais confiável e atômico.
- **localStorage para `activeAlbumId`**: simples, sem necessidade de backend state para preferência de UI.
