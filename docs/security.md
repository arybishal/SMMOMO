# SMMOMO Security Model

Concise reference for how security works in this repo. **No secrets are documented here.**

## Authentication model

- Browser session = Supabase Auth cookie (`sb-<ref>-auth-token`) set by `@supabase/ssr` (`SameSite=Lax`; `Secure` when `NODE_ENV=production`).
- Fastify `preHandler` (`apps/api/src/app.ts`) resolves the cookie → verifies the JWT with `GET /auth/v1/user` → ensures a workspace via `bootstrap_workspace()` RPC. Failures → 401/500 with generic messages.
- Route exemptions (intentional): `GET /health`, Instagram OAuth callback (auth inline), `/webhooks/*` (HMAC + service-role gate).
- Platform admin = env `PLATFORM_ADMIN_EMAILS` checked server-side after session auth (`apps/api/src/admin.ts`). No client-supplied admin flag.

## Authorization model

- Identity and workspace always come from the **server session**, never from body/query/params.
- Every product mutation sets `workspace_id` from `req.workspaceId` (session-derived).
- Row access is gated by **Postgres RLS** using `is_workspace_member(workspace_id)`.

## Supabase client types

| Client | Where | Credentials |
|---|---|---|
| Browser | `apps/web/lib/supabase/client.ts` | Publishable key only |
| Web server / proxy | `apps/web/lib/supabase/server.ts`, `proxy.ts` | Publishable key + cookies |
| API user context | `apps/api/src/supabase.ts` `rest()` | Caller JWT + publishable key → RLS |
| API service-role | `apps/api/src/supabase.ts` `restService()` | `SUPABASE_SERVICE_ROLE_KEY` (API env only) |

Service-role is imported only by `webhooks.ts`, `engine.ts`, `delivery.ts`, `usage.ts`, `platform-config.ts`. Absent key → explicit 503, never anon fallback.

## Service-role usage (why)

- **Webhooks:** persist comments for Meta events (no user session).
- **Engine:** claim matched comments + enqueue deliveries idempotently.
- **Delivery worker:** claim/send/finalize deliveries; read IG tokens for Graph sends.
- **Usage events:** idempotent billing-layer inserts (Task 019).
- **Platform settings:** read/write encrypted Meta config (Task 018A).

Each path does its own workspace/validation lookups because RLS is bypassed.

## RLS model

- All application tables have RLS enabled; **no** `using (true)` policies.
- SELECT policies: membership-scoped. Writes: membership INSERT/UPDATE/DELETE where product needs them; `comments`/`deliveries`/`usage_events`/`platform_settings` writes are service-role only (or no policies).
- `workspace_members` has **no** authenticated INSERT/UPDATE/DELETE — roles only via `bootstrap_workspace()` SECURITY DEFINER RPC.
- `social_accounts` column-level SELECT: members can read profile columns only; `access_token` / `ig_user_id` / `token_expires_at` are not SELECT-able by `authenticated` (migration `20260923230000`).
- Triggers block `workspace_id` reassignment on UPDATE for `automations` and `social_accounts` (same migration).

## Webhook verification

- `GET /webhooks/instagram`: timing-safe compare of `hub.verify_token` vs resolved config; challenge echoed as `text/plain`.
- `POST /webhooks/instagram`: HMAC-SHA256 `X-Hub-Signature-256` over **raw body** with `timingSafeEqual` before any DB work; invalid → 403.
- Idempotent: comment unique `(workspace_id, ig_comment_id)`; usage unique `(workspace_id, event_type, idempotency_key)`; engine claim on `matched=false`; delivery claim on `status=queued`.
- Workspace derived from `ig_user_id` → `social_accounts` lookup (never client-supplied).

## OAuth / token handling

- State = HMAC-SHA256(user.id + expiry) with app secret; callback verifies against current session user + 10-minute TTL.
- Access tokens exchanged/stored **server-side only**; browser only receives `?oauth=connected|denied|…` flags.
- `redirect_uri` comes from env/config (not admin-editable free text).
- Platform Meta App Secret + webhook verify token encrypted at rest (AES-256-GCM, `PLATFORM_ENCRYPTION_KEY`); GET returns configured flags only.

## Usage-event security

- Writes: service-role only; clients cannot INSERT/UPDATE/DELETE `usage_events`.
- Reads: end-user JWT + RLS; summary never accepts a workspace id from the client.
- Deterministic idempotency keys (`comment:{id}`, `delivery:{id}`); DB unique constraint is the final guard.

## Security headers

- **Next** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; HSTS in production builds.
- **Fastify** (`onSend`): `x-content-type-options`, `referrer-policy`, `x-frame-options`.
- Fastify `setErrorHandler`: 5xx responses are generic (no stack traces to clients).

## Rate limiting status

- In-process fixed-window limiter on `POST /webhooks/*` (60/min/IP) and non-GET `/admin/*` (30/min/IP).
- Login/signup rate limits are Supabase Auth–side (hosted defaults).
- **Production multi-instance:** the in-process limiter is per-process — use a shared store (Redis / edge WAF) when scaling horizontally.

## Input validation

- UUID path params validated before PostgREST; automation status enum whitelist; usage date range regex + order check; free-text length caps (name/keyword/replies).
- No client-supplied sort/filter column names reach PostgREST order clauses.

## Known follow-up security work

| Item | Severity | Notes |
|---|---|---|
| IG token encryption-at-rest in `social_accounts` | medium | Tokens are column-hidden from members but stored plaintext; add app-level encryption when a key-management path exists. |
| Shared rate-limit store | medium | Required for multi-instance production. |
| Full CSP | low | Needs inventory of any future third-party scripts/fonts before locking down. |
| Stuck `processing` delivery reclaim | low | Operator-driven today; not a security boundary. |
| `automations.post_id` cross-workspace FK | low | Referential tidiness only — RLS still hides foreign posts. |

## Production deployment requirements

1. Set `NODE_ENV=production` (enables HSTS + secure cookies).
2. Strong `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_ENCRYPTION_KEY`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` via secret manager — never in repo or web env.
3. Restrict `CORS_ORIGIN` to the real web origin.
4. HTTPS only at the edge; HSTS from Next headers.
5. Confirm Supabase Auth URL/redirect config for the production origin (`/auth/confirm`).
6. Rotate any credentials that ever lived in test scripts or local shells.
