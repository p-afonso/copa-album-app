# Copa 2026 — Fase 4A: Design Polish + Collection UX

## Resumo

Transformar o app de "gerenciador de álbum funcional" em "plataforma de colecionador premium" através de três vetores: sistema de design consistente, microinterações emocionalmente satisfatórias e UX de coleção mais rápida e fluida. Sem gamificação, sem mascote — personalidade via copy, estados visuais e feedback.

---

## Contexto do App

- Next.js 16 App Router + React 19, tRPC v11, Supabase Postgres + Realtime
- Design tokens em `app/globals.css` (CSS custom properties)
- Animações existentes: `.card-pop`, `.sheet-enter`, `.backdrop-enter`, `.progress-glow`, `.skeleton-shimmer`
- Fontes: Outfit (body) + Bebas Neue (display)
- 20 componentes existentes — preservar arquitetura e componentização

---

## Seção 1: Design System Foundation

### 1.1 Tokens novos/revisados (`app/globals.css`)

**Cores:**
```css
--text-dim: #7a9a7a;                        /* era #a3bba3 — contraste corrigido 4.6:1 */
--surface-elevated: #f8fbf8;               /* cards flutuando acima de --surface */
--green-glow: rgba(22, 163, 74, 0.12);     /* team completion, hover states */
--gold-glow: rgba(217, 119, 6, 0.12);      /* repeated celebration */
```

**Border radius:**
```css
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
--radius-xl: 24px;
```

**Escala tipográfica:**
```css
--text-xs: 11px;    /* captions, labels uppercase */
--text-sm: 13px;    /* body secundário */
--text-base: 15px;  /* body principal */
--text-lg: 17px;    /* títulos pequenos */
--text-xl: 20px;    /* títulos */
--text-2xl: 28px;   /* display */
```

### 1.2 Botões primários

Aplicar em todos os botões de ação principal (ActionSheet, TradeProposalSheet, OnboardingScreen, ProposalsTab):
- Altura mínima: **48px**
- Padding lateral: **20px**
- `box-shadow: 0 4px 12px rgba(22, 163, 74, 0.28)` no estado normal
- `box-shadow: none` no estado `disabled` ou `isPending`
- Transição: `box-shadow 0.15s ease`

### 1.3 Espaçamento

Padronizar padding/gap nos componentes existentes para múltiplos de 4px: 8 / 12 / 16 / 20 / 24 / 32px. Eliminar valores inconsistentes como 10px, 11px, 14px onde aparecerem nos componentes principais.

---

## Seção 2: Microinterações + Feedback Emocional

### 2.1 StickerCard — flash de cor

Ao mudar status, além do `.card-pop` já existente, adicionar flash de fundo temporário (400ms):

```css
@keyframes flash-green {
  0%, 100% { background: transparent; }
  30%       { background: var(--green-glow); }
}
@keyframes flash-gold {
  0%, 100% { background: transparent; }
  30%       { background: var(--gold-glow); }
}
@keyframes flash-red {
  0%, 100% { background: transparent; }
  30%       { background: rgba(220, 38, 38, 0.08); }
}
.sticker-flash-green { animation: flash-green 0.4s ease; }
.sticker-flash-gold  { animation: flash-gold  0.4s ease; }
.sticker-flash-red   { animation: flash-red   0.3s ease; }
```

Aplicação em `StickerCard`: após receber prop de status atualizado, aplicar classe por 450ms via `useEffect` com `setTimeout`.

### 2.2 Team completion celebration

Em `StickerGrid`, calcular `isTeamComplete` por time (todos os stickers com `status !== 'missing'`).

Quando `isTeamComplete === true`:
- Header do time: fundo `var(--gold-glow)`, borda-bottom `1px solid var(--gold-mid)` com `opacity: 0.4`
- Texto do time: `color: var(--gold-mid)`
- Badge `✦ Completo` ao lado do nome (font-size 10px, uppercase, letter-spacing)
- Animação de entrada do badge: fade-in + translateX(-4px → 0) em 300ms

```css
@keyframes badge-appear {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
.team-complete-badge {
  animation: badge-appear 0.3s ease forwards;
}
```

### 2.3 Progress bar — count-up + overshooting

Em `ProgressPanel`:
- Número `X/670` anima com count-up de 600ms usando `requestAnimationFrame` ao receber novo valor
- Barra de progresso: `transition: width 0.6s cubic-bezier(0.34, 1.2, 0.64, 1)` (overshoot leve)

Implementação do count-up: hook `useCountUp(value, duration)` — anima de valor anterior para novo valor usando `requestAnimationFrame`.

### 2.4 Confetti — marcos significativos

Biblioteca: `canvas-confetti` (~3KB gzip). Instalar como dependência de produção.

**Triggers** (em `AlbumApp` que já observa `getProgress`):
1. Álbum atinge 50% de conclusão (primeira vez por sessão)
2. Álbum atinge 100% de conclusão

**Não** disparar por time individual — seria spam.

Configuração: burst de 1.5s, cores `['#16a34a', '#d97706', '#ffffff']`, `particleCount: 80`, `spread: 70`, origem `{ y: 0.6 }`.

Controle de "já disparou": `useRef<Set<string>>` de marcos já celebrados na sessão. Resetar ao trocar de álbum.

### 2.5 ActionSheet — micro-delay no close

Após salvar, fechar o sheet com delay de **80ms** (ao invés de imediato). Parece mais responsivo — o usuário vê que a ação foi registrada antes do sheet sair. Implementar em `ActionSheet` adicionando `setTimeout(onClose, 80)` no `onSuccess` da mutation.

---

## Seção 3: Collection UX

### 3.1 Quick-Add Mode

**Toggle** no `FilterBar`: botão `⚡` à direita do input de busca. Estado salvo em `localStorage('copa_quick_mode')`.

**Comportamento quando ativo:**

| Sticker atual | Tap | Resultado |
|---|---|---|
| `missing` | simples | → `obtained`, flash verde + card-pop |
| `obtained` | simples | → mini-overlay inline (ver abaixo) |
| `repeated` | simples | → `quantity + 1`, flash dourado |
| qualquer | long press (500ms) | → ActionSheet completo |

**Mini-overlay inline** (quando toca `obtained` no modo rápido):
- Aparece sobreposto ao card, fundo `var(--surface)` com sombra
- Dois botões: `+1 Repetida` e `Remover`
- Fecha automaticamente após 2s de inatividade
- Fecha ao tocar fora
- Implementar como componente `QuickActionOverlay` posicionado absolutamente em relação ao card

**API changes necessárias:** nenhuma — reutiliza `stickers.updateStatus` existente.

**UX do toggle:**
- Ativo: botão `⚡` com fundo `var(--green)`, texto branco, borda verde
- Inativo: botão `⚡` com fundo `var(--surface-2)`, texto `--text-muted`
- Toast discreto ao ativar: "Modo rápido ativado — toque para marcar" (2s, bottom)

### 3.2 Visual states dos times no StickerGrid

Aproveitar `isTeamComplete` calculado para a celebração (2.2) e adicionar estados visuais progressivos:

| Progresso do time | Visual |
|---|---|
| 0% (nenhuma figurinha) | Header opacity: 0.5 |
| 1–79% | Normal |
| ≥ 80% | Barra de progresso com `.progress-glow` (já existe) |
| 100% | Header dourado + badge `✦ Completo` (ver 2.2) |

### 3.3 Filtros de status no FilterBar

Após as pills de seção existentes (Todos / Group A / Group B / etc.), adicionar segunda linha de pills de status:

```
[ Todas ] [ Faltando ] [ Obtidas ] [ Repetidas ]
```

Implementado via filtro client-side sobre o array `stickers` já disponível — **zero request adicional**.

Quando filtro de status ativo + seção ativa, combinar os dois filtros (`AND`).

Pill "Repetidas" mostra badge com count: `Repetidas (12)`.

### 3.4 Toast system

Criar componente `Toast` simples (não usar biblioteca) para feedback leve:
- Posição: bottom center, `position: fixed`, `bottom: 88px` (acima do TabBar)
- Entrada: slide-up + fade, 200ms
- Saída: fade-out após duração configurável
- Máximo 1 toast visível por vez (fila simples)
- Variantes: `info` (fundo `--surface-elevated`), `success` (fundo `--green-dim`), `error` (fundo vermelho suave)

Usar para: ativação do quick mode, erros de trade, confirmações leves.

---

## Seção 4: Empty States com Personalidade

Substituir os empty states genéricos. Estrutura padrão:

```tsx
<EmptyState
  icon="📦"          // ou SVG inline
  title="Título bold"
  subtitle="Contexto e próximo passo."
  action={{ label: "CTA →", onClick: ... }}  // opcional
/>
```

Componente `EmptyState` novo, reutilizável, com ícone centralizado (opacity 0.35, font-size 40px), título (`--text`, 17px, 600), subtítulo (`--text-muted`, 13px), botão CTA opcional.

**Mapeamento:**

| Tela | Icon | Título | Subtítulo | CTA |
|---|---|---|---|---|
| Repetidas (vazia) | 📦 | Tudo único por aqui | Quando você tiver figurinhas repetidas, elas aparecem aqui para trocar. | — |
| Marketplace (vazio) | 🌐 | Ninguém no mercado ainda | Ative sua visibilidade e convide amigos para começar a trocar. | Ativar agora → |
| Propostas (vazia) | 📬 | Sua caixa está vazia | Visite o marketplace e proponha sua primeira troca. | Ver marketplace → |
| Histórico (vazio) | 🤝 | Nenhuma troca concluída | Suas trocas aceitas aparecem aqui com o contato da outra pessoa. | — |
| Álbuns (vazio) | 🗂 | Nenhum álbum ainda | Crie seu álbum ou entre em um compartilhado com um código. | — |

---

## Arquivos Afetados

**Modificar:**
- `app/globals.css` — novos tokens, animações de flash, team-complete, badge-appear
- `components/StickerCard.tsx` — flash de cor, suporte a quick-add long press
- `components/StickerGrid.tsx` — isTeamComplete, visual states por time
- `components/FilterBar.tsx` — toggle quick-add, pills de status
- `components/ProgressPanel.tsx` — count-up hook, overshoot na barra
- `components/ActionSheet.tsx` — 80ms delay no close, botões primários 48px
- `components/AlbumApp.tsx` — lógica de confetti, milestone tracking
- `components/RepeatedView.tsx` — EmptyState component
- `components/MarketplaceTab.tsx` — EmptyState component com CTA
- `components/ProposalsTab.tsx` — EmptyState component com CTA
- `components/ProfileView.tsx` — EmptyState para histórico

**Criar:**
- `components/EmptyState.tsx` — componente reutilizável
- `components/QuickActionOverlay.tsx` — overlay inline para quick-add
- `components/Toast.tsx` + `hooks/useToast.ts` — sistema de toast simples
- `hooks/useCountUp.ts` — hook de animação numérica

**Instalar:**
- `canvas-confetti` + `@types/canvas-confetti`

---

## Fora de Escopo (Fase 4B)

- Perfil público visitável por link
- OG image gerada no servidor
- Melhorias no marketplace (discovery, match perfeito, proposta rápida)
