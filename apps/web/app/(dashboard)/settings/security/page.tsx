import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/api/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PasswordForm } from "./password-form";
import { SessionsCard } from "./sessions-card";
import { DangerZone } from "./danger-zone";
import { CopyButton } from "./copy-button";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

export default async function SecuritySettingsPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let workspace: Awaited<ReturnType<typeof getWorkspace>> | undefined;
  try {
    workspace = await getWorkspace();
  } catch {
    workspace = undefined;
  }

  const created = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const roleLabel =
    workspace?.role === "owner"
      ? "Owner"
      : workspace?.role === "admin"
        ? "Admin"
        : workspace?.role === "member"
          ? "Member"
          : null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Security"
        description="Password, sessions, and account safety."
      />

      <div className="space-y-6">
        <Card className="p-6">
          <CardTitle>Change password</CardTitle>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">
            Your password is stored by Supabase Auth — SMMOMO never sees or
            stores it.
          </p>
          <PasswordForm email={user.email ?? ""} />
        </Card>

        <SessionsCard />

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Two-factor authentication</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Add an extra layer of security to your account.
              </p>
            </div>
            <Badge tone="neutral">Not available yet</Badge>
          </div>
        </Card>

        <Card className="p-6">
          <CardTitle>Account information</CardTitle>
          <dl className="mt-3 divide-y divide-border">
            {created && <Row label="Account created">{created}</Row>}
            <Row label="Workspace">{workspace?.name ?? "—"}</Row>
            {roleLabel && <Row label="Role">{roleLabel}</Row>}
            <Row label="Account ID">
              <CopyButton value={user.id} />
            </Row>
          </dl>
        </Card>

        <DangerZone />
      </div>
    </div>
  );
}
