# SMMOMO Tree

Living map of the repository. Update this file whenever files or directories are
created, deleted, renamed, or moved.

Last updated: 2026-09-25 (Task 025 — Live Meta Integration Verification & Production Delivery Validation)

---

```text
smmomo/
├── .env.example              Environment template with Task 021 classification comments (client-safe / server-only / secret / optional / production-required)
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
│   │   ├── scripts/
│   │   │   ├── encrypt-ig-tokens.ts  Task 021 one-shot: encrypt existing social_accounts.access_token (idempotent, plaintextLeft check)
│   │   │   ├── validate-tokens.ts    Task 021 crypto check: roundtrip, malformed/tampered/wrong-key → null, DB all-v1 + decryptable
│   │   │   ├── validate-config.ts    Task 022 config gate: corsAllowlist + missingProductionConfig (names only, never values)
│   │   │   ├── validate-usage.mjs  Task 019 validation harness (idempotency, date range, RLS, webhook, route sweep)
│   │   │   ├── validate-security.mjs  Task 020+021+022 security harness (authz, input, webhook sig, headers, CSP, RLS column probe, member UPDATE token, no stack leak, CORS origin allowlist)
│   │   │   ├── validate-delivery.ts  Task 023 delivery harness: Graph contract (success/401/403/429/4xx/5xx/timeout/refused/malformed), error classification + token redaction, {{first_name}} literal, redirect-uri single source, stuck reclaim + claim race (service-role)
│   │   │   ├── validate-onboarding.ts  Task 024 onboarding harness (46 checks): pure step/checklist state, sync stub mode (import/idempotent/skipped VIDEO), activation gates (draft/409 duplicate/400 missing post), token-leak scan, web smokes
│   │   │   └── validate-integration.ts  Task 025 local integration harness (67 checks): single-source redirect + config presence audit, webhook→match→delivery→sent→usage E2E (Graph stub), duplicate replay, non-match, case-insensitive, workspace isolation (RLS+API+FK), reconnect UI, analytics formula, rate limits (runs last — 60s per-IP cooldown)
│   │   └── src/
│       │   ├── app.ts        buildApp(): error handler (no stack leak) + security headers + rate limit (020/021: webhooks, admin, OAuth + key cap; 024: sync 10/min/IP) + CORS allowlist (022 exact Set match, credentials, missing Origin = server-to-server) + production config warn (022 names only) + raw-body JSON parser + auth preHandler (skips /health, OAuth callback, /webhooks/*) + product routes (comments/deliveries live reads + /usage/summary from usage_events) + checkActivation gate (024: POST activate flag + PATCH status=active) + registerMetaRoutes + registerWebhookRoutes + registerAdminRoutes + registerContentSyncRoutes
│       │   ├── origins.ts    Central origin config (022): WEB_ORIGIN, API_ORIGIN, corsAllowlist (CORS_ORIGIN comma-separated exact), resolveRedirectUri, webhookCallbackUrl, missingProductionConfig (prod-only, names only)
│       │   ├── crypto.ts     AES-256-GCM shared helpers (021): encryptSecret/decryptSecret, v1 envelope, encryptionKey/encryptionReady — platform secrets + IG tokens
│       │   ├── usage.ts      Usage service (019): recordUsageEvent (service-role, idempotent), usageIdempotencyKey, currentUsagePeriod/parseUsageRange, getWorkspaceUsage (end-user JWT + RLS)
│       │   ├── admin.ts      Platform-admin routes (018A): GET/PUT /admin/integrations/meta + POST …/test (PLATFORM_ADMIN_EMAILS gate; secrets never in GET)
│       │   ├── platform-config.ts  Meta config service (018A): AES-256-GCM encrypt + getMetaConfig() DB-first/env-fallback single source for OAuth + webhooks (re-exports encryptionReady from crypto.ts)
│       │   ├── delivery.ts   Delivery worker (018/023): inline poll claim queued→processing → Graph send via meta-client → sent/requeue/failed + stuck processing reclaim (failed, no requeue — avoid duplicate DMs) + resolveAccessToken (decrypt v1 / lazy re-encrypt legacy, exported 024 for sync) + automation counters + recordUsageEvent on terminal sent/failed only (019) + needsReconnect on auth/permission errors (023, markAccountNeedsReconnect exported 024)
│       │   ├── meta-client.ts  Explicit Meta Graph HTTP boundary (023/024): sendInstagramDm / sendInstagramCommentReply / fetchInstagramMedia (GET /{igUserId}/media, 1 page of 50), shared graph() GET/POST, injectable fetch, lazy META_GRAPH_BASE, AbortSignal timeout, error class (auth/permission/rate_limit/invalid_request/temporary/network) + safe user messages + token redaction in diagnostics, {{first_name}} literal render
│       │   ├── posts-sync.ts Content sync route (024): POST /social-accounts/instagram/sync — session + 10/min/IP, service-role token via resolveAccessToken, fetchInstagramMedia → posts upsert on_conflict=workspace_id,ig_media_id (IMAGE/REEL/CAROUSEL only, VIDEO skipped), 400 no account / 409 needsReconnect / 502 classified
│       │   ├── engine.ts     Comment keyword engine (017): case-insensitive contains match → claim matched → bump matched_count → enqueue deliveries + comment_matched usage (019 winning claim only)
│       │   ├── meta.ts       Instagram OAuth: connect/callback/disconnect + state HMAC + service-role token upsert via encryptSecret (021) + best-effort webhook topic subscribe (credentials via getMetaConfig; origins via origins.ts 022)
│       │   ├── webhooks.ts   Meta webhooks: timing-safe GET verify handshake (020) + POST signature-checked comment persist → runCommentEngine → comment_received usage (019 inserted only) (service_role, idempotent; tokens via getMetaConfig)
│   │       ├── supabase.ts   Cookie session → verify JWT (+email) → PostgREST as user (204-safe); ensureWorkspace(); restService() for webhook/engine/delivery/platform_settings
│   │       └── server.ts     Listen on PORT (default 4000) + startDeliveryWorker (018)
│   │
│   └── web/                  Next.js 16 frontend (App Router, TypeScript, Tailwind v4)
│       ├── package.json      Workspace "web": dev/build/start/lint/typecheck
│       ├── tsconfig.json     Strict TS; "@/*" maps to apps/web root
│       ├── next.config.ts    Next.js config + security headers + full CSP (021, inventory in comments)
│       ├── proxy.ts           Next 16 proxy: cookie session refresh + route guard (app routes → /login?next=, authed off /login|/register only — /auth/confirm stays reachable)
│       ├── postcss.config.mjs Tailwind v4 via @tailwindcss/postcss
│       ├── eslint.config.mjs ESLint (eslint-config-next)
│       ├── AGENTS.md         Auto-managed Next.js agent rules (do not hand-edit)
│       ├── README.md         Pointer to root README
│       │
│       ├── app/
│       │   ├── layout.tsx            Root layout: fonts, metadata ("SMMOMO") + AuthResultBridge (forwards Supabase confirm tokens → /auth/confirm)
│       │   ├── page.tsx              Landing page (hero, how-it-works, features, CTA)
│       │   ├── globals.css           SMMOMO design-token foundation (@theme: semantic colors, radius, shadow; light theme only)
│       │   ├── favicon.ico
│       │   ├── (auth)/
│       │   │   ├── layout.tsx        Auth shell: logo header, centered card area
│       │   │   ├── login/page.tsx    Sign-in: signInWithPassword, friendly errors, unconfirmed→resend, ?verified=1 banner (Suspense+useSearchParams)
│       │   │   ├── register/page.tsx Sign-up: signUp + name metadata; enhanced "Confirm your email" state
│       │   │   └── auth/confirm/page.tsx  Email-confirmation callback: PKCE code / implicit tokens → verified | already | expired states
│       │   └── (dashboard)/
│       │       ├── layout.tsx        Force-dynamic DashboardShell (sidebar + topbar; session-scoped API data — never prerender)
│       │       ├── dashboard/page.tsx       3-branch connection card + Get started checklist (024 SetupCard, hidden at live), KPIs, usage, activity, deliveries, automations (+ empty-state CTAs)
│       │       ├── error.tsx                Route-group error boundary (024): "Something went wrong" + Try again (reset) + Back to dashboard
│       │       ├── automations/
│       │       │   ├── page.tsx             Server page: header, summary counts, empty state
│       │       │   ├── list.tsx             Client island: status filter + search + responsive rows (not a route)
│       │       │   ├── new/
│       │       │   │   ├── page.tsx         Server page: searchParams Promise; ?edit prefill (404 if unknown) + ?post preselect → builder
│       │       │   │   └── builder.tsx      Client island: post/keyword/DM/reply form, validation, live preview, "Activate right after saving" checkbox (024, activate flag → server gate), server error messages, real save (POST/PATCH via lib/api)
│       │       │   └── [id]/page.tsx        Detail; Edit → /automations/new?edit=id; StatusToggle island (Pause/Activate PATCH); 404s if unknown
│       │       │       └── status-toggle.tsx  Client island: PATCH status + router.refresh (not a route)
│       │       ├── posts/
│       │       │   ├── page.tsx             Server page: header + Sync CTA when connected (024), Instagram connection context, empty states, delegates list
│       │       │   ├── list.tsx             Client island: type filter + search + table/card rows + automation join (not a route)
│       │       │   └── sync-button.tsx      Client island (024): POST /social-accounts/instagram/sync → router.refresh, err.message surfacing (not a route)
│       │       ├── inbox/
│       │       │   ├── page.tsx             Server page: header, empty state, comments+deliveries+automations+posts via lib/api → island
│       │       │   └── inbox.tsx            Client island: activity list + detail panel, selection/search/outcome+post filters (not a route)
│       │       ├── analytics/page.tsx       Server page: KPIs (Dashboard-consistent), 7-day CSS chart + text summary, automation/content performance tables, delivery breakdown + failure records (all via lib/api)
│       │       └── settings/
│       │           ├── page.tsx                   Async hub: live lib/api summaries per row (account, period·DMs) + Integrations row only if admin API allows
│       │           ├── account/page.tsx           Server page: session getUser → email + name (redirect /login if none)
│       │           ├── account/account-form.tsx   Client island: Name, Email (readOnly), optional password change → updateUser; Save enabled
│       │           ├── social-accounts/page.tsx   Instagram card + OAuth ?oauth= notices + live Connect/Disconnect (Task 015)
│       │           ├── social-accounts/actions.tsx  Client islands: ConnectInstagram link + DisconnectInstagram (DELETE + connection-changed event)
│   │           ├── usage/page.tsx             UsageSummary rows: real period (UTC month or range), per-metric hints incl. comments matched/failures, zero-guard, Analytics cross-link
│       │           ├── integrations/page.tsx      Server page: platform-admin only (API 403 → redirect /settings) → MetaForm
│       │           └── integrations/meta-form.tsx Client island: App ID + secret/verify password fields + Configured badges + read-only redirect URI + Test
│       │
│       ├── components/
│       │   ├── auth-result-bridge.tsx  Client: if URL has Supabase auth tokens/?code=, replace() → /auth/confirm (silent on normal visits)
│       │   ├── ui/
│       │   │   ├── button.tsx        Button + buttonClasses() (Link reuses variant styles; token-driven variants)
│       │   │   ├── card.tsx          Card, CardTitle (rounded-card/border/surface/shadow-card tokens)
│       │   │   ├── badge.tsx         Badge (tone: success/paused/draft/failed/neutral/info; token-driven)
│       │   │   └── input.tsx         Label, Input, Textarea, Select (shared field chrome, primary focus ring)
│       │   └── layout/
│       │       ├── dashboard-shell.tsx  Client shell: mobile drawer state + sidebar/topbar/main
│       │       ├── sidebar.tsx          Nav (usePathname active state; closes drawer on navigate)
│       │       ├── topbar.tsx           Sticky top bar, menu button, status-aware connection pill (024: green connected / red reconnect link / zinc Connect link), real initials + Sign out
│       │       ├── page-header.tsx      Reusable page title/description/action row
│       │       └── icons.tsx            Inline SVG icon set (no icon dependency)
│       │
│       ├── lib/
│       │   ├── api/
│       │   │   ├── client.ts           request() seam: USE_MOCK=false → fetch(API_BASE); options (method/body incl. PUT); 404→undefined; API error body `message` surfaced on thrown Error (024, 200-char cap); friendly network-failure text; server-side cookie forward (next/headers)
│       │   │   ├── automations.ts      listAutomations, getAutomation, createAutomation (activate?: boolean → server gate, 024), updateAutomation
│       │   │   ├── posts.ts            listPosts, getPost, syncPosts (024: POST /social-accounts/instagram/sync)
│       │   │   ├── social-accounts.ts  listSocialAccounts, getInstagramAccount, instagramConnectHref, disconnectInstagram
│       │   │   ├── analytics.ts        getAnalyticsSummary
│       │       │   ├── usage.ts            getUsageSummary (/usage/summary — usage_events authority)
│       │   │   ├── admin-meta.ts       getAdminMetaConfig, saveAdminMetaConfig, testAdminMetaConfig (platform-admin only)
│       │   │   └── inbox.ts            listRecentComments, listRecentDeliveries
│       │   ├── supabase/
│       │   │   ├── client.ts           Browser Supabase client (@supabase/ssr createBrowserClient, publishable key, lazy env check)
│       │   │   ├── server.ts           Server Supabase client (@supabase/ssr createServerClient, async cookies(), session user)
│       │   │   └── cookie-options.ts   Shared session cookie options (022): SameSite=Lax, Secure in prod, optional NEXT_PUBLIC_COOKIE_DOMAIN Domain
│       │   ├── onboarding.ts       Pure derived state (024): onboardingStep (connect→reconnect→import→create→activate→waiting→live) + setupChecklist (done/current/pending + hrefs) — harness-tested, no React
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
│       ├── 20260923190000_webhook_events.sql  comments + deliveries tables + posts.ig_media_id + member SELECT RLS (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260923200000_delivery_worker.sql  deliveries status + processing + attempts/claimed_at + queued index (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260923210000_platform_settings.sql  single-row platform Meta settings, RLS no policies, service-role only (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260923220000_usage_events.sql  usage_events + unique idempotency + member SELECT RLS + 2 indexes (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260923230000_security_hardening.sql  social_accounts column-level SELECT + workspace_id immutability triggers (APPLIED 2026-09-23 via supabase db push)
│       ├── 20260924000000_production_readiness.sql  social_accounts no member INSERT/UPDATE + automations composite FK (workspace_id,post_id)→posts + unique (workspace_id,platform) (APPLIED 2026-09-23 via supabase db push)
│       └── 20260925000000_posts_sync_unique.sql  unique posts (workspace_id, ig_media_id) for idempotent content sync upsert (APPLIED 2026-09-25 via supabase db push)
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
- `apps/api/src/app.ts` → Fastify `buildApp()`: CORS exact-match allowlist (022:
  `corsAllowlist()` from `origins.ts`, credentials, missing Origin = server-to-server)
  + raw-body application/json parser (HMAC for
  webhooks) + auth preHandler (session cookie → JWT → ensureWorkspace; skips
  `/health`, Instagram OAuth callback, `/webhooks/*`) + product routes (posts,
  automations CRUD, social-accounts, analytics/usage summaries,
  comments/deliveries **live table reads**). `apps/api/src/origins.ts` → single
  source for WEB_ORIGIN/API_ORIGIN/CORS/redirect/webhook URLs (022).
  `apps/api/src/supabase.ts` → cookie
  parse + user verification + PostgREST helper + bootstrap_workspace RPC +
  `restService()` (service-role, webhook path only).
  `apps/api/src/meta.ts` → Instagram OAuth connect/callback/disconnect (Task 015)
  + best-effort webhook subscribe. `apps/api/src/webhooks.ts` → Meta verify
  handshake + signed comment ingest → engine (Task 016–017).
  `apps/api/src/engine.ts` → keyword match + delivery enqueue (Task 017)
  + comment_matched usage (019). `apps/api/src/delivery.ts` → inline
  delivery worker claim/send/counters (Task 018) + terminal sent/failed
  usage_events (019). `apps/api/src/usage.ts` → idempotent usage event
  layer + period summary (Task 019) — authority for usage/future billing.
  `apps/api/src/platform-config.ts` + `admin.ts` → platform Meta config
  (encrypted `platform_settings`, DB-first/env-fallback) + admin-only
  GET/PUT/test routes (Task 018A) — single source for OAuth + webhooks.
  `apps/api/scripts/validate-usage.mjs` → Task 019 validation harness.
  `apps/api/scripts/validate-security.mjs` → Task 020+021+022 security harness.
  `apps/api/scripts/validate-config.ts` → Task 022 production config gate (names only).
  `apps/api/scripts/encrypt-ig-tokens.ts` → Task 021 one-shot IG token encryption (idempotent).
  `apps/api/scripts/validate-tokens.ts` → Task 021 crypto + DB encryption checks.
  `apps/api/scripts/validate-delivery.ts` → Task 023 delivery harness (Graph contract, reclaim).
  `apps/api/scripts/validate-onboarding.ts` → Task 024 onboarding harness (sync + activation gates + web smokes).
  `apps/api/scripts/validate-integration.ts` → Task 025 local integration harness (webhook E2E, duplicate safety, isolation, rate limits; run last).
  `docs/security.md` → Security model, residual risks, prod requirements, CSP inventory, token storage, origin/CORS/cookie model.
- `apps/web/app/globals.css` → Design tokens (@theme): semantic colors, radius,
  shadow, fonts. Source of truth for the visual foundation — see README → Design System.
- `apps/web/lib/api/client.ts` → The only place UI data flows through; `USE_MOCK=false`
  (Task 014) hits the real API — server Components forward the request cookie,
  browser uses credentials include; 404 → undefined.
- `apps/web/lib/supabase/` → Browser/server Supabase clients (@supabase/ssr
  cookie sessions, publishable key only).
- `apps/web/app/(auth)/auth/confirm/page.tsx` → Processes email confirmation
  results (PKCE `?code=` exchange or implicit `#access_token=` setSession) and
  renders verified / already-verified / expired states. Mounted in (auth) layout.
- `apps/web/components/auth-result-bridge.tsx` → Root-layout client bridge:
  when Supabase Site URL lands on `/` with auth result params, forwards to
  `/auth/confirm` so the session is established and the user sees the state.
- `supabase/migrations/` → SQL migrations (apply via CLI link+push or dashboard SQL Editor): foundation, bootstrap/automation writes, social OAuth columns, webhook events (comments/deliveries), delivery worker (`20260923200000`), platform settings (`20260923210000`), usage events (`20260923220000`), security hardening (`20260923230000`), production readiness (`20260924000000` — token lockdown, composite FK, unique IG connection), posts sync unique (`20260925000000` — idempotent content import).
- `docs/security.md` → Task 020+021 security architecture + residual risks + CSP inventory.
- `apps/web/lib/mock/` → Centralized mock data shaped like real backend responses.
- `apps/web/types/index.ts` → Shared frontend domain types (match future API contracts).

## Not created yet (by design — create when needed)

`apps/web/hooks/`, `apps/web/stores/`, `prisma/`, `docker-compose.yml`,
`packages/shared/`, `packages/config/`, `docs/architecture/`.
