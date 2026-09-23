# SMMOMO Tree

Living map of the repository. Update this file whenever files or directories are
created, deleted, renamed, or moved.

Last updated: 2026-09-23 (Task 016)

---

```text
smmomo/
├── .env.example              Environment template (Supabase publishable vars + reserved secrets)
├── .gitignore                Root ignores (node_modules, .next, .env, etc.)
├── README.md                 Project documentation: what, install, run, architecture
├── TASK.md                   Task tracker + AI handoff file (read first)
├── Tree.md                   This file
├── package.json              Monorepo root: npm workspaces + dev/build/lint/typecheck (+ dev:api/build:api) scripts
│
├── apps/
│   ├── api/                  Fastify backend service (health + CORS + product routes on end-user JWT/RLS)
│   │   ├── package.json      Workspace "api": dev/build/start/typecheck
│   │   ├── tsconfig.json     Strict TS, CommonJS, tsc → dist/ (gitignored)
│   │   └── src/
│   │       ├── app.ts        buildApp(): CORS + raw-body JSON parser + auth preHandler (skips /health, OAuth callback, /webhooks/*) + product routes (comments/deliveries live reads) + registerMetaRoutes + registerWebhookRoutes
│   │       ├── meta.ts       Instagram OAuth: connect/callback/disconnect + state HMAC + token upsert + best-effort webhook topic subscribe
│   │       ├── webhooks.ts   Meta webhooks: GET verify handshake + POST signature-checked comment persist (service_role, idempotent)
│   │       ├── supabase.ts   Cookie session → verify JWT → PostgREST as user (204-safe); ensureWorkspace(); restService() for webhook path only
│   │       └── server.ts     Listen on PORT (default 4000)
│   │
│   └── web/                  Next.js 16 frontend (App Router, TypeScript, Tailwind v4)
│       ├── package.json      Workspace "web": dev/build/start/lint/typecheck
│       ├── tsconfig.json     Strict TS; "@/*" maps to apps/web root
│       ├── next.config.ts    Next.js config
│       ├── proxy.ts           Next 16 proxy: cookie session refresh + route guard (app routes → /login?next=, authed off /login|/register)
│       ├── postcss.config.mjs Tailwind v4 via @tailwindcss/postcss
│       ├── eslint.config.mjs ESLint (eslint-config-next)
│       ├── AGENTS.md         Auto-managed Next.js agent rules (do not hand-edit)
│       ├── README.md         Pointer to root README
│       │
│       ├── app/
│       │   ├── layout.tsx            Root layout: fonts, metadata ("SMMOMO")
│       │   ├── page.tsx              Landing page (hero, how-it-works, features, CTA)
│       │   ├── globals.css           SMMOMO design-token foundation (@theme: semantic colors, radius, shadow; light theme only)
│       │   ├── favicon.ico
│       │   ├── (auth)/
│       │   │   ├── layout.tsx        Auth shell: logo header, centered card area
│       │   │   ├── login/page.tsx    Sign-in form: signInWithPassword, inline errors, safe ?next return to app
│       │   │   └── register/page.tsx Sign-up form: signUp + name metadata; "Check your email" when confirmation required
│       │   └── (dashboard)/
│       │       ├── layout.tsx        Force-dynamic DashboardShell (sidebar + topbar; session-scoped API data — never prerender)
│       │       ├── dashboard/page.tsx       Connection, KPIs, usage, activity, deliveries, automations (+ empty states)
│       │       ├── automations/
│       │       │   ├── page.tsx             Server page: header, summary counts, empty state
│       │       │   ├── list.tsx             Client island: status filter + search + responsive rows (not a route)
│       │       │   ├── new/
│       │       │   │   ├── page.tsx         Server page: searchParams Promise; ?edit prefill (404 if unknown) + ?post preselect → builder
│       │       │   │   └── builder.tsx      Client island: post/keyword/DM/reply form, validation, live preview, real save (POST/PATCH via lib/api → draft)
│       │       │   └── [id]/page.tsx        Detail; Edit → /automations/new?edit=id; StatusToggle island (Pause/Activate PATCH); 404s if unknown
│       │       │       └── status-toggle.tsx  Client island: PATCH status + router.refresh (not a route)
│       │       ├── posts/
│       │       │   ├── page.tsx             Server page: header, Instagram connection context, empty states, delegates list
│       │       │   └── list.tsx             Client island: type filter + search + table/card rows + automation join (not a route)
│       │       ├── inbox/
│       │       │   ├── page.tsx             Server page: header, empty state, comments+deliveries+automations+posts via lib/api → island
│       │       │   └── inbox.tsx            Client island: activity list + detail panel, selection/search/outcome+post filters (not a route)
│       │       ├── analytics/page.tsx       Server page: KPIs (Dashboard-consistent), 7-day CSS chart + text summary, automation/content performance tables, delivery breakdown + failure records (all via lib/api)
│       │       └── settings/
│       │           ├── page.tsx                   Async hub: live lib/api summaries per row (account state, period·DMs)
│       │           ├── account/page.tsx           Server page: session getUser → email + name (redirect /login if none)
│       │           ├── account/account-form.tsx   Client island: Name, Email (readOnly), optional password change → updateUser; Save enabled
│       │           ├── social-accounts/page.tsx   Instagram card + OAuth ?oauth= notices + live Connect/Disconnect (Task 015)
│       │           ├── social-accounts/actions.tsx  Client islands: ConnectInstagram link + DisconnectInstagram (DELETE + connection-changed event)
│       │           └── usage/page.tsx             UsageSummary rows: period badge, per-metric hints, zero-guard, Analytics cross-link
│       │
│       ├── components/
│       │   ├── ui/
│       │   │   ├── button.tsx        Button + buttonClasses() (Link reuses variant styles; token-driven variants)
│       │   │   ├── card.tsx          Card, CardTitle (rounded-card/border/surface/shadow-card tokens)
│       │   │   ├── badge.tsx         Badge (tone: success/paused/draft/failed/neutral/info; token-driven)
│       │   │   └── input.tsx         Label, Input, Textarea, Select (shared field chrome, primary focus ring)
│       │   └── layout/
│       │       ├── dashboard-shell.tsx  Client shell: mobile drawer state + sidebar/topbar/main
│       │       ├── sidebar.tsx          Nav (usePathname active state; closes drawer on navigate)
│       │       ├── topbar.tsx           Sticky top bar, menu button, connection pill, real initials + Sign out
│       │       ├── page-header.tsx      Reusable page title/description/action row
│       │       └── icons.tsx            Inline SVG icon set (no icon dependency)
│       │
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts           request() seam: USE_MOCK=false → fetch(API_BASE); options (method/body); 404→undefined; server-side cookie forward (next/headers)
│       │   │   ├── automations.ts      listAutomations, getAutomation, createAutomation, updateAutomation
│       │   │   ├── posts.ts            listPosts, getPost (plain API seam — dual path removed)
│       │   │   ├── social-accounts.ts  listSocialAccounts, getInstagramAccount, instagramConnectHref, disconnectInstagram
│       │   │   ├── analytics.ts        getAnalyticsSummary
│       │   │   ├── usage.ts            getUsageSummary
│       │   │   └── inbox.ts            listRecentComments, listRecentDeliveries
│       │   ├── supabase/
│       │   │   ├── client.ts           Browser Supabase client (@supabase/ssr createBrowserClient, publishable key, lazy env check)
│       │   │   └── server.ts           Server Supabase client (@supabase/ssr createServerClient, async cookies(), session user)
│       │   └── mock/
│       │       ├── accounts.ts         Instagram account mock
│       │       ├── posts.ts            Posts/reels mock
│       │       ├── automations.ts      Automations mock (active/paused/draft)
│       │       ├── comments.ts         Comment events mock (matched + unmatched)
│       │       ├── deliveries.ts       DM/public-reply delivery mock (incl. failed)
│       │       └── analytics.ts        Analytics + usage summaries mock
│       │
│       ├── types/
│       │   └── index.ts           Domain types shaped like future API responses
│       │
│       ├── public/                Static assets (template SVGs for now)
│       └── .gitignore             Web-specific ignores
│
├── supabase/                Supabase CLI project (database foundation)
│   ├── config.toml          CLI config (project_id = SMMOMO; generated by `npx supabase init`)
│   ├── .gitignore           CLI ignores (.branches, .temp, .env.local…)
│   └── migrations/
│       ├── 20260923120000_smmomo_foundation.sql  workspaces → members/social_accounts → posts → automations + membership RLS (APPLIED 2026-09-23 via supabase db push; local == remote)
│       ├── 20260923170000_bootstrap_and_automation_writes.sql  bootstrap_workspace() RPC + member INSERT/UPDATE on automations (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260923180000_social_account_oauth_writes.sql  social_accounts token columns + member INSERT/UPDATE/DELETE (APPLIED 2026-09-23 via supabase db push)
│       └── 20260923190000_webhook_events.sql  comments + deliveries tables + posts.ig_media_id + member SELECT RLS (APPLIED 2026-09-23 via supabase db push)
│
├── packages/                 Reserved for genuinely shared code (empty for now)
│   └── .gitkeep
│
├── docs/                     Architecture / API decision records
│   ├── assets/
│   │   ├── banner.jpg            Hero banner for GitHub README
│   │   ├── how-it-works.jpg      4-step automation workflow infographic
│   │   └── dashboard-preview.jpg Product dashboard preview graphic
│   └── .gitkeep
│
├── tests/                    Cross-app tests (empty for now)
│   └── .gitkeep
│
└── docker/                   Container configs (empty for now)
    └── .gitkeep
```

## Important files (short explanations)

- `TASK.md` → WHAT is done / in progress / blocked / next. Read before any change.
- `Tree.md` → WHERE everything is. Keep accurate.
- `README.md` → General docs: install, run, env vars, architecture, design system.
- `package.json` (root) → npm workspaces (`apps/*`, `packages/*`) and top-level scripts
  (`dev`/`build` for web, `dev:api`/`build:api` for the API, `lint`, `typecheck` across both).
- `apps/api/src/app.ts` → Fastify `buildApp()`: CORS (origin `CORS_ORIGIN`, default
  localhost:3000, credentials) + raw-body application/json parser (HMAC for
  webhooks) + auth preHandler (session cookie → JWT → ensureWorkspace; skips
  `/health`, Instagram OAuth callback, `/webhooks/*`) + product routes (posts,
  automations CRUD, social-accounts, analytics/usage summaries,
  comments/deliveries **live table reads**). `apps/api/src/supabase.ts` → cookie
  parse + user verification + PostgREST helper + bootstrap_workspace RPC +
  `restService()` (service-role, webhook path only).
  `apps/api/src/meta.ts` → Instagram OAuth connect/callback/disconnect (Task 015)
  + best-effort webhook subscribe. `apps/api/src/webhooks.ts` → Meta verify
  handshake + signed comment ingest (Task 016).
- `apps/web/app/globals.css` → Design tokens (@theme): semantic colors, radius,
  shadow, fonts. Source of truth for the visual foundation — see README → Design System.
- `apps/web/lib/api/client.ts` → The only place UI data flows through; `USE_MOCK=false`
  (Task 014) hits the real API — server Components forward the request cookie,
  browser uses credentials include; 404 → undefined.
- `apps/web/lib/supabase/` → Browser/server Supabase clients (@supabase/ssr
  cookie sessions, publishable key only).
- `supabase/migrations/` → SQL migrations (apply via CLI link+push or dashboard SQL Editor).
- `apps/web/lib/mock/` → Centralized mock data shaped like real backend responses.
- `apps/web/types/index.ts` → Shared frontend domain types (match future API contracts).

## Not created yet (by design — create when needed)

`apps/web/hooks/`, `apps/web/stores/`, `prisma/`, `docker-compose.yml`,
`packages/shared/`, `packages/config/`, `docs/architecture/`.
