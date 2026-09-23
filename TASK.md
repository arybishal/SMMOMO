# SMMOMO Task Tracker

## Current Project State

Status: IN DEVELOPMENT

Current Phase: Frontend Foundation

Current Task: Task 019 - Usage Tracking

Last Completed Task: Task 018 - BullMQ Delivery

Next Task: Task 019 - Usage Tracking

Last Updated: 2026-09-23 (Task 018)

Verification: 2026-09-23 Task 018 validation PASSED — typecheck/lint/
build:api/build exit 0; migration `20260923200000_delivery_worker.sql`
APPLIED via `supabase db push` (status check + `attempts` +
`claimed_at` + partial queued index); worker started on API process
(`pollMs=1500`, `graph=http://127.0.0.1:4090` validation stub);
**failed path first** (real Graph with invalid token): 4 rows →
`status=failed`, `attempts=1`, `error=graph_dm_401/graph_reply_401`
(Meta OAuth text), `failed_count=4`; **requeue → sent path** (Graph
stub 200): same rows → `status=sent`, `attempts=2`, errors cleared,
`dm_sent_count` 0→2 (private_dm only; public_reply does not bump
dm counter); **claim idempotency**: PATCH `status=eq.queued` on an
already-`sent` row returns `[]` (0 rows — no double-claim); inline
poller idempotent under single-process re-entry (`running` guard);
member route sweep 6/6 200; webhook GET verify → 200 challenge echo;
`/health` 200; secret **value** scan clean; Redis absent → honest
inline poll documented (not BullMQ); Graph live Meta send not proven
(no messaging perms — stub only for validation); Task 019 next.

Prior verification (fetch-failed investigation): 2026-09-23 **`TypeError: fetch failed` investigation PASSED** —
root cause = Fastify API not listening on `:4000` (stale/zombie `tsx watch`
`dev:api` processes after prior validation stopped servers; port free while
Next on `:3000` kept serving). Reproduced: `PORT_4000=False` while
`PORT_3000=True`; direct `GET http://localhost:4000/health` → connection
refused (`ECONNREFUSED` 127.0.0.1:4000); undici `fetch` cause =
`ECONNREFUSED` (connection failure, **not** an HTTP 4xx/5xx); all authed
dashboard routes 500 with `fetch failed` while API down. Affected requests:
server-component + client `fetch(`${API_BASE}${path}`)` from
`apps/web/lib/api/client.ts` (`API_BASE=http://localhost:4000`,
`USE_MOCK=false`) — every dashboard data path (`/dashboard` analytics +
social + inbox + automations + usage, `/automations`, `/inbox`, `/analytics`,
`/posts`, `/settings` + usage + social-accounts). **Task 017 engine not the
cause** — `runCommentEngine` only runs on the `/webhooks/*` path, never page
render. Env shape correct (web `NEXT_PUBLIC_API_URL` matches Fastify
`PORT ?? 4000`; CORS origin `http://localhost:3000`); no port/protocol/path
mismatch. **Fix = restart API only** (kill stale `dev:api`/`tsx watch`
processes, `npm run dev:api` with service-role env for webhook path) — **no
app code change**, no mock flip, no auth bypass, no suppressed errors.
Regression after fix: typecheck/lint/build:api/build exit 0; API `/health`
200; node fetch Next→API path OK; authed route sweep 9/9 200; anon
`/dashboard` 307; API product routes 200 (`/usage/summary` — note `/usage`
alone is 404, wrong probe path, not a bug); webhook GET verify → 200
challenge echo, bad signature → 403; no secret **values** in tracked sources
(only documentation strings mention `sb_secret_`); Task 018 remains
**NOT STARTED**. Ops note: always leave `npm run dev:api` running beside
`npm run dev` for local work; prior "servers stopped after validation"
shutdowns explain the observed error. Next roadmap task: **Task 018 —
BullMQ Delivery**.

Prior verification (Task 017): 2026-09-23 Task 017 validation PASSED —
typecheck/lint/build:api/build exit 0; signed webhook match → comment
matched=true + automation_name=Giveaway Engine + matched_count=1 +
deliveries private_dm+public_reply queued; duplicate webhook → still
count=1, delivery_rows=2 (idempotent claim); non-match → matched=false;
paused automation ignores keyword; case-insensitive contains
("GIVEAWAY" matches keyword giveaway); bad signature → 403; member
/comments/recent + /deliveries/recent 200 with matched shape (no token
leak); analytics commentsMatched=2; web /inbox + /dashboard 200, anon
inbox → login redirect; 0 API level 50/60 errors; secret values clean;
servers stopped after validation (this shutdown left port 4000 free and
produced the later `fetch failed` reports — see investigation above).

Prior verification (auth bugfix): 2026-09-23 auth confirmation bugfix PASSED — typecheck/
lint/build:api/build exit 0; `/auth/confirm` 200 (working state SSR);
login/register 200; authed dashboard/settings/inbox suite 200; anon
protected → 307 `/login?next=`; authed `/login`+`/register` → 307
`/dashboard`; Auth API: confirmed login OK, invalid →
`invalid_credentials` (UI: "Invalid email or password."), unconfirmed →
`email_not_confirmed` (UI: confirm message + resend), login after
confirm OK; confirm page structural states present; no `sb_secret_`/
service-role/PAT values in HTML or `.next` bundle; hydration audit:
no app `typeof window` render branches / `Math.random` /
`suppressHydrationWarning` — reported `bis_*` attrs are
extension-injected; servers stopped after validation. Next roadmap
task remains **Task 017 — Automation Engine**.

Prior verification (Task 016): 2026-09-23 Task 016 validation PASSED — typecheck/lint/
build/build:api exit 0; migration `20260923190000` applied via
`supabase db push`; handshake good token → 200 challenge echo / bad
token → 403 (with and without cookie); signed POST → 200 + durable
comment row (DB count=1), duplicate POST → 200 `duplicate` (still
count=1), bad/missing signature → 403, unknown ig_user_id → 200 ack
with warn log (no phantom workspace); member `/comments/recent` → 200
with probe shape (follower_probe, matched=false, postId empty until
posts import), `/deliveries/recent` → `[]`, anon → 401; social GET
no token/ig_user_id leak; web inbox shows probe comment, social
accounts Connect/Disconnect live, 13 routes 200, no-cookie/bogus →
`/login?next=`; 0 API level 50/60 errors; secret **values** clean in
tracked sources; servers stopped after validation.

Audit: 2026-09-23 read-only Supabase architecture audit PASSED — schema
designed in `supabase/migrations/20260923120000_smmomo_foundation.sql`
(5 tables: workspaces, workspace_members, social_accounts, posts,
automations; RLS enabled, membership-scoped SELECT-only, no
`using (true)` anywhere); auth confirmed mock-only (no middleware, no
`@supabase/ssr`); Posts runtime path is mock (`USE_MOCK=true`) with a
dormant Supabase branch; builder post selection is UI-only (preventDefault,
no persistence); remote schema verified still empty (migration intentionally
unapplied; storage buckets `[]`). Verdict for Task 008: READY — inbox
frontend on mocks needs no schema change; comments/deliveries tables, write
policies, and real auth belong to later tasks (013-015+). This audit
changed no database objects, migrations, or RLS.
Update: superseded 2026-09-23 — migration APPLIED in Task 012 via
`supabase db push` (local == remote; all 5 tables verified live, RLS
blocking anon); see the Task 012 record below.

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
| 006 | Automation Builder | COMPLETE |
| 007 | Posts + Supabase Foundation | COMPLETE |
| 008 | Inbox | COMPLETE |
| 009 | Analytics | COMPLETE |
| 010 | Settings | COMPLETE |
| 011 | Backend Foundation | COMPLETE |
| 012 | Database | COMPLETE |
| 013 | Authentication | COMPLETE |
| 014 | API Integration | COMPLETE |
| 015 | Meta OAuth | COMPLETE |
| 016 | Meta Webhooks | COMPLETE |
| 017 | Automation Engine | COMPLETE |
| 018 | BullMQ Delivery | COMPLETE |
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

## Task 019 - Usage Tracking

Status: NOT STARTED

### Objective

TODO — read master prompt §usage / Task 019 notes before implementing.

### Requirements

- See master prompt; do not invent scope.

---

# Completed Tasks

## Task 018 - BullMQ Delivery

Status: COMPLETE (2026-09-23). Roadmap next: Task 019.

### Objective (from spec)

Consume queued `deliveries` rows (Task 017 enqueue) and perform actual
Instagram Graph API sends (private DM + optional public reply) with
retry/failed accounting.

### What shipped

- **No Redis/BullMQ** in this environment (port 6379 closed; same gap as
  017). Shipped **honest inline poll** on the API process — documented,
  not dressed up as BullMQ. Upgrade path: swap `startDeliveryWorker`
  interval for a BullMQ worker when Redis exists.
- `supabase/migrations/20260923200000_delivery_worker.sql` APPLIED
  (`supabase db push`): status check gains `processing`; columns
  `attempts`, `claimed_at`; partial index on `status=queued`.
- `apps/api/src/delivery.ts` (new): claim `queued → processing` (filter
  `status=eq.queued` + `return=representation` — empty ⇒ lost race, skip);
  load comment → automation message text + workspace IG token;
  Graph send (`META_GRAPH_BASE` default `https://graph.instagram.com`,
  env-overridable for validation stub only); finalize `sent` / requeue
  `queued` (retryable network/5xx/429, max 3 attempts) / `failed` +
  `error` text; bump `automations.dm_sent_count` on private_dm sent and
  `failed_count` on permanent fail (public_reply success does not bump
  dm counter — no public-reply counter column exists yet).
- `apps/api/src/server.ts`: `startDeliveryWorker(app.log)` after listen.
- Graph endpoints: private_dm → `POST {base}/{ig_user_id}/messages`
  (recipient = commenter **username** from webhook); public_reply →
  `POST {base}/{ig_comment_id}/replies`. Non-2xx → `graph_dm_<status>` /
  `graph_reply_<status>` + Meta body snippet (truncated); network throw →
  `*_network` retryable.

### Files

- apps/api/src/delivery.ts (new)
- apps/api/src/server.ts (worker start)
- supabase/migrations/20260923200000_delivery_worker.sql (new)
- TASK.md, Tree.md

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`, `npm run build` — all exit 0.
- Migration: `npx supabase db push` → Finished, lists exactly `20260923200000_delivery_worker.sql`.
- Worker boot: API log `delivery worker started` with `pollMs=1500`, `graph=http://127.0.0.1:4090`.
- **Failed path (real Graph, invalid token)**: 4 queued rows → all
  `status=failed`, `attempts=1`, `error` =
  `graph_dm_401`/`graph_reply_401` with Meta OAuth JSON; automation
  `failed_count=4`.
- **Sent path (Graph stub 200 on :4090)**: requeued same 4 →
  `status=sent`, `attempts=2`, `error` cleared, stub hits for
  `POST /{ig_user_id}/messages` and `POST /{ig_comment_id}/replies`;
  `dm_sent_count` 0→2 (two private_dm); additional engine-enqueued row
  also sent (`dm_sent_count` climbed with later activity).
- **Claim idempotency**: PATCH `deliveries?id=eq.<sent>&status=eq.queued`
  → body `[]` (0 rows); row stays `sent`. Second claim on a claimed
  `processing` row also empty. In-process poller `running` guard prevents
  overlapping intervals.
- **Regressions**: authed `/dashboard` `/inbox` `/analytics`
  `/automations` `/posts` `/settings` → 200; webhook GET verify → 200
  challenge echo; `/health` → 200.
- Secret value scan: no service-role/PAT values in tracked sources.

### Known limitations / honest notes

- **Live Meta send not proven** — no Instagram messaging app permissions
  in this environment. Success path proven against a local Graph stub
  (`META_GRAPH_BASE=http://127.0.0.1:4090`); default env remains real
  Graph host (never fakes 200).
- Recipient is commenter **username**; some Graph modes require a
  numeric recipient id — non-2xx surfaces as `failed` with Meta error text.
- Stuck `processing` (crash mid-send) is **not** auto-reclaimed —
  operator resets to `queued` if needed (safer than silent redelivery).
- `publicReplies` analytics metric still 0 (no counter column) — 019 may
  derive from deliveries.
- Redis/BullMQ still absent — inline poll only.

---

## Task 017 - Automation Engine

Status: COMPLETE (2026-09-23)

Completed:

- **`apps/api/src/engine.ts` (new)** — `runCommentEngine(workspaceId,
  igCommentId, text, log)` after every successful webhook persist
  (inserted **or** duplicate — Meta retries safe):
  1. Load comment (`id`, `post_id`, `username`, `matched`).
  2. Load workspace **active** automations (`created_at.asc`; if
     `comment.post_id` set, filter `post_id=` that post; if `post_id`
     null while posts import pending, any active automation is eligible
     — documented policy).
  3. **Match policy: case-insensitive substring containment** —
     `comment.text.toLowerCase().includes(keyword.toLowerCase())`.
     `"GIVEAWAY"` matches keyword `giveaway`; `"give away"` (space) does
     **not** match `giveaway`. First matching automation wins.
  4. **Idempotent claim**: `PATCH comments SET matched, automation_id,
     automation_name WHERE id=… AND matched=false` with
     `return=representation` — empty result → already matched, no
     double-count.
  5. On winning claim: `matched_count = current + 1` (read-modify-write;
     claim gate prevents this comment counting twice — no RPC migration),
     then enqueue **deliveries** rows (`private_dm` always; `public_reply`
     only when automation.public_reply non-empty), both `status=queued`.
  6. Non-match: leave `matched=false` (inbox Ignored). Engine failure
     after persist → webhook 502 so Meta retries (idempotent re-entry).
- **`apps/api/src/webhooks.ts`** — after persist, call
  `runCommentEngine`; log `outcome` + `engine`; failed engine → push
  failure → 502.
- **Sync/queue boundary (017 vs 018)**: engine runs **inline** in the
  webhook request (no Redis/BullMQ in this environment). Enqueue =
  insert `deliveries` queued rows. Actual Graph API send belongs to
  **018**.
- No new migration (uses 016 `comments`/`deliveries` as-is). Service
  key only via API env `SUPABASE_SERVICE_ROLE_KEY` (never web).

Validation:

- `npm run typecheck`, `npm run lint`, `npm run build:api`,
  `npm run build` — all exit 0.
- E2E signed webhook (service + APP_SECRET test-app-secret-016):
  - Matching comment → 200; `matched=true`, `automation_name=Giveaway
    Engine`, `matched_count=1`, deliveries: private_dm + public_reply
    queued for `e2e_follower`.
  - Duplicate same comment → 200; `matched_count` still **1**;
    delivery_rows still **2** (claim idempotent).
  - Non-match text → `matched=false`.
  - Paused automation + keyword text → `matched=false`, count unchanged.
  - Case: text with `GIVEAWAY` → matched, count increments.
  - Substring edge: `"give away"` (space) correctly does not match
    keyword `giveaway` — policy is substring, not token-equality.
  - Bad signature → 403 (016 regression).
- Member API: `/comments/recent` shows matched comment + automation
  name (no access_token leak); `/deliveries/recent` shows queued
  private_dm; `/analytics/summary` `commentsMatched=2`.
- Web: `/inbox` 200, `/dashboard` 200; anon `/inbox` → login redirect.
- 0 API level 50/60 errors in engine run; secret values clean.

Files:

- apps/api/src/engine.ts (new)
- apps/api/src/webhooks.ts (engine call after persist)
- Tree.md, TASK.md

Notes / known limits:

- Redis/BullMQ still absent — inline path only; 018 may introduce queue
  without changing match semantics.
- If claim succeeds but delivery insert fails → webhook 502 → Meta retry
  → engine sees `matched=true` → returns `already` without re-enqueue
  (rare PostgREST blip; comment stays matched without delivery rows until
  018 adds repair — document, don't silently double-send).
- Graph API live send not proven here (no Meta messaging permissions in
  environment) — 018's problem.

## Bug Investigation — `TypeError: fetch failed` (after Task 017)

Status: COMPLETE (2026-09-23). **No code change.** Task 018 remains NOT
STARTED. Roadmap next remains Task 018.

### Symptom

Next.js runtime / server components logged `TypeError: fetch failed`
(and browser `Uncaught TypeError: fetch failed` for topbar
`getInstagramAccount`). Dashboard routes returned 500.

### Root cause (reproduced, not assumed)

**Fastify was not listening on port 4000** while Next continued on 3000.
State at repro: `PORT_3000=True`, `PORT_4000=False`. Stale `tsx watch` /
`npm run dev:api` processes were present but not bound (prior validation
cycles stop servers when done). `GET http://localhost:4000/health` →
"target machine actively refused it 127.0.0.1:4000". Node `fetch` cause
code: **`ECONNREFUSED`** — connection failure, distinct from HTTP 401/404/500
(fetch succeeded). Not caused by Task 017: engine only runs inside
`/webhooks/*`.

### Affected requests

All UI→API calls through `apps/web/lib/api/client.ts` line 50
(`fetch(`${API_BASE}${path}`)`), `API_BASE` from
`NEXT_PUBLIC_API_URL=http://localhost:4000`, `USE_MOCK=false`:
server pages (`/dashboard`, `/automations`, `/inbox`, `/analytics`,
`/posts`, `/settings`, `/settings/usage`, `/settings/social-accounts`) and
client topbar Instagram status. Env/port/protocol aligned with
`server.ts` `PORT ?? 4000`; CORS origin `http://localhost:3000` OK.

### Fix applied

Operational only: kill stale API processes; start `npm run dev:api` with
service-role env. **No application code change** — did not flip
`USE_MOCK`, did not disable auth, did not fake responses, did not bypass
Fastify, did not weaken security, did not add a generic try/catch to hide
the error. The error correctly surfaces when the API is down.

### Files

None (docs only: this TASK.md record + Tree.md "Last updated" line).

### Validation

- typecheck / lint / build:api / build exit 0
- API `/health` 200; node-level Next→API fetch OK
- Authed route sweep 9/9 → 200; anon `/dashboard` → 307
- API product routes 200 (`/usage/summary`; bare `/usage` 404 = wrong
  probe path, route lives at `/usage/summary`)
- Webhook GET verify → 200 challenge echo; bad signature → 403
- Tracked secret **value** scan clean (only docs mention `sb_secret_`)

### Ops note

Leave both `npm run dev` (3000) and `npm run dev:api` (4000) running for
local work. Stopping only the API after validation is what produced this
bug report.

---

## Task 016 - Meta Webhooks

## Bug Fix — Email Confirmation UX + Login Error + Hydration (after Task 016)

Status: COMPLETE (2026-09-23). Roadmap next remains Task 017.

### Bug discovered / root cause

1. **No confirmation callback existed.** Supabase confirmation emails redirect
   to Site URL with PKCE `?code=` or implicit `#access_token=…`. No route
   consumed those params: landing (`/`) is a static marketing page with no
   Supabase client, so the session was never established and the user saw
   only the homepage — no "Email verified" feedback.
2. **Login "error" after confirm** was raw Supabase messages (notably
   `email_not_confirmed` / `invalid_credentials`) shown verbatim. When the
   user had not completed confirmation (because #1 gave them no path),
   login correctly rejected with unconfirmed — but the UI never explained
   that or offered resend.
3. **Hydration warning** reported attributes `bis_skin_checked`, `bis_register`,
   `__processed_…` — browser-extension DOM injection before React hydration,
   not application-rendered attributes (see investigation below).

### Confirmation flow implemented

- **`app/(auth)/auth/confirm/page.tsx`** (new, client, under auth shell) —
  only reports success after Auth yields a confirmed session:
  - PKCE: `exchangeCodeForSession(code)` → `email_confirmed_at` → **Email verified**
    + "Continue to login" (`/login?verified=1`).
  - Implicit: `setSession(access_token, refresh_token)` → verified.
  - URL `error`/`error_description` or failed exchange without session →
    **Confirmation link expired** + "Request a new email" → `/register`.
  - Session already confirmed with no unused callback params →
    **Already verified** + continue to login.
  - Bare visit with no session → expired state (safe recovery, no raw errors).
- **`components/auth-result-bridge.tsx`** (new) mounted in root `layout.tsx` —
  if the browser lands on any path (typically `/`) with auth-result query/hash,
  `location.replace` to `/auth/confirm` preserving query+hash. Works even when
  Supabase Site URL still points at `/` (dashboard can later point Site URL
  at `/auth/confirm` directly).
- **`proxy.ts`**: `AUTH_PAGES` stays `["/login","/register"]` only —
  `/auth/confirm` must remain reachable when a session already exists
  (already-verified state).
- Register confirmation-sent card enhanced: "Confirm your email" pill +
  explicit note that the link opens an **Email verified** page; resend via
  re-submitting the same email (Supabase signup resend) or login resend button.

### Login issue / fix

- **`friendlyLoginError()`** maps Auth errors to safe copy:
  - `invalid_credentials` / user not found → **"Invalid email or password."**
  - `email_not_confirmed` → confirmation message + **Resend confirmation email**
    (`auth.resend({ type: "signup", email })`) using last submitted email.
  - rate limit → generic wait message.
  - anything else → "Something went wrong — try again." (no raw provider text).
- Success path unchanged: `signInWithPassword` → `safeNext` → dashboard.
- `?verified=1` banner: **"Email verified — you can sign in to continue."**
  via `useSearchParams` wrapped in `Suspense` (static prerender-safe).

### Hydration investigation result

- Reported attrs (`bis_skin_checked`, `bis_register`, `__processed_*`) are
  **browser-extension injected**, not React app attributes.
- App audit: **no** `typeof window` render branches in `.tsx`, **no**
  `Math.random()` in components, **no** `suppressHydrationWarning` added.
  `typeof window` exists only in `lib/api/client.ts` (fetch path, not render).
  Date formatting/`Date.now` in dashboard/inbox run in server components or
  client islands after hydration with force-dynamic data — not the reported error.
- Conclusion: **extension-only mismatch**; no application code change for
  hydration; no blind `suppressHydrationWarning`. Clean-browser recheck
  (extensions off/incognito) is the manual confirmation step — not automatable
  here (no browser automation).

### Files changed

- apps/web/app/(auth)/auth/confirm/page.tsx (new)
- apps/web/components/auth-result-bridge.tsx (new)
- apps/web/app/layout.tsx (mount AuthResultBridge)
- apps/web/app/(auth)/login/page.tsx (friendly errors, resend, verified banner, Suspense)
- apps/web/app/(auth)/register/page.tsx (richer confirmation-sent state)
- apps/web/proxy.ts (comment only — AUTH_PAGES unchanged behavior)
- TASK.md, Tree.md (this record)

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`, `npm run build` — all exit 0; `/auth/confirm` present as static route.
- Route sweep: `/login`,`/register`,`/auth/confirm`, `/auth/confirm?error=…`, `/auth/confirm?code=bogus` → 200; anon `/dashboard`,`/settings`,`/inbox` → 307 `/login?next=`; authed `/login`,`/register` → 307 `/dashboard`.
- Auth API (real Supabase): confirmed probe password grant OK; wrong password → `400 invalid_credentials`; admin-created unconfirmed user → `400 email_not_confirmed` (maps to resend UI); after `email_confirm=true`, same user login OK; signup email hit host rate limit (`over_email_send_rate_limit`) during testing — documented, not a code bug.
- Authed HTTP: dashboard/settings/automations/posts/analytics/social-accounts → 200; HTML scan no `sb_secret_` / service-role / PAT values; `.next` bundle secret scan CLEAN.
- Confirm page SSR: working state copy present; verified/already/expired copy lives in client bundle (resolved after Auth callback — by design).

### Required Supabase dashboard configuration (manual)

Hosted project Auth URL configuration (cannot be changed from this repo):

1. **Authentication → URL Configuration → Site URL**
   - Dev: `http://localhost:3000/auth/confirm` (or `http://localhost:3000` — bridge still forwards)
   - Prod: `https://<production-origin>/auth/confirm`
2. **Additional redirect URLs**: add `http://localhost:3000/auth/confirm` and
   `https://<production-origin>/auth/confirm` (and `/` if not already listed).
3. Confirm email templates still use default ConfirmationURL (Site URL based).
4. Local CLI `supabase/config.toml` has `site_url = http://127.0.0.1:3000` —
   only affects local stack, not the hosted project used by the app.

Code does not hard-code a dev URL into production behavior; origin comes from
where the browser already is (`AuthResultBridge` / relative `/auth/confirm`).

### Known limitations

- Full click-through of a real inbox confirmation email not automated
  (host rate limits + no headless browser in this environment); callback
  route, token processing paths, and Auth-side confirm→login sequence were
  tested as documented above.
- Resend may return 429 if Supabase email rate limit is hit — UI shows a
  safe failure message.
- No password-recovery flow (unchanged from Task 013 — still no fake link).

## Task 016 - Meta Webhooks

Status: COMPLETE

Completed:

- **Migration `20260923190000_webhook_events.sql` APPLIED**
  (`supabase db push`): `comments` (workspace-scoped,
  `unique (workspace_id, ig_comment_id)` for idempotency, nullable
  `post_id` + `ig_media_id`, matched/automation fields for 017),
  `deliveries` (ready for 017–018 engine rows), `posts.ig_media_id`
  (nullable until content import), member SELECT-only RLS on both
  tables (service_role writes bypass RLS from API env only).
- **`apps/api/src/webhooks.ts`** — `GET /webhooks/instagram`
  (hub.challenge handshake vs `META_WEBHOOK_VERIFY_TOKEN`; missing
  token → 503, wrong token → 403); `POST /webhooks/instagram`
  (HMAC-SHA256 `X-Hub-Signature-256` over raw body vs
  `META_APP_SECRET` with `timingSafeEqual`; missing secret/service
  key → 503; invalid/missing sig → 403; unknown ig_user_id → 200
  ack + warn — Meta must stop retrying; comment → workspace via
  `social_accounts.ig_user_id` → optional post join via
  `posts.ig_media_id` → idempotent insert
  (`on_conflict=workspace_id,ig_comment_id` +
  `resolution=ignore-duplicates`); 200 only after durable accept,
  502 on persist failure so Meta retries; structured logs for
  inserted/duplicate/unknown/failed).
- **`apps/api/src/supabase.ts`** — `restService()` +
  `serviceEnabled()` (service-role PostgREST for webhook path only;
  key from process env, absent key → explicit 503, never anon
  fallback). Product routes remain end-user JWT + RLS.
- **`apps/api/src/app.ts`** — `/webhooks/*` exempted from cookie
  auth preHandler (Meta servers send no session); raw-body
  content-type parser (keeps string for HMAC + JSON.parse; strips
  UTF-8 BOM); `registerWebhookRoutes(app)`;
  `/comments/recent` + `/deliveries/recent` now real RLS-scoped
  table reads mapped to `CommentEvent` / `MessageDelivery` shapes
  (were honest `[]` stubs).
- **`apps/api/src/meta.ts`** — best-effort
  `subscribeWebhookTopics()` after successful OAuth upsert
  (Graph `/v22.0/{app-id}/subscriptions` comments+messages; fails
  open with warn if app/env missing — dashboard subscribe remains
  the operator fallback).
- **`.env.example` / README** — `META_WEBHOOK_VERIFY_TOKEN` active
  (API env); `SUPABASE_SERVICE_ROLE_KEY` documented as API-env-only,
  never apps/web, never commit.

Validation:

- `npm run typecheck`, `npm run lint`, `npm run build:api`,
  `npm run build` — all exit 0.
- Migration: `npx supabase db push` → Finished, lists exactly
  `20260923190000_webhook_events.sql`.
- Handshake: good token → **200** body `12345abc` (challenge echo);
  bad token → **403**; works with **no cookie**.
- Signed POST: valid HMAC → **200** `{"ok":true}` + log
  `outcome:inserted` + DB row `ig_comment_id` count **1**;
  duplicate re-POST → **200** `duplicate` (count still **1**);
  bad signature → **403**; missing signature → **403**;
  unknown ig_user_id → **200** + `level:40` warn (no phantom
  workspace, no comment row).
- Member reads: `/comments/recent` → **200** with probe shape
  (`username=follower_probe`, `matched=false`, `postId=""` until
  posts import, `automationName=null`); `/deliveries/recent` →
  **200** `[]`; anon → **401**; social GET → **200** without
  `access_token`/`ig_user_id` (seeded `DUMMY_TOKEN_NOT_LEAKED`
  absent from response).
- Web: inbox page shows probe comment (Activity list has
  `follower_probe`); social-accounts has Connect + Disconnect,
  gated Task 015 copy absent; dashboard no service-key/token leak;
  **13** routes **200** with cookie; no-cookie + bogus cookie →
  `/login?next=…`.
- Logs: API `level:50`/`level:60` = **0**; web error-ish = **0**.
- Secret **values** (service key, app secret, PAT) scan clean across
  tracked sources + `.env*` + `.next` — only documentation mentions
  of the string `sb_secret_` remain (expected).

Deferred honestly:

- No live Meta app in this environment → real Meta → webhook traffic
  unproven; handshake/signature code ships against env vars
  (`META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, service key in
  API process env only).
- Messages/messaging_postbacks not persisted yet (comments only);
  add when 018+ needs inbound message rows.
- Posts import still absent → webhook comments may have empty
  `postId`/`postCaption` until content sync lands.

---

## Task 015 - Meta OAuth

Status: COMPLETE

Completed:

- **Migration `20260923180000_social_account_oauth_writes.sql`
  APPLIED** (`supabase db push`): `social_accounts.access_token` +
  `ig_user_id` + `token_expires_at` (token is API-only — never
  selected into web responses) + membership INSERT/UPDATE/DELETE
  policies (the foundation migration's deferred write policies for
  this table).
- **`apps/api/src/meta.ts`** — Instagram API with Instagram Login
  OAuth code flow: `GET /social-accounts/instagram/connect` (302 to
  `instagram.com/oauth/authorize` with HMAC-bound `state`;
  unconfigured → web `?oauth=not_configured`, not a JSON 500),
  `GET …/callback` (inline auth so expired session mid-redirect →
  login URL; verify state vs session user; exchange code →
  `api.instagram.com/oauth/access_token` → profile via
  `graph.instagram.com/me`; upsert connection; redirect
  `?oauth=connected|denied|invalid_state|failed`),
  `DELETE /social-accounts/instagram` (RLS-scoped remove + token).
  Callback exempted from the blanket preHandler (auth handled inline).
  App id/secret + redirect URI from API env only.
- **`app.ts`** — `registerMetaRoutes(app)`; social GET selects
  explicit columns (**no** `access_token`/`ig_user_id` in responses).
- **Web seam** — `social-accounts.ts` gained `instagramConnectHref()`
  (absolute API URL for full-page OAuth nav — cookies are host-scoped)
  + `disconnectInstagram()` DELETE; `actions.tsx` islands:
  `ConnectInstagram` (plain `<a>`), `DisconnectInstagram` (DELETE →
  `smmomo:connection-changed` event + `router.refresh()`).
- **Settings social-accounts page** — OAuth `?oauth=` notices
  (connected/denied/invalid_state/failed/not_configured), live Connect
  (reconnect copy when a row exists), Disconnect island with pending
  + `role="alert"` error; Task 010's disabled "Meta OAuth arrives"
  copy **removed**.
- **Topbar pill** — no longer hardcoded "Instagram connected";
  fetches `getInstagramAccount()` and renders only when
  `status === "connected"`; re-fetches on
  `smmomo:connection-changed`.
- **`.env.example`** — Meta section documents Task 015 vars
  (`META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`) as API-env
  only; webhook token still reserved for 016. README env table
  statuses updated.

Validation:

- `npm run typecheck` (api+web), `npm run lint`, `npm run build`,
  `npm run build:api` — all exit 0 (final re-run after the 204-body
  fix in `rest()`).
- Migration: `npx supabase db push` → "Finished supabase db push"
  listing exactly `20260923180000_social_account_oauth_writes.sql`.
- API (no META creds in env — honest path): cookie `GET /connect` →
  **302** `…/settings/social-accounts?oauth=not_configured`; anon
  `/connect` → **401**; callback (no code / forged state) → 302
  `not_configured` (config gate first); `DELETE` (no row) → **200
  `{"ok":true}`** (PostgREST 204 handled); anon DELETE/GET → 401;
  GET instagram → 404 when unconnected.
- **RLS write proof**: seeded a row as the user via PostgREST
  (member INSERT policy) with `access_token=SECRET_SHOULD_NOT_LEAK`;
  API GET returned the mapped shape **without** the token
  (`leaks SECRET: False`); API DELETE removed it; final REST count
  `[]`. (UI Disconnect path is the same DELETE + event.)
- Web with cookie: Connect `<a href="http://localhost:4000/social-
  accounts/instagram/connect">` present; notices render
  (`connected` / `not_configured` / `invalid_state`); old gated copy
  absent; settings hub still honest (`No Instagram account
  connected.`); no Disconnect section while unconnected.
- Status sweep with cookie: 9 protected routes **200**;
  `/login`,`/register` → 307 `/dashboard`; landing 200. No-cookie:
  `/dashboard` + `/settings/social-accounts` → 307 `/login?next=…`;
  login/register/landing 200.
- Logs: 0 recent web `⨯`/API-request-failed; API level 40/50 = 0.
- Secret scan: 0 `sb_secret_…` patterns; META secret only via
  `process.env`; `.env*` still gitignored; git status clean of env
  files.
- No browser automation and **no live Meta app credentials in this
  environment** — the authorize URL / token exchange / profile fetch
  are implemented against the documented endpoints but not E2E'd
  against Instagram; unconfigured + state + RLS paths fully HTTP-
  tested. Servers stopped (3000/4000 free) after validation.

Files:

- supabase/migrations/20260923180000_social_account_oauth_writes.sql (new, applied)
- apps/api/src/meta.ts (new — OAuth connect/callback/disconnect + state HMAC)
- apps/api/src/app.ts (registerMetaRoutes, callback preHandler skip, explicit social selects)
- apps/api/src/supabase.ts (rest(): handle 204/empty bodies)
- apps/web/lib/api/social-accounts.ts (connect href + disconnectInstagram)
- apps/web/app/(dashboard)/settings/social-accounts/page.tsx (notices + live CTAs)
- apps/web/app/(dashboard)/settings/social-accounts/actions.tsx (new islands)
- apps/web/components/layout/topbar.tsx (real connection pill)
- .env.example, README.md (Meta env docs)
- TASK.md, Tree.md (this record)

Notes:

- Operator setup for a live connect: create an **Instagram API with
  Instagram Login** app, set `META_APP_ID`/`META_APP_SECRET`/
  `META_REDIRECT_URI` on **apps/api only**, add the redirect URI to
  the app's Valid OAuth Redirect URIs. Without those env vars the UI
  honestly reports `not_configured` — never simulated success.
- One IG professional account per workspace (upsert replaces).
  Long-lived token stored ~60d expiry — refresh/rotation belongs to
  016+.
- `state` = HMAC(user.id+expiry) with the app secret — callback
  re-verifies against the session cookie (CSRF binding).
- Posts import / comment+message webhooks remain 016+ (empty posts
  list after connect is expected until then).

---

## Task 014 - API Integration

Status: COMPLETE

Completed:

- **End-user JWT auth for every product API route** — `apps/api/src/
  supabase.ts` parses the `sb-<ref>-auth-token` cookie (chunked +
  `base64-` base64url JSON, same format as `@supabase/ssr`), verifies
  the access token via `GET /auth/v1/user`, then talks to PostgREST
  **as that user** (RLS is the isolation boundary — no `service_role`
  / `sb_secret` anywhere in source; env falls back to public URL +
  publishable key). Fastify preHandler: `requireUser` → 401 "Sign in
  required", then `ensureWorkspace()` RPC → `req.workspaceId` (500
  "Workspace setup failed" on RPC failure). `/health` skips auth.
- **Workspace bootstrap migration** — `20260923170000_bootstrap_and_
  automation_writes.sql` APPLIED via `supabase db push` (PAT session
  env var only): `bootstrap_workspace()` SECURITY DEFINER RPC
  (idempotent create-or-get workspace + owner membership for
  `auth.uid()`, execute granted to `authenticated` only) + member
  INSERT/UPDATE policies on `automations` (the foundation migration's
  deferred write policies). Verified live: exactly 1 workspace + 1
  owner membership after multiple authenticated requests (idempotent).
- **Product routes** in `app.ts` matching the `lib/api` seam +
  `types/index.ts` shapes: `GET /posts`, `/posts/:id` (404),
  `/automations` (with `post:posts(caption)` embed, newest first),
  `/automations/:id`, `POST /automations` (validates fields, FK miss →
  400 "Unknown post", creates **draft**), `PATCH /automations/:id`
  (partial; status whitelist → 400; 0 rows → 404; empty patch → 400),
  `GET /social-accounts`, `/social-accounts/instagram` (404 when
  none), `/analytics/summary` (lifetime sums from automations,
  `daily: []`, `publicReplies: 0`), `/usage/summary` (`period: "All
  time"`, lifetime sums — counters are lifetime), `/comments/recent` +
  `/deliveries/recent` → `[]` (tables arrive 016–019 — honest empty,
  never fake rows). Row→camelCase mappers for all shapes.
- **CORS credentials** — `credentials: true` with concrete origin
  (never `*`); preflight verified `access-control-allow-origin:
  http://localhost:3000` + `access-control-allow-credentials: true`.
- **Seam flip** — `USE_MOCK = false` in `lib/api/client.ts` (the
  point of this task); `request()` gained `RequestOptions`
  (`method`/`body`, JSON headers when body present) and **404 →
  `undefined as T`** so get-by-id keeps its `| undefined` contract;
  **server-side cookie forwarding** (dynamic `import("next/headers")`
  → forward `cookie` header) so Server Component fetches authenticate
  — without it every dashboard page 500'd on API 401 (found in
  validation, fixed at the one shared call site).
- **`posts.ts` dual path resolved** — dormant Supabase-direct branch
  deleted; plain API seam like every other module.
- **Writes through the seam** — `automations.ts` gained
  `AutomationInput`, `createAutomation`, `updateAutomation` (mock
  resolvers throw `mockWrite()`); builder wired to real submit
  (name derived from keyword — no Name field; creates as draft;
  `router.push` + `refresh`; error `role="alert"`; button
  `Saving…`); detail page Pause/Activate replaced disabled stub with
  `status-toggle.tsx` island (PATCH status + `router.refresh()`).
- **`(dashboard)/layout.tsx` force-dynamic** — session-scoped segment
  must not prerender at build (a build-time fetch has no cookie →
  401); one segment config covers every dashboard page.

Validation:

- `npm run typecheck` (api+web), `npm run lint`, `npm run build`
  (dashboard routes all `ƒ`, landing/login/register stay `○`),
  `npm run build:api` — all exit 0 (re-run after every edit).
- Migration: `npx supabase login/link/db push` → "Finished supabase
  db push" listing exactly `20260923170000_bootstrap_and_automation_
  writes.sql`.
- API anon `GET /posts` → **401**; forged/bogus cookie → 401;
  `GET /health` → 200 without auth.
- API with valid cookie (fresh password-grant session harness) —
  10/10: `/posts`,`/automations`,`/social-accounts`,`/comments/
  recent`,`/deliveries/recent` → `200 []`; `/social-accounts/
  instagram` → 404; `/analytics/summary` honest zeros + `daily: []`;
  `/usage/summary` `period: "All time"`; unknown automation/post
  uuids → 404.
- Bootstrap: REST as user shows **exactly one** workspace
  (`My Workspace`) + one `owner` membership after many requests
  (RPC idempotent).
- Write error paths: POST missing fields → 400 "postId, keyword, and
  privateReply are required"; POST unknown post uuid → 400 "Unknown
  post"; PATCH bad status → 400 "status must be active, paused, or
  draft"; PATCH unknown id → 404. (Happy-path POST needs a real post
  row — Task 015+ Meta content; not faked here.)
- CORS preflight OPTIONS → 204 with ACAO origin + ACAC true.
- Web cookie sweep — 12/12 protected routes **200** (unknown
  `/automations/<uuid>` → 404); `/login`,`/register` → 307
  `/dashboard`; landing 200. Content assertions **21/21** honest
  empties: dashboard `Instagram not connected` / `No recent
  comments` / `No automations yet` / `No delivery activity yet` /
  `All time` / `Sign out`; analytics chartUnavailable + 3 empty
  tables; inbox/posts/settings/social-accounts/usage/automations/
  builder strings (`All time · 0 DMs sent`, `No posts available`,
  `Save automation`, drafts hint); mock handle `bishal.grows` absent
  from live pages; account page still real probe email + Save.
- No-cookie regression: all 6 protected prefixes → 307
  `/login?next=%2F…`; login/register 200; landing 200; bogus cookie
  → 307 login (proxy + API both reject).
- Logs: 0 new `API request failed` lines across a fresh 7-page hit
  (count stable at pre-fix total); API level 40/50 = 0; secret scan
  `sb_secret_[A-Za-z0-9]{10,}` in app sources = 0; gitignored
  `.env*` unchanged.
- No browser automation — write-button interaction claims are
  structural (form wiring + status-toggle island) + API-level.
  Servers stopped (3000/4000 free) after validation.

Files:

- supabase/migrations/20260923170000_bootstrap_and_automation_writes.sql (new, applied)
- apps/api/src/supabase.ts (new — cookie/JWT auth, PostgREST, bootstrap RPC)
- apps/api/src/app.ts (all product routes + auth preHandler + CORS credentials)
- apps/web/lib/api/client.ts (USE_MOCK=false, request options, 404→undefined, server cookie forward)
- apps/web/lib/api/posts.ts (plain seam — dual path removed)
- apps/web/lib/api/automations.ts (createAutomation, updateAutomation, AutomationInput)
- apps/web/app/(dashboard)/layout.tsx (force-dynamic)
- apps/web/app/(dashboard)/automations/new/builder.tsx (real submit)
- apps/web/app/(dashboard)/automations/[id]/page.tsx + status-toggle.tsx (new island)
- TASK.md, Tree.md (this record)

Notes:

- Design decisions to carry forward: end-user JWT only (never add a
  service key to the web app; API env-only if ever required);
  bootstrap is SECURITY DEFINER not weakened RLS; comments/deliveries
  tables honestly empty until 016–019; usage period is "All time"
  because counters are lifetime (a calendar period needs the usage
  tables); new automations start `draft` (Activate on detail page);
  builder derives `name` from keyword.
- Known gap: cannot E2E the happy-path POST from the UI until posts
  exist (needs Meta content → Task 015); error paths validated.
- Cookie harness (reuse): `sb-<ref>-auth-token=base64-<base64url(JSON
  session)>` from password grant; tokens ~1h — re-grant if expired.
- `comments`/`deliveries` tables + webhook/engine writes remain
  016–019; generated Supabase types still deferred (CLI token).

---

## Task 013 - Authentication

Status: COMPLETE

Completed:

- **Cookie sessions via `@supabase/ssr@0.12.7`** (the one new
  dependency; installed in `apps/web`) — `lib/supabase/client.ts`
  lazily returns `createBrowserClient` (publishable key only,
  env-checked factory); `lib/supabase/server.ts` is now async and
  returns `createServerClient` with `cookies()` getAll/setAll
  (setAll failures swallowed in Server Components — `proxy.ts`
  handles token rotation). Dormant `posts.ts` branch updated to
  `await getServerSupabase()`.
- **`apps/web/proxy.ts` (Next 16 middleware→proxy rename)** — named
  `proxy` export + `config.matcher` excluding `_next` static/image/
  favicon/images. Runs `supabase.auth.getUser()` (JWT verified with
  Auth — not a cookie-presence check). Unauthenticated + protected
  prefix (`/dashboard,/automations,/posts,/inbox,/analytics,/settings`,
  exact or nested) → `307 /login?next=<urlencoded>`; authenticated on
  `/login`/`/register` → `307 /dashboard`. Landing, auth pages, and
  assets stay public. Convention confirmed from
  `node_modules/next/dist/docs` per AGENTS.md warning.
- **Login page** — real `signInWithPassword`; inline `role="alert"`
  errors (raw Supabase message: invalid credentials, email not
  confirmed, etc.); pending button state; `?next` read from
  `window.location` at submit time (avoids useSearchParams/Suspense),
  sanitized by `safeNext` (same-origin path only, never auth pages —
  no redirect loop; fallback `/dashboard`). Dead "Forgot password?"
  text removed (no recovery flow exists — no fake affordance).
- **Register page** — real `signUp` with `options.data.name`; session
  returned (auto-confirm someday) → straight to `/dashboard`; hosted
  has Confirm email ON (`mailer_autoconfirm:false`, verified), so the
  default path shows an honest "Check your email" state + link to
  sign in — no fake dashboard push.
- **Topbar** — static "BA" avatar replaced with real initials (name
  from `user_metadata.name`, fallback email local part; browser
  `getUser` + `onAuthStateChange` subscription) and a **Sign out**
  button (`signOut()` → push `/login` + `router.refresh()`).
  Instagram connection pill unchanged (Task 015); its comment now
  points there.
- **Settings → Account** — split into server `page.tsx` (session
  `getUser`, `redirect("/login")` belt-and-suspenders, passes
  `email` + `initialName`) and colocated `account-form.tsx` island:
  Name editable, Email `readOnly`/`aria-readonly` with "Email changes
  aren't supported yet." hint, optional New+Confirm password
  (client min-length + match validation), one
  `updateUser({ data:{name}, password? })` call, success
  `role="status"` / error `role="alert"`, passwords cleared on
  success. **Save is enabled** — Task 010's "disabled until Task 013"
  hint removed as the spec required; no stale copy remains.
- **Env fix found during build**: Next loads `.env.local` from the
  workspace dir, not the monorepo root — copied root `.env.local` →
  `apps/web/.env.local` (both gitignored: root `.gitignore`
  `.env.local` + `apps/web/.gitignore` `.env*`; verified with
  `git check-ignore`). Root `.env.example` unchanged (documents the
  vars). Build log confirms `Environments: .env.local`.
- Data layer untouched: `USE_MOCK=true` still; no
  `workspace_members` seeding (explicitly 014's problem); no
  service/secret key anywhere in the web app.

Validation:

- `npm run typecheck` (api+web), `npm run lint`, `npm run build`
  (Next 16.3.6: `ƒ Proxy (Middleware)` registered, `/settings/account`
  now `ƒ` dynamic), `npm run build:api` — all exit 0; final re-run of
  typecheck+lint after all edits also green.
- No-cookie sweep (14 routes): `/`, `/login`, `/register` → 200; all
  11 protected paths (incl. nested/unknown ids like
  `/automations/abc`) → 307 `/login?next=%2F…` — 14/14 correct.
- With forged session cookie (test-user password grant → session JSON
  → `base64-`+base64url value in
  `sb-etwuqthopqrzffdgvhqs-auth-token`; format confirmed from
  `@supabase/ssr` source, default encoding `base64url`): 12 protected
  routes 200 (`/automations/abc` correctly 404 behind auth),
  `/login`+`/register` → 307 `/dashboard`, `/` stays 200 — redirects
  correct in both directions.
- Real Auth API: password grant for
  `task013-probe@smmomo-test.com` (confirmed user) → token + user;
  wrong password → `400 invalid_credentials` (the exact message the
  UI surfaces).
- Content assertions with cookie — 16/16: dashboard `DMs sent` +
  `Sign out` + mock identity intact; account page shows real probe
  email, `Save changes`, password block; settings hub/usage/posts/
  inbox/analytics/automations titles present; Save `<button>` has
  **no** `disabled` attribute (regex-checked, `disabled:` Tailwind
  classes not mistaken for the attr); email input `readOnly` +
  `aria-readonly` + real value; login/register SSR include their
  forms and no premature `role="alert"`.
- Assets: `favicon.ico` and a `/_next/static` chunk → 200 without a
  session (matcher exclusion works); landing 200 with and without
  cookie.
- Secret scan: no `sb_secret` in either `.env*` file (boolean
  `Select-String -Quiet`, values never printed); the two
  `sb_secret` matches under `.next/static` + `.next/server` are
  supabase-js library code (`e.startsWith("sb_secret_")` string
  checks), not key material; `git status` clean of env files.
- Regression: API `GET /health` 200 on :4000 alongside web dev on
  :3000 (coexistence holds); dev log 0 `⨯`/Error lines; `USE_MOCK`
  untouched; `lib/mock` untouched; 16 routes re-verified.
- No browser automation — sign-in/click paths are claims at the
  code + Auth-API level; redirect and HTML assertions are
  HTTP-level. Servers stopped (3000/4000 free) after validation.

Files:

- apps/web/proxy.ts (new)
- apps/web/lib/supabase/client.ts, server.ts (@supabase/ssr rewrite)
- apps/web/lib/api/posts.ts (await async server client)
- apps/web/app/(auth)/login/page.tsx, register/page.tsx
- apps/web/components/layout/topbar.tsx (real initials + Sign out)
- apps/web/app/(dashboard)/settings/account/page.tsx (server page) +
  account-form.tsx (new client island)
- apps/web/package.json + package-lock.json (@supabase/ssr@0.12.7)
- local-only, gitignored: apps/web/.env.local (copy of root)

Notes:

- Hosted `mailer_confirm` stays false→email confirmation required
  (flipped true only transiently during test-user provisioning, then
  restored — re-verify it if signup misbehaves). Test user for future
  E2E: `task013-probe@smmomo-test.com` / `Task013-Probe-Pw!2026`
  (test-only project; never reuse this pattern for real secrets).
- No password-recovery UI (no fake link); Instagram pill still static
  (015); name/password updates touch only Auth user data — no app
  tables (014+).
- Cookie harness for later tasks:
  `sb-<ref>-auth-token=base64-<base64url(JSON session)>` (session =
  token response + `expires_at` epoch seconds).

## Task 012 - Database

Status: COMPLETE

Completed:

- **Foundation migration applied to the remote project** —
  `20260923120000_smmomo_foundation.sql` pushed via Supabase CLI
  (v2.117.0): `login --token` (user-provided personal access token —
  session/CLI-creds only, never written to any repo file) →
  `link --project-ref etwuqthopqrzffdgvhqs` → `db push` exit 0,
  "Finished supabase db push" listing exactly that one migration.
- **`migration list`**: `local: 20260923120000 == remote: 20260923120000`
  (recorded `2026-09-23 12:00:00`) — schema versioning in sync.
- **REST verification (publishable key, anon role)** — all 5 tables
  (`workspaces`, `workspace_members`, `social_accounts`, `posts`,
  `automations`) flipped from pre-apply `PGRST205` to **HTTP 200 `[]`**:
  tables exist, PostgREST schema cache refreshed, RLS returns zero rows
  for unauthenticated requests.
- **RLS behavioral proofs**: anon `INSERT` into `workspaces` → **401
  denied** (RLS enabled + no insert policies — tables left empty,
  probe created no rows); `POST /rpc/is_workspace_member` as anon →
  **401** (the `revoke … from public, anon` on the SECURITY DEFINER
  helper works — anon cannot even evaluate membership).
- **Migration file unchanged** — pushed exactly as authored in Task 007
  (5 tables, membership-scoped SELECT-only policies, no `using (true)`,
  no `CREATE EXTENSION` needed — `gen_random_uuid()` is available by
  default). No new migrations, no seed data, no extra objects.
- **Credential hygiene**: personal access token used only as a
  session-scoped env var + stored by the CLI in `~/.supabase` (outside
  the repo); git status clean of secrets (`supabase/.temp` ignored);
  the user's pasted `sb_secret_` key was **not** committed or stored —
  Management API correctly rejected it (401) as the wrong token type,
  and Supabase flagged its use (recommendation issued: regenerate).
- **Docs updated**: Tree.md migration line now "applied … 5 tables +
  membership RLS live"; this file's audit note marked superseded; header
  points at Task 013.

What it does:

The database foundation is live: hosted Postgres now has the multi-tenant
schema (workspaces → members/social_accounts/posts/automations) with RLS
on every table and membership-scoped reads only — anonymous clients see
zero rows and cannot execute the membership helper or insert anything.
The path from empty-project audit (Task 007) to applied-and-verified
schema is closed; Tasks 013/014 build auth context and API reads on top
without schema changes.

Files (key):

- supabase/migrations/20260923120000_smmomo_foundation.sql (applied
  unchanged — no content edits)
- TASK.md, Tree.md (documentation: applied status, audit superseded)

API/mock changes:

- None in code. Remote schema state changed (that IS the task); web
  `USE_MOCK=true` seam untouched; no new env vars committed.

Error & loading handling:

- N/A (schema operation). CLI push is transactional — a partial apply
  was impossible; exit 0 + migration-list match confirm full success.

Validation:

- `npx supabase db push` — exit 0, migration listed.
- `npx supabase migration list` — local == remote.
- REST: 5× table probes 200 `[]`; anon INSERT 401; anon RPC 401;
  tables re-checked empty after probes (0 failures total).
- Pre-apply baseline captured: all 5 probes were PGRST205 (schema
  genuinely empty before this task).
- `npm run typecheck` + `npm run lint` — passed (docs-only task; gate
  run anyway). No web/API code changed (git diff: TASK.md, Tree.md only).

Known limitations:

- Schema is SELECT-only by design: even signed-in members cannot read
  rows until membership exists, and nobody can write until Task 014 adds
  API/service write paths — RLS blocks anon by design, verified.
- No `workspace_members` seed row yet — first real user gets zero visible
  data until Task 014 provisions a workspace (documented there, not
  papered over with permissive policies).
- `comments`/`deliveries` tables still don't exist (deferred to the
  automation-engine tasks 016–018, per the Task 008 audit decision).
- Local dev stack (`supabase start`) was not used — hosted project is
  the single source of truth for this repo stage.
- The PAT used for this push lives in CLI session creds; rotating it
  later does not affect the applied schema.

Deferred backend functionality:

- Workspace/membership provisioning for real users, API read/write
  integration over these tables (Task 014), auth context in policies
  (already membership-based — needs sessions from Task 013), comments/
  deliveries tables (016–018), write policies/service-role paths.

Next:

Task 013 - Authentication

## Task 011 - Backend Foundation

Status: COMPLETE

Completed:

- **`apps/api` workspace created** (new — the repo's first backend
  package): `package.json` (name `api`, scripts dev/build/start/typecheck),
  `tsconfig.json` (strict, CommonJS, `tsc` → `dist/`, `types: ["node"]`),
  `src/app.ts` (`buildApp()`), `src/server.ts` (listen). npm workspaces
  (`apps/*`) picked it up; `npm install` added Fastify + @fastify/cors
  (runtime) and typescript + tsx + @types/node (dev) — 0 vulnerabilities,
  web lockfile deps untouched.
- **`buildApp()`** — Fastify with `logger: true` (bundled pino; no extra
  logging dep); `@fastify/cors` with `origin` = `process.env.CORS_ORIGIN
  ?? "http://localhost:3000"`; **one route: `GET /health`** returning
  `{status:"ok", service:"smmomo-api", version:"0.1.0", uptime, timestamp}`.
  No custom 404/error handlers — Fastify's built-in JSON shape
  (`{message, error, statusCode}`) is the sane default; stack only ever
  leaves the process when `NODE_ENV !== "production"` (Fastify default).
- **`server.ts`** — `PORT` env (default 4000, matching
  `NEXT_PUBLIC_API_URL` docs), promise-chain boot with `process.exit(1)`
  on failure (CommonJS — no top-level await).
- **Root `package.json` scripts**: added `dev:api`, `build:api`;
  `typecheck` now runs `npm run typecheck --workspaces --if-present`
  (web + api in one command; web's own script unchanged).
- **`.gitignore`**: added `dist/` (API `tsc` output).
- **`.env.example`**: backend section now documents `PORT` /
  `CORS_ORIGIN` (commented defaults that already match code defaults);
  `NEXT_PUBLIC_API_URL` no longer labeled "backend not implemented".
- **README**: layout tree shows `apps/api`; scripts table (dev:api,
  build:api, cross-workspace typecheck); env table gains PORT +
  CORS_ORIGIN (NEXT_PUBLIC_API_URL → Active); tech-stack backend row
  no longer "(Planned)"; roadmap Phase 1 ✅ / Phase 2 🟡; owner phase
  line updated.
- **No product endpoints** — `/posts`, `/automations`, `/analytics` all
  honest 404s (stub data would be fake functionality; routes = Task 014).
- **Web untouched**: `USE_MOCK=true` seam, all UI, all mocks — zero web
  source changes (git diff: only new `apps/api/**`, root config, docs).

What it does:

Phase 2 now has a running backend: `npm run dev:api` boots Fastify on
:4000, `GET /health` answers with structured JSON, unknown routes 404 in
Fastify's standard error shape, and CORS admits exactly the web dev
origin (foreign origins never honored — browser-enforced mismatch). The
web app keeps running fully on mocks; when Task 014 flips `USE_MOCK`,
`NEXT_PUBLIC_API_URL` already points at this server. Structure is the
plug-in point for Task 012 (DB) / 014 (routes).

Files (key):

- apps/api/package.json, apps/api/tsconfig.json (new workspace)
- apps/api/src/app.ts, apps/api/src/server.ts (service)
- package.json (root scripts), .gitignore, .env.example
- README.md, Tree.md, TASK.md (documentation)

API/mock changes:

- None in the web app. The new API serves only `/health` — no product
  routes, no DB/Redis/auth wiring (Tasks 012–014/018), no changes to
  `apps/web/lib/api/client.ts` (its `API_BASE` contract preserved).

Error & loading handling:

- Listen/boot failures log + `process.exit(1)`; request errors/404s use
  Fastify defaults (structured JSON; no stack in production). No custom
  error middleware added — YAGNI until a route needs it.

Validation:

- `npm run typecheck` — passed (api + web workspaces in one run).
- `npm run lint` — passed (web; API has no lint config yet — same
  eslint-config-next would not fit Node code; lint for api deferred to
  Task 021 testing task).
- `npm run build` — passed (web, 15 routes unchanged).
- `npm run build:api` — passed (`tsc` emitted `dist/app.js`, `dist/server.js`).
- API runtime (built `node dist/server.js`): `GET /health` → 200 with all
  5 fields (`status/service/version/uptime/timestamp`); `GET /nope` →
  404 `{"message":"Route GET:/nope not found","error":"Not Found","statusCode":404}`;
  `/posts` `/automations` `/analytics` `/healthz` → 404 (no stubs);
  `POST /health` → 404 (route is GET-only); CORS: `Origin:
  http://localhost:3000` reflected, `Origin: http://evil.example` never
  honored (ACAO stays the configured origin — browser blocks mismatch).
- `npm run dev:api` (tsx watch) — boots and serves `/health` (esbuild
  postinstall warning was benign; tsx verified working).
- Web + API coexistence: both servers up — `/settings`, `/settings/usage`,
  `/dashboard`, `/analytics` 200 on :3000 while `/health` healthy on :4000.
- Dev logs (web + api): zero runtime errors. Both servers stopped after
  (3000 + 4000 free).
- Two initial API-check "FAILs" were assertion bugs (PowerShell error
  stream already consumed for the 404 body; string-origin CORS config
  always emits its configured value — security property is "foreign
  origin never honored", which holds). Corrected assertions PASS; zero
  code bugs found.

Known limitations:

- No product routes, no DB connection, no auth, no queue — explicitly
  Task 012+ scope; health check is the only endpoint.
- `logger: true` logs every request at info level — fine for dev; log
  level/redaction tuning belongs to Task 020/022 hardening.
- CORS origin is a single value (string config) — sufficient for one web
  origin; multi-origin needs (production domain) arrive with Task 022.
- API has no ESLint config (root `lint` still web-only) — deliberate;
  Node-oriented lint setup belongs with Task 021's test/tooling pass.
- API `version` constant duplicates `package.json` "version" (noted in
  source) — reading package.json at runtime would add file-path coupling
  for two strings that change once per release.
- `.env.example` PORT/CORS_ORIGIN are commented because defaults already
  match; no dotenv loader wired (shell/`--env-file` can set them later).

Deferred backend functionality:

- Product routes + real data (Task 014), DB access (Task 012/014),
  authentication middleware (Task 013), Meta OAuth/webhooks (015–016),
  BullMQ worker (017–018), usage tracking (019), hardening (020).

Next:

Task 012 - Database

## Task 010 - Settings

Status: COMPLETE

Completed:

- All four Settings surfaces deepened in place from their Task 002/003
  first-pass state (4 files changed, +198/−64; no files created/removed;
  no shared components modified; no new dependencies).
- **`/settings` hub** — now an async server page loading
  `getInstagramAccount()` + `getUsageSummary()` via `Promise.all`
  (established loader pattern), so each row carries a live summary:
  Account keeps static copy, Social accounts shows `@username ·
  Connected|Needs attention` (text state, not color-only), Usage shows
  `{period} · {dmsSent} DMs sent`. Usage row icon switched from the
  placeholder arrow to `IconAnalytics`; link-card layout/tokens unchanged.
- **`/settings/account`** — keeps `"use client"` island + `preventDefault`
  form; added the password block the hub already promised (Current /
  New password, `autoComplete` current/new-password, `CardTitle` h2
  subsection behind a `border-border-muted` divider); `autoComplete` added
  to name/email; single visible hint under Save: "Save stays disabled
  until authentication lands (Task 013) — no fake persistence yet."
  **Save stays unconditionally disabled — no fake persistence.**
- **`/settings/social-accounts`** — honest three-state rendering of the
  `SocialAccount | undefined` mock: connected (default: icon block,
  `@username`, `{followers} followers · connected Aug 14, 2026` full
  date via `toLocaleDateString("en-US", {dateStyle-shorthand})`, success
  Badge "Connected"); `status === "error"` → `border-danger` card +
  "Needs attention — reconnect once Instagram login ships (Task 015)" +
  failed Badge (text + color); `undefined` → muted icon, "Not connected",
  explanatory line. Added a **Disconnect** action row (only when an
  account exists) mirroring the existing dashed Connect row — both
  buttons `disabled` with explicit Task 015 copy (**no fake OAuth flow**).
- **`/settings/usage`** — stayed strictly within the `UsageSummary`
  contract (period/dmsSent/commentsProcessed/publicReplies/
  failedDeliveries): `This period` CardTitle + neutral period Badge;
  each row gained an honest one-line descriptor (what the counter
  means); failed > 0 stays `text-danger` (number always present — never
  color-alone); zero-guard → "No usage recorded this period yet.";
  contextual cross-link "Failed deliveries are broken down in Analytics"
  → `/analytics` only when `failedDeliveries > 0`; footer billing note
  kept ("Usage feeds future billing. No payment integration in V1.").
  Row labels keep Dashboard-strip terminology exactly (DMs sent /
  comments processed / public replies / failed deliveries).
- Accessibility: every field has `Label htmlFor`; sections use
  h1 (PageHeader) / h2 (CardTitle); status conveyed as text
  ("Connected"/"Needs attention") alongside badge color; disabled
  buttons carry visible text reasons.
- No unrelated routes touched — regression sweep PASS (Dashboard, Inbox,
  Analytics, Automations incl. auto_1/missing/edit flows, Posts,
  Login/Register, Landing).

What it does:

Settings now reads as a finished V1 section: the hub previews live state
from the same `lib/api` seam every other page uses, account exposes the
full profile+password shape behind an honest auth gate, social accounts
shows exactly what the connection state is (including the error branch)
with honestly-disabled Connect/Disconnect, and usage explains its own
numbers without inventing quotas or percentages. Architecture unchanged
(UI → lib/api → mock); zero new dependencies; mock-only.

Files (key):

- apps/web/app/(dashboard)/settings/page.tsx (async hub + live summaries)
- apps/web/app/(dashboard)/settings/account/page.tsx (password block + hints)
- apps/web/app/(dashboard)/settings/social-accounts/page.tsx (3-state card + Disconnect row)
- apps/web/app/(dashboard)/settings/usage/page.tsx (period badge, descriptors, zero-guard, Analytics link)
- TASK.md, Tree.md (documentation)

API/mock changes:

- None. Consumed existing `getInstagramAccount()` + `getUsageSummary()` —
  no new endpoints, types, fields, or mock objects; no `lib/mock`
  imports in pages (grep-verified); mock data unmodified.

Error & loading handling:

- No try/catch (convention — failures throw to Next's error page); no
  `loading.tsx` (mocks resolve instantly); async `Promise.all` on the hub
  drops into a real API without UI changes.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (Next 16.3.6; all 4 settings routes static ○).
- Dev-server route sweep — 17/17 statuses (incl. `automations/missing`
  404, `?edit=nope` 404).
- `/settings` HTML assertions: period·DMs summary (`September 2026 · 611
  DMs sent`), `bishal.grows · Connected`, hub copy, `Settings` h1.
- `/settings/account`: Current/New password labels, 2× `type="password"`,
  `autoComplete="current-password"`, `<label for="name">`, Save-hint
  text, 1 disabled button.
- `/settings/social-accounts`: `@bishal.grows`, `12,480 followers ·
  connected Aug 14, 2026`, `Disconnect bishal.grows` (node-aware
  `Disconnect <!-- -->bishal.grows`), Task 015 Connect copy, success
  Badge, 2 disabled buttons; **negative**: `border-danger` and
  "Needs attention — reconnect" absent (mock is connected).
- `/settings/usage`: `This period`, period Badge, `1,842`, all 4
  descriptors, Analytics cross-link + `href="/analytics"`, billing note,
  `text-danger` (failed=8>0).
- Regressions (all PASS): Dashboard (`Needs attention`, node-aware
  `Usage · <!-- -->September 2026`, Details→`/settings/usage` link,
  12,480 followers), Inbox (Ignored/Private DM/Public reply), Analytics
  (Last 7 days, Failed deliveries, 32 `bg-indigo` bar matches), Automation
  list+detail (Checklist DM, search placeholder), edit prefill (CHECK),
  Posts copy, Login/Register Password. Dev log: zero runtime errors.
- Dependencies: `git diff --stat` shows only the 4 settings files — no
  package.json/lockfile changes.
- 3 initial assertion "FAILs" were test bugs (React `<!-- -->` text-node
  separators ×2, and `bg-primary` vs the documented `bg-indigo-*` chart
  exception) — corrected assertions all PASS; zero code bugs found.

Known limitations:

- Account form values are placeholder literals (no user/profile API
  exists until Task 013/014) — clearly gated by the Save hint; no
  client-side validation added because Save is unconditionally disabled
  (validation UX would imply a working save).
- Password fields are typeable but unsavable — same honest gate as
  name/email; no strength meter/match checks (would imply flow).
- Disconnect row only renders when an account exists; both Connect and
  Disconnect are inert until Meta OAuth (Task 015).
- Usage descriptors/hints are explanatory copy only — no quotas,
  percentages, or limits beyond the model (per spec).
- Date formatting uses server default locale conventions
  (`toLocaleDateString("en-US", …)` explicit for the connected date);
  no i18n layer (out of scope).
- Interactions (hover/focus/disabled visuals) are structural/code-level
  only — no browser automation in this environment.

Deferred backend functionality:

- Real profile save + password change (Task 013 auth + Task 014 API),
  Meta OAuth connect/disconnect (Task 015), billing/plan/limits UI
  (needs real quotas — post-V1), usage export.

Next:

Task 011 - Backend Foundation

## Task 009 - Analytics

Status: COMPLETE

Completed:

- `/analytics` rewritten from the Task 002/003 first-pass (4 KPIs + bare
  7-day bar chart) into a full performance surface: server page loads
  `getAnalyticsSummary()` + `listAutomations()` + `listPosts()` +
  `listRecentComments()` + `listRecentDeliveries()` in one `Promise.all`
  (all through `lib/api` — no mock/fetch/Supabase imports in the page,
  grep-verified), renders `PageHeader` ("Analytics" / spec copy), then:
- **KPI row (4)** — same metrics, wording, and styling as Dashboard for
  cross-page consistency: Comments matched (emphasis card), DMs sent,
  Failed deliveries (danger + "Needs attention" only when > 0), Active
  automations `2 / 4`. All values come straight from the
  `AnalyticsSummary` contract — no invented metrics.
- **Daily activity card** — the existing CSS bar chart kept (no chart
  library; documented indigo data-viz raw values), now with: `Last 7
  days` Badge (period context — the only period supported: `daily[]`
  carries exactly 7 labeled days and **sums exactly** to the KPIs
  Σcomments=619=`commentsMatched`, Σdms=611=`dmsSent`), bars marked
  `aria-hidden` (hover `title`s kept), text legend with color swatches +
  labels, and a **generated textual summary** (equivalent accessible
  description per spec §14): range `68 (Wed)`–`112 (Thu)`, totals 619 /
  611 — all derived from `daily[]` at render time.
- **Automation performance table** (real `<table>`, `th scope="col"`,
  right-aligned tabular numerics): rows sorted by matched desc (readability
  only — no winner language, no grades, no scores); each row = name →
  detail `Link`, status Badge (same tone map as Automations list), keyword
  chip, then the model's own counters: `matchedCount` / `dmSentCount` /
  `failedCount` (failed in `text-danger` when > 0 — number always present,
  never color-alone). Empty state when 0 automations.
- **Content performance table** (real `<table>`): per-post rows via real
  `postId` joins — Comments = `post.commentsCount`, Matched/DMs sent =
  summed `matchedCount`/`dmSentCount` of automations linked by `postId`
  (e.g. post_4: 251 comments, 0 matched/0 DMs — draft automation, honest
  zeros). Post cell = type Badge + truncated caption. Empty state when 0
  posts.
- **Delivery breakdown card** (scoped "Recent records" — event layer, not
  the 611-scale summary, following Dashboard's aggregate-vs-recent
  precedent): hero **success rate `60%`** = delivered ÷ attempted where
  **attempted = sent + delivered + failed (queued explicitly excluded —
  never silently successful)** → 3 ÷ 5 with the 6 mock records; all four
  model statuses listed with Badge + count (Queued 1 / Sent 1 / Delivered 3
  / Failed 1 — "sent" kept distinct from "delivered" per spec §9);
  caption spells out both definitions and the record scope. **Zero-guard:
  0 records → "No delivery records yet"; all-queued → "No delivery
  attempts yet — N queued" — never NaN/Infinity/misleading 0%.**
- **Failed deliveries card** (scoped "Recent records"): one row per
  failed event record — Failed Badge, joined automation name
  (`automationName` via `commentId`, "Automation unknown" fallback),
  `<time dateTime>` absolute timestamp, the model's own user-facing
  `error` string ("Meta API: recipient cannot receive messages (24h
  window).") — **no stack traces, no invented errors** — plus comment
  context (`@username` — comment text · post caption). Compact neutral
  empty state ("No failed deliveries in recent activity.") when none.
- **No period filter / no search** (spec §5, §11): only 7 days of
  timestamps exist — filtering would claim history the data doesn't
  have; static "Last 7 days" Badge on the chart is the honest period
  context. No management-table behavior added.
- **Empty states everywhere** (compile-verified branches): no activity in
  7 days, no delivery records, no attempts, no automations, no posts, no
  failures — compact text-only, consistent with Dashboard/Inbox.
- **Math safety**: `successRate` null unless `attempted > 0`; `maxBar`
  floored at 1 (no div-by-zero in bar heights); every displayed
  percentage/count derived at render time from loaded arrays — zero
  hard-coded percentages, zero random numbers, zero fabricated chart
  points (chart uses only `daily[]`).
- **No future functionality** (spec §19): no realtime, no Meta Insights,
  no sync, no aggregation jobs, no exports, no scheduled/AI reports. No
  Supabase changes (spec §18). No shared components modified —
  Dashboard/Inbox/Builder/Posts untouched (regression-verified).

What it does:

`/analytics` now answers "how are my automations performing?" from four
angles — account KPIs (consistent with Dashboard), 7-day trend (chart +
text summary), per-automation and per-post breakdowns (model counters via
real joins), and delivery health (status split + mathematically-honest
success rate + failure forensics) — every number traceable to an existing
contract, with the aggregate layer and recent-event layer each explicitly
scoped. Pure server component; architecture unchanged
(UI → lib/api → mock); zero new dependencies.

Files (key):

- apps/web/app/(dashboard)/analytics/page.tsx (rewritten in place — the
  only code file changed)
- TASK.md, Tree.md (documentation)

API/mock changes:

- None. Consumed existing `getAnalyticsSummary()`, `listAutomations()`,
  `listPosts()`, `listRecentComments()`, `listRecentDeliveries()` — no new
  endpoints, types, fields, or mock objects; calculations that span
  multiple resources live in the page (Dashboard precedent); the API layer
  stays a pure data seam.

Error & loading handling:

- No try/catch (convention — failures throw to Next's error page); no
  `loading.tsx` (mocks resolve instantly); async `Promise.all` structure
  drops in a real API without UI changes.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (16 routes; `/analytics` remains static ○).
- Dev-server route sweep — 17/17 (incl. 404 cases unchanged).
- `/analytics` HTML assertions (all pass after correcting assertion
  false-negatives from React `<!-- -->` text-node separators and RSC
  payload double-counting): spec description; all 4 KPI labels + values
  (619 / 611 / 8 + "Needs attention" / `2 / 4`); emphasis card class;
  chart title + `Last 7 days` Badge; 7 day labels + 14 indigo bars; legend
  text; generated summary (`68 (Wed)`–`112 (Thu)`, totals 619/611);
  `aria-hidden` bars; table `th scope="col"` headers; 4 automation names +
  detail hrefs; counters (341/337/4, 184, 94/90, zeros); active/paused/
  draft badges; keyword chips; matched-desc sort order; delivery card +
  scope label; **60% rate (node-aware `60<!-- -->%`)** + `3 of 5 attempted
  delivered` + all 4 status badges + formula caption + `6 recent delivery
  records` scope; content table + captions + type badges + commentCounts
  (342/187/96/251) + matched column; failed card + model error string +
  `sana.studio` context + `Launch Link` join + `<time dateTime>`; no
  Export/CSV/Subscribe/Schedule controls; **zero `aria-pressed`** (no
  period filter); responsive grids (`sm:grid-cols-2`, `lg:grid-cols-4`,
  2× `lg:grid-cols-2`); no `NaN`/`Infinity`/`undefined` in output.
- Architecture greps: 0 `lib/mock` / `fetch(` / `supabase` references in
  the page; exactly 4 `lib/api` imports; all 6 empty-state branches +
  both zero-guards present in source.
- Regression (all PASS): Dashboard KPIs/usage/activity/deliveries
  (node-aware checks); Inbox two-panel + filters + detail sections;
  Builder Save disabled-invalid; Posts ×4 create-automation hrefs;
  Automations filters. Dev log: zero runtime errors.
- Responsive: structural verification only (classes in served HTML). No
  browser automation in this environment — no click-through claims.

Known limitations:

- The two mock layers have different scales by design: `AnalyticsSummary`
  aggregates (619/611/8) vs recent event records (6 comments / 6
  deliveries). Sections derived from each are explicitly scope-labeled
  ("Recent records"); Dashboard already established this pattern.
- Success rate (60%) reflects only the 6 recent records — not the
  611-scale summary (the summary contract has no queued/sent/delivered
  split, so a summary-level rate cannot be computed honestly).
- Per-automation "successful/delivered" counts omitted — the `Automation`
  model has only `dmSentCount`/`failedCount`, no delivered field.
- "Comments received" KPI omitted — `AnalyticsSummary` has no such field;
  `post.commentsCount` is a lifetime Instagram count (different period
  than the 7-day KPIs) and would be misleading in the KPI row. Shown per
  post in Content performance instead.
- "DMs delivered" KPI omitted — not in the summary contract; delivered
  count lives in the event-scoped Delivery breakdown.
- `publicReplies` (198) unused on this page — not in spec's KPI list;
  still surfaced on Dashboard usage strip + `/settings/usage`.
- Period filter, empty-state branches, and all interactions are
  compile-verified only (mocks populated; no browser tooling).
- Automation/content counters carry no explicit period field — presented
  without a period claim (only the `daily[]` chart claims "Last 7 days",
  which its 7 labeled points support).

Deferred backend functionality:

- Real analytics aggregation, Meta Insights API, realtime updates,
  historical periods beyond 7 days, exports, scheduled reports (future
  tasks; same `AnalyticsSummary` contract can back them).

Next:

Task 010 - Settings

## Task 008 - Inbox

Status: COMPLETE

Completed:

- `/inbox` rewritten from the Task 002/003 two-card first-pass (separate
  Comments/Deliveries lists) into a two-panel operational inbox: server
  page loads `listRecentComments()` + `listRecentDeliveries()` +
  `listAutomations()` + `listPosts()` in one `Promise.all`, renders
  `PageHeader` ("Inbox" / "Monitor comments, automation matches, and
  private DM activity from your Instagram content."), the true empty state
  (0 comments → "No inbox activity yet" copy that does **not** claim
  Instagram is connected), and delegates to a colocated client island.
- Client island `inbox/inbox.tsx` (Task 005/007 pattern): owns selection +
  search + filters only; all data arrives as props (no fetch, no direct
  `lib/mock` imports — grep-verified).
- Activity list (left, `lg:col-span-5`): one row per comment showing
  author (`@username`), comment text, post caption, `Automation: <name>` or
  "No automation matched" (real `CommentEvent` fields), outcome Badge, and
  `<time dateTime>` relative time. Rows are semantic `<button>`s —
  selected row carries `aria-current="true"` + `border-primary
  bg-primary-soft`; hover/focus outlines from shared chrome.
- Outcome badges reuse the Dashboard tone/label vocabulary via the same
  deliveries-by-`commentId` join (Ignored / Failed / DM sent / Queued /
  Matched) — **no invented statuses**; delivery statuses stay the model's
  `queued | sent | delivered | failed` mapped through the existing Badge
  tone map.
- Detail panel (right, `lg:col-span-7`): selected comment header
  (username, absolute + relative time, outcome badge) then sections —
  **Comment** (quoted text, post caption, post-type Badge, `View on
  Instagram` permalink link when the `postId` join resolves),
  **Automation** (name → `/automations/[id]`, keyword chip, status Badge —
  joined by `automationName`, documented: `CommentEvent` has no
  `automationId` yet), **Public reply** (configured reply text when
  automation has one + delivery status/time when a `public_reply` delivery
  exists), **Private DM** (automation's `privateReply` template in a
  `whitespace-pre-wrap` primary-soft block + `private_dm` delivery
  status/time + "No delivery recorded" fallback).
- Delivery errors surfaced per spec §8 in a danger-tinted `ErrorBlock`:
  "Delivery failed" / "Unable to send the private message." (or "public
  reply") / the `MessageDelivery.error` string already on the model
  ("Meta API: recipient cannot receive messages (24h window).") — no stack
  traces, no invented internals. Rendered only for `status === "failed"`.
- Toolbar: outcome filter buttons All / Sent / Failed / Ignored
  (`role="group"` + `aria-pressed` + token selected state; Queued/Matched
  outcomes have no button — zero such rows exist today, spec §10 "don't
  create five filters to fill the interface"), post `<Select>` offering
  only posts with activity (derived from distinct `postId`s — 3 options +
  All posts; `aria-label`), and search `Input type="search"` (`aria-label`)
  over comment text / author / post caption / automation name — all fields
  live on `CommentEvent`, client-side `useMemo`, no search library, no
  per-keystroke backend. Filters combine (AND); `aria-live` "Showing X of
  Y" only while filtered; "No activity matches your filters." + `Clear
  filters` for the no-match branch.
- Selection: defaults to the first visible row; survives filtering by
  falling back to the first visible item; empty filtered list shows the
  no-results state in the list panel and a "Select an activity…" placeholder
  in the detail panel.
- Empty states: page-level (0 comments) and filter-level (0 matches) both
  implemented; the page-level copy explains activity will appear "as
  followers engage" without asserting a connection state.
- Responsive: two-panel `grid lg:grid-cols-12` (5/7 split) collapses to a
  single column below `lg` (list first, then detail) — same structure as
  Posts/Automations; all row text truncates; no horizontal overflow classes
  needed; structural verification only (no browser tooling).
- Accessibility: `PageHeader` h1 → panel `CardTitle` h2 → section h3
  (`aria-labelledby` wiring on Comment/Automation/Public reply/Private DM);
  semantic `<ul>/<li>`; row selection via `aria-current`; filter
  `aria-pressed`; labeled search + select; status always text-in-badge
  (never color-only); `<time dateTime>` on every timestamp; error block is
  plain understandable text; links carry descriptive labels + new-tab
  hints; focus outlines from shared button/input chrome.
- No fake messaging (spec §17): zero reply/retry/delete/hide/like controls,
  no composer, no Meta calls — detail panel is read-only; deliveries are
  display-only until Task 014+. No Supabase touched (spec §22): no tables,
  no migrations, no RLS, no auth changes, no storage, no triggers.

What it does:

`/inbox` now communicates the full operational story — comment →
automation match → public reply / private DM → delivery result — in one
scan-friendly surface: pick any activity, see exactly what the follower
said, which automation handled it (with keyword), what message went out,
and whether delivery succeeded or failed (with the failure reason), while
search/filter answer "what happened recently" at a glance. Architecture
unchanged: server fetch → props → one client island; zero new
dependencies.

Files (key):

- apps/web/app/(dashboard)/inbox/page.tsx (rewritten: server page,
  header, empty state, 4-way Promise.all through lib/api, delegates island)
- apps/web/app/(dashboard)/inbox/inbox.tsx (NEW — client island: selection,
  search, filters, two-panel list+detail; not a route)
- TASK.md, Tree.md (documentation)

API/mock changes:

- None. Consumed existing `listRecentComments()`, `listRecentDeliveries()`,
  `listAutomations()`, `listPosts()` — no new endpoints, types, fields, or
  mock objects. Joins are real identifiers: deliveries↔comment by
  `commentId` (existing Dashboard pattern), comment↔post by `postId`,
  comment↔automation by `automationName` (the only key `CommentEvent`
  carries — documented in code; a real `automationId` arrives with the
  comments table in a later backend task). `lib/api/inbox.ts` unchanged.

Error & loading handling:

- No try/catch (convention — `request()` failures throw to Next's error
  page); no `loading.tsx` (mocks resolve instantly); structure is async
  `Promise.all` so a future real API drops in without UI changes. No fake
  spinners (spec §13).

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (16 routes; `/inbox` now static ○ with the
  colocated client island).
- Dev-server route sweep — 17/17 (all baseline routes incl. `?edit=nope`
  → 404, `/automations/missing` → 404, `/inbox` → 200).
- `/inbox` HTML assertions (all pass after correcting assertion-regex
  false-negatives from React `<!-- -->` text-node separators): spec
  description copy; Activity panel; all 6 comment authors; comment text;
  post captions; `Automation: Checklist DM` row join; "No automation
  matched" row copy; DM sent/Ignored/Failed badges; ≥4 `aria-pressed`
  buttons; filter-group + search + post-select `aria-label`s; "All posts"
  option; exactly one `aria-current="true"` (default selection); detail
  header `@mia.builds` with absolute+relative `<time>`; section headings
  (`inbox-comment/automation/reply/dm-heading`); keyword chip `CHECK`;
  active status badge; DM template URL; public-reply text "Sent! Check your
  DMs."; Delivered badge; `View on Instagram` + `rel="noopener noreferrer"`
  + `/automations/auto_1` href; failed `d_4` + queued `d_6` + `public_reply`
  records present in RSC payload (ErrorBlock code path grep-verified — it
  renders client-side when the failed row is selected); **no**
  reply/send/retry/composer controls; `lg:grid-cols-12` + `lg:col-span-5/7`;
  relative-time text; API-seam-only imports (3/3), zero `lib/mock`/fetch/
  supabase references in inbox files.
- Regression (all PASS): Dashboard KPIs/usage/activity/deliveries;
  Automations list names + ≥4 filters; detail Edit link + Pause still
  disabled; builder Save disabled when invalid; `?edit=auto_1` prefilled +
  Save enabled; Posts captions + exactly 4 `?post=post_N` hrefs + type
  badges. Dev log: zero runtime errors.
- Responsive: structural verification only (breakpoint classes in served
  HTML). No browser automation in this environment — click-through of
  search/filter/selection interaction left to owner.

Known limitations:

- Filter/search/selection behavior is client-side — compile- and
  SSR-verified only (no browser tooling; no new deps allowed).
- Queued and Matched comment outcomes render their badges but have no
  filter button (0 rows in current data) — visible under All; add buttons
  when data warrants.
- Post filter options come from posts with activity in the current mock
  (3 of 4); posts without comments are intentionally absent.
- Comment→automation join is by `automationName` (no `automationId` on
  `CommentEvent`) — unique in mock data; real id arrives with the comments
  table (backend task).
- `{{first_name}}` in the DM template renders raw (no follower first name
  exists in the data model — not fabricated).
- Public-reply section appears when either the automation configures a
  reply or a `public_reply` delivery exists; config-only case shows "No
  public reply recorded" (accurate: no delivery row).
- Empty states (0 comments / 0 matches) are compile-verified branches —
  mocks stay populated.
- No pagination/realtime — mock dataset is small by design (spec §21).

Deferred backend functionality (spec §16/§17/§22):

- Meta webhook → verify → dedupe → queue → match → DM/reply → delivery
  record pipeline (Tasks 016–018); comments/deliveries tables + write
  policies (014+); real auth (013); reply/retry/resolve actions; pagination
  and realtime inbox updates.

Next:

Task 009 - Analytics

## Task 007 - Posts + Supabase Foundation

Status: COMPLETE

Completed (frontend pass — Posts management UI):

- `/posts` rewritten from a first-pass 4-card grid into an admin-SaaS
  management screen: server page loads `listPosts()` + `listAutomations()`
  + `getInstagramAccount()` in one `Promise.all`, renders `PageHeader`
  ("Posts" / spec copy), connection context, empty states, and delegates
  filter/search to a colocated client island.
- Connection context (real data only): connected → `Badge success
  "Connected"` + `Instagram · @username`; missing account → notice
  ("Instagram not connected" + posts-become-available copy + `Open social
  accounts` → `/settings/social-accounts`); `status === "error"` →
  "Instagram needs attention" + out-of-date copy + same CTA. No fake
  connect/refresh flow.
- Client island `posts/list.tsx` (Task 005 pattern): media-type filter
  All / Reels / Posts / Carousels (`aria-pressed`, labels follow actual
  `IMAGE|REEL|CAROUSEL` data) + caption/id search (`aria-label`);
  filters combine (AND); `aria-live` "Showing X of Y" only while filtered;
  "No posts match your filters." + `Clear filters` for the no-match branch.
- Desktop layout: columnar table-style rows inside `Card` (`lg:grid-cols-12`
  with header row Post / Type / Published / Automations / Action). Post
  cell = media thumb (gradient + `IconPosts` placeholder while
  `mediaUrl` is null; real `<img alt=caption>` path kept), caption
  (truncated + full in `title`), likes · comments meta. Type = Badge,
  Published = `<time dateTime>` with year, Automations = joined-by-`postId`
  count ("1 automation" / "2 automations" / "No automations") with each
  automation name linked to its detail page, Action = `Create automation`
  → `/automations/new?post=<id>` + `View on Instagram` (real `permalink`,
  `target="_blank" rel="noopener noreferrer"`, caption-bearing
  `aria-label`).
- Mobile layout: same rows collapse to stacked cards with `lg:hidden`
  labels (Type / Published / Automations) — no table library, no
  horizontal overflow.
- Empty state (0 posts + connected): "No Instagram content yet" card
  explaining import arrives with the Instagram API integration — no fake
  sync CTA. Empty + disconnected: the connection notice alone (no
  duplicated card).
- Builder integration (Task 006 touch, spec §7): `/automations/new` now
  also reads `?post=<id>` through the same query-param prefill mechanism —
  server page validates the id against `listPosts()` and passes
  `initialPostId` to the island; `?edit=` prefill always wins when both
  are present; unknown/empty `post` id is ignored (renders New, empty
  selector) — deliberately NOT a 404, since it's a hint, not a resource.

Completed (Supabase foundation pass):

- Supabase configuration: `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` wired through env only — no
  hard-coded values in source (grep-verified); publishable key documented
  as browser-safe; **no service_role / `sb_secret_` key exists anywhere in
  this repo** (grep-verified — hits are only "never use it" comments).
  `.env.example` updated with both vars + warnings; local `.env.local`
  created (gitignored — `.gitignore` covers `.env`, `.env.local`,
  `.env.*.local`; `.env.example` correctly NOT ignored, re-verified with
  `git check-ignore`).
- Existing-schema inspection (read-only, before any design): PostgREST
  accepts the publishable key; probed 20 domain-candidate tables
  (workspaces, workspace_members, social_accounts, posts, automations,
  comments, deliveries, usage, users, profiles, migrations, …) — **every
  one returns PGRST205 "table not found" → public schema is empty**;
  Storage buckets `[]` (none); GoTrue healthy (v2.197.0). No duplicate
  objects touched — nothing existed to duplicate, delete, or reset.
- Supabase workflow: `npx supabase init` scaffolded `supabase/config.toml`
  + CLI `.gitignore`; standard `supabase/migrations/` directory adopted.
- Migration `supabase/migrations/20260923120000_smmomo_foundation.sql`
  (CREATED, **NOT YET APPLIED**): minimum multi-tenant schema
  `workspaces → workspace_members / social_accounts → posts → automations`
  with FK cascades, CHECK constraints matching frontend unions
  (media type, account status, automation status, platform, role),
  indexes on every FK/lookup column. RLS enabled on all 5 tables with
  `to authenticated` SELECT policies gated by a `security definer`
  `is_workspace_member(workspace_id)` helper (revoked from `anon`,
  granted to `authenticated`); **zero `using (true)` policies; no
  mutation policies yet** (app writes arrive with backend tasks).
  Apply is blocked in this environment: `npx supabase link` fails with
  `LegacyPlatformAuthRequiredError` (no `SUPABASE_ACCESS_TOKEN`, no
  dashboard session, no Docker for local stack) — file header documents
  both apply paths: `supabase link` + `db push` once a token exists, or
  paste into the dashboard SQL Editor (token-free). Never reset/wipe.
- Auth dependency decision (spec §17 — critical): authentication is still
  **mock-only** (login/register just navigate to `/dashboard`; no
  Supabase session exists). Therefore: **Posts stay on the mock
  implementation (`USE_MOCK = true`)**; no unrestricted query of private
  data; no insecure "temporary" RLS policy. Real reads unlock after
  Task 013 (Supabase auth + workspace seeding), at which point the same
  RLS policies already enforce workspace isolation with zero policy
  changes.
- Supabase client architecture (official `@supabase/supabase-js` — added
  as the only new dependency; no ORM, no extra auth framework):
  `lib/supabase/client.ts` (browser, publishable key, lazy factory) and
  `lib/supabase/server.ts` (server components; `persistSession: false`;
  **publishable key only**, lazy env-checked factory that throws a clear
  message if env is missing — mock mode never calls it). Cookie/session
  wiring (`@supabase/ssr`) deferred to Task 013 when sessions exist.
- Posts API (`lib/api/posts.ts`): same public shape (`listPosts`,
  `getPost` → `Post[]`), branch preserved inside the API layer —
  `USE_MOCK=true` → `request()`/mocks (unchanged default);
  `USE_MOCK=false` → Supabase query mapped snake_case rows → `Post`
  (manual `PostRow` interface until `supabase gen types` can run with a
  CLI token; deferred). Query deliberately carries **no workspace_id
  filter — RLS is the isolation boundary**. Errors throw to Next's error
  page (project convention, no swallowed try/catch). Other API modules
  untouched (their `USE_MOCK=false` target remains the future Fastify
  API per Task 011+). UI/Posts page unchanged — it cannot tell which
  implementation is behind the seam.
- Posts UI: the frontend pass above already satisfies §10–16 (header,
  table/cards, search/filter, Create-automation preselect, honest
  automation counts, empty + no-match states, connection context, no fake
  Sync). **Social-account column intentionally omitted**: no reachable
  data source populates it (mocks lack `socialAccountId`; Supabase reads
  are RLS-empty pre-auth) — per spec "if a field is not available, adapt
  the UI"; DB `posts.social_account_id` exists for when data does.
- README: env table gained the two Supabase rows (+ migration workflow
  note); tech-stack Database row now Supabase (replacing the stale
  PostgreSQL+Prisma plan); repo-layout block gained `supabase/`.

What it does:

SMMOMO now has Supabase as its real database foundation: an inspected,
empty project; a proper CLI-standard migration defining the full
multi-tenant ownership chain with strict membership RLS; browser/server
client seams behind the existing `USE_MOCK` switch; and Posts wired
through `lib/api` so flipping one flag moves it from mocks to Supabase —
while authentication stays mock-only and nothing insecure was shipped.

Files (key):

- supabase/config.toml, supabase/.gitignore (NEW — `npx supabase init`
  scaffold)
- supabase/migrations/20260923120000_smmomo_foundation.sql (NEW — full
  schema + RLS; authored, not yet applied)
- apps/web/lib/supabase/client.ts (NEW — browser client factory)
- apps/web/lib/supabase/server.ts (NEW — server client factory)
- apps/web/lib/api/posts.ts (added USE_MOCK=false → Supabase branch)
- apps/web/package.json (added `@supabase/supabase-js`)
- .env.example (Supabase vars + no-secret warnings), .env.local (local,
  gitignored)
- README.md (env table, tech-stack DB row, repo layout)
- apps/web/app/(dashboard)/posts/page.tsx (rewritten: server page,
  connection context, empty states, delegates list)
- apps/web/app/(dashboard)/posts/list.tsx (NEW — client filter/search
  island + table/card rows; not a route)
- apps/web/app/(dashboard)/automations/new/page.tsx (reads `?post=`
  prefill param alongside `?edit=`)
- apps/web/app/(dashboard)/automations/new/builder.tsx (accepts
  `initialPostId`; edit prefill takes precedence)
- TASK.md, Tree.md (documentation)

API/mock changes:

- `lib/api/posts.ts` keeps its public shape (`listPosts`, `getPost` →
  `Post[]`) and gains an implementation branch: `USE_MOCK=true` →
  existing `request()` + `mockPosts` (default, unchanged);
  `USE_MOCK=false` → Supabase `public.posts` via `getServerSupabase()`,
  rows mapped to the unchanged `Post` type (snake_case ↔ camelCase).
  Mock layer NOT deleted (spec §9). `getPost` reuses the same fetch.
  Other API modules untouched. No new frontend types; no mock-data
  changes; Post→automation counts remain real `postId` joins.

Error & loading handling:

- No try/catch (convention — `request()` failures throw to Next's error
  page); no fake in-page error state, since the current abstraction has no
  recoverable in-page error path; no `loading.tsx` (mocks resolve
  instantly). Structure is compatible with the future real API.

Accessibility:

- h1 (`PageHeader`); search input has `aria-label`; filter group has
  `role="group"` + `aria-label` + `aria-pressed` per button; mobile-only
  labels hidden at `lg` (desktop headers present); thumbs are decorative
  (`aria-hidden`) or real images with caption alt; external links have
  caption-bearing `aria-label` + new-tab hint; state text always literal
  ("Connected", "No automations", counts) — never color-only; focus
  outlines from shared button/input chrome.

Validation:

- `npm run typecheck` — passed (includes new Supabase modules).
- `npm run lint` — passed.
- `npm run build` — passed (15 routes; `/automations/new` remains ƒ,
  `/posts` remains static ○; `@supabase/supabase-js` compiles in).
- Migration validation: authored under the standard CLI layout; **cannot
  be applied or `db push`ed from this environment** (no
  `SUPABASE_ACCESS_TOKEN`, no Docker) — `npx supabase link` error captured
  in Task notes. SQL reviewed manually (FK/CHECK/index/RLS structure);
  server-side execution validation deferred until apply via SQL Editor or
  linked `db push`.
- Remote inspection re-run post-design: 20/20 candidate tables still
  PGRST205 (empty schema confirmed — no accidental objects created);
  storage still `[]`.
- Production-server URL sweep (`next start` in apps/web): 19/19 —
  `/posts`, `/automations`, `/automations/new`,
  `?post=post_1` → 200; `?edit=auto_1` → 200; `?edit=` → 200;
  `?edit=nope` → 404; `/automations/auto_1` → 200;
  `/automations/missing` → 404; `/settings/social-accounts`, `/dashboard`,
  `/`, `/login`, `/register`, `/inbox`, `/analytics`, `/settings`,
  `/settings/account`, `/settings/usage` → 200.
- `/posts` HTML assertions (all pass): spec description copy; Connected
  badge + `bishal.grows`; ≥4 `aria-pressed` filter buttons incl. Reels +
  Carousels labels; search `aria-label`; all 4 captions; REEL/IMAGE/
  CAROUSEL badges; `Sep 18, 2026` date; likes/comments meta (verified
  node-aware — React `<!-- -->` separators defeat naive substrings); all 4
  automation names; exactly 4 `?post=post_N` Create-automation hrefs;
  exactly 4 `target="_blank" rel="noopener noreferrer"` external links;
  `hidden lg:grid` + `lg:grid-cols-12` header; `lg:hidden` mobile labels;
  Published/Automations/Action column labels; filter group `aria-label`.
- Builder prefill HTML assertions (all pass): `?post=post_1` → option
  `selected` + Save still `disabled` (keyword empty); `?post=nope` → no
  post selected, renders "New automation"; `?edit=auto_1` → its post
  selected + Save enabled (precise `disabled` attribute check — Tailwind
  `disabled:` classes cause false positives in naive regexes).
- Security greps: no `sb_secret_`/`service_role` credential values in the
  repo (only explanatory comments/README/migration text mention the term);
  no hard-coded Supabase URL or key in `apps/web` source (env-only);
  `git check-ignore` confirms `.env`, `.env.local`, `.env.*.local`
  ignored and `.env.example` tracked.
- Responsive: structural verification only (breakpoint classes in served
  HTML). No browser automation in this environment — real-viewport eyeball
  QA + click-through of filter/search/Create-automation left to owner.

Known limitations:

- **Migration not applied** — schema exists only in the SQL file until an
  access token (`supabase login`) or dashboard SQL Editor run applies it.
  Posts' Supabase branch therefore has no tables yet (it is also
  unreachable while `USE_MOCK=true`).
- **Posts stay on mocks** — by design until Task 013 auth + workspace
  membership exist; flipping `USE_MOCK=false` today yields RLS-empty
  results (anonymous), not data. Documented as the security model working.
- No generated Supabase types (`supabase gen types` needs a CLI token) —
  `PostRow` interface is hand-written and must track the migration.
- No `@supabase/ssr`/cookie sessions yet — added in Task 013 with real
  auth; server client is sessionless (anonymous) until then.
- FK/index/policy details of the *hosted* database cannot be introspected
  from this environment (no token) — discovery used PostgREST probes
  (table existence, buckets, GoTrue health) only.
- Filter/search interaction and the `?post=` preselect click-through are
  client-side behavior — compile- and SSR-verified only (no browser
  tooling; no new deps allowed).
- Empty-post, disconnected, and error-connection branches are
  compile-verified only (mocks: 4 posts, account connected).
- No in-page error state (no recoverable error path in `request()` today);
  real API failures land on Next's error page — revisit with Task 014.
- Engagement (likes/comments) shown as Post-cell meta, not its own column;
  no Social-account column (no reachable data populates it — see above).
- No summary counts strip (spec didn't ask; filter row covers scan needs).
- "Create automation" does not persist anything (builder Save is Task
  014) — it only preserves the selected post into the builder.

Deferred work:

- Apply migration (SQL Editor or linked `db push`) + re-inspect schema.
- Supabase auth + workspace seeding + cookie sessions (Task 013).
- Generated DB types; member INSERT/UPDATE policies or service-role
  backend writes (Task 014+); comments/deliveries/usage tables; social
  account column on Posts once real data includes it; Meta sync (015+).

Next:

Task 008 - Inbox

## Task 006 - Automation Builder

Status: COMPLETE

Completed:

- `/automations/new` rewritten from concept-steps placeholder into the real
  builder: server page reads `searchParams` (`Promise` — awaited per Next 16
  docs), loads `listPosts()` + optional `getAutomation(edit)`, renders
  `PageHeader` ("New automation" / "Edit automation" with editing name) and
  one client island.
- Client island `new/builder.tsx`: post/reel `<select>` from `listPosts()`
  (new `Select` primitive reusing shared field chrome), required trimmed
  keyword, required private-DM textarea with visible
  `{{first_name}}` code-chip hint + placeholder, optional public-reply
  checkbox that reveals a required-when-on reply textarea (text preserved
  when toggled off).
- Validation: derived `isValid` gates Save (`disabled` until valid);
  per-field errors appear on blur (`touched`), wired with `aria-invalid` +
  `aria-describedby` → `<p id="…-error" className="text-danger">` (text, not
  color-only); `required` attrs for a11y with `noValidate` form so custom
  messages own the UX.
- Save: `onSubmit` preventDefault only — persistent hint under the buttons
  ("Saving and activation arrive with Task 014 — … nothing is stored yet").
  No fake persistence, no fake activate flow; Cancel returns to
  `/automations` (new) or `/automations/[id]` (edit).
- Live preview panel (right column, stacks on mobile via
  `lg:grid-cols-2`): selected-post caption + example follower comment once a
  keyword is typed, private-DM bubble (`bg-primary-soft`, `whitespace-
  pre-wrap`) with `{{first_name}}` rendered as "Sarah", optional public-reply
  bubble, empty-state copy until the DM is written, and a footnote that
  names the sample substitution whenever the variable is used.
- Edit path wired: detail page's disabled `Edit (Task 006)` button replaced
  with an enabled Link → `/automations/new?edit=<id>`; builder prefills
  postId/keyword/DM/reply from the automation (Save enabled immediately —
  prefilled data is valid). Unknown `edit` id → `notFound()` (404, same as
  detail); empty `?edit=` treated as New.
- Pause/Activate on the detail page untouched (still disabled — Task 014).

What it does:

`/automations/new` is now a complete V1 builder experience — choose post,
set keyword, compose DM/reply, see exactly what the follower receives,
with honest validation and zero faked backend behavior — and the detail
page's Edit action lands on it prefilled. Architecture unchanged: server
fetch → props → one client island; zero new dependencies.

Files (key):

- apps/web/app/(dashboard)/automations/new/page.tsx (rewritten: server
  page, searchParams Promise, posts + optional edit prefill)
- apps/web/app/(dashboard)/automations/new/builder.tsx (NEW — client
  island: form state, validation, live preview; not a route)
- apps/web/app/(dashboard)/automations/[id]/page.tsx (Edit → prefilled
  builder link; buttons row now wraps)
- apps/web/components/ui/input.tsx (added `Select` sharing `fieldClasses`)
- TASK.md, Tree.md (documentation)

API/mock changes:

- None. Consumed existing `listPosts()` and `getAutomation()`; no new types,
  fields, endpoints, or mock objects.

Error & loading handling:

- Unknown `?edit=` id → `notFound()`; empty `?edit=` renders New (verified).
- No try/catch (convention — requests throw to Next's error page); no
  `loading.tsx` (mocks resolve instantly).

Accessibility:

- h1 (`PageHeader`) → h2 (`Setup`/`Preview`); `<Label htmlFor>` on every
  field; checkbox has a real label; errors announced via `aria-describedby`
  + visible text; `aria-invalid` set only when showing; focus outlines from
  shared field/button chrome; external links/state never color-only.

Validation:

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed (15 routes; `/automations/new` is now dynamic ƒ
  because it reads `searchParams`).
- Production-server URL sweep (`next start`): 18/18 — `/`, `/login`,
  `/register`, `/dashboard`, `/automations`, `/automations/new`,
  `?edit=auto_1` → 200; `?edit=` → 200; `?edit=nope` → 404;
  `/automations/auto_1` → 200; `/automations/missing` → 404; `/posts`,
  `/inbox`, `/analytics`, `/settings`, `/settings/account`,
  `/settings/social-accounts`, `/settings/usage` → 200.
- HTML assertions (served markup): new-page Save carries the `disabled`
  attribute; edit-page Save does not; prefilled `value="CHECK"` + DM text +
  checked reply toggle + "Sarah" already rendered in the preview + Cancel
  href back to the detail; detail has `href="/automations/new?edit=auto_1"`,
  old `Edit (Task 006)` gone, Pause still disabled; Task 014 hint present;
  preview empty-state and select placeholder present.
- Responsive: structural verification only (`lg:grid-cols-2` form+preview
  stack below lg). No browser automation in this environment — real-viewport
  eyeball QA left to owner.

Known limitations:

- Typing/blurring/preview updates are client-side behavior — compile- and
  SSR-verified only, not driven by automated browser interaction (no
  tooling; no new deps allowed).
- Save click does nothing beyond `preventDefault` (by design until Task
  014); the persistent hint explains this.
- Builder has no name field — Task 006 spec's field list didn't include one;
  `automation.name` is display-only (server-side naming = later task).
- Reply-off keeps the typed text in state but hides the field (re-toggle
  restores it) — runtime behavior not exercised by automation.
- No URL-persisted draft state (out of scope; no state libraries).

Next:

Task 007 - Posts

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
- **2026-09-23** — Task 007 (Supabase): Supabase is the database foundation;
  UI keeps the `UI → lib/api/* → (USE_MOCK ? mock : implementation)` seam with
  posts branching to Supabase when mocks are off. Publishable key only in the
  web app — service_role/secret keys never enter this repo. RLS is the
  multi-tenant isolation boundary (membership helper, no `using (true)`
  policies). App stays on mocks until Task 013 auth exists; migration lives in
  `supabase/migrations/` and applies via CLI link+push or dashboard SQL Editor.

---

# Known Issues

- None currently failing. See Deferred for intentional gaps.
