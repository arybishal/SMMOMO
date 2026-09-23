"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Only same-origin app paths; never another origin or the auth pages
// themselves (avoids redirect loops).
function safeNext(raw: string | null): string {
  if (
    raw &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.startsWith("/login") &&
    !raw.startsWith("/register")
  ) {
    return raw;
  }
  return "/dashboard";
}

// Map Supabase auth errors to safe, user-facing copy. Never surface raw
// implementation details (stack codes, provider messages).
function friendlyLoginError(err: {
  message?: string;
  code?: string;
}): { message: string; unconfirmed?: boolean } {
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials") ||
    code === "user_not_found" ||
    msg.includes("user not found")
  ) {
    return { message: "Invalid email or password." };
  }
  if (
    code === "email_not_confirmed" ||
    msg.includes("email not confirmed") ||
    msg.includes("email_not_confirmed")
  ) {
    return {
      message:
        "Your email hasn't been confirmed yet. Open the confirmation link we sent you, or resend it below.",
      unconfirmed: true,
    };
  }
  if (
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    msg.includes("rate limit")
  ) {
    return {
      message: "Too many attempts. Wait a moment and try again.",
    };
  }
  return { message: "Something went wrong — try again." };
}

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [resendState, setResendState] = useState<
    { kind: "idle" | "pending" | "sent" | "failed"; message?: string }
  >({ kind: "idle" });
  const lastEmailRef = useRef("");
  const banner =
    searchParams.get("verified") === "1"
      ? "Email verified — you can sign in to continue."
      : null;

  async function resendConfirmation(email: string) {
    if (!email || resendState.kind === "pending") return;
    setResendState({ kind: "pending" });
    const { error: err } = await getBrowserSupabase().auth.resend({
      type: "signup",
      email,
    });
    if (err) {
      setResendState({
        kind: "failed",
        message: "Could not resend right now. Try again shortly.",
      });
      return;
    }
    setResendState({
      kind: "sent",
      message: "Confirmation email sent. Check your inbox.",
    });
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-card border border-border bg-surface p-8 shadow-card">
        <h1 className="text-lg font-semibold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to manage your automations.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setUnconfirmed(false);
            setResendState({ kind: "idle" });
            setPending(true);
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email") ?? "");
            lastEmailRef.current = email;
            try {
              const { error: err } =
                await getBrowserSupabase().auth.signInWithPassword({
                  email,
                  password: String(form.get("password") ?? ""),
                });
              if (err) {
                const friendly = friendlyLoginError(err);
                setError(friendly.message);
                setUnconfirmed(Boolean(friendly.unconfirmed));
                setPending(false);
                return;
              }
              const next = safeNext(
                new URLSearchParams(window.location.search).get("next"),
              );
              router.push(next);
              router.refresh();
            } catch {
              setError("Something went wrong — try again.");
              setPending(false);
            }
          }}
        >
          {banner && (
            <p
              role="status"
              className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong"
            >
              {banner}
            </p>
          )}
          {error && (
            <div className="space-y-2">
              <p
                role="alert"
                className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
              >
                {error}
              </p>
              {unconfirmed && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={resendState.kind === "pending"}
                    onClick={() => {
                      void resendConfirmation(lastEmailRef.current);
                    }}
                  >
                    {resendState.kind === "pending"
                      ? "Sending…"
                      : "Resend confirmation email"}
                  </Button>
                  {resendState.message && (
                    <p className="text-xs text-muted-foreground">
                      {resendState.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:text-primary-hover"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
