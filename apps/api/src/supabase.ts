import type { FastifyReply, FastifyRequest } from "fastify";

// Public project config — same values documented in the repo's .env.example.
// Product routes: end-user JWTs + RLS. Webhook path (016) only: service_role
// from API env (session/process env, never apps/web, never a committed file).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://etwuqthopqrzffdgvhqs.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const PROJECT_REF = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
const SESSION_COOKIE = `sb-${PROJECT_REF}-auth-token`;

export interface AuthUser {
  id: string;
  token: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
    workspaceId?: string;
  }
}

// Read the @supabase/ssr session cookie (plain or chunked `.0`/`.1`…).
// Value format: `base64-<base64url(JSON session)>` (ssr's default encoding).
function sessionAccessToken(req: FastifyRequest): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  let raw = "";
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === SESSION_COOKIE) raw = value;
    else if (name.startsWith(`${SESSION_COOKIE}.`)) raw += value;
  }
  if (!raw) return null;
  let json = raw;
  if (raw.startsWith("base64-")) {
    json = Buffer.from(raw.slice(7), "base64url").toString("utf8");
  }
  try {
    const parsed = JSON.parse(json) as { access_token?: string };
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

// Verify the access token with Auth (`GET /auth/v1/user`).
// Sends 401 and returns null when the caller has no valid session.
export async function requireUser(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  const token = sessionAccessToken(req);
  if (!token) {
    await reply
      .code(401)
      .send({ statusCode: 401, error: "Unauthorized", message: "Sign in required" });
    return null;
  }
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    req.log.error({ err }, "auth lookup failed");
    await reply
      .code(502)
      .send({ statusCode: 502, error: "Bad Gateway", message: "Auth service unreachable" });
    return null;
  }
  if (!res.ok) {
    await reply
      .code(401)
      .send({ statusCode: 401, error: "Unauthorized", message: "Session expired" });
    return null;
  }
  const user = (await res.json()) as { id?: string };
  if (!user.id) {
    await reply
      .code(401)
      .send({ statusCode: 401, error: "Unauthorized", message: "Session expired" });
    return null;
  }
  return { id: user.id, token };
}

// PostgREST call with the caller's JWT (RLS scopes the rows) + publishable key.
export async function rest<T>(
  user: AuthUser,
  path: string,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<{ status: number; data: T | null; errorCode: string | null }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${user.token}`,
    "Content-Type": "application/json",
  };
  if (init?.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

  if (!res.ok) {
    let errorCode: string | null = null;
    try {
      const body = (await res.json()) as { code?: string };
      errorCode = body.code ?? null;
    } catch {
      // non-JSON error body (e.g. HTML gateway page) — status alone is enough
    }
    return { status: res.status, data: null, errorCode };
  }
  // 204 / empty body (DELETE without Prefer: return) — no JSON to parse.
  if (res.status === 204) {
    return { status: res.status, data: null, errorCode: null };
  }
  const text = await res.text();
  if (!text) {
    return { status: res.status, data: null, errorCode: null };
  }
  return { status: res.status, data: JSON.parse(text) as T, errorCode: null };
}

// Service-role PostgREST (webhook engine path only — bypasses RLS by design).
// Key must come from API process env; absent key → explicit 503, never anon fallback.
export function serviceEnabled(): boolean {
  return Boolean(SUPABASE_SERVICE_ROLE_KEY);
}

export async function restService<T>(
  path: string,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<{ status: number; data: T | null; errorCode: string | null }> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return { status: 503, data: null, errorCode: "service_key_missing" };
  }
  const headers: Record<string, string> = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (init?.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    let errorCode: string | null = null;
    try {
      const body = (await res.json()) as { code?: string };
      errorCode = body.code ?? null;
    } catch {
      // non-JSON error body — status alone is enough
    }
    return { status: res.status, data: null, errorCode };
  }
  if (res.status === 204) {
    return { status: res.status, data: null, errorCode: null };
  }
  const text = await res.text();
  if (!text) {
    return { status: res.status, data: null, errorCode: null };
  }
  return { status: res.status, data: JSON.parse(text) as T, errorCode: null };
}

// Idempotent first-run workspace + owner membership (migration 014 RPC).
// Runs once per authenticated request (cheap after the first call — select
// + return). ponytail: per-request, not cached; cache if hop latency matters.
export async function ensureWorkspace(user: AuthUser): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bootstrap_workspace`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`workspace bootstrap failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const ws = await res.json();
  if (typeof ws !== "string" || ws.length === 0) {
    throw new Error("workspace bootstrap returned no workspace id");
  }
  return ws;
}

export function authed(req: FastifyRequest): AuthUser {
  if (!req.user) {
    // Programming error: auth preHandler did not run for this route.
    throw new Error("missing authenticated user on request");
  }
  return req.user;
}
