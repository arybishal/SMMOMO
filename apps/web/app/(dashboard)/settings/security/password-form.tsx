"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

// Client-side strength signal only — the real gate is Supabase Auth's own
// password policy (server-side). Current password is verified by a real
// password sign-in before the update; the password never touches our API.
function strength(password: string): {
  score: number;
  label: string;
  className: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  if (password === "") return { score: 0, label: "", className: "" };
  const levels = [
    { label: "Very weak", className: "bg-danger" },
    { label: "Weak", className: "bg-danger" },
    { label: "Fair", className: "bg-warning" },
    { label: "Good", className: "bg-info" },
    { label: "Strong", className: "bg-success" },
    { label: "Strong", className: "bg-success" },
  ];
  const level = levels[score];
  return {
    score,
    label: level.label,
    className: level.className,
  };
}

function PasswordField({
  id,
  label,
  autoComplete,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  autoComplete: string;
  hint?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={8}
          required
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 px-3"
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? "Hide" : "Show"}
        </Button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

export function PasswordForm({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const [meter, setMeter] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });

    const form = e.target as HTMLFormElement;
    const current = (form.elements.namedItem("current-password") as HTMLInputElement)
      .value;
    const next = (form.elements.namedItem("new-password") as HTMLInputElement)
      .value;
    const confirm = (
      form.elements.namedItem("confirm-password") as HTMLInputElement
    ).value;

    if (next.length < 8) {
      setStatus({
        kind: "error",
        message: "New password must be at least 8 characters.",
      });
      return;
    }
    if (next !== confirm) {
      setStatus({ kind: "error", message: "Passwords don't match." });
      return;
    }
    if (next === current) {
      setStatus({
        kind: "error",
        message: "New password must be different from your current one.",
      });
      return;
    }

    setPending(true);
    try {
      const supabase = getBrowserSupabase();
      // Real current-password check (Supabase Auth), not a local guess.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) {
        setStatus({
          kind: "error",
          message: "Current password is incorrect.",
        });
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        if (
          (error.code ?? "") === "weak_password" ||
          msg.includes("password should be at least")
        ) {
          setStatus({
            kind: "error",
            message: "Password is too weak — use at least 8 characters.",
          });
        } else if (
          (error.code ?? "") === "over_request_rate_limit" ||
          msg.includes("rate limit")
        ) {
          setStatus({
            kind: "error",
            message: "Too many attempts. Wait a moment and try again.",
          });
        } else {
          setStatus({
            kind: "error",
            message: "Could not update your password — try again.",
          });
        }
        return;
      }
      form.reset();
      setMeter("");
      setStatus({ kind: "success", message: "Password updated." });
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server — try again.",
      });
    } finally {
      setPending(false);
    }
  }

  const s = strength(meter);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status.kind === "success" && (
        <p
          role="status"
          className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong"
        >
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong"
        >
          {status.message}
        </p>
      )}

      <PasswordField
        id="current-password"
        label="Current password"
        autoComplete="current-password"
      />

      <div className="space-y-1.5">
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters. Mixing cases, numbers, and symbols makes it stronger."
          onChange={setMeter}
        />
        {meter !== "" && (
          <div className="flex items-center gap-2" aria-live="polite">
            <div className="h-1.5 w-32 overflow-hidden rounded-pill bg-zinc-100">
              <div
                className={`h-full ${s.className}`}
                style={{ width: `${(s.score / 5) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{s.label}</span>
          </div>
        )}
      </div>

      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
