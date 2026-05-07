# Copa 2026 — Fase 3: Trocas e Perfil — Design Spec

## Resumo

Sistema de propostas de troca de figurinhas entre quaisquer usuários registrados, com marketplace público por álbum (opt-in), propostas in-app e atualização automática de status ao aceitar. Mais aba de perfil com histórico de trocas, edição de username e alteração de senha.

---

## Contexto do App

- Next.js 16 App Router + React 19, tRPC v11, Supabase Postgres + Realtime
- Auth: Supabase email+password; `ctx.userId` sempre presente em `protectedProcedure`
- `album_stickers`: (album_id, sticker_id) PK; `status ∈ {obtained, repeated}`; `quantity ≥ 1`
- `profiles`: user_id PK, username (único, 3-20 alfanumérico)
- Navegação atual: AlbumSelectionScreen → AlbumApp com TabBar (album | repetidas)

---

## Funcionalidades

### 1. Marketplace (por álbum, opt-in)

- Cada álbum tem um flag `marketplace_visible boolean DEFAULT false`
- Quando ativo, as figurinhas `repeated` do álbum aparecem como "OFEREÇO" e as `missing` aparecem como "PRECISO" no marketplace global
- O marketplace exibe stickers de **todos os usuários** com álbum visível, exceto o próprio
- Cada item mostra: código da figurinha, nome do país, `@username` do dono

### 2. Propostas de Troca

**Criação:** Usuário A vê no marketplace que `@joao` tem BRA-001 (OFEREÇO) e precisa de ARG-010 (PRECISO). Usuário A tem ARG-010 repetida. Clica em BRA-001 → abre `TradeProposalSheet` → escolhe qual das suas repetidas oferecer → envia proposta.

**Estado da proposta:** `pending → accepted | rejected | cancelled`

**Aceitar:** Dispara atualização automática nos dois álbuns:
- Proposer perde 1 unidade de `offered_sticker` (quantity-1; se chega a 1 → `obtained`; se chega a 0 → `missing` + remove linha)
- Proposer ganha `wanted_sticker`: se não existe no álbum → insere `{status: 'obtained', quantity: 1}`; se existe → `quantity + 1`, `status: 'repeated'`
- Inverso para o receiver (perde `wanted_sticker` do proposer, ganha `offered_sticker`)

**Rejeitar / Cancelar:** Atualiza só o status da proposta, sem mexer em stickers.

**Regras:**
- Não pode propor troca para si mesmo
- `offered_sticker` deve ter `status = 'repeated'` no `proposer_album` no momento da criação
- `wanted_sticker` deve existir com `status = 'repeated'` no `receiver_album` no momento da criação
- Propostas duplicadas (mesmo par de stickers entre os mesmos usuários, status `pending`) são bloqueadas

### 3. Aba Perfil (global, fora do contexto de álbum)

- Exibe `@username` atual
- **Alterar username**: campo inline, valida unicidade (3-20 alfanumérico); atualiza `profiles.username`
- **Alterar senha**: reutiliza `SetPasswordScreen` (já existente); chama `supabaseBrowser.auth.updateUser({ password })`
- **Histórico de trocas**: lista de propostas com `status = 'accepted'` onde o usuário é proposer ou receiver, ordenadas por `updated_at DESC`; mostra: figurinha dada ⇄ figurinha recebida, `@outro_usuario`, data
- **Sair**: `supabaseBrowser.auth.signOut()` → redireciona para LoginScreen

---

## Navegação

TabBar ganha 2 novas abas: `trocas` e `perfil`

```
Tab 1: album      — grid de figurinhas (existente)
Tab 2: repetidas  — lista de repetidas (existente)
Tab 3: trocas     — marketplace + propostas (novo)
Tab 4: perfil     — perfil global (novo)
```

A aba `trocas` tem sub-abas internas: **Marketplace** | **Propostas**

---

## Data Model

Migration file: `supabase/migrations/007_marketplace_trades.sql`

### Alteração na tabela `albums`

```sql
ALTER TABLE albums ADD COLUMN marketplace_visible boolean NOT NULL DEFAULT false;
```

### Nova tabela `trade_proposals`

```sql
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
```

### RLS

```sql
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;

-- Leitura: proposer ou receiver
CREATE POLICY "trade_proposals_select" ON trade_proposals
  FOR SELECT USING (
    auth.uid() = proposer_id OR auth.uid() = receiver_id
  );

-- Inserção: proposer_id deve ser o próprio usuário
CREATE POLICY "trade_proposals_insert" ON trade_proposals
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);

-- Atualização: proposer pode cancelar; receiver pode aceitar/rejeitar
CREATE POLICY "trade_proposals_update" ON trade_proposals
  FOR UPDATE USING (
    auth.uid() = proposer_id OR auth.uid() = receiver_id
  );
```

---

## tRPC Routers

### `trades` router — `server/routers/trades.ts`

| Procedure | Tipo | Descrição |
|---|---|---|
| `setVisibility` | mutation | Liga/desliga `marketplace_visible` num álbum (owner only) |
| `getMarketplace` | query | Retorna stickers de álbuns visíveis (exceto os do `ctx.userId`) |
| `propose` | mutation | Cria proposta; valida stickers e duplicatas |
| `respond` | mutation | Aceita ou rejeita proposta; se aceito, atualiza os dois álbuns |
| `cancel` | mutation | Cancela proposta (proposer only, status = pending) |
| `listProposals` | query | Lista propostas do usuário (incoming + outgoing) |

### `profile` router — `server/routers/profile.ts` (extensão)

| Procedure | Tipo | Descrição |
|---|---|---|
| `updateUsername` | mutation | Atualiza `profiles.username`; valida unicidade e formato |
| `getTradeHistory` | query | Propostas aceitas do usuário, ordenadas por `updated_at DESC` |

---

## Componentes

### Novos

| Componente | Responsabilidade |
|---|---|
| `TradeView` | Container da aba Trocas; gerencia sub-aba ativa e toggle de visibilidade |
| `MarketplaceTab` | Lista OFEREÇO + PRECISO de outros usuários; abre TradeProposalSheet |
| `ProposalsTab` | Lista incoming (aceitar/rejeitar) e outgoing (cancelar) |
| `TradeProposalSheet` | Bottom sheet: escolhe qual repetida oferecer → confirma proposta |
| `ProfileView` | Aba Perfil: username, alterar username/senha, histórico, sair |

### Modificados

| Componente | Mudança |
|---|---|
| `TabBar` | Adiciona tabs `trocas` e `perfil`; tipo `Tab` atualizado; mostra badge numérico na aba `trocas` quando há propostas incoming `pending` |
| `AlbumApp` | Renderiza `TradeView` e `ProfileView` conforme `activeTab` |

---

## Real-time

Ao entrar na aba Trocas, subscribe ao channel `trade_proposals_${userId}`:

```ts
supabaseBrowser
  .channel(`trade_proposals_${userId}`)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'trade_proposals',
    filter: `proposer_id=eq.${userId}`,
  }, () => utils.trades.listProposals.invalidate())
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'trade_proposals',
    filter: `receiver_id=eq.${userId}`,
  }, () => utils.trades.listProposals.invalidate())
  .subscribe()
```

Ao aceitar uma proposta, invalidar também `stickers.list`, `stickers.getProgress`, `stickers.listDuplicates` para os dois álbuns envolvidos.

---

## Edge Cases

- **Sticker não está mais repetido ao aceitar**: `respond` verifica no momento do aceite se o sticker ainda tem `status = 'repeated'` em ambos os álbuns; caso contrário lança `CONFLICT`
- **Álbum deletado**: CASCADE na FK garante que propostas relacionadas são deletadas
- **Usuário sai de álbum compartilhado**: proposta permanece; sticker update usa o `album_id` salvo na proposta
- **Proposta duplicada**: `propose` verifica se já existe proposta `pending` com mesmo par (proposer+offered_sticker vs receiver+wanted_sticker)

---

## Fora de Escopo

- Chat / mensagens entre usuários
- Trocas múltiplas (mais de 1 sticker por lado)
- Notificações push (só Realtime in-app)
- Matchmaking automático (sugestão de trocas perfeitas)
