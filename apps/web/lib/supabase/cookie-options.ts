import type { CookieOptions } from "@supabase/ssr";

// Shared Supabase session cookie options (Task 022).
// SameSite=Lax: localhost is one host (port-agnostic); production
// app.example.com → api.example.com is same-site (same eTLD+1), so Lax
// cookies ride credentialed fetches without SameSite=None. Secure only
// in production (localhost is http — secure would drop the cookie).
// Domain: only when NEXT_PUBLIC_COOKIE_DOMAIN is set (e.g. `.example.com`)
// so a host-only cookie set by the frontend is also sent to the API
// subdomain. Leave empty in localhost — host-only already spans ports.
export function sessionCookieOptions(): CookieOptions {
  const opts: CookieOptions = { sameSite: "lax" };
  if (process.env.NODE_ENV === "production") opts.secure = true;
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim();
  if (domain) opts.domain = domain;
  return opts;
}
