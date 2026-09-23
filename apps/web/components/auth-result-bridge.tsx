"use client";

import { useEffect } from "react";

// Supabase confirmation emails may land on Site URL (/) with PKCE ?code=
// or implicit #access_token=… still in the URL. No other page consumes
// those params, so the session was never established and the user saw no
// verified state. Forward auth-result URLs to /auth/confirm (same origin,
// preserves query + hash) without touching normal visits.
export function AuthResultBridge() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/auth/confirm")) return;
    const { search, hash } = window.location;
    const hp = new URLSearchParams(
      hash.startsWith("#") ? hash.slice(1) : hash,
    );
    const sp = new URLSearchParams(search);
    const isAuthResult =
      sp.has("code") ||
      sp.has("error") ||
      sp.has("error_description") ||
      hp.has("access_token") ||
      hp.has("refresh_token") ||
      hp.has("error") ||
      hp.has("error_description") ||
      hp.has("error_code");
    if (isAuthResult) {
      window.location.replace(`/auth/confirm${search}${hash}`);
    }
  }, []);
  return null;
}
