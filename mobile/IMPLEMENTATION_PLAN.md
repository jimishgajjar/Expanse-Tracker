# Expense Tracker — Native App Implementation Plan

> **Goal:** a native **iOS + Android** app with **exact feature parity** to the web app, a clean **Notion‑style** UI, sharing the **same Neon backend** as the website (one source of truth, zero schema changes).

| | |
|---|---|
| **Platforms** | iOS, Android (one Expo codebase) |
| **Location** | `mobile/` (Expo app) + new `/api/mobile/*` routes in the Next.js backend |
| **Backend** | Reuses the existing Neon DB via the mobile API — **no DB/schema changes** |
| **Status** | ✅ **Complete** — all phases (0–8) + the buildable extras (forgot password, tag detail, period comparisons, verify banner) are built, typecheck‑clean & bundle‑verified. Only environment‑gated items remain: running it on a device, a push dev build, and store submission. Deliberately deferred: Excel export (browser download + Bearer auth don't mix on mobile — the web export still works) and two polish items (skeleton loaders, optimistic updates). |
| **Last updated** | 2026‑06‑08 |

---

## 1. Why rebuild, and what we keep

The first pass shipped a thin "core" and hit two **Expo Go quirks** (both fixed): `expo-secure-store` has no web module, and importing `expo-notifications` throws inside Expo Go (SDK 53+). Those were environment issues, not architecture.

**Keep (already working):**
- ✅ Mobile API + **Bearer‑token auth** (`getSession()` reads the token; reuses every existing query/action — no schema changes)
- ✅ Notion **design tokens**
- ✅ Fixes: cross‑platform token storage, Expo‑Go push gating, CORS on `/api/mobile`
- ✅ Native push **delivery** wired (`sendPushToSub` routes Expo tokens to the Expo push service)

**Rebuild:** the **UI layer** — on real libraries, with **every** screen, phase by phase, each runnable in Expo Go before moving on.

---

## 2. Tech stack

| Concern | Library | Rationale |
|---|---|---|
| Navigation | **Expo Router** | file‑based, already set up |
| Styling | **NativeWind v4** (Tailwind for RN) | reuse the web's exact Notion tokens & class names ~1:1 |
| Icons | **lucide-react-native** | same icon names as the web (~180 category/account icons map perfectly) |
| Server state | **TanStack Query** | caching, background refetch, optimistic mutations, auto‑invalidation |
| Auth/UI state | **Zustand** + `expo-secure-store` | token + active workspace, persisted |
| Forms | **react-hook-form** + **zod** | mirror web validation |
| Charts | **react-native-gifted-charts** | donut / bar / line, clean and light |
| Bottom sheets | **@gorhom/bottom-sheet** | Notion‑style panels for every manager + add/edit |
| Lists | **@shopify/flash-list** | smooth with hundreds of transactions |
| Dates / money | port `src/lib/dates.ts` + `format.ts` | identical period logic & currency |
| Haptics / gestures | `expo-haptics`, `react-native-gesture-handler` | tactile feel, swipe actions |
| Push | `expo-notifications` (dev build) | gated off in Expo Go |

> If maximum build‑tool simplicity is preferred over NativeWind, the fallback is a typed **StyleSheet design system** (token module + primitives). Default is NativeWind.

---

## 3. Architecture

### Navigation tree
```
app/
  _layout.tsx                 Providers: QueryClient, GestureHandler, SafeArea, BottomSheet, Auth gate
  index.tsx                   redirect → /(app)/home or /(auth)/login
  (auth)/
    login.tsx  signup.tsx  forgot.tsx  reset.tsx
  (app)/
    _layout.tsx               auth guard (redirect if no token)
    (tabs)/
      _layout.tsx             bottom tabs
      home.tsx                Overview
      transactions.tsx        list + filters
      analytics.tsx           charts + budgets
      more.tsx                menu → managers + settings
    account/[id].tsx          account detail
    tag/[id].tsx              tag detail
  (sheets, presented modally)
    transaction.tsx           add/edit (income/expense/transfer)
    account-form.tsx          add/edit account
    category-form.tsx, categories.tsx
    subscription-form.tsx, subscriptions.tsx
    goal-form.tsx, goals.tsx
    split.tsx, sharing.tsx, settings.tsx
    period.tsx, workspace.tsx
```

### Folder structure (target)
```
mobile/src/
  app/                Expo Router routes (above)
  components/
    ui/               Box, Text, Card, Button, Input, Sheet, Chip, IconBubble, Segmented, Empty, Skeleton
    transaction-row.tsx, account-card.tsx, summary-card.tsx, category-picker.tsx,
    tag-input.tsx, icon-picker.tsx, period-bar.tsx, charts/*
  lib/
    api.ts            fetch wrapper (Bearer, base URL)
    query.ts          QueryClient + query keys
    auth.ts           Zustand store (token, user, workspace) + SecureStore
    hooks/            useBootstrap, useTransactions, useAccounts, useMutation wrappers per entity
    dates.ts          ported period logic
    format.ts         money + date formatting
    theme.ts          Notion tokens (also wired into tailwind.config.js)
    icons.ts          lucide name → component map
    types.ts          DTOs (mirrors src/lib/queries.ts)
    push.ts           expo-notifications (dev build only)
```

### Data flow
- **Server state → TanStack Query.** Query keys per entity (`['accounts']`, `['transactions', range, date]`, `['goals']`, …). Mutations call the mobile API, then `invalidateQueries` (or optimistic update + rollback).
- **Auth/session → Zustand** (`token`, `user`, `activeWorkspaceId`), persisted to SecureStore; `api.ts` injects the Bearer header.
- **One bootstrap** for first paint, then per‑entity queries for freshness.

---

## 4. Design system (Notion)

### Color tokens
| Token | Light | Dark |
|---|---|---|
| `bg` | `#ffffff` | `#191919` |
| `card` | `#ffffff` | `#202020` |
| `ink` (text) | `#37352f` | `#e9e9e7` |
| `ink-soft` | `#787774` | `#9b9a97` |
| `border` | `rgba(55,53,47,0.10)` | `rgba(255,255,255,0.094)` |
| `hover` | `#f1f1ef` | `#2a2a2a` |
| `green` (income/brand) | `#0f7b6c` | `#2f9e89` |
| `red` (expense) | `#e03e3e` | `#ff7369` |
| accents | blue `#0b6e99`, yellow `#cb912f`, purple `#6940a5` | brighter variants |

### Shape & type
- **Radii:** sm 6 · md 8 · lg 12 · xl 16 · pill 999
- **Spacing:** 4px base grid
- **Type:** system font; large tabular numerals for money; small uppercase labels for section headers
- **Surfaces:** flat, 1px hairline borders, minimal shadow — Notion "quiet premium"

### Core components (`components/ui`)
`Box` · `Text` · `Card` · `Button` (primary/outline/ghost/destructive) · `Input` · `Segmented` (toggle) · `Sheet` (gorhom wrapper) · `Chip`/`Tag` · `IconBubble` · `Avatar` · `ListRow` · `Empty` · `Skeleton` · `FAB`

---

## 5. Screen inventory — exact web parity

| # | Screen | Mirrors (web) | Key interactions |
|---|---|---|---|
| 1 | Login / Signup / Forgot / Reset | auth pages | sign in/up, reset, email‑verify banner |
| 2 | **Home (Overview)** | dashboard Overview | workspace switcher · period bar · 4 summary cards · account cards w/ **+Income / −Expense / ⇄Transfer** · spending donut · income‑vs‑expense chart · recent txns · FAB |
| 3 | **Transactions** | Transactions tab | type/account/category filters · search · date‑grouped FlashList · pagination · tap‑edit · swipe‑delete |
| 4 | **Analytics** | Analytics tab | net‑worth line · spend‑by‑category · income vs expense · **budget** progress · period comparison |
| 5 | **Account detail** | `/accounts/[id]` | balance + in/out/opening · full history · transfers · edit / archive / delete |
| 6 | **Tag detail** | `/tags/[id]` | all txns for a tag |
| 7 | **Add/Edit Transaction** | TransactionDialog | income/expense/**transfer** · amount · account · category · **multi‑tag** · note · **date picker** |
| 8 | **Categories** | CategoryManager | CRUD · **lucide icon picker** · color · income/expense kind |
| 9 | **Subscriptions** | RecurringManager | CRUD · frequency · next/end date · auto‑post · alerts |
| 10 | **Goals** | GoalsManager | create · **contribute** · progress · delete |
| 11 | **Split** | SplitManager | per‑member balances · add split · **settle up** |
| 12 | **Sharing** | MembersManager | invite by email · roles · remove · pending invites · view‑only mode |
| 13 | **Settings** | SettingsDialog | currency/locale · profile · change password · **notifications + digest toggles** · delete account · sign out · **Export** |

---

## 6. Backend — mobile API surface

Auth model: `Authorization: Bearer <session token>` (the token is a row in the `sessions` table; `getSession()` already reads it). Each endpoint is a thin wrapper over an **existing** action/query — no new business logic, no schema changes.

| Group | Endpoints | Backs onto |
|---|---|---|
| Auth | `POST /auth/login` ✅ · `POST /auth/signup` · `POST /auth/logout` · `POST /auth/change-password` · `POST /auth/forgot` · `GET /me` | auth.ts |
| Bootstrap | `GET /bootstrap?range=&date=` ✅ | aggregate |
| Accounts | `POST /accounts` · `PATCH /accounts/[id]` · `DELETE /accounts/[id]` · `POST /accounts/[id]/archive` | create/update/delete/setArchived |
| Categories | `POST /categories` · `PATCH /categories/[id]` · `DELETE /categories/[id]` | category actions |
| Transactions | `GET /transactions?range=` ✅ · `POST /transactions` ✅ · `PATCH /transactions/[id]` · `DELETE /transactions/[id]` | transaction actions |
| Transfers | `POST /transfers` · `DELETE /transfers/[id]` | transfer actions |
| Tags | `GET /tags` · `POST /tags` · `DELETE /tags/[id]` | tag actions |
| Recurring | `GET /recurring` · `POST /recurring` · `DELETE /recurring/[id]` | recurring actions |
| Goals | `GET /goals` · `POST /goals` · `POST /goals/[id]/contribute` · `DELETE /goals/[id]` | goal actions |
| Split | `GET /split` · `POST /split` · `POST /split/settle` · `DELETE /split/[id]` | split actions |
| Members | `GET /members` · `GET /invites` · `POST /members/invite` | sharing |
| Budgets | `GET /budgets` · `POST /budgets` · `DELETE /budgets/[id]` | setBudget/deleteBudget |
| Settings | `GET /settings` · `PATCH /settings` | updateSettings |
| Workspace | `POST /workspace/switch` | switchWorkspace |
| Analytics | `GET /analytics/net-worth` · `GET /analytics/range-totals?start=&end=` · `GET /transactions/all` | net‑worth / totals |
| Push | `POST /push/register` ✅ | push subscriptions |
| Export | `GET /export` (Excel, Bearer‑authed) | existing export route |

✅ = already built.

---

## 7. Build phases

Each phase is **independently runnable in Expo Go**, verified with `tsc` clean + `expo export` bundles, and a short "what to check on your phone."

| Phase | Delivers | Acceptance |
|---|---|---|
| **0 · Foundation** | NativeWind + tokens, lucide, Query + Zustand, `api.ts`, all `/api/mobile` endpoints, nav skeleton, UI primitives | app boots to login; tokens render; `tsc` + export clean |
| **1 · Auth** | login, signup, forgot, reset, verify banner, sign out | can sign in/out; bad creds show error; session persists across reloads |
| **2 · Home** | period bar, 4 summary cards, account cards + quick‑add, donut + bar charts, recent txns, FAB | real balances/charts; pull‑to‑refresh; quick‑add opens sheet |
| **3 · Transactions** | list, filters, search, pagination, **full add/edit/delete sheet** with multi‑tag + date | create/edit/delete reflect immediately (optimistic) |
| **4 · Accounts** | account detail, account CRUD, archive, transfers | add/edit/archive/delete account; create transfer |
| **5 · Analytics** | net‑worth line, category/account breakdowns, **budgets**, comparisons | charts match web numbers; set/clear budget |
| **6 · Managers** | Categories (icon picker), Tags, Subscriptions, Goals, Split, Sharing | full CRUD for each; invite member; contribute to goal; settle split |
| **7 · Settings** | currency, profile, change password, notifications + digest toggles, delete account, export, workspace switch | settings persist; export downloads; workspace switch rescopes data |
| **8 · Push + polish** | dev build push, skeleton loaders, haptics, empty states, optimistic everywhere, app icon/splash | a real push arrives on a dev build; polished transitions |

---

## 8. Testing strategy

- **Phases 1–7** run entirely in **Expo Go** — reload and verify each on a real phone.
- **Push (Phase 8)** requires a **development build** (`eas build --profile development`): free on **Android**; iPhone needs the **$99 Apple Developer** account.
- Every phase: `npx tsc --noEmit` clean + `npx expo export -p ios` bundles successfully, plus a concrete on‑device checklist.

---

## 9. Prerequisites (provided by you)

| Need | For | Cost |
|---|---|---|
| **Expo account** (`webhost466`) ✅ | EAS / push projectId | free |
| Same Wi‑Fi or `expo start --tunnel` | running in Expo Go | — |
| **Apple Developer** account | iPhone dev build + push + App Store | $99/yr |
| **Google Play** account | Play Store listing (APK sideload is free) | $25 once |

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Expo Go can't do push | gated off in Expo Go; push only in dev build (already handled) |
| NativeWind build hiccups | pin v4 + verify with `expo export` each phase; StyleSheet fallback ready |
| Can't test on‑device from this machine | verify via `tsc` + `expo export` + on‑device checklist you run |
| API parity drift | every endpoint wraps an existing action — same validation & scoping as web |
| Large transaction lists | FlashList + server pagination |

---

## 11. Open decisions

1. **Styling:** NativeWind v4 (default, matches web) vs plain StyleSheet (max simplicity). 
2. **Build cadence:** phase‑by‑phase check‑ins (recommended) vs one large drop.
3. **iOS distribution:** Expo Go now → dev build when the Apple account is ready.

---

### Next step
Begin **Phase 0 + 1** — rebuild the foundation on NativeWind and ship a working login you can see on your phone, then proceed through the phases with a check‑in after each.
