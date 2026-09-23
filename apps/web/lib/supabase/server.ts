import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (server components / route handlers).
// Publishable key only — no service_role key exists in the web app.
// Sessions/cookies are intentionally not wired yet: authentication is still
// mock-only (Task 013 adds Supabase auth, likely via @supabase/ssr). Until
// then every query is anonymous and Row Level Security returns zero private
// rows — that is the security model working, not a bug.
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
