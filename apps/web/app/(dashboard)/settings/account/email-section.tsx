"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";
import { getBrowserSupabase } from "@/lib/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

// Supabase Auth email-change flow: the backend sends a verification link to
// the NEW address — nothing here mutates an "email column". Pending state is
// read back from the session's user (new_email) after refresh.
export function EmailSection({
  email,
  newEmail,
}: {
  email: string;
  newEmail: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "idle" });

    const target = value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setStatus({ kind: "error", message: "Enter a valid email address." });
      return;
    }
    if (target.toLowerCase() === email.toLowerCase()) {
      setStatus({
        kind: "error",
        message: "That's already your email address.",
      });
      return;
    }

    setPending(true);
    try {
      const { error } = await getBrowserSupabase().auth.updateUser({
        email: target,
      });
      if (error) {
        const msg = (error.message ?? "").toLowerCase();
        const code = error.code ?? "";
        if (
          code === "user_already_exists" ||
          msg.includes("already registered") ||
          msg.includes("already been registered")
        ) {
          setStatus({
            kind: "error",
            message: "That email address is already in use.",
          });
        } else if (
          code === "over_request_rate_limit" ||
          code === "too_many_requests" ||
          msg.includes("rate limit")
        ) {
          setStatus({
            kind: "error",
            message: "Too many attempts. Wait a moment and try again.",
          });
        } else if (
          code === "validation_failed" ||
          code === "over_email_send_rate_limit" ||
          msg.includes("invalid") ||
          msg.includes("unable to validate")
        ) {
          setStatus({
            kind: "error",
            message: "That email address isn't valid — check it and try again.",
          });
        } else {
          setStatus({
            kind: "error",
            message: "Could not start the email change — try again.",
          });
        }
        return;
      }
      setValue("");
      setStatus({
        kind: "success",
        message:
          "Verification email sent — check your new email address to confirm the change.",
      });
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server — try again.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6">
      <CardTitle>Email address</CardTitle>
      <p className="mb-4 mt-1 text-xs text-muted-foreground">
        Changing your email requires a confirmation link sent to the new
        address. Your current email keeps working until you confirm.
      </p>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="current-email">Current email</Label>
          <Input
            id="current-email"
            type="email"
            defaultValue={email}
            readOnly
            aria-readonly
          />
        </div>

        {newEmail && (
          <div
            role="status"
            className="rounded-control bg-info-soft px-3 py-2 text-sm text-info-strong"
          >
            Verification pending — we sent a confirmation link to{" "}
            <span className="font-medium">{newEmail}</span>. Check that inbox
            to finish the change.
          </div>
        )}

        <form onSubmit={handleChange} className="space-y-4">
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
          <div className="space-y-1.5">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              name="new-email"
              type="email"
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="new-email@example.com"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Sending…" : "Change email"}
          </Button>
        </form>
      </div>
    </Card>
  );
}
