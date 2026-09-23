"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/client";

export function AccountForm({
  email,
  initialName,
}: {
  email: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "success"; message: string } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [pending, setPending] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setStatus({ kind: "error", message: "New password must be at least 8 characters." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setStatus({ kind: "error", message: "Passwords don't match." });
        return;
      }
    }
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const { error } = await getBrowserSupabase().auth.updateUser({
        data: { name: name.trim() },
        ...(newPassword ? { password: newPassword } : {}),
      });
      if (error) {
        setStatus({ kind: "error", message: error.message });
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setStatus({ kind: "success", message: "Saved." });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong — try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {status.kind === "success" && (
        <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong">
          {status.message}
        </p>
      )}

      <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={email} readOnly aria-readonly />
          <p className="text-xs text-muted-foreground">Email changes aren&apos;t supported yet.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <p className="text-sm font-medium text-foreground">Change password</p>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            name="new-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            name="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat the new password"
          />
        </div>
        <p className="text-xs text-muted-foreground">Leave both fields blank to keep your current password.</p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
