import { createBrowserClient } from "@supabase/ssr";

// Browser-safe Supabase client (cookie sessions via @supabase/ssr).
// Uses the publishable key only — never a service_role/secret key (those
// stay in a backend, never in this repo's client code). Lazy factory:
// throws only if actually used without env configured.
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  return createBrowserClient(url, key, {
    cookieOptions:
      process.env.NODE_ENV === "production"
        ? { secure: true, sameSite: "lax" }
        : { sameSite: "lax" },
  });
}
