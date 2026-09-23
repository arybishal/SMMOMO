# SMMOMO Task Tracker

## Current Project State

Status: IN DEVELOPMENT

Current Phase: Frontend Foundation

Current Task: Task 005 - Automation List (COMPLETE)

Last Completed Task: Task 005 - Automation List

Next Task: Task 006 - Automation Builder

Last Updated: 2026-09-23 (Task 005)

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
| 004 | Dashboard | COMPLETE |
| 005 | Automation List | COMPLETE |
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

## Task 006 - Automation Builder

Status: NOT STARTED

### Objective

Turn `/automations/new` (and the disabled Edit path on `/automations/[id]`)
into a complete V1 automation builder UX: post selection, keyword rule,
private DM, optional public reply, and a live preview — without faking
persistence.

### Requirements

- Refine `app/(dashboard)/automations/new/page.tsx` in place; reuse data via
  `listPosts()` (posts API already exists) — no new data layer.
- Fields: post/reel selector (from API data), trigger keyword (required,
  trimmed, non-empty validation), private DM textarea (required; keep
  `{{first_name}}` variable visible), optional public reply toggle + field.
- Live preview panel: renders the DM/reply as the follower would see it
  (client-side, no backend, no chart/preview engine dependency).
- Validation feedback inline (accessible: labels, focus states, aria where
  needed); submit button disabled until valid — Save itself stays disabled /
  preview-style until mutation API exists (Task 014). No fake persistence,
  no fake activate flow (existing project convention).
- Wire the Edit action on `/automations/[id]` to open the builder prefilled
  (or clearly disabled with the same convention if prefilled routing is
  genuinely awkward — prefer prefilled via query/route state).
- Responsive: form and preview stack on mobile; no horizontal scroll.
- Tokens/primitives only; no new deps; mock-only.
- Do not touch unrelated routes.

### Notes

- Task 005 list links into detail; detail currently has disabled
  `Edit (Task 006)` / `Pause` buttons — Task 006 owns the Edit path.
- Full activation workflow / Meta calls remain later tasks (015–018).

---

# Completed Tasks

## Task 005 - Automation List

Status: COMPLETE

Completed:

- Header updated to spec: `Automations` / "Manage the comment-to-DM
  workflows running on your Instagram content." / `New automation` CTA →
  `/automations/new`.
- Compact summary strip (not metric cards): total / active / paused / draft,
  counts derived from `listAutomations()` data, colored numbers with text
  labels (never color-only).
- Status filter: All / Active / Paused / Draft segmented buttons
  (`aria-pressed`, token-based selected state, keyboard focus outlines).
- Lightweight search: single controlled `Input type="search"` matching
  automation name and keyword (case-insensitive); `aria-label`; filters and
  search combine (AND); `aria-live` "Showing X of Y" appears only while
  filtered; "No automations match" + `Clear filters` when a combination
  yields nothing.
- List content per row: name → `/automations/[id]`, post caption, `Updated`
  date (`updatedAt` contract field, `<time dateTime>`), keyword chip,
  truncated private-DM preview (`title` attr + full text on detail page),
  status Badge (active→success / paused→paused / draft→draft, unknown →
  neutral, never coerced to active), performance (matched / DMs / failed —
  failed in `text-danger` when > 0).
- Responsive: full columnar layout at `lg+` (12-col grid with matching
  header row: Automation / Trigger / Private DM / Status / Performance);
  stacked cards below `lg` with mobile labels for Keyword and Private DM
  plus an explicit `View` link — no horizontal scrolling anywhere.
- Client island isolated: new colocated `list.tsx` ("use client") owns only
  filter/search state; the server `page.tsx` keeps data loading through
  `lib/api/automations` and renders header, summary, and the true empty
  state (0 automations → explanation + `Create automation` CTA).
- No fake mutations: no Activate/Pause/Delete/Duplicate controls added;
  detail page untouched (its disabled Edit/Pause remain Task 006/014).

What it does:

`/automations` is now a finished V1 management surface — scannable summary,
filterable/searchable list with DM previews and performance, correct mobile
representation — while keeping the exact architecture (server fetch → props →
one client island) and zero new dependencies.

Files (key):

- apps/web/app/(dashboard)/automations/page.tsx (rewritten: header, summary,
  empty state, delegates list)
- apps/web/app/(dashboard)/automations/list.tsx (NEW — client filter/search
  island, colocated; not a route)
- TASK.md, Tree.md (documentation)

API/mock changes:

- None. Only `listAutomations()` consumed; no new types, fields, endpoints,
  or mock objects; no fetch outside `lib/api`.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (15 routes; list.tsx is a client module, not a
  route).
- Dev-server route verification:
  - `/automations` → 200 (list renders)
  - `/automations/auto_1` → 200 (valid detail renders, "Checklist DM" present)
  - `/automations/missing` → 404 (notFound behavior preserved)
  - `/`, `/dashboard`, `/posts`, `/inbox`, `/analytics`, `/settings`,
    `/automations/new` → 200
- `/automations` HTML assertions: new description copy, summary counts
  (`4 total`, `2 active`, `1 paused`, `1 draft` — verified in DOM, React
  text-node `<!-- -->` separators defeat naive substring checks), all four
  filter buttons with `aria-pressed`, search placeholder, all 4 automation
  names + 4 keywords, Updated dates, DM preview text, perf labels
  (matched/DMs/failed), `lg:grid-cols-12` header, `lg:hidden` mobile View
  link, `lg:col-span-4` row spans.
- Responsive: structural verification only (breakpoint classes in served
  HTML). No browser automation in this environment — real-viewport eyeball
  QA left to owner. Filter/search interaction is client-side and
  compile-verified (state logic); exercised manually by owner if desired.
- Empty state (0 automations) and no-match branch: compile-verified only
  (mock arrays always populated).

Known limitations:

- Filter/search behavior not driven by an automated browser (no tooling; no
  new deps allowed) — logic is minimal useMemo/useState, verified by types +
  lint only.
- Empty-state branches unexercised at runtime while mocks stay populated.
- No URL-persisted filter/search state (intentionally out of scope — spec
  forbade URL state libraries/complex query state).
- Detail-page Edit button still disabled (owned by Task 006).

Next:

Task 006 - Automation Builder

## Task 004 - Dashboard

Status: COMPLETE

Completed:

- Header kept: `Dashboard` / "Your Instagram comment automations at a glance."
  / primary `New automation` CTA via existing `PageHeader` + `buttonClasses`.
- Connection card refined: username, follower count, "connected since" date
  (from `SocialAccount.connectedAt`), Connected badge, Manage link →
  `/settings/social-accounts`. Disconnected/error state: danger-tinted border
  and icon, `Needs attention` badge, explanatory copy, `Open settings`
  secondary-button link — attention without alarming the whole page. The
  Manage/settings link is no longer hidden on mobile.
- KPI group (4, weighted hierarchy preserved): Comments matched (emphasis
  card), DMs sent, Failed deliveries (danger value + "Needs attention"
  caption only when > 0), Active automations `x / y` (from
  `AnalyticsSummary.activeAutomations` + list length).
- No KPI period label: `AnalyticsSummary` has no `period` field — not
  fabricated per spec §5.
- Usage snapshot strip: `UsageSummary.period` ("September 2026") + DMs sent,
  comments processed, public replies, failed (danger styling when > 0) +
  Details link → `/settings/usage`. Satisfies TASK.md usage requirement using
  only contract fields.
- Recent comment activity refined: username, comment text, matched automation,
  outcome badge computed by joining deliveries on `commentId`
  (Ignored / Failed / DM sent / Queued / Matched — Badge tones), relative
  time in a semantic `<time dateTime>` element. Empty state added.
- Recent deliveries card (new, full width): recipient, kind
  (Private DM / Public reply), automation name (joined via commentId) or
  error text when failed, status badge (Delivered/Sent/Queued/Failed — same
  tone map as Inbox), relative time. Empty state + View inbox link.
- Automation overview kept: name → detail link, keyword, DM count, status
  badge, View all → `/automations`. Empty state: explanation + `Create
  automation` CTA → `/automations/new` (View all hidden when empty).
- Empty states for all four sections (no account, no automations, no
  comments, no deliveries): compact text (+ CTA where actionable), no
  illustrations.
- Responsive: KPI grid 1 → 2 cols (`sm`) → 4 cols (`lg`); activity +
  automations side-by-side only at `lg` (stack below); timestamps hidden
  below `sm` so badges never overflow; all row text truncates; connection
  actions always visible.

What it does:

The dashboard now answers the eight product questions at a glance (connection,
automation health, matched comments, DMs, failures, recent events, active
automations, next action) while staying a single static server component with
zero new dependencies.

Files (key):

- apps/web/app/(dashboard)/dashboard/page.tsx (refined in place — the only
  code file changed)
- TASK.md, Tree.md (documentation updates)

API/mock changes:

- None. Consumed existing modules only: `getAnalyticsSummary`,
  `getInstagramAccount`, `listRecentComments`, `listRecentDeliveries`,
  `listAutomations`, `getUsageSummary`. No new types, fields, mock objects,
  or fetch calls; delivery→automation shown via `commentId` join
  ("Automation unknown" fallback — no invented backend fields).

Error & loading handling:

- No try/catch: `request()` throws propagate to Next's default error page —
  nothing swallowed, no parallel fetching architecture introduced.
- No `loading.tsx` — current architecture has none, mocks resolve instantly;
  add with the real API (Task 014) if latency warrants it.

Accessibility:

- h1 (`PageHeader`) → h2 (`CardTitle`) hierarchy; semantic `<ul>/<li>`;
  badges are text-labelled (state never color-only); `<time dateTime>`;
  meaningful link text ("View inbox", "View all", "Open settings");
  `focus-visible` outlines via `buttonClasses`, default focus ring on text
  links; contrast from the Tailwind-derived token palette.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (15 routes).
- Dev-server smoke: `/`, `/login`, `/register`, `/dashboard`, `/automations`,
  `/posts`, `/inbox`, `/analytics`, `/settings` — all HTTP 200.
- `/dashboard` HTML assertions verified present: header copy, username,
  follower count, Connected badge, all 4 KPI labels, `Usage · September 2026`
  (UTF-8), activity states (DM sent / Ignored / Failed), delivery kinds
  (Private DM / Public reply), Delivered badge, failed-error text, Launch Link
  automation join, New automation CTA, responsive classes
  (`sm:grid-cols-2`, `lg:grid-cols-4`, `lg:grid-cols-5`, `sm:block`).
- Queued badge absent from current render: d_6 is 6th in mock order, outside
  the top-4 slice — code path exists, not a defect.
- Responsive: structural verification only (grid/breakpoint classes confirmed
  in served HTML). No browser automation is available in this environment —
  real-viewport eyeball QA left to owner. Empty states/disconnected card are
  compile-verified branches (mock arrays are always populated at runtime).

Known limitations:

- Empty states and the disconnected connection state are not exercised at
  runtime while mocks stay populated.
- No browser-level visual check (no automation tooling; no new deps allowed).
- No `loading.tsx`/`error.tsx` yet — revisit when real API latency/failures
  arrive (Task 014).
- Delivery automation attribution depends on a matching comment record;
  otherwise shows "Automation unknown".

Next:

Task 005 - Automation List

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
