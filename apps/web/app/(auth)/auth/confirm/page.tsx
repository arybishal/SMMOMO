"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Status = "working" | "verified" | "already" | "expired";

// Processes Supabase email-confirmation results (PKCE ?code= or implicit
// #access_token=) and shows an explicit verified / already / expired state.
// Success is only reported after Auth actually yields a confirmed session.
export default function AuthConfirmPage() {
  const [status, setStatus] = useState<Status>("working");

  useEffect(() => {
    let cancelled = false;
    const finish = (s: Status) => {
      if (!cancelled) setStatus(s);
    };
    (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { search, hash } = window.location;
        const sp = new URLSearchParams(search);
        const hp = new URLSearchParams(
          hash.startsWith("#") ? hash.slice(1) : hash,
        );

        const urlError =
          sp.get("error") ??
          sp.get("error_description") ??
          hp.get("error") ??
          hp.get("error_description") ??
          hp.get("error_code");
        const code = sp.get("code");
        const accessToken = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");

        if (urlError) {
          finish("expired");
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            finish(error ? "already" : "verified");
            return;
          }
          finish("expired");
          return;
        }

        if (accessToken && refreshToken) {
          // detectSessionInUrl may already have applied these; setSession is
          // idempotent enough for a re-apply and covers the missed case.
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (!error) {
            finish("verified");
            return;
          }
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user?.email_confirmed_at) {
            finish("already");
            return;
          }
          finish("expired");
          return;
        }

        // No callback params: already signed in and confirmed (re-open)?
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user?.email_confirmed_at) {
          finish("already");
          return;
        }
        finish("expired");
      } catch {
        finish("expired");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-card border border-border bg-surface p-8 shadow-card">
        {status === "working" && (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Confirming your email…
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Hang tight while we activate your SMMOMO account.
            </p>
          </>
        )}

        {status === "verified" && (
          <>
            <p className="mb-3 inline-flex items-center rounded-pill bg-success-soft px-2 py-0.5 text-xs font-medium text-success-strong ring-1 ring-inset ring-success/20">
              Success
            </p>
            <h1 className="text-lg font-semibold text-foreground">
              Email verified
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your SMMOMO account is now active. You can sign in to continue.
            </p>
            <Link
              href="/login?verified=1"
              className={`${buttonClasses("primary")} mt-6 w-full`}
            >
              Continue to login
            </Link>
          </>
        )}

        {status === "already" && (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Already verified
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This email is already confirmed. Sign in to continue to your
              account.
            </p>
            <Link
              href="/login"
              className={`${buttonClasses("primary")} mt-6 w-full`}
            >
              Continue to login
            </Link>
          </>
        )}

        {status === "expired" && (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Confirmation link expired
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your confirmation link is no longer valid. Request a new
              confirmation email and try again.
            </p>
            <Link
              href="/register"
              className={`${buttonClasses("primary")} mt-6 w-full`}
            >
              Request a new email
            </Link>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-primary hover:text-primary-hover"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
