import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getWorkspace } from "@/lib/api/workspace";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "./workspace-form";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

// Workspace configuration stays separate from the personal profile: this
// page only touches workspace rows (member-readable, owner/admin-writable
// via RLS) — personal metadata edits can never leak in here.
export default async function WorkspaceSettingsPage() {
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

  if (!workspace) {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Workspace" description="Your workspace settings." />
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">
            Workspace information is unavailable right now — try again in a
            moment.
          </p>
        </Card>
      </div>
    );
  }

  const created = new Date(workspace.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const canEdit = workspace.role === "owner" || workspace.role === "admin";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Workspace"
        description="Workspace-level configuration — separate from your personal profile."
      />

      <div className="space-y-6">
        <Card className="p-6">
          <CardTitle>Details</CardTitle>
          <dl className="mt-3 divide-y divide-border">
            <Row label="Workspace name">{workspace.name}</Row>
            <Row label="Workspace ID">
              <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs text-zinc-600">
                {workspace.id}
              </code>
            </Row>
            <Row label="Your role">
              {workspace.role === "owner"
                ? "Owner"
                : workspace.role === "admin"
                  ? "Admin"
                  : "Member"}
            </Row>
            <Row label="Created">{created}</Row>
            <Row label="Members">
              {workspace.memberCount}{" "}
              {workspace.memberCount === 1 ? "member" : "members"}
            </Row>
          </dl>
        </Card>

        <Card className="p-6">
          <CardTitle>Rename workspace</CardTitle>
          {canEdit ? (
            <>
              <p className="mb-4 mt-1 text-xs text-muted-foreground">
                Owners and admins can rename the workspace.
              </p>
              <WorkspaceForm initialName={workspace.name} />
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Only workspace owners and admins can rename the workspace.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
