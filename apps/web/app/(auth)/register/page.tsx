"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

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
          <h1 className="text-lg font-semibold text-foreground">
            Check your email
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a confirmation link to finish creating your account.
            Confirm it, then sign in.
          </p>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-hover"
            >
              Go to sign in
            </Link>
          </p>
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
                setError(err.message);
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
