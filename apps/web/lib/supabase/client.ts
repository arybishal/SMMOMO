import { createClient } from "@supabase/supabase-js";

// Browser-safe Supabase client. Uses the publishable key only — never a
// service_role/secret key (those stay server-side in a backend, never in
// this repo's client code). Lazy factory: throws only if actually used
// without env configured (mock mode never calls it).
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example)",
    );
  }
  return createClient(url, key);
}
