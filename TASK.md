# SMMOMO Task Tracker

## Current Project State

Status: IN DEVELOPMENT

Current Phase: Production Readiness

Current Task: Task 025 - Live Meta Integration Verification & Production Delivery Validation (BLOCKED on live Meta — local validation PASS)

Last Completed Task: Task 024 - Production Onboarding + First Automation Experience

Next Task: Task 025 (resume when live Meta dependencies are available; then set next)

Last Updated: 2026-09-25 (Task 025)

Verification: 2026-09-25 Task 025 LOCAL validation PASSED / LIVE Meta
validation BLOCKED. Local: new `apps/api/scripts/validate-integration.ts`
**67/67 PASS** — single-source redirect URI (admin view == test view ==
`http://localhost:4000/social-accounts/instagram/callback`, no trailing
slash, no competing mechanism), config presence audit via
`POST /admin/integrations/meta/test` (no values printed), webhook
handshake challenge + wrong-token 403, full webhook → persist → match →
delivery → `sent` → usage chain against local Graph stub (comment linked
to post, 1 private_dm delivery, `comment_received`/`comment_matched`
exactly once, `matched_count` bumps), **duplicate webhook replay → no
second comment/delivery/usage/attempts**, non-match comment recorded with
0 deliveries and 0 `comment_matched`, case-insensitive KEYWORD/Keyword/
keyword each matched with exactly 1 delivery and `matched_count == 3`,
workspace isolation (RLS: other-workspace posts/comments/deliveries/
automations/social_accounts all invisible to second user; API list hides
them; PATCH other-workspace automation 404; create with other-workspace
post 400 "Unknown post" via composite FK), UI reflects backend state
(posts/inbox/dashboard/analytics show the fixture rows; dashboard shows
reconnect guidance when account status=error with no token material in
HTML), analytics formula footnote asserted (`Attempted = sent + delivered
+ failed`, "accepted by Instagram"), rate limits verified live
(sync 429 past 10/min, OAuth connect past 20/min, webhook past 60/min,
admin non-GET past 30/min — burst runs last, ~60s per-IP cooldown).
Regression baselines: validate-delivery **45/45**, validate-onboarding
**46/46**, validate-security **34/34**, validate-usage **32/32**,
validate-tokens **14/14** (trailing node-on-Windows UV_HANDLE assert is
benign, pre-existing), validate-config ok; typecheck/lint/build:api/
build:web exit 0; secret-value scan 0 (docs mention pattern strings
only); npm audit 0 vulnerabilities. LIVE Meta BLOCKED — exact
dependencies: (1) a real Meta developer app with App ID/App Secret
configured (`platform_settings` is empty, no META_* env in production
form), (2) a publicly reachable HTTPS API origin so Meta can deliver
webhooks to `/webhooks/instagram` (no tunnel/deployment exists in this
environment), (3) an Instagram Professional account to connect plus a
controlled second account to comment from and receive the DM. No product
code changed in Task 025 — harness + docs only. Task 025 stays BLOCKED
until those externals exist; do not mark COMPLETE.

Verification (Task 024): 2026-09-25 Task 024 validation PASSED — typecheck/lint/
build:api/build exit 0; migration `20260925000000_posts_sync_unique.sql`
APPLIED via `supabase db push` (unique posts(workspace_id, ig_media_id) for
idempotent content sync); real content import `POST
/social-accounts/instagram/sync` in new `apps/api/src/posts-sync.ts`
(session preHandler + 10/min/IP rate limit; service-role token read via
exported resolveAccessToken; `fetchInstagramMedia` GET through the Task 023
meta-client boundary with shared classification/safe messages + reconnect
flag; upsert `on_conflict=workspace_id,ig_media_id` merge-duplicates; IMAGE/
REEL/CAROUSEL only — Graph VIDEO skipped, reels accepted as REEL or
VIDEO+REELS); server-authorized activation gate `checkActivation` on POST
(`activate?: boolean` flag → status active) and PATCH (status=active) —
connection required/needs-reconnect → 409, missing post → 400, duplicate
active (post, case-insensitive keyword) → 409, engine first-wins preserved;
`apps/web/lib/onboarding.ts` pure derived state (connect→reconnect→import→
create→activate→waiting→live) + checklist; dashboard first-run checklist
card + 3-branch connection card (connected / needs attention / not
connected with Reconnect/Connect CTAs); topbar connect/reconnect pill for
every state; posts page Sync button (real POST + refresh) + empty-state
CTA; builder "Activate right after saving" (default on) → "Create &
activate" + server message surfacing via client.ts error-body parse;
status-toggle shows gate messages; detail page active/waiting/draft +
disconnected cards (§12/§13 copy); analytics success rate = (sent +
delivered)/attempted (honest — delivered never written alone); empty-state
CTAs (dashboard/inbox/analytics); social-accounts never-connected badge →
"Not connected"; `(dashboard)/error.tsx` minimal boundary; **no token in
responses** harness-checked; validate-onboarding.ts **46/46 PASS** (pure
state 10, auth gates, sync stub mode imported=2/skipped VIDEO=1/idempotent
re-sync, error-account 409, activation draft/unknown-post/activate 201/
duplicate 409 both routes/self-reactivate/pause/error-restore, no-account
workspace 400+409, token leak 4 routes, web smokes 6 incl. Sync CTA);
baselines validate-delivery **45/45**, validate-security **32/32**,
validate-usage **32/32**, validate-tokens **14/14**, validate-config ok;
secret scan 0; npm audit 0; Tree.md/TASK.md/README updated. Sync happy path
proven against META_GRAPH_BASE stub (real Graph default unchanged; LIVE
Instagram import not possible in this env). Task 025 next.

Verification (Task 023): 2026-09-23 Task 023 validation PASSED — typecheck/lint/
build:api/build exit 0; `apps/api/src/meta-client.ts` Graph boundary
(injectable fetch, lazy META_GRAPH_BASE, AbortSignal timeout, error class
auth/permission/rate_limit/invalid_request/temporary/network + safe user
messages + token-redacted diagnostics); delivery.ts claim → meta-client →
finalize with ownership guard; stuck `processing` reclaim → failed (no
requeue, avoid duplicate DMs); auth/permission → social_accounts.status=
error (reconnect, never disconnect); retry only rate_limit/5xx/
ECONNREFUSED while attempts < max; timeout ambiguous not retried;
{{first_name}} literal; frontend DeliveryStatus gains `processing`
(types + inbox/dashboard/analytics maps + analytics counts);
validate-delivery.ts **45/45 PASS** (Graph contract 200/401/403/429/400/
500/502 malformed, ECONNREFUSED retryable, timeout not retryable, token
never in safe message/diagnostic, {{first_name}}, redirect-uri single
source, stuck reclaim → failed, fresh processing kept, claim race empty);
validate-security **32/32**; validate-usage **32/32**; validate-tokens
**14/14**; validate-config ok; secret scan 0; npm audit 0; Tree.md/
TASK.md/README/docs/security.md/.env.example updated. LIVE Meta send NOT
proven (no IG messaging app in this env) — contract proven via injected
fetch. Task 024 next.

Verification (Task 022): 2026-09-23 Task 022 validation PASSED — typecheck/lint/
build:api/build exit 0; `apps/api/src/origins.ts` centralized (WEB_ORIGIN,
API_ORIGIN, corsAllowlist exact Set match from CORS_ORIGIN comma list,
resolveRedirectUri, webhookCallbackUrl, missingProductionConfig names-only);
CORS in app.ts exact match + credentials + missing Origin = server-to-server
no ACAO; cookie-options.ts shared SameSite=Lax + Secure prod + optional
NEXT_PUBLIC_COOKIE_DOMAIN Domain; meta.ts/platform-config.ts use origins;
validate-config.ts gate; validate-security.mjs **34/34 PASS** (25 prior + 9
CORS: allowed reflect/credentials, unknown/null/suffix no ACAO, missing
Origin 200 no ACAO, preflight 204 allowed / no ACAO unknown, credentialed
usage 200); validate-usage.mjs **32/32 PASS** (re-run with non-admin env);
validate-tokens.ts **14/14 PASS**; validate-config.ts development ok names
only; route smoke login/register 200 API /posts 401; secret scan 0; npm
audit 0; .env.local gitignored; Tree.md/TASK.md/README/docs/security.md
updated; localhost unchanged (allowlist default = WEB_ORIGIN). Task 023 next.

Verification (Task 021): 2026-09-23 Task 021 validation PASSED — typecheck/lint/
build:api/build exit 0; migration `20260924000000_production_readiness.sql`
APPLIED via `supabase db push` (revoke member INSERT/UPDATE on
social_accounts; unique posts(workspace_id,id); composite FK
automations(workspace_id,post_id)→posts ON DELETE CASCADE; unique
(workspace_id,platform) on social_accounts — duplicate probe rows cleaned
first; migration made idempotent after first unique-index failure);
shared crypto in `apps/api/src/crypto.ts` (AES-256-GCM `v1.<iv>.<tag>.<ct>`
base64url, PLATFORM_ENCRYPTION_KEY, no plaintext fallback → 503);
OAuth upsert now service-role + encryptSecret; delivery resolveAccessToken
(decrypt v1 / lazy re-encrypt legacy plaintext) + sanitizeGraphError;
encrypt-ig-tokens.ts run 1/1 encrypted plaintextLeft=0; validate-tokens.ts
14/14 PASS (roundtrip, malformed/tampered/wrong-key → null, DB all-v1 +
decryptable); full CSP always-on in next.config.ts from asset inventory
(unsafe-inline documented for Next bootstrap); OAuth connect/callback
rate limit 20/min/IP + Map key cap 10k; env classification in
.env.example; docs/security.md token-storage model + CSP inventory +
resolved-table + prod requirements 7–8; Tree.md new files; README env
table; validate-security.mjs extended → **25/25 PASS** (CSP present +
blocks external scripts, member cannot UPDATE access_token);
validate-usage.mjs **32/32 PASS**; secret scan 0 real secrets (publishable
keys + service_role comments only); npm audit 0 vulnerabilities; route
smoke health/login/register 200 + /posts 401; residual risks: multi-instance
rate-limit store, key-rotation dual-key window, script-src unsafe-inline,
stuck processing delivery reclaim; Task 022 next.

Prior verification (Task 020): 2026-09-23 Task 020 validation PASSED —
typecheck/lint/
build:api/build exit 0; migration `20260923230000_security_hardening.sql`
APPLIED via `supabase db push` (column-level SELECT on social_accounts —
members get id/workspace_id/platform/username/name/followers/status/
connected_at only, access_token/refresh_token revoked; workspace_id
immutability triggers on automations + social_accounts); timing-safe
webhook verify-token compare; OAuth token insert return=minimal; Fastify
setErrorHandler (generic 5xx, no stack) + onSend headers (nosniff,
no-referrer, DENY); Next security headers (nosniff/DENY/referrer/
permissions-policy/HSTS prod); in-process rate limit (webhooks POST
60/min/IP, admin non-GET 30/min/IP); automation field length caps;
friendly signup/account errors (no raw provider text); production cookies
secure+lax sameSite; .gitignore env patterns broadened; validate-usage
creds from env (no hardcoded passwords in harness); Task password removed
from TASK.md (rotate on hosted project); docs/security.md written;
validate-security.mjs 22/22 PASS; validate-usage.mjs 32/32 PASS; secret
scan: only historical TASK.md password hit — removed this task; npm audit
0 vulnerabilities; residual risks documented (IG token plaintext at rest,
shared rate-limit store multi-instance, full CSP needs third-party
inventory, automations.post_id cross-workspace FK); Task 021 next.

Prior verification (Task 019): 2026-09-23 Task 019 validation PASSED —
build:api/build exit 0; migration `20260923220000_usage_events.sql`
APPLIED via `supabase db push`; `usage_events` table with unique
(workspace_id, event_type, idempotency_key) + member SELECT RLS (no
`using (true)`); `recordUsageEvent` service-role only (never browser);
hooks wired: webhook `comment_received` (inserted only — duplicate POST
→ 1 row), engine `comment_matched` (winning claim only), delivery
`private_dm_sent`/`private_dm_failed`/`public_reply_sent`/
`public_reply_failed` (terminal outcomes only — requeue retries not
counted); idempotency keys `comment:{ig_comment_id}` /
`delivery:{delivery_id}` (never random UUID); double-insert → exactly
1 row; different event_type same reference → separate rows OK;
`GET /usage/summary` calendar-month UTC default + optional `start`/
`end` (invalid → 400 `invalid start date` / `start must be before
end`); summary: period label, start/end, byEventType totals,
dmsSent=private_dm_sent, limit=null + remaining=null (no fake plan);
RLS: other-user JWT → `[]`, member can read own usage; webhook
comment_received exactly once under duplicate POST; usage page 200
with real period (no "All time"); pure-function selfcheck OK; node
harness 32/32 PASS; secret scan: 0 real secrets (comments + publishable
key only); Task 020 next.

Prior verification (Task 018): 2026-09-23 Task 018 validation PASSED —
typecheck/lint/build exit 0; migration `20260923200000_delivery_worker.sql`
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
| 018A | Secure Admin Meta Configuration | COMPLETE |
| 019 | Usage Tracking | COMPLETE |
| 020 | Security Hardening | COMPLETE |
| 021 | Production Readiness + Residual Risk Cleanup | COMPLETE |
| 022 | Production Domain + Multi-Origin Hardening | COMPLETE |
| 023 | End-to-End Instagram DM Delivery | COMPLETE |
| 024 | Production Onboarding + First Automation Experience | COMPLETE |
| 025 | Live Meta Integration Verification & Production Delivery Validation | BLOCKED (local PASS — live deps missing) |

Note on 004–010: Task 002 delivered working placeholder versions of every route
(designed, data-driven, not empty). Tasks 004–010 should treat their pages as
"real but first-pass" — refine depth (filters, empty states, edit flows) rather
than rebuilding from scratch.

---

# Current Task

## Task 025 - Live Meta Integration Verification & Production Delivery Validation

Status: **BLOCKED** (2026-09-25) — Local validation: **PASS**; Live Meta
validation: **BLOCKED** on missing external dependencies (below). No
product code changed — new harness + docs only. Resume this task when the
externals exist; do not mark COMPLETE on local harnesses alone.

### Objective (from spec)

Prove the existing core product against the real Meta platform end to end:
real OAuth connect, real `/media` sync, real automation activation, real
Instagram comment → signed webhook → engine match → Graph DM → delivery
states → usage exactly once, duplicate-webhook safety, non-match behavior,
case-insensitive matching, reconnect states, rate limits, workspace
isolation, UI reflecting real backend state, analytics formula audit.
Official Meta APIs only — no scraping/browser automation/workarounds. Fix
only real integration blockers; no scope expansion (no billing/AI/new
platforms/Redis).

### Exact external dependencies (why BLOCKED)

1. **Real Meta developer app** — `platform_settings` row is empty
   (meta_app_id/secret/verify token all unset) and no production
   `META_APP_ID`/`META_APP_SECRET`/`META_WEBHOOK_VERIFY_TOKEN` exist in any
   env file (only ad-hoc local test values in dev shells). Without App ID +
   Secret the OAuth exchange, webhook signature verification, and app
   subscription cannot run against real Meta.
2. **Publicly reachable HTTPS API origin** — Meta delivers webhooks to
   `<API_ORIGIN>/webhooks/instagram`; this environment only has
   `http://localhost:4000` and no tunnel (no ngrok/cloudflared) or deployed
   host. Real comment events cannot reach the server.
3. **Instagram Professional accounts** — one Business/Creator account to
   connect + sync + own the post, and one controlled second account to post
   the test comment and receive the DM. None available; personal accounts
   cannot use the API at all.

When those exist: configure App ID/Secret + verify token (Settings →
Integrations or env), set `WEB_ORIGIN`/`API_ORIGIN`/`CORS_ORIGIN` to the
public HTTPS deployment, register the single-source redirect URI in the
Meta dashboard, subscribe webhook fields `comments,messages`, add the test
accounts as app-role users while in development mode, then execute spec
§5–§16 live and record results here.

### Live Meta configuration verified (§2/§3/§4 — code + docs audit)

- **Single redirect URI source confirmed:** `origins.resolveRedirectUri()`
  = `META_REDIRECT_URI ?? API_ORIGIN + /social-accounts/instagram/callback`;
  `platform-config.ts` delegates; admin SaveMetaConfig has **no redirect
  field** (display/`redirectUriPresent` only) — no competing mechanism
  exists to reconcile. Harness asserts admin view == test view ==
  `http://localhost:4000/social-accounts/instagram/callback`, no trailing
  slash. Documented rule: exactly one source; register that exact string
  (protocol/host/port/path, HTTPS in production, no trailing slash) in the
  Meta app dashboard.
- **Config audit (no secrets printed):** presence-only
  `POST /admin/integrations/meta/test` reports appId/secret/verify-token
  configured flags + `source` labels (db|env|none) — in the local dev run
  all three come from `env`; production must provide them via secret
  manager or encrypted `platform_settings`. Never: App Secret, service-role
  key, encryption key, access tokens, session/webhook secrets — none
  printed, none committed (value scan 0).
- **Permission/scope names checked against current official Meta docs
  (2026):** `instagram_business_basic`, `instagram_business_manage_comments`,
  `instagram_business_manage_messages` are the **current** scope values
  (introduced Sept 2024; old `business_*` values deprecated 2025-01-27 —
  SMMOMO already uses the new names). OAuth hosts match official flow
  (`www.instagram.com/oauth/authorize` → `api.instagram.com/oauth/access_token`,
  API host `graph.instagram.com`); messaging endpoint `POST /{igUserId}/messages`
  with `recipient:{id:IGSID}` and webhook app subscription via
  `graph.facebook.com/v22.0/{appId}/subscriptions` (fields `comments,messages`)
  match current docs. No deprecated permission names used.
- **Live-only risks documented (cannot be proven without accounts):**
  Standard Access apps may only message app-role users until app review;
  Instagram messaging may require a customer-initiated 24h window (the
  official comment-scoped alternative is `POST /{comment-id}/private_replies`
  at 750/hour — current implementation sends `/{igUserId}/messages`, which
  only a live test can accept or reject); Graph calls omit an explicit
  version (relies on app default version); webhook subscribe is best-effort
  (dashboard fallback documented). These are the first things to observe in
  the live run.

### What was proven locally (harness `validate-integration.ts` — 67/67)

- **§2/§3 redirect + config:** as above; webhook GET handshake returns the
  challenge for the right verify token, 403 for a wrong one.
- **§8 comment → delivery chain (synthetic signed webhook):** comment
  persisted with post linkage → engine matched the active fixture
  automation (`TESTKEY025`, case-insensitive contains) → exactly 1
  `private_dm` delivery queued → inline worker claimed (attempts=1) →
  Graph send via local `META_GRAPH_BASE` stub → status `sent` →
  `comment_received` usage ×1, `comment_matched` usage ×1,
  `private_dm_sent` usage ×1 (polled: usage is written after the owned
  `sent` finalize by design — count-only-terminal ordering).
- **§9 state semantics:** `queued → processing → sent` observed; `sent`
  means "accepted by the send path" (stub today, Meta HTTP 200 in live);
  `delivered` never fabricated — remains dependent on a future
  delivery-status webhook/event (documented, unchanged).
- **§10 duplicate webhook (DB-level):** identical payload replay → still
  1 comment row (unique `workspace_id,ig_comment_id` + ignore-duplicates),
  1 delivery, usage counts unchanged, `matched_count` unchanged, delivery
  `attempts` unchanged → no second Graph send. Constraints, not just
  app behavior.
- **§11 non-match:** comment recorded (`comment_received`), `matched=false`,
  0 deliveries, 0 `comment_matched` usage, no billable DM event.
- **§12 case-insensitive:** `TESTKEY025` / `testkey025` in different cases
  each matched with exactly 1 delivery; final `matched_count == 3`
  (non-match contributed 0).
- **§13 reconnect:** API side already covered by validate-delivery (401/403
  → `needsReconnect`, safe message, token redacted, not retryable) and
  validate-onboarding (sync/activate 409 with reconnect copy); harness adds
  UI proof — account flipped to `error` → dashboard renders reconnect
  guidance, page HTML contains no token material → restored to `connected`.
- **§14 rate limits (live against running API):** sync 429 past 10/min/IP,
  OAuth connect 429 past 20/min/IP, webhook 429 past 60/min/IP, admin
  non-GET 429 past 30/min/IP — all enforced before auth/validation as
  designed; in-process single-instance limitation unchanged and still
  documented in `docs/security.md` (no Redis introduced).
- **§15 workspace isolation:** second user's JWT sees **0 rows** of the
  other workspace's posts/comments/deliveries/automations/social_accounts;
  API list hides them; `PATCH /automations/:id` of other workspace → 404;
  creating an automation with the other workspace's post → 400 "Unknown
  post" (composite FK `(workspace_id, post_id)`). API + DB constraints both
  verified.
- **§16 UI reflects state:** /posts shows the fixture media, /inbox shows
  the real comment, /dashboard shows connection + fixture, /analytics
  renders; no fake/demo values introduced anywhere.
- **§17 analytics formula audited:** `attempted = sent + delivered + failed`
  (queued/processing excluded — not yet attempted), `accepted = sent +
  delivered`, `successRate = accepted/attempted`, empty → null → honest
  "No delivery records yet" / "no attempts yet" copy. Failed counts in the
  denominator ✔; queued/processing never counted successful ✔; `sent` never
  double-counted as `delivered` ✔ (mutually exclusive row statuses);
  footnote states the formula verbatim (harness-asserted). Distinction
  documented rather than strengthened: `sent` = operational acceptance,
  `delivered` = confirmed delivery (hypothetical until a delivery-status
  webhook exists).

### Implementation changes (§19 — no product defects found)

- NEW `apps/api/scripts/validate-integration.ts` only. Every observed
  anomaly during development was a harness bug (polling usage before the
  post-finalize write landed; wrong presence-field names in the audit
  print), fixed in the harness — product code behavior was correct.
  This harness joins the standard validation workflow (run after the other
  suites; its rate-limit bursts poison the per-IP window for ~60s).

### Tests run (§20) — all green

- `npm run typecheck` / `npm run lint` / `npm run build:api` / `npm run build` — exit 0.
- validate-delivery **45/45**; validate-onboarding **46/46**;
  validate-security **34/34**; validate-usage **32/32**;
  validate-tokens **14/14**; validate-config ok;
  validate-integration **67/67**.
- Secret **value** scan: 0 (service-role + encryption-key values absent
  from all tracked files; docs mention pattern strings only).
- `npm audit`: 0 vulnerabilities.
- Note: validate-tokens exits via a benign node-on-Windows UV_HANDLE
  assertion after printing `pass=14 fail=0` (pre-existing, documented in
  Task 024).

### Files changed

- NEW `apps/api/scripts/validate-integration.ts` (67 checks)
- EDIT `TASK.md`, `Tree.md`, `README.md` (docs only)
- No product code, no migrations, no config changes.

### Commits

- This change: `local integration harness: webhook E2E, duplicate safety, isolation, rate limits (Task 025)` → `origin/main`.

### Known limitations

- **Live OAuth / media sync / real comment / real DM / real duplicate
  delivery from Meta: NOT OBSERVED** — blocked on the three externals
  above. Local proofs use synthetic signed webhooks (valid HMAC with the
  configured App Secret) and a local Graph stub that never fakes a 200 on
  the real host.
- One media page (50) per sync, no cursor pagination (unchanged).
- Usage event written immediately after the owned `sent` finalize — a
  crash in that narrow window would lose one event (undercount); ordering
  is deliberate (record-before-finalize would risk double-count on lost
  ownership). Documented, not changed.
- Rate-limit verification is same-IP/in-process; multi-instance still
  needs a shared store (existing documented residual risk).
- Analytics `delivered` count remains 0 until a delivery-status webhook
  exists.

### Exact next task

**Resume Task 025** the moment a real Meta app + public HTTPS origin +
Instagram Professional accounts exist: configure secrets, register the
single-source redirect URI, subscribe webhooks, run the live scenario
spec §5–§16, record results in this section, re-run the full validation
battery, then flip status to COMPLETE. If no product defect appears,
there is no code work — observation + documentation only. If a live
defect appears: reproduce → smallest fix → regression test → re-run
harnesses → re-run live scenario (spec §19).

---

## Task 023 - End-to-End Instagram DM Delivery

Status: COMPLETE (2026-09-23). Roadmap next: Task 024.

### Objective (from spec)

Ship the full comment → match → private DM / public reply path with a real
Graph client boundary: delivery state machine (`queued/processing/sent/
delivered/failed`), idempotent claim, stuck-processing reclaim, Meta API
error classification + safe messages, account reconnect signal, retry
policy with duplicate-DM tradeoff, usage on terminal outcomes only,
template var policy (`{{first_name}}`), inbox/analytics display of
`processing`, OAuth redirect single source, automated delivery harness
(unit Graph contract + optional service-role integration), full validation,
git hygiene, docs, final report.

### Decisions

- **Graph boundary:** new `apps/api/src/meta-client.ts` — only place that
  calls Meta Messaging/Comment Reply. Injected `fetch` for tests; lazy
  `META_GRAPH_BASE` (read at call time); `AbortSignal.timeout`
  (`META_GRAPH_TIMEOUT_MS` default 15s). `delivery.ts` imports send helpers.
- **Error classes:** 401 `auth`, 403 `permission`, 429 `rate_limit`,
  4xx `invalid_request`, 5xx `temporary`, fetch fail `network`. Persisted
  `deliveries.error` is a fixed safe string only (never raw Graph body or
  token); diagnostics stay in server logs with Bearer/IGQV/EAA redacted.
- **Account health:** `auth`/`permission` → PATCH
  `social_accounts.status='error'` (reconnect UI). Never auto-disconnect.
- **Retry / ambiguity:** requeue only for `rate_limit` / `temporary` /
  connection-refused (`ECONNREFUSED`/`ENOTFOUND` — never left the host)
  while `attempts < DELIVERY_MAX_ATTEMPTS`. Timeout/abort after connect is
  ambiguous → fail (duplicate-DM risk over silent double-send).
- **Stuck reclaim:** `processing` + `claimed_at` older than
  `DELIVERY_STUCK_MS` (default 120s > Graph timeout) → permanent `failed`
  with “not retried to avoid duplicate messages”. Atomic guard (still
  processing + old claim). Fresh processing rows untouched. Ownership
  finalize (`status=eq.processing`) so lost races skip usage.
- **Usage:** terminal `sent`/`failed` only (requeue is intermediate);
  idempotent `delivery:{uuid}` — `private_dm_sent` never on failure.
- **Template:** `renderDeliveryMessage` leaves `{{first_name}}` literal —
  webhook payload has username only; personalization deferred (never
  invent follower names).
- **Frontend:** `DeliveryStatus` gains `processing`; label/tone maps +
  analytics counts updated (inbox, dashboard, analytics).
- **Redirect URI §25:** still single source `origins.resolveRedirectUri()`
  (`META_REDIRECT_URI ?? API_ORIGIN + /social-accounts/instagram/callback`);
  platform-config delegates; admin SaveMetaConfig has no redirect field.
  Harness asserts stability + path.
- **No new migration** — statuses/`attempts`/`claimed_at` already exist
  (018). Processing partial index skipped (small table; add if reclaim scan
  ever shows up in EXPLAIN).
- **No Redis/BullMQ** — same honest inline poll as 018.

### Files

- NEW `apps/api/src/meta-client.ts`
- NEW `apps/api/scripts/validate-delivery.ts` (45 checks)
- EDIT `apps/api/src/delivery.ts` — use meta-client; reclaim; ownership
  finalize; needsReconnect; safe error strings; template hook
- EDIT `apps/api/src/app.ts` — DeliveryRow status includes `processing`
- EDIT `apps/web/types/index.ts` — DeliveryStatus `processing`
- EDIT `apps/web/app/(dashboard)/inbox/inbox.tsx`,
  `dashboard/page.tsx`, `analytics/page.tsx` — processing label/tone/counts
- EDIT `.env.example`, `Tree.md`, `README.md`, `docs/security.md`, `TASK.md`

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`, `npm run build` — all exit 0.
- `npx tsx apps/api/scripts/validate-delivery.ts` → **45/45 PASS**
  (classification table; DM/reply 200; 401/403 needsReconnect + no token in
  safe/diagnostic; 429/500 retryable; 400 not; ECONNREFUSED retryable;
  timeout not retryable; malformed 502 temporary; `{{first_name}}`;
  resolveRedirectUri; stuck reclaim → failed + message; fresh kept; claim race empty).
- `validate-security.mjs` **32/32 PASS**; `validate-usage.mjs` **32/32 PASS**;
  `validate-tokens.ts` **14/14 PASS**; `validate-config.ts` development ok.
- API boot log: `delivery worker started` with `stuckMs=120000`.
- Secret scan 0; npm audit 0.

### Known limitations / honest notes

- **LIVE META VERIFICATION NOT COMPLETED** — no Instagram messaging app /
  permissions in this environment. Graph contract proven via injected
  fetch boundary; default host remains real Graph (never fakes 200).
- Recipient is commenter **username** (webhook source); if Meta requires
  numeric recipient id, non-2xx → classified + safe failed.
- Stuck reclaim always fails (no requeue) — crash-before-Graph is also
  failed; operator can re-trigger. Documented duplicate-DM tradeoff.
- `{{first_name}}` sends the literal token until a verified name field
  exists on the comment/webhook row.
- Redis/BullMQ still absent — inline poll only.
- Task 023 delivery harness uses service-role for DB probes (same pattern
  as validate-tokens); skips cleanly without the key.

### Final report fields (§32)

- **Delivery state machine:** `queued → processing → sent | failed`;
  retryable Graph errors requeue to `queued`; stuck processing → `failed`.
- **Claim:** PATCH `status=eq.queued` + representation (empty = lost race);
  attempts bumped on claim; finalize only while `processing`.
- **Reclaim:** `processing` older than `DELIVERY_STUCK_MS` → `failed`
  (atomic, no requeue).
- **Meta errors:** class + safe message + reconnect flag; retry policy as above.
- **Usage:** terminal outcomes only; idempotent delivery key.
- **Template:** `{{first_name}}` literal, deferred.
- **UI:** `processing` status labeled/tone-mapped on inbox/dashboard/analytics.
- **Redirect URI:** single source origins.ts, harness-verified.
- **Tests:** validate-delivery 45/45; baselines green; LIVE Meta not done.
- **Git:** commit + push `origin/main` without asking (standing directive).

---

## Task 024 - Production Onboarding + First Automation Experience

Status: COMPLETE (2026-09-25). Roadmap next: Task 025.

### Objective (from spec)

Production first-run: audit the new-workspace experience end to end; derive
onboarding state server-side; dashboard first-run with connection CTAs;
real activation endpoint with server validation (connection, post,
duplicate) — client never self-authorizes `status=active`; real Instagram
content import (Graph `/media` → posts upsert) so "choose a post" is
possible; success/waiting/failed activation states (§12/§13 honest copy,
no guaranteed-delivery promises); useful empty states with CTAs across
pages; mobile-safe responsive layout; preserve CORS/CSP/OAuth/token
protections; `USE_MOCK=false` throughout; automated testing harness;
docs; full validation; git hygiene; §33 final report. No billing, no new
platforms, no AI, no second builder.

### Decisions

- **P0 content import:** posts import never existed — new workspaces could
  not build an automation at all. New `apps/api/src/posts-sync.ts`:
  `POST /social-accounts/instagram/sync` (session preHandler, 10/min/IP
  rate limit added in app.ts next to the OAuth limits). Service-role
  account/token read (members cannot see `access_token`); token via
  exported `resolveAccessToken` from delivery.ts (same decrypt/lazy
  re-encrypt path). Graph call through the Task 023 meta-client: new
  `fetchInstagramMedia` (GET `/{igUserId}/media`, one page of 50,
  injectable fetch, shared error classification + safe messages +
  `needsReconnect` → `markAccountNeedsReconnect`, never disconnect).
  ponytail: single page — cursor pagination when >50 posts is routine.
- **Idempotent upsert:** migration `20260925000000_posts_sync_unique.sql`
  adds unique `posts(workspace_id, ig_media_id)` (NULLs distinct — pre-sync
  rows unaffected); sync POSTs with `?on_conflict=workspace_id,ig_media_id`
  + `Prefer: resolution=merge-duplicates` → re-sync updates counts/captions,
  never duplicates. Harness asserts row count stable across re-sync.
- **Type mapping:** posts CHECK only allows IMAGE/REEL/CAROUSEL — Graph
  IMAGE→IMAGE, REEL→REEL, CAROUSEL_ALBUM→CAROUSEL, VIDEO with
  `media_product_type=REELS`→REEL, plain VIDEO/stories skipped and counted
  (`skipped` in response), never faked.
- **Server activation gate:** `checkActivation(req, {postId, keyword,
  privateReply, excludeId?})` in app.ts — RLS-scoped reads via the
  caller's session (cross-workspace checks impossible by construction):
  no social row → 409 "Connect Instagram before activating…"; status
  `error` → 409 reconnect message; post missing → 400; another **active**
  automation on same post with case-insensitive-equal keyword → 409
  "Another active automation already uses …" (excludeId makes re-activating
  the same row idempotent). Wired into POST `/automations` via new
  `activate?: boolean` body flag (status `active` only when validated,
  else always `draft`) and into PATCH when `status=active` (current row
  loaded first to merge keyword/post context). Engine first-match policy
  unchanged — gate only prevents new duplicates.
- **Derived onboarding state:** `apps/web/lib/onboarding.ts` — pure
  `onboardingStep()` (connect → reconnect → import → create → activate →
  waiting → live) + `setupChecklist()` (done/current/pending per step,
  reconnect wording). Pure = harness-testable without React. Dashboard
  loads `listPosts()` alongside existing five requests.
- **Dashboard:** connection card now three honest branches (connected /
  needs attention+Reconnect / never connected+Connect Instagram — badge
  `success`/`failed`/`neutral`, red border only on error) and a compact
  "Get started" checklist card for steps import/create/activate (+waiting
  card copy "Automation is live … Waiting for comments") that hides at
  `live` — never nags. Connect/reconnect states use the connection card
  itself (no duplicate checklist card). Comment/delivery empty states gain
  "Create automation" CTAs.
- **Topbar:** pill for every state — green connected, red
  "Instagram — reconnect", zinc "Connect Instagram" (both link to
  /settings/social-accounts); null while loading (no flash).
- **Builder UX:** "Activate right after saving" checkbox (default ON for
  new, hidden for edit) → `createAutomation({…, activate})` → button label
  "Create & activate"/"Save as draft"; footer copy states server verifies
  the connection; zero-posts select gains "import your posts" link to
  /posts; edit flow copy notes status lives on the detail page.
- **Server messages reach the UI:** `client.ts` `request()` now parses the
  API error body's author-written `message` (capped 200 chars) into the
  thrown Error; network failure → friendly "Could not reach the server…";
  404→undefined contract unchanged. Builder, status-toggle, and Sync
  button show `err.message` verbatim (validation text, never tokens/stacks).
- **Detail page §12/§13:** active+not-connected card ("deliveries will
  fail until connected"), active+connected+0 matched "Waiting for matching
  comments" card, draft "Not watching for comments yet" card — honest
  waiting copy, no delivery guarantees.
- **Analytics success rate fix:** `delivered` rows are never written (no
  delivery webhook), so `delivered/attempted` always showed 0% — now
  `(sent + delivered)/attempted` with the footnote formula updated; the
  breakdown card lists statuses as-is.
- **Other empty states:** inbox empty → Create automation CTA; analytics
  automations empty → Create automation CTA; posts connected-empty →
  "Sync to pull in your latest posts" + in-card Sync button; posts page
  header gets the Sync CTA when connected (`PageHeader action`).
- **Social accounts:** never-connected badge → neutral "Not connected"
  (was a false "Needs attention"); error keeps red.
- **Error boundary:** minimal `apps/web/app/(dashboard)/error.tsx` —
  "Something went wrong" + Try again (reset) + Back to dashboard.
- **Not done (deliberately):** sidebar nav unchanged (topbar pill +
  dashboard CTAs make connection discoverable); no builder preview
  rewrite (mock `@maya.skies` sample is client-only preview); usage page
  has no backend action to CTA; no cursor pagination on media; no
  delivery-webhook subscription (`delivered` still hypothetical).

### Files

- NEW `supabase/migrations/20260925000000_posts_sync_unique.sql` (APPLIED)
- NEW `apps/api/src/posts-sync.ts` — sync route (Graph /media → upsert)
- NEW `apps/api/scripts/validate-onboarding.ts` (46 checks)
- NEW `apps/web/lib/onboarding.ts` — pure derived state + checklist
- NEW `apps/web/app/(dashboard)/posts/sync-button.tsx` — SyncPosts client
- NEW `apps/web/app/(dashboard)/error.tsx` — route-group error boundary
- EDIT `apps/api/src/meta-client.ts` — shared `graph()` GET/POST, `data` on
  ok, `fetchInstagramMedia` + `InstagramMediaItem`
- EDIT `apps/api/src/delivery.ts` — export `resolveAccessToken`,
  `markAccountNeedsReconnect` (reused by sync)
- EDIT `apps/api/src/app.ts` — `checkActivation` gate; POST `activate` flag;
  PATCH status=active gate; sync rate limit; registerContentSyncRoutes
- EDIT `apps/web/lib/api/client.ts` — surface API error `message`
- EDIT `apps/web/lib/api/posts.ts` — `syncPosts()`; `automations.ts` —
  `activate?: boolean` on AutomationInput
- EDIT `apps/web/app/(dashboard)/dashboard/page.tsx` — 3-branch connection
  card, SetupCard, posts load, empty CTAs
- EDIT `apps/web/components/layout/topbar.tsx` — status-aware pill
- EDIT `apps/web/app/(dashboard)/posts/page.tsx` — Sync CTA + empty copy
- EDIT `apps/web/app/(dashboard)/automations/new/builder.tsx` — activate
  flow, server errors, zero-posts link
- EDIT `apps/web/app/(dashboard)/automations/[id]/page.tsx` — activation
  state cards + connection check; `status-toggle.tsx` — gate messages
- EDIT `apps/web/app/(dashboard)/analytics/page.tsx` — success-rate fix +
  automations CTA; `inbox/page.tsx` — CTA; `settings/social-accounts/
  page.tsx` — never-connected badge
- EDIT `TASK.md`, `Tree.md`, `README.md`

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`, `npm run build` — all exit 0.
- Migration `20260925000000` applied via `npx supabase db push`.
- `npx tsx apps/api/scripts/validate-onboarding.ts` → **46/46 PASS**
  (pure onboarding state 7 + checklist 3; anon sync/PATCH 401; sync stub
  mode imported=2 skipped=1 VIDEO, rows with ig_media_id, re-sync
  idempotent no dup, no token material in body; error-account sync 409;
  draft create 201/status draft; activate non-boolean 400; unknown post
  400 "Post no longer exists"; create&activate 201/active; duplicate
  case-insensitive 409 both POST and PATCH routes; unique keyword 201;
  self re-activate 200; pause 200; activate-while-error 409 → restore →
  200; no-account workspace sync 400 + activate 409; token leak scan on 4
  routes; web smokes /dashboard /posts /automations/new
  /settings/social-accounts 200 + Sync CTA + Instagram marker).
- Baselines: `validate-delivery.ts` **45/45**; `validate-security.mjs`
  **32/32**; `validate-usage.mjs` **32/32**; `validate-tokens.ts`
  **14/14**; `validate-config.ts` ok.
- Render checks (node fetch with real session cookie): dashboard contains
  "Get started" + checklist + @usage_probe; posts contains "Sync posts"
  + imported "Sunset over the bay"; builder contains "Activate right after
  saving"; analytics contains "accepted by Instagram"; social-accounts
  "Connected".
- Secret scan 0 (`sb_secret_`/JWT/`sbp_`); npm audit 0.

### Known limitations / honest notes

- **LIVE INSTAGRAM IMPORT NOT POSSIBLE in this env** — sync happy path
  proven against a local `META_GRAPH_BASE` stub (IMAGE/REEL/VIDEO items);
  default host remains the real Graph API (never fakes 200). Against real
  Meta with a non-Messaging token the endpoint returns the classified
  409/reconnect branch — harness covers that branch too (degraded mode).
- One media page (50 items) per sync — no cursor pagination yet; re-sync
  updates the same rows (merge-duplicates).
- Activation gate is per-request state: two concurrent activations of the
  same keyword could still race (no DB constraint on active duplicates —
  engine's first-wins keeps behavior deterministic either way).
- `delivered` count remains 0 until a delivery-status webhook exists;
  success rate honestly uses `sent`.
- Sync rate limit is per-IP single-instance (same documented multi-instance
  gap as the other limits in docs/security.md).

### Final report fields (§33)

- **Content import:** `POST /social-accounts/instagram/sync` — session +
  10/min/IP; Graph `/media` via meta-client; unique
  (workspace_id, ig_media_id) upsert; IMAGE/REEL/CAROUSEL only; re-sync
  idempotent (harness: 2 rows stable, VIDEO skipped).
- **Activation:** server gate on POST (`activate` flag) and PATCH —
  409 connect/reconnect/duplicate, 400 missing post; client text surfaces
  verbatim; engine first-wins preserved.
- **Onboarding:** pure `onboardingStep` (7 branches) + checklist;
  dashboard first-run card + 3-branch connection card + topbar pill for
  every state; hides at live.
- **States:** success (detail "Active"/waiting cards), waiting (0 matches
  copy), failed (connected-error card + delivery error strings), empty
  CTAs on dashboard/inbox/analytics/posts.
- **Analytics:** success rate (sent+delivered)/attempted — no more
  permanent 0%.
- **Security unchanged:** CORS/CSP/OAuth/token protections untouched; no
  tokens in any response (harness-scanned); client cannot self-activate.
- **Tests:** validate-onboarding 46/46; baselines 45/45 + 32/32 + 32/32 +
  14/14 + config ok; secret scan 0; audit 0.
- **Git:** commit + push `origin/main` without asking (standing directive).

---

## Task 022 - Production Domain + Multi-Origin Hardening

Status: COMPLETE (2026-09-23). Roadmap next: Task 023.

### Objective (from spec)

Audit and harden origin architecture for production multi-origin: central
origin config, frontend API base strategy, explicit CORS allowlist, cookie/
session model for split subdomains, OAuth redirect centralization, webhook
origin independence, Meta redirect single source, security headers re-test,
Supabase env audit, `.env.example` classification, localhost still works,
config validation (names only — no secret values in errors), origin security
tests, API/admin security checks, delivery/webhook/usage regression, docs,
full validation, git hygiene, final report. No `example.com` hardcoding;
no unnecessary proxy layers. Do **not** solve Task 021 residual risks
(multi-instance rate limit, dual-key rotation, `unsafe-inline`, stuck
delivery reclaim) unless required — document dependency instead.

### Decisions

- **Single source:** `apps/api/src/origins.ts` — `WEB_ORIGIN`, `API_ORIGIN`,
  `corsAllowlist()` (comma-separated `CORS_ORIGIN`, default `WEB_ORIGIN`,
  exact `Set` match), `resolveRedirectUri()` (`META_REDIRECT_URI` ??
  `API_ORIGIN` + callback path), `webhookCallbackUrl()`,
  `missingProductionConfig()` (prod-only, **names only**).
- **CORS:** exact match + `credentials: true`; missing Origin =
  server-to-server (Meta webhook, curl) → request proceeds **without** CORS
  headers; unknown/null/suffix-spoof → no ACAO (browser blocks). No `*`,
  no prefix/`startsWith`.
- **Cookies:** shared `sessionCookieOptions()` in
  `apps/web/lib/supabase/cookie-options.ts` used by browser client, server
  client, and `proxy.ts`. `SameSite=Lax` (same-site subdomains need Lax, not
  None); `Secure` only in production; optional `Domain` via
  `NEXT_PUBLIC_COOKIE_DOMAIN` for split-subdomain deploys; empty on
  localhost (host-only cookie spans ports).
- **Frontend API base:** remains single seam `NEXT_PUBLIC_API_URL` in
  `apps/web/lib/api/client.ts` only — no scattered fetch URLs.
- **OAuth redirect:** still env/`origins.ts` only — never admin free text,
  never request Origin/Host. `platform-config.ts` delegates to
  `origins.resolveRedirectUri()`.
- **Webhooks:** unchanged server-to-server (timing-safe verify + HMAC +
  idempotency) — no browser CORS dependency.
- **Config gate:** API boot warns when `NODE_ENV=production` and required
  names missing; `npx tsx apps/api/scripts/validate-config.ts` for CI.
  Development never crashes on missing prod-only vars.
- **No migration** for Task 022.

### Files changed

- NEW `apps/api/src/origins.ts` — centralized origins + CORS allowlist +
  redirect/webhook URLs + production missing-names check.
- NEW `apps/web/lib/supabase/cookie-options.ts` — shared session cookie
  options (`SameSite=Lax`, Secure in prod, optional Domain).
- NEW `apps/api/scripts/validate-config.ts` — names-only config gate.
- EDIT `apps/api/src/app.ts` — exact-match CORS allowlist + credentials;
  production missing-config warn (names only).
- EDIT `apps/api/src/meta.ts` — origins via `origins.ts`.
- EDIT `apps/api/src/platform-config.ts` — redirect URI via `origins.ts`.
- EDIT `apps/web/lib/supabase/client.ts`, `server.ts`, `apps/web/proxy.ts`
  — use `sessionCookieOptions()`.
- EDIT `apps/api/scripts/validate-security.mjs` — CORS origin tests
  (allowed reflect + credentials; unknown/null/suffix no ACAO; missing
  Origin still works; preflight allowed/disallowed; credentialed usage 200).
- EDIT `.env.example` — CORS comma-list comment, `NEXT_PUBLIC_COOKIE_DOMAIN`.
- EDIT `README.md` — env table (WEB/API/CORS/cookie domain + 022 note).
- EDIT `docs/security.md` — Origin architecture + CORS + cookie model +
  prod requirements 3–4.
- EDIT `Tree.md` — new files + app.ts/origins descriptions.

### Verification

- typecheck / lint / build:api / build (web) exit 0.
- `npx tsx apps/api/scripts/validate-config.ts` — development ok (names
  only, no values printed).
- `node apps/api/scripts/validate-security.mjs` → **34/34 PASS** (25 prior
  + 9 CORS origin cases).
- `node apps/api/scripts/validate-usage.mjs` → **32/32 PASS**.
- `npx tsx apps/api/scripts/validate-tokens.ts` → **14/14 PASS**.
- Route smoke: health/login/register 200, /posts 401.
- Secret scan 0 real secrets; npm audit 0 vulnerabilities.
- Localhost CORS: browser `http://localhost:3000` → API still works
  (allowed origin exact match = default allowlist).

### Notes / follow-ups

- Task 021 residual risks remain open (documented in docs/security.md):
  multi-instance rate-limit store, dual-key rotation window,
  `script-src 'unsafe-inline'`, stuck `processing` delivery reclaim.
- Production: set `WEB_ORIGIN`, `API_ORIGIN`, `CORS_ORIGIN`,
  `NEXT_PUBLIC_API_URL`, optional `NEXT_PUBLIC_COOKIE_DOMAIN` together;
  run `validate-config.ts` before traffic.

---

# Completed Tasks

## Task 021 - Production Readiness + Residual Risk Cleanup

Status: COMPLETE (2026-09-23). Roadmap next: Task 022.

### Objective (from spec)

Clear residual risks from Task 020 without billing/V1 expansion/giant
refactor: encrypt IG tokens at rest (key-rotation-ready format), token
migration, RLS recheck, rate-limit review, CSP from real asset inventory,
`automations.post_id` FK decision, DB integrity audit, OAuth/webhook/
delivery/usage regressions, security scanning, env classification, error
handling, tests, full validation, docs, git hygiene, final report.

### Decisions

- **Shared crypto:** `apps/api/src/crypto.ts` AES-256-GCM envelope
  `v1.<iv>.<tag>.<ct>` (base64url) with `PLATFORM_ENCRYPTION_KEY`;
  platform-config re-exports `encryptionReady`. Same helpers for
  platform secrets + IG tokens. Envelope versioned for future dual-key
  rotation (rotation window not implemented — documented).
- **No plaintext fallback:** missing key → explicit 503 on OAuth upsert
  and encrypt paths; never write plaintext tokens.
- **Legacy plaintext tokens:** delivery `resolveAccessToken` uses once
  and re-encrypts in place (one-way toward ciphertext).
- **`automations.post_id`:** keep NOT NULL + CASCADE (automation never
  exists without post; disconnect cascade wipes posts→automations
  intentionally) + **composite FK** `(workspace_id, post_id) →
  posts(workspace_id, id)` so members cannot bind across tenants.
- **Rate limiting:** stay in-process (single instance; Redis reserved
  only in .env.example). Added OAuth connect/callback 20/min/IP; Map key
  cap 10,000 clear-on-full. Multi-instance limitation documented.
- **CSP:** always-on in `next.config.ts` from real asset inventory
  (self, Supabase URL, API origin; self-hosted Geist; `'unsafe-inline'`
  for Next bootstrap — documented). HSTS prod-only. Inventory table in
  docs/security.md; adding third-party scripts requires updating both.
- **Env classification:** `.env.example` comments: client-safe /
  server-only / secret / optional / development-only /
  production-required.

### Completed

- **Crypto:** new `apps/api/src/crypto.ts`; platform-config imports +
  re-exports; admin path unchanged.
- **OAuth:** `meta.ts upsertConnection` → service-role +
  `encryptSecret(accessToken)` (signature without unused `user`).
- **Delivery:** `resolveAccessToken` (v1 decrypt / legacy re-encrypt) +
  `sanitizeGraphError` strips Bearer/IGQV from persisted Graph errors.
- **Rate limit:** Map key cap 10,000; third limiter OAuth connect/
  callback 20/min/IP.
- **Web CSP:** full Content-Security-Policy (+ existing headers) with
  inventory in config comments.
- **Migration `20260924000000_production_readiness.sql` APPLIED:** REVOKE
  INSERT/UPDATE on social_accounts from authenticated; unique
  posts(workspace_id,id); drop/replace automations FK with composite
  workspace-scoped FK; unique (workspace_id,platform) index. Idempotent
  (DO block for unique target). First push failed on duplicate
  (workspace,instagram) probe rows — cleaned 2 of 3 fixture rows, kept
  newest, re-push succeeded.
- **Token migration:** `encrypt-ig-tokens.ts` run →
  `{"total":1,"encrypted":1,"plaintextLeft":0}`.
- **Token validation:** `validate-tokens.ts` 14/14 PASS (key ready,
  roundtrip, malformed empty/no-dots/wrong-version/short → null, tampered
  tag/ct → null, wrong key → null, DB all-`v1.` + decryptable).
- **Harness:** `validate-security.mjs` + CSP present + CSP blocks
  external scripts + member cannot UPDATE access_token (owner JWT → 403)
  → **25/25 PASS**. `validate-usage.mjs` **32/32 PASS** (regression).
- **Docs:** docs/security.md — IG token storage model, CSP inventory
  table, RLS/composite FK/unique connection, service-role includes meta +
  scripts, rate-limit OAuth note, Resolved table (token/CSP/FK/unique),
  Remaining (multi-instance, key rotation dual-key, unsafe-inline, stuck
  delivery), prod requirements 7–8 (run encrypt script, rotation plan);
  Tree.md new files + migration; README env table 021 row; .env.example
  classification.

### Validation

- typecheck / lint / build:api / build (web) exit 0.
- Migration applied via `npx supabase db push` (after dedupe).
- Token encrypt script 1/1, validate-tokens 14/14.
- API `/health` 200; web :3000 200; route smoke login/register 200,
  /posts 401.
- `node apps/api/scripts/validate-security.mjs` → **25/25 PASS**.
- `node apps/api/scripts/validate-usage.mjs` → **32/32 PASS**.
- Secret scan: 0 real secrets (publishable keys + `service_role`
  word-in-comments only); `npm audit` 0 vulnerabilities.

### Residual risks (documented, not fixed here)

- In-process rate-limit store — multi-instance needs shared store (medium).
- Key rotation dual-key decrypt window not implemented (medium) —
  envelope is versioned ready.
- CSP `script-src 'unsafe-inline'` required by Next bootstrap (low).
- Stuck `processing` delivery reclaim still operator-driven (low).
- Graph live Meta send still not proven (no messaging perms — stub
  validation only).

### Files changed

- apps/api/src/crypto.ts (new), platform-config.ts, meta.ts,
  delivery.ts, app.ts, admin.ts (import only)
- apps/api/scripts/encrypt-ig-tokens.ts (new), validate-tokens.ts (new),
  validate-security.mjs
- apps/web/next.config.ts
- supabase/migrations/20260924000000_production_readiness.sql (new)
- .env.example, docs/security.md, Tree.md, README.md, TASK.md

## Task 020 - Security Hardening

Status: COMPLETE (2026-09-23). Roadmap next: Task 021.

### Objective (from spec)

Systematic security audit + minimal defense-in-depth fixes across env/
secrets, auth/authz, Supabase clients, RLS, input validation, injection,
webhooks, OAuth, CSRF, rate limiting, usage tracking, error leakage,
headers, deps, logging — document residual risks; no redesign, no RLS
weakening, no service-role exposure, no client-side checks replacing
server logic.

### Completed

- **Audit:** full read-only pass (env/secrets, auth/authz, Supabase
  clients, RLS, validation, injection, webhooks, OAuth, CSRF, rate limit,
  headers, logging, deps, uploads, web trust).
- **`.gitignore`:** `.env` / `.env.*` (with `!.env.example`).
- **Webhooks:** timing-safe verify-token compare
  (`timingSafeStringEqual`).
- **OAuth:** token insert `prefer: return=minimal` (no RETURNING
  access_token).
- **API `app.ts`:** `setErrorHandler` (generic 5xx, no stack/PII);
  onSend security headers (x-content-type-options, referrer-policy,
  x-frame-options); minimal in-process rate limit (webhooks POST
  60/min/IP, admin non-GET 30/min/IP — ponytail: Map+interval, not a
  plugin); automation field length caps (name 200, keyword 120,
  privateReply 4000, publicReply 1000).
- **Web:** `next.config.ts` security headers (nosniff, DENY, referrer,
  permissions-policy, HSTS prod-only); register + account friendly error
  mapping (no raw provider text); Supabase cookieOptions `secure:true` +
  `sameSite:"lax"` in production.
- **Migration `20260923230000_security_hardening.sql` APPLIED:**
  REVOKE table SELECT on social_accounts from authenticated + column
  GRANT safe columns only; `prevent_workspace_reassign()` triggers on
  automations + social_accounts.
- **Harnesses:** `validate-usage.mjs` creds/verify-token from env (exit
  2 if unset); `validate-security.mjs` new (auth 401s, bad input 400s,
  webhook sig/handshake 403/200, no token/secret leak, headers, RLS
  column probe, no stack leak).
- **Docs:** `docs/security.md` (auth model, clients, service-role
  rationale, RLS, webhook, OAuth, usage, headers, rate limit, validation,
  residual risks, prod requirements).
- **Secret hygiene:** Task 013 password removed from TASK.md (rotate on
  hosted project); harness passwords only via session env.

### Validation

- typecheck / lint / build:api / build (web) exit 0.
- Migration applied via `npx supabase db push`.
- API `/health` 200 with security headers; web :3000 200.
- `node apps/api/scripts/validate-security.mjs` → **22/22 PASS**.
- `node apps/api/scripts/validate-usage.mjs` → **32/32 PASS**.
- Secret scan: 0 real secrets (Task password removed); `npm audit` 0
  high/critical (0 total vulnerabilities).

### Residual risks (documented, not fixed here)

- IG access/refresh tokens plaintext at rest in social_accounts (medium)
  — encrypt-at-rest follow-up.
- In-process rate-limit store (multi-instance needs shared store).
- Full CSP needs third-party asset inventory before shipping.
- `automations.post_id` cross-workspace FK (low).

### Files changed

- .gitignore
- apps/api/src/app.ts, webhooks.ts, meta.ts
- apps/api/scripts/validate-usage.mjs, validate-security.mjs (new)
- apps/web/next.config.ts, app/(auth)/register/page.tsx,
  app/(dashboard)/settings/account/account-form.tsx,
  lib/supabase/server.ts, lib/supabase/client.ts, proxy.ts
- supabase/migrations/20260923230000_security_hardening.sql (new, APPLIED)
- docs/security.md (new)
- TASK.md, Tree.md

---

# Completed Tasks

## Task 019 - Usage Tracking

Status: COMPLETE (2026-09-23). Roadmap next: Task 020.

### Objective (from spec)

Idempotent `usage_events` layer (DB-enforced uniqueness), usage
service, `GET /usage/summary` with date range, RLS workspace
isolation, wire into real webhook/engine/delivery lifecycle points,
real data in `/settings/usage`. No payments/Stripe/fake limits,
tests, regression suite, docs, commit+push.

### What shipped

- **Migration `20260923220000_usage_events.sql` APPLIED** (`supabase
  db push`): `usage_events` (workspace FK, event_type/source/
  reference_type checks, quantity>0, metadata jsonb, occurred_at,
  idempotency_key); **unique (workspace_id, event_type,
  idempotency_key)**; indexes `(workspace_id, occurred_at)` +
  `(workspace_id, event_type, occurred_at)`; RLS member SELECT via
  `public.is_workspace_member(workspace_id)` (no `using (true)`).
- **`apps/api/src/usage.ts` (new):**
  - Event types: `comment_received`, `comment_matched`,
    `private_dm_sent`, `private_dm_failed`, `public_reply_sent`,
    `public_reply_failed`.
  - `recordUsageEvent()` — service-role only (`restService()`),
    PostgREST `?on_conflict=workspace_id,event_type,idempotency_key`
    + `Prefer: resolution=ignore-duplicates`; 23505 → `duplicate`;
    returns `"recorded" | "duplicate" | "failed"`.
  - `usageIdempotencyKey()` — deterministic `comment:{ig_comment_id}`
    / `delivery:{delivery_id}` — never a random UUID.
  - `currentUsagePeriod()` — UTC calendar month `[start, end)`.
  - `parseUsageRange()` — optional `start`/`end` ISO dates; invalid →
    `{ok:false, message}` (API → 400); inverted range → 400.
  - `getWorkspaceUsage(user, start, end)` — end-user JWT + RLS via
    `rest()` (never browser-supplied workspace id); aggregates
    `event_type`+`quantity` in JS (limit 10000); `used` =
    `private_dm_sent`; **`limit: null`, `remaining: null`** (no plan
    system — never invent).
- **Hooks (service-role writes only):**
  - `webhooks.ts` — after persist, `outcome === "inserted"` (not
    `duplicate`) + comment_id → `comment_received` (source `webhook`,
    ref `comment:{ig_comment_id}`); error logged, never fails webhook.
  - `engine.ts` — after winning claim (`claim.data.length` non-zero,
    not `already`) → `comment_matched` (source `engine`).
  - `delivery.ts` — `recordDeliveryUsage(row, outcome, log)` called
    only on **terminal** `sent` and permanent `failed` — requeue
    retries do NOT count; `queued` never counts as sent. Maps kind×
    outcome → `private_dm_sent`/`private_dm_failed`/
    `public_reply_sent`/`public_reply_failed` (source `delivery`, ref
    `delivery:{id}`).
- **`GET /usage/summary` rewritten** (`app.ts`): `parseUsageRange` +
  `getWorkspaceUsage`; default = current UTC month; response keeps
  UI contract (`period`, `dmsSent`, `commentsProcessed`,
  `publicReplies`, `failedDeliveries`) + `start`, `end`,
  `byEventType` totals, `commentsReceived`/`commentsMatched`,
  `privateDmFailed`/`publicReplyFailed`, `used`, `limit: null`,
  `remaining: null`.
- **Authority map (do not conflate):**
  - `deliveries.status` → operational delivery state.
  - `automations.*_count` → analytics / product reporting (unchanged).
  - `usage_events` → usage + future billing.
- **Types/UI:** `UsageSummary` extended (optional start/end/
  limit/remaining/byEventType/commentsMatched/…); usage page shows
  real period (no "All time"), comments matched, failures, zero-guard
  empty state; settings hub + dashboard consume `period`/`dmsSent`
  unchanged.
- **Validation script:** `apps/api/scripts/validate-usage.mjs` (node
  harness — 32 checks: idempotency double-insert → 1 row, date range
  filtering + boundaries, invalid input 400, workspace isolation RLS,
  webhook duplicate → no second `comment_received`, pure-function
  selfcheck, route sweep, regression).

### Files

- supabase/migrations/20260923220000_usage_events.sql (new, applied)
- apps/api/src/usage.ts (new)
- apps/api/src/app.ts (usage import + /usage/summary rewrite)
- apps/api/src/webhooks.ts (comment_received hook)
- apps/api/src/engine.ts (comment_matched hook)
- apps/api/src/delivery.ts (recordDeliveryUsage on terminal outcomes)
- apps/api/scripts/validate-usage.mjs (new — validation harness)
- apps/web/types/index.ts (UsageSummary extension)
- apps/web/lib/api/usage.ts (unchanged seam — /usage/summary)
- apps/web/app/(dashboard)/settings/usage/page.tsx (real period, matches, failures)
- TASK.md, Tree.md

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`,
  `npm run build` — all exit 0.
- Migration: `npx supabase db push` → Finished, lists exactly
  `20260923220000_usage_events.sql`.
- **Idempotency:** double-insert same (workspace, type, key) → 1 row;
  different event_type same reference → 2 rows.
- **Date range:** default = current UTC month (label `September 2026`);
  `?start=2026-09-01&end=2026-10-01` → 200; invalid start → 400
  `invalid start date`; inverted → 400 `start must be before end`;
  old period → zeros.
- **Summary shape:** `limit === null`, `remaining === null`,
  `byEventType.private_dm_sent` numeric; `dmsSent` includes recorded
  event.
- **RLS:** other-user JWT on workspace's `usage_events` → `[]`;
  member can read own.
- **Webhook integration:** signed POST → 200 + `comment_received`
  exactly 1; duplicate re-POST → still 1; `comment_matched` ≤ 1.
- **Pure functions:** selfcheck OK (label, start/end boundaries,
  parse rejects bad/inverted, idempotency keys, 6 event types).
- **Node harness:** 32/32 PASS (health, anon 401, summary 200, range
  validation, insert idempotency, webhook, RLS, route sweep, usage
  page, webhook GET verify).
- **Web:** `/settings/usage` → 200, period not "All time"; dashboard/
  settings hub consume `period`/`dmsSent` unchanged (typecheck).
- Secret value scan: 0 real secrets (comments + publishable key in
  validation script only — never service-role/PAT values).

### Known limitations / honest notes

- Aggregation is **JS-side** (limit 10000 events per period) — fine
  for V1; move to Postgres `sum(quantity) … group by` when volume
  exceeds that (upgrade path, not YAGNI for launch).
- **No plan system** — `limit`/`remaining` stay null forever until a
  billing task adds real plan rows; never fake a number.
- `automations.*_count` still authoritative for analytics — 019 does
  not migrate those; both sources must stay in sync only if a future
  task reconciles them (currently independent — documented).
- Requeue retries correctly do not double-count, but a stuck
  `processing` row that is manually reset after a crash mid-send
  could under-count if never terminal — operator sees empty delivery
  and can re-enqueue (usage stays honest: no event until terminal).
- No Stripe/payments in V1 (per spec).
- Task 020 Security Hardening is the next roadmap task (019 stays
  COMPLETE).

---

## Task 018A - Secure Admin Meta Configuration

Status: COMPLETE (2026-09-23). Roadmap next: Task 019 (unchanged).

### Objective (from spec)

Admin-managed Meta app credentials (App ID/Secret, webhook verify token)
with server-side encryption, platform-admin-only API access, Settings UI,
wired into Task 015 OAuth + Task 016 webhook as a **single source of
truth**. Platform-level vs workspace-level must not mix. Do not mark
Task 018 complete as part of this task (018 was already shipped — this
interstitial task does not change delivery).

### What shipped

- **Platform-admin model (new — none existed):** API env
  `PLATFORM_ADMIN_EMAILS` (comma-separated). Checked server-side after
  the normal session preHandler using Auth profile email. No client
  `isAdmin` flag; workspace `workspace_members.role` stays workspace-scoped
  and is not used for platform secrets.
- **`platform_settings` single-row table** (migration
  `20260923210000_platform_settings.sql` APPLIED): `id` boolean PK
  constrained to true; `meta_app_id`, `meta_app_secret_encrypted`,
  `webhook_verify_token_encrypted`, `updated_at`, `updated_by`. RLS
  enabled with **no policies** (end-user JWTs get zero rows; only
  service-role reads/writes). No `using (true)`.
- **`apps/api/src/platform-config.ts`:** AES-256-GCM encrypt/decrypt
  (`v1.<iv>.<tag>.<ct>` base64url) keyed by `PLATFORM_ENCRYPTION_KEY`
  (64 hex or 32-byte base64). **Precedence (one rule):** non-empty DB
  field wins; empty/missing DB falls back to matching `META_*` env.
  Redirect URI is deployment config only (env / default
  `API_ORIGIN + callback path`) — not admin-editable. Process-local
  cache invalidated on save.
- **`apps/api/src/admin.ts`:** `GET/PUT /admin/integrations/meta`,
  `POST /admin/integrations/meta/test`. GET never returns plaintext
  secrets — only `appSecretConfigured`/`webhookVerifyTokenConfigured`
  flags + `source=db|env|none`. PUT encrypts non-empty secrets; empty
  string clears; omitted leaves unchanged. Secret write without
  encryption key → 503.
- **Wiring:** `meta.ts` (OAuth connect/callback/state HMAC/token
  exchange/webhook subscribe) and `webhooks.ts` (GET verify + POST
  HMAC) both call `getMetaConfig()` — one resolved object, never a
  second App ID/Secret path. Workspace `social_accounts.access_token`
  remains separate (workspace-level) and is never written to
  platform_settings.
- **Settings UI:** `/settings/integrations` server page (admin only —
  API 403 → redirect `/settings`) + `MetaForm` client island (App ID,
  password fields for secrets with Configured badges, read-only
  redirect URI + copy, Test configuration). Integrations hub row only
  renders when `GET /admin/integrations/meta` succeeds (API-side gate).
- **`.env.example`:** documents `PLATFORM_ADMIN_EMAILS`,
  `PLATFORM_ENCRYPTION_KEY`, and that empty DB fields fall back to
  `META_*` env defaults.

### Files

- supabase/migrations/20260923210000_platform_settings.sql (new)
- apps/api/src/platform-config.ts (new)
- apps/api/src/admin.ts (new)
- apps/api/src/meta.ts (getMetaConfig wiring)
- apps/api/src/webhooks.ts (getMetaConfig wiring)
- apps/api/src/supabase.ts (AuthUser.email)
- apps/api/src/app.ts (registerAdminRoutes)
- apps/web/lib/api/admin-meta.ts (new)
- apps/web/lib/api/client.ts (PUT method)
- apps/web/app/(dashboard)/settings/page.tsx (Integrations row)
- apps/web/app/(dashboard)/settings/integrations/page.tsx (new)
- apps/web/app/(dashboard)/settings/integrations/meta-form.tsx (new)
- .env.example
- TASK.md, Tree.md

### Validation performed

- `npm run typecheck`, `npm run lint`, `npm run build:api`, `npm run build` — all exit 0.
- Migration: `npx supabase db push` → Finished, lists exactly `20260923210000_platform_settings.sql`.
- **Auth:** anon admin GET → 401; non-admin (separate confirmed user)
  GET/PUT/test → 403; admin GET → 200.
- **Masking:** admin GET/PUT responses and Settings HTML contain no
  App Secret / verify-token plaintext; flags + sources only.
- **Encryption:** PUT stores `meta_app_secret_encrypted` /
  `webhook_verify_token_encrypted` as `v1.…` ciphertext (not plaintext).
- **Single source:** after DB save, webhook GET verify uses DB token
  (200); POST HMAC signed with DB App Secret → 200; bad sig → 403.
  After clearing DB fields, env `META_WEBHOOK_VERIFY_TOKEN` works again
  (200) — proves env fallback.
- **OAuth:** `/social-accounts/instagram/connect` → 302
  `client_id=app-id-018a` (resolved config).
- **RLS:** end-user JWT `GET platform_settings` → `[]` (no rows).
- **Routes:** product sweep 8/8 200; `/health` 200.
- **Web:** `/settings` for admin → 200 with Integrations link; non-admin
  hub hides Integrations; non-admin `/settings/integrations` → 307
  `/settings`; anon → login redirect; admin integrations page has
  App ID but no secret values.
- Secret value scan: production build (`.next/static`,
  `.next/server`, `api/dist`) + tracked sources → 0 hits for
  service-role key, encryption key, test secret markers.

### Known limitations / honest notes

- Platform admin is **env-email allowlist only** (no platform-admin
  table/UI). Grant/revoke = edit `PLATFORM_ADMIN_EMAILS` + restart API.
  Upgrade path: `platform_admins` table when multi-admin self-serve is needed.
- Config cache is process-local; multi-instance deploy needs short TTL
  or invalidation broadcast if saves must be instant everywhere.
- `redirectUri` is intentionally not stored in DB (deployment config).
- Workspace-level IG tokens (`social_accounts`) unchanged — not part
  of platform_settings.
- Encryption key absent → secret writes 503; DB-encrypted fields
  ignored (fall back to env). Documented in `.env.example`.
- Task 019 Usage Tracking remains the next roadmap task (018 stays COMPLETE).

---

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
  E2E: `task013-probe@smmomo-test.com` — password lives only in the
  session env (`TEST_ADMIN_PASSWORD`), never in the repo (Task 020).
  Rotate that password on the hosted project (it previously appeared
  in this file).
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
