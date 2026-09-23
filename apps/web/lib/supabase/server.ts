import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "./cookie-options";

// Server-side Supabase client (server components / route handlers).
// Cookie-backed session via @supabase/ssr; publishable key only — no
// service_role/secret key exists in the web app. Row Level Security is
// the isolation boundary: without a signed-in member, queries return
// zero private rows.
export async function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    // Shared options (Task 022): SameSite=Lax, Secure in prod, optional
    // Domain for split-subdomain deployments (NEXT_PUBLIC_COOKIE_DOMAIN).
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot set cookies — proxy.ts refreshes the
          // session on every request, so token rotation still lands there.
        }
      },
    },
  });
}
