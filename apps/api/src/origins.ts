// Central origin configuration (Task 022). Every server-side origin string
// resolves here — meta OAuth redirects, webhook subscribe callback, CORS
// allowlist, and production config checks. Development localhost defaults
// stay; production replaces them via env. Never derive origins from request
// Origin/Host headers.

const CALLBACK_PATH = "/social-accounts/instagram/callback";

export function webOrigin(): string {
  return process.env.WEB_ORIGIN ?? "http://localhost:3000";
}

export function apiOrigin(): string {
  return process.env.API_ORIGIN ?? `http://localhost:${process.env.PORT ?? "4000"}`;
}

/**
 * Exact-match CORS allowlist for credentialed browser requests.
 * CORS_ORIGIN = comma-separated origins (e.g. https://app.example.com,https://www.example.com).
 * Unset → WEB_ORIGIN (the configured frontend). Never `*`.
 */
export function corsAllowlist(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) return [webOrigin()];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function resolveRedirectUri(): string {
  return process.env.META_REDIRECT_URI ?? `${apiOrigin()}${CALLBACK_PATH}`;
}

export function webhookCallbackUrl(): string {
  return `${apiOrigin()}/webhooks/instagram`;
}

/**
 * Production-only config check. Logs missing *names* only — never values.
 * Returns the missing list so callers can decide whether to warn or fail.
 * Development: returns [] (localhost defaults are intentional).
 */
export function missingProductionConfig(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  const required = [
    "WEB_ORIGIN",
    "API_ORIGIN",
    "CORS_ORIGIN",
    "SUPABASE_SERVICE_ROLE_KEY",
    "PLATFORM_ENCRYPTION_KEY",
    "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ];
  const missing: string[] = [];
  for (const key of required) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  return missing;
}

export { CALLBACK_PATH };
