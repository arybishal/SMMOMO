"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

// Map Supabase signup errors to safe copy — never surface raw provider text.
function friendlySignupError(err: { message?: string; code?: string }): string {
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (
    code === "email_exists" ||
    msg.includes("already registered") ||
    msg.includes("already been registered")
  ) {
    return "An account with this email already exists. Try signing in.";
  }
  if (code === "weak_password" || msg.includes("password should be at least")) {
    return "Password is too weak — use at least 8 characters.";
  }
  if (
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    msg.includes("rate limit")
  ) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (code === "validation_failed" || msg.includes("invalid email")) {
    return "Enter a valid email address.";
  }
  return "Something went wrong — try again.";
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Hosted project has "Confirm email" ON — signup without a session means
  // the confirmation email is the real next step (no fake dashboard push).
  const [confirmationSent, setConfirmationSent] = useState(false);

  if (confirmationSent) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-card border border-border bg-surface p-8 shadow-card">
          <p className="mb-3 inline-flex items-center rounded-pill bg-info-soft px-2 py-0.5 text-xs font-medium text-info-strong ring-1 ring-inset ring-info/20">
            Check your email
          </p>
          <h1 className="text-lg font-semibold text-foreground">
            Confirm your email
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to finish creating your account.
            Open it to activate your account, then sign in.
          </p>
          <p className="mt-3 text-xs text-subtle-foreground">
            The link opens a clear <strong>Email verified</strong> page when
            it works. Didn&apos;t get it? Check spam, or sign up again with
            the same address to resend.
          </p>
          <Link
            href="/login"
            className={`${buttonClasses("primary")} mt-6 w-full`}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-card border border-border bg-surface p-8 shadow-card">
        <h1 className="text-lg font-semibold text-foreground">
          Create your account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start turning comments into conversations.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setPending(true);
            const form = new FormData(e.currentTarget);
            try {
              const { data, error: err } = await getBrowserSupabase().auth.signUp({
                email: String(form.get("email") ?? ""),
                password: String(form.get("password") ?? ""),
                options: {
                  data: { name: String(form.get("name") ?? "") },
                },
              });
              if (err) {
                setError(friendlySignupError(err));
                setPending(false);
                return;
              }
              if (data.session) {
                // Auto-confirm enabled someday → straight in.
                router.push("/dashboard");
                router.refresh();
                return;
              }
              setConfirmationSent(true);
            } catch {
              setError("Something went wrong — try again.");
              setPending(false);
            }
          }}
        >
          {error && (
            <p
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
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
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:text-primary-hover"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
