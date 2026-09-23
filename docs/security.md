# SMMOMO Security Model

Concise reference for how security works in this repo. **No secrets are documented here.**

## Origin architecture (Task 022)

Single source for every server-side origin string: `apps/api/src/origins.ts`.

| Consumer | Resolution |
|---|---|
| Primary frontend origin | `WEB_ORIGIN` (default `http://localhost:3000`) — OAuth post-redirect only |
| Public API origin | `API_ORIGIN` (default `http://localhost:${PORT\|\|4000}`) — OAuth callback + webhook base |
| CORS allowlist | `CORS_ORIGIN` comma-separated exact origins; unset → `WEB_ORIGIN` |
| Instagram OAuth `redirect_uri` | `META_REDIRECT_URI` ?? `API_ORIGIN` + `/social-accounts/instagram/callback` |
| Meta webhook subscribe callback | `API_ORIGIN` + `/webhooks/instagram` |
| Frontend API base | `NEXT_PUBLIC_API_URL` (`apps/web/lib/api/client.ts` `API_BASE`) — only web-side origin seam |
| Supabase URL | `NEXT_PUBLIC_SUPABASE_URL` (client-safe publishable) |

Production never trusts browser `Origin`/`Host` headers for redirects or allowlists. `missingProductionConfig()` runs at API boot (`NODE_ENV=production` only) and logs **missing names only** — never values. `npx tsx apps/api/scripts/validate-config.ts` is the same check for CI/scripts.

### CORS model

- Exact string match (`Set.has`) — no `startsWith`/prefix, no `*`, no `null` origin allowance.
- `credentials: true` so cookie sessions work cross-origin (frontend origin ≠ API origin).
- Missing `Origin` (Meta webhook, curl, server-to-server): request proceeds **without** CORS headers — browser cannot read the response (correct); server-to-server is unaffected.
- Unknown/suffix-spoof origin (`https://evil.example`, `https://localhost:3000.evil.com`): no `Access-Control-Allow-Origin` → browser blocks.
- Preflight (`OPTIONS`): allowed → 200/204 + ACAO; disallowed → no ACAO.
- Covered by `apps/api/scripts/validate-security.mjs` (Task 022 CORS block).

### Cookie / session model

| Env | Cookie | Notes |
|---|---|---|
| localhost | Host-scoped, no `Domain`, `SameSite=Lax`, no `Secure` | Port-agnostic: `:3000` session is sent to `:4000` |
| Production, API on same host as web | Same as above + `Secure` | Host-only cookie reaches the reverse-proxied API path |
| Production, API on different subdomain | `Domain=.example.com` (or shared eTLD+1), `SameSite=Lax`, `Secure` | Set via `NEXT_PUBLIC_COOKIE_DOMAIN` (browser-safe, not a secret) |

- Shared options: `apps/web/lib/supabase/cookie-options.ts` (`sessionCookieOptions()`) used by browser client, server client, and `proxy.ts`.
- `SameSite=Lax` is intentional: `app.example.com` → `api.example.com` is same-site (same eTLD+1), so Lax cookies ride credentialed fetches. **Do not** switch to `SameSite=None` unless the API moves to a **different registrable domain** (cross-site).
- `HttpOnly` comes from `@supabase/ssr` defaults. Host-only cookies (no Domain) are never sent to other hosts — no accidental super-cookie in development.

## Authentication model

- Browser session = Supabase Auth cookie (`sb-<ref>-auth-token`) set by `@supabase/ssr` (`SameSite=Lax`; `Secure` when `NODE_ENV=production`; optional `Domain` via `NEXT_PUBLIC_COOKIE_DOMAIN`).
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

Service-role is imported only by `webhooks.ts`, `engine.ts`, `delivery.ts`, `usage.ts`, `platform-config.ts`, `meta.ts` (OAuth token upsert), and the one-shot token scripts under `apps/api/scripts/`. Absent key → explicit 503, never anon fallback.

## Service-role usage (why)

- **Webhooks:** persist comments for Meta events (no user session).
- **Engine:** claim matched comments + enqueue deliveries idempotently.
- **Delivery worker:** claim/send/finalize deliveries; read IG tokens for Graph sends.
- **Usage events:** idempotent billing-layer inserts (Task 019).
- **Platform settings:** read/write encrypted Meta config (Task 018A).
- **OAuth connect:** encrypt + upsert `social_accounts.access_token` (Task 021).

Each path does its own workspace/validation lookups because RLS is bypassed.

## RLS model

- All application tables have RLS enabled; **no** `using (true)` policies.
- SELECT policies: membership-scoped. Writes: membership INSERT/UPDATE/DELETE where product needs them; `comments`/`deliveries`/`usage_events`/`platform_settings` writes are service-role only (or no policies).
- `workspace_members` has **no** authenticated INSERT/UPDATE/DELETE — roles only via `bootstrap_workspace()` SECURITY DEFINER RPC.
- `social_accounts` column-level SELECT: members can read profile columns only; `access_token` / `ig_user_id` / `token_expires_at` are not SELECT-able by `authenticated` (migration `20260923230000`).
- `social_accounts` has **no** member INSERT/UPDATE (Task 021, migration `20260924000000`) — only service-role OAuth upsert and member DELETE (disconnect).
- Triggers block `workspace_id` reassignment on UPDATE for `automations` and `social_accounts` (migration `20260923230000`).
- `automations` → `posts` is a **composite FK** on `(workspace_id, post_id)` (migration `20260924000000`) so a member cannot bind an automation to another workspace's post; `ON DELETE CASCADE` is intentional (automation never exists without its post; disconnect cascade removes posts → automations).
- Unique `(workspace_id, platform)` on `social_accounts` — one Instagram connection per workspace.

## Webhook verification

- `GET /webhooks/instagram`: timing-safe compare of `hub.verify_token` vs resolved config; challenge echoed as `text/plain`.
- `POST /webhooks/instagram`: HMAC-SHA256 `X-Hub-Signature-256` over **raw body** with `timingSafeEqual` before any DB work; invalid → 403.
- Idempotent: comment unique `(workspace_id, ig_comment_id)`; usage unique `(workspace_id, event_type, idempotency_key)`; engine claim on `matched=false`; delivery claim on `status=queued`.
- Workspace derived from `ig_user_id` → `social_accounts` lookup (never client-supplied).

## OAuth / token handling

- State = HMAC-SHA256(user.id + expiry) with app secret; callback verifies against current session user + 10-minute TTL.
- Access tokens exchanged/stored **server-side only**; browser only receives `?oauth=connected|denied|…` flags.
- `redirect_uri` comes from `origins.ts` / `META_REDIRECT_URI` (not admin-editable free text, never request Origin).
- Platform Meta App Secret + webhook verify token encrypted at rest (AES-256-GCM, `PLATFORM_ENCRYPTION_KEY`); GET returns configured flags only.

### IG access tokens at rest (Task 021)

- `social_accounts.access_token` is encrypted with the same AES-256-GCM envelope as platform secrets (`apps/api/src/crypto.ts`, format `v1.<iv>.<tag>.<ct>` base64url).
- Writes: OAuth callback `upsertConnection` uses service-role + `encryptSecret` — never plaintext. Missing `PLATFORM_ENCRYPTION_KEY` → explicit 503, never a silent plaintext fallback.
- Reads: only `delivery.ts` resolves tokens (`resolveAccessToken`). Prefixed `v1.` → decrypt (auth tag verified; tamper/wrong key → null). Legacy plaintext rows are used once and re-encrypted in place (one-way migration toward ciphertext).
- Members: no INSERT/UPDATE on `social_accounts` (migration `20260924000000`); column SELECT already hides token columns (migration `20260923230000`). DELETE (disconnect) remains.
- Migration + verification: `apps/api/scripts/encrypt-ig-tokens.ts` (idempotent, `plaintextLeft` must be 0), `apps/api/scripts/validate-tokens.ts` (roundtrip + malformed/tampered/wrong-key → null + DB all-`v1.` probe).
- Graph error text is sanitized (`sanitizeGraphError`) before persist so Bearer tokens never land in `deliveries.error`.

## Usage-event security

- Writes: service-role only; clients cannot INSERT/UPDATE/DELETE `usage_events`.
- Reads: end-user JWT + RLS; summary never accepts a workspace id from the client.
- Deterministic idempotency keys (`comment:{id}`, `delivery:{id}`); DB unique constraint is the final guard.

## Security headers

- **Next** (`next.config.ts`): `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; HSTS in production builds; full CSP (always-on, Task 021).
- **Fastify** (`onSend`): `x-content-type-options`, `referrer-policy`, `x-frame-options`.
- Fastify `setErrorHandler`: 5xx responses are generic (no stack traces to clients).

### CSP inventory (Task 021)

Asset sources were inventoried before locking the policy (documented in `next.config.ts` comments):

| Directive | Value | Why |
|---|---|---|
| `default-src` | `'self'` | baseline |
| `script-src` | `'self'` `'unsafe-inline'` | Next.js RSC/hydration inline bootstrap (no third-party scripts today) |
| `style-src` | `'self'` `'unsafe-inline'` | styled-jsx / Tailwind runtime |
| `img-src` | `'self'` `data:` `blob:` `https:` | favicons, user media, future OG images |
| `font-src` | `'self'` `data:` | `next/font` self-hosted Geist |
| `connect-src` | `'self'` + Supabase URL + API origin | browser Supabase client + `NEXT_PUBLIC_API_URL` |
| `frame-ancestors` | `'none'` | clickjacking (pairs with `X-Frame-Options: DENY`) |
| `object-src` | `'none'` | plugins |
| `form-action` | `'self'` | forms |
| `base-uri` | `'self'` | base-tag injection |
| HSTS | prod builds only | mixed-content / downgrade |

Adding a third-party script/CDN requires updating `next.config.ts` and this table in the same change.

## Rate limiting status

- In-process fixed-window limiter on `POST /webhooks/*` (60/min/IP), non-GET `/admin/*` (30/min/IP), and Instagram OAuth connect/callback (20/min/IP). Map key cap 10,000 (clear-on-full) to bound memory.
- Login/signup rate limits are Supabase Auth–side (hosted defaults).
- **Production multi-instance:** the in-process limiter is per-process — use a shared store (Redis / edge WAF) when scaling horizontally. Redis stays reserved-only in `.env.example` until multi-instance is real.

## Input validation

- UUID path params validated before PostgREST; automation status enum whitelist; usage date range regex + order check; free-text length caps (name/keyword/replies).
- No client-supplied sort/filter column names reach PostgREST order clauses.

## Known follow-up security work

| Item | Severity | Notes |
|---|---|---|
| Shared rate-limit store | medium | Required for multi-instance production (single instance today). |
| Key rotation for `PLATFORM_ENCRYPTION_KEY` | medium | Envelope is versioned (`v1.`) for multi-key rotation, but no dual-key decrypt window is implemented yet — rotate by re-encrypting all rows while both keys are accepted. |
| Stuck `processing` delivery reclaim | low | Operator-driven today; not a security boundary. |
| `script-src 'unsafe-inline'` | low | Required by Next.js inline bootstrap; revisit with nonce-based CSP if a stricter posture is needed. |

## Resolved (Task 021)

| Item | Former severity | Resolution |
|---|---|---|
| IG token encryption-at-rest | medium | AES-256-GCM `v1.` envelope; migration + lazy re-encrypt; member INSERT/UPDATE revoked. |
| Full CSP | low | Always-on CSP in `next.config.ts` from real asset inventory. |
| `automations.post_id` cross-workspace FK | low | Composite FK `(workspace_id, post_id) → posts(workspace_id, id)` + unique posts target; member UPDATE on `social_accounts` revoked. |
| Unique Instagram connection | low | Unique index `(workspace_id, platform)`; duplicate probe rows cleaned before apply. |

## Production deployment requirements

1. Set `NODE_ENV=production` (enables HSTS + secure cookies).
2. Strong `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_ENCRYPTION_KEY`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` via secret manager — never in repo or web env.
3. Set origin envs together (see Origin architecture): `WEB_ORIGIN`, `API_ORIGIN`, `CORS_ORIGIN` (comma-separated exact origins), `NEXT_PUBLIC_API_URL`; `NEXT_PUBLIC_COOKIE_DOMAIN` when API is a different subdomain.
4. Run `npx tsx apps/api/scripts/validate-config.ts` — exit 0 and no missing names before traffic.
5. HTTPS only at the edge; HSTS from Next headers.
6. Confirm Supabase Auth URL/redirect config for the production origin (`/auth/confirm`).
7. Rotate any credentials that ever lived in test scripts or local shells (including any password that appeared in TASK.md history).
8. Run `npx tsx apps/api/scripts/encrypt-ig-tokens.ts` once per environment after deploying Task 021 (idempotent); `validate-tokens.ts` must report `plaintextLeft=0`.
9. If rotating `PLATFORM_ENCRYPTION_KEY`: plan a dual-key decrypt window (not implemented) or re-encrypt while the old key is still available.
