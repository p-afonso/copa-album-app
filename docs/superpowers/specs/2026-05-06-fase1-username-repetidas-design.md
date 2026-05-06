# Design: Fase 1 — Username + Aba Repetidas + Export CSV

**Data:** 2026-05-06  
**Escopo:** Fase 1 de 3 do roadmap de features sociais do Copa 2026 Album App.

---

## Contexto

O app já possui auth via Supabase magic link, tRPC com `protectedProcedure`, e tabela `user_stickers` com RLS por usuário. Esta fase adiciona identidade de usuário (username único) e ferramentas de gestão de repetidas (visualização dedicada, remoção unitária e export CSV).

---

## 1. Banco de Dados

### Migration `004_profiles.sql`

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  created_at timestamptz default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);
create unique index profiles_username_idx on profiles (lower(username));
alter table profiles enable row level security;

-- Qualquer usuário autenticado pode ler (necessário para busca nas trocas - Fase 3)
create policy "select_any" on profiles
  for select using (auth.role() = 'authenticated');

-- Só o próprio usuário pode inserir/atualizar
create policy "insert_own" on profiles
  for insert with check (auth.uid() = user_id);

create policy "update_own" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Regras do username:**
- 3–20 caracteres
- Apenas letras, números e underscore (`_`)
- Case-insensitive (índice em `lower(username)`)

---

## 2. tRPC

### Novo router: `server/routers/profile.ts`

| Procedure | Tipo | Descrição |
|---|---|---|
| `profile.get` | query | Retorna `{ username: string } \| null` para o usuário autenticado |
| `profile.checkUsername` | query | Input: `{ username: string }` → retorna `{ available: boolean }` |
| `profile.create` | mutation | Input: `{ username: string }` → cria perfil; erro se username já existe |

### Alteração em `server/routers/stickers.ts`

| Procedure | Tipo | Descrição |
|---|---|---|
| `stickers.decrementRepeated` | mutation | Input: `{ stickerId: string }` → decrementa `quantity` em 1. Se `quantity` era 2 → muda status para `obtained`. Se era 1 → deleta a linha. |

---

## 3. UI

### `OnboardingScreen`

Exibida quando `profile.get` retorna `null` após autenticação. Substitui o app inteiro enquanto username não for configurado.

- Campo de username com validação em tempo real via `profile.checkUsername` (debounce 400ms)
- Feedback visual inline: verde se disponível, vermelho se indisponível/inválido
- Regras exibidas abaixo do campo: "3–20 caracteres, letras, números e _"
- Botão "Confirmar" desabilitado até que o username esteja disponível e válido
- Após criação bem-sucedida, `AlbumApp` re-renderiza com o app principal

### Navegação principal — duas abas

Substituem / complementam o logo bar atual:

| Aba | Conteúdo |
|---|---|
| **Álbum** | Comportamento atual: FilterBar + StickerGrid |
| **Repetidas** | Nova view `RepeatedView` |

### `RepeatedView`

- Lista todas as figurinhas com `status = 'repeated'`, agrupadas por seção
- Cada item: código, nome, quantidade de extras (ex: `×2 extras`)
- Botão **`−1`** por item → chama `stickers.decrementRepeated` com optimistic update
- Botão **"Exportar CSV"** no topo → gera download client-side

### Header

O espaço vazio à esquerda do logo exibe `@username` em `var(--text-muted)` após onboarding.

---

## 4. Export CSV

Gerado inteiramente client-side via `Blob` + `URL.createObjectURL`. Sem dependência externa.

**Formato:**
```
tipo,id,nome,secao,quantidade
repetida,BRA-01,Neymar Jr,Brasil,2
faltando,FRA-07,Mbappé,França,
```

- `quantidade` preenchida apenas para repetidas
- Arquivo nomeado `copa2026-@username-YYYY-MM-DD.csv`
- Funciona offline

---

## 5. Tratamento de Erros

| Cenário | Comportamento |
|---|---|
| `decrementRepeated` falha | Optimistic update revertido automaticamente pelo tRPC; toast de erro simples (div absoluta, sem lib) |
| Username tomado no submit (race condition) | Erro inline: "Username indisponível, tente outro" |
| `checkUsername` com resposta stale | Debounce 400ms + ignora respostas de queries anteriores ao campo atual |

---

## 6. Fora de Escopo (Fases futuras)

- **Fase 2:** Múltiplos álbuns por usuário + álbum compartilhado
- **Fase 3:** Sistema de trocas virtuais, histórico de trocas

---

## Decisões Técnicas

- **Profiles como tabela separada** (não `user_metadata`): permite unique constraint nativa, RLS própria, e é a base limpa para o sistema de trocas da Fase 3.
- **Export client-side**: evita endpoint adicional, funciona offline, sem custo de processamento no servidor.
- **Optimistic update no decrementRepeated**: UX mais fluida; tRPC reverte automaticamente em caso de erro.
