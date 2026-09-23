# SMMOMO Task Tracker

## Current Project State

Status: IN DEVELOPMENT

Current Phase: Frontend Foundation

Current Task: Task 003 - Design System (COMPLETE)

Last Completed Task: Task 003 - Design System

Next Task: Task 004 - Dashboard

Last Updated: 2026-09-23

---

## Important Instructions For The Next AI Agent

1. Read this file completely.
2. Read Tree.md.
3. Read README.md.
4. Inspect the actual repository before changing anything.
5. Do not assume a task is incomplete simply because you have not seen it.
6. Verify the current code.
7. Continue from the first incomplete task unless there is a technical reason to change the order.
8. Update TASK.md after completing work.
9. Note: `apps/web` is Next.js 16 — its `AGENTS.md` warns that conventions may differ
   from older knowledge. Read `node_modules/next/dist/docs/` before writing Next code.
   Key facts already verified: `params` is a `Promise` (await it), route groups work
   normally, `LayoutProps`/`PageProps` globals only exist after a build — this project
   uses explicit prop typing so `tsc --noEmit` works on a clean clone.

---

# Task Overview

| ID | Task | Status |
|---|---|---|
| 001 | Project Initialization | COMPLETE |
| 002 | Frontend Application Shell | COMPLETE |
| 003 | Design System | COMPLETE |
| 004 | Dashboard | NOT STARTED |
| 005 | Automation List | NOT STARTED |
| 006 | Automation Builder | NOT STARTED |
| 007 | Posts | NOT STARTED |
| 008 | Inbox | NOT STARTED |
| 009 | Analytics | NOT STARTED |
| 010 | Settings | NOT STARTED |
| 011 | Backend Foundation | NOT STARTED |
| 012 | Database | NOT STARTED |
| 013 | Authentication | NOT STARTED |
| 014 | API Integration | NOT STARTED |
| 015 | Meta OAuth | NOT STARTED |
| 016 | Meta Webhooks | NOT STARTED |
| 017 | Automation Engine | NOT STARTED |
| 018 | BullMQ Delivery | NOT STARTED |
| 019 | Usage Tracking | NOT STARTED |
| 020 | Security Hardening | NOT STARTED |
| 021 | Testing | NOT STARTED |
| 022 | Production Preparation | NOT STARTED |

Note on 004–010: Task 002 delivered working placeholder versions of every route
(designed, data-driven, not empty). Tasks 004–010 should treat their pages as
"real but first-pass" — refine depth (filters, empty states, edit flows) rather
than rebuilding from scratch.

---

# Current Task

## Task 004 - Dashboard

Status: NOT STARTED

### Objective

Take the Task 002 dashboard page from first-pass to finished: better hierarchy,
empty-state handling, and depth that matches what a daily user needs.

### Requirements

- Refine the dashboard page (`app/(dashboard)/dashboard/page.tsx`) in place —
  it is already data-driven; improve depth, do not rebuild.
- Empty states: no connected account, no automations, no posts — clear
  next-action copy with a CTA linking to the right route.
- Usage snapshot card: reuse `getUsageSummary()` (already in `lib/api/usage.ts`)
  so usage is visible on the home screen, not only `/settings/usage`.
- Recent activity: show delivery status alongside comments (delivery result
  join from `lib/api/inbox.ts` mock data) so failures are visible at a glance.
- Keep tokens/primitives (`components/ui/*`, `@theme` classes) — no new raw
  palette values. No chart library.
- Mock-only: no backend, no new deps.

### Notes

- Dashboard shell, sidebar, topbar are done (Task 002) and tokenized
  (Task 003). Only the page body changes here.

---

# Completed Tasks

## Task 003 - Design System

Status: COMPLETE

Completed:

- Semantic `@theme` token layer in `apps/web/app/globals.css`: surfaces, text,
  primary/danger/success/warning families (each with `-soft`/`-strong`/
  `-foreground`), `info` aliasing primary, `neutral-soft`/`neutral-strong`,
  `border`/`border-muted`. Palette copied 1:1 from Tailwind v4 `theme.css`
  oklch values — no visual color shift.
- Radius tokens: `rounded-control` (0.375rem), `rounded-card` (0.5rem),
  `rounded-pill` (9999px). Shadow token: `shadow-card` (= v4 `shadow-sm` value).
- Geist fonts wired via `--font-sans`/`--font-mono`; typography hierarchy
  documented in README (titles / body / meta / metrics).
- Dark media block removed — light-only, explicitly deferred (README + Deferred).
- Migrated all UI primitives: `button.tsx` (tokenized variants,
  `rounded-control`), `card.tsx` (`rounded-card border-border bg-surface
  shadow-card`), `badge.tsx` (token tones, `rounded-pill`, `ring-{status}/20`),
  `input.tsx` (shared field chrome, `ring-primary` focus).
- Migrated layout components: `sidebar.tsx`, `topbar.tsx`, `page-header.tsx`,
  `dashboard-shell.tsx`.
- Migrated every page: landing, auth (layout/login/register), dashboard,
  automations (list/new/[id]), posts, inbox, analytics, settings (index +
  account/social-accounts/usage).
- README gained a Design System section (tokens, radius/shadow, typography,
  badge tones, raw-value exceptions, dark-mode deferral rule).

What it does:

Establishes one token source of truth. Future features (Tasks 004–010) style
against semantic classes, so palette or radius changes become one-line edits in
`globals.css` instead of a repo-wide find-replace.

Files (key):

- apps/web/app/globals.css (rewritten — @theme token foundation)
- apps/web/components/ui/{button,card,badge,input}.tsx
- apps/web/components/layout/{sidebar,topbar,page-header,dashboard-shell}.tsx
- apps/web/app/page.tsx + app/(auth)/* + app/(dashboard)/*/page.tsx (all pages)
- README.md (Design System section), Tree.md, TASK.md

Technical decisions:

- Semantic tokens (not palette dumps): e.g. `surface-muted` = zinc-50, not
  `zinc-50` used directly — components never name a palette step.
- Badge rings via opacity modifier `ring-success/20` instead of 6 extra ring
  tokens.
- Deliberate keep-as-literal (documented in README): intermediate greys
  (zinc-600/700), keyword chips `bg-zinc-100`, input ring `ring-zinc-300`,
  chart indigo, gradient placeholders, sidebar scrim `bg-zinc-950/40`.
- Documented micro-shifts: draft badge zinc-600 → `neutral-strong` (zinc-700);
  topbar dot emerald-500 → `success` (emerald-600); body default zinc-950 →
  `foreground` (zinc-900). Structure/layout unchanged everywhere.
- Dark mode deferred (not implemented): second token set later, no `dark:`
  utilities sprinkled meanwhile.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (15 routes).
- Built-CSS check: all token custom properties and utilities present in the
  emitted stylesheet (`--color-primary`, `.rounded-card`, `.shadow-card`,
  `.ring-success\/20`, `.divide-border-muted`, `var(--font-geist-sans)`, …).
- Dev-server smoke test: all 14 routes → HTTP 200.
- Visual verification: limited to the above (no browser automation in this
  environment). Token values are 1:1 copies of the Tailwind palette the pages
  already used, and no layout/copy/structure changed — owner eyeball pass
  recommended before heavy design work.

Known limitations:

- Light theme only (intentional — see Deferred).
- A handful of context-specific raw values remain by design (README list).

Next:

Task 004 - Dashboard

## Task 002 - Frontend Application Shell

Status: COMPLETE

Completed:

- Route groups: `(auth)` and `(dashboard)` with their own layouts.
- All V1 frontend routes created and rendering:
  `/`, `/login`, `/register`, `/dashboard`, `/automations`, `/automations/new`,
  `/automations/[id]`, `/posts`, `/inbox`, `/analytics`, `/settings`,
  `/settings/account`, `/settings/social-accounts`, `/settings/usage`.
- Responsive dashboard shell: fixed sidebar (drawer on mobile), sticky topbar,
  active-nav highlighting via `usePathname`, auto-close drawer on navigation.
- Landing page rewritten (hero, 3-step flow, features, CTA) — template page removed.
- API abstraction per master prompt §19: `lib/api/client.ts` + 6 feature modules.
  All UI data flows through `request()`; no fetch in components.
- Centralized mock data per §20: `lib/mock/` (accounts, posts, automations,
  comments, deliveries, analytics+usage) shaped like future API responses.
- Shared domain types in `types/index.ts`.
- UI primitives in `components/ui/` (Button, Card, Badge, Input/Label/Textarea)
  and layout components in `components/layout/` (shell, sidebar, topbar,
  page-header, inline SVG icons — no icon dependency added).
- Auth pages are functional UI with mock submit → `/dashboard` (real auth = Task 013).
- Social accounts page: Connect button intentionally disabled — no fake Meta flow.

What it does:

Provides the complete navigable frontend workspace with realistic mock-driven
content. Every route the master prompt §21 requires now exists, navigation works,
and the data seam for the future Fastify API is in place.

Files (key):

- apps/web/app/page.tsx (landing)
- apps/web/app/(auth)/{layout,login/page,register/page}.tsx
- apps/web/app/(dashboard)/{layout.tsx + dashboard, automations/*, posts, inbox,
  analytics, settings/*}
- apps/web/components/ui/{button,card,badge,input}.tsx
- apps/web/components/layout/{dashboard-shell,sidebar,topbar,page-header,icons}.tsx
- apps/web/lib/api/{client,automations,posts,social-accounts,analytics,usage,inbox}.ts
- apps/web/lib/mock/{accounts,posts,automations,comments,deliveries,analytics}.ts
- apps/web/types/index.ts
- apps/web/app/globals.css (forced single theme; auto-dark removed until tokens exist)

Technical decisions:

- `USE_MOCK` boolean in `lib/api/client.ts` is the single switch to real API;
  modules pass a mock resolver as fallback — flipping later touches one file.
- Explicit `{ children: ReactNode }` / `params: Promise<{id}>` prop typing instead
  of generated `LayoutProps`/`PageProps` globals (clean-clone typecheck safety).
- No icon/chart/image libraries: inline SVGs + CSS bars + gradient placeholders
  (offline-friendly, zero deps). Add libraries only when these fall short.
- Disabled-but-visible controls (Save, Connect, Edit, Pause) instead of hiding
  them — shows product shape without faking backend behavior.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (15 routes; `/automations/[id]` dynamic).
- Dev-server smoke test: all 14 concrete routes → HTTP 200;
  `/automations/missing` → 404 (correct `notFound()` behavior).

Known limitations:

- All data is mock; login/register submit only navigates (Tasks 013/014).
- Automation create/edit/activate are previews (Task 006).
- Design is coherent but not yet tokenized (Task 003).
- No `hooks/`, `stores/` — none needed yet.

Next:

Task 003 - Design System

## Task 001 - Project Initialization

Status: COMPLETE

Completed:

- Initialized git repository (no commits made yet — owner controls commit policy).
- Created npm workspaces monorepo root (`package.json`) with dev/build/lint/typecheck scripts.
- Created reserved folders: `docs/`, `tests/`, `docker/`, `packages/`.
- Scaffolded Next.js 16 frontend in `apps/web` (TypeScript, Tailwind v4, ESLint, App Router).
- Added root `.gitignore` and `.env.example` (secrets reserved/commented — no fake Meta credentials).
- Wrote `README.md`, `Tree.md`, and this `TASK.md`.
- Added `typecheck` script to `apps/web`.
- Updated page metadata to "SMMOMO".
- Replaced template `apps/web/README.md` with a pointer to root README.

What it does:

This establishes the initial SMMOMO repository structure and the documentation/handoff
system required for AI-assisted development. The frontend workspace compiles, lints,
builds, and serves.

Files:

- package.json
- .gitignore
- .env.example
- README.md
- Tree.md
- TASK.md
- apps/web/ (full Next.js scaffold)

Technical decisions:

- npm workspaces (no extra monorepo tooling — not needed yet).
- Next.js 16 with App Router; `LayoutProps<"/">` global replaced with explicit
  `{ children: ReactNode }` so `tsc --noEmit` passes on a clean clone.
- `docker-compose.yml`, `packages/shared`, `packages/config`, `apps/api`, `prisma/`
  intentionally NOT created yet — folders appear when they become necessary.
- Git initialized but uncommitted: no commits unless owner requests.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run dev` — HTTP 200 on `/`.

Next:

Task 002 - Frontend Application Shell

---

# Blocked Tasks

None.

---

# Deferred Tasks

- Payments/billing — V1 free during testing; usage tracking only (master prompt §34).
  Will surface as part of Task 019 unless the owner requests otherwise.
- Dark mode — deferred by decision in Task 003 (token layer is light-only).
  Ships as a coordinated second token pass in `globals.css` plus component
  review — not piecemeal `dark:` utilities. Documented in README.

---

# Important Technical Decisions

- **2026-09-23** — npm workspaces monorepo; frontend-first; mock API layer before real
  backend; Next.js 16 (verify docs before coding — breaking changes vs older Next).
- **2026-09-23** — `lib/api/client.ts` `USE_MOCK` flag is the single mock→real switch;
  feature modules pass mock resolvers as fallbacks.
- **2026-09-23** — explicit prop typing (not generated `LayoutProps`/`PageProps`) so
  typecheck works without a prior build.
- **2026-09-23** — no icon/chart/image dependencies yet; inline SVG + CSS only.
- **2026-09-23** — Task 003: semantic `@theme` tokens in `globals.css` are the
  single style source; UI uses token classes, light-only palette copied 1:1 from
  Tailwind v4 oklch theme (zero visual shift by construction).

---

# Known Issues

- None currently failing. See Deferred for intentional gaps.
