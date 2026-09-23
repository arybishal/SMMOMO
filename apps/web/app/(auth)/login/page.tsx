"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
            setPending(true);
            const form = new FormData(e.currentTarget);
            try {
              const { error: err } = await getBrowserSupabase().auth.signInWithPassword({
                email: String(form.get("email") ?? ""),
                password: String(form.get("password") ?? ""),
              });
              if (err) {
                setError(err.message);
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
          {error && (
            <p
              role="alert"
              className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          )}
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
