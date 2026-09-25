import Link from "next/link";
import { notFound } from "next/navigation";
import { getAutomation } from "@/lib/api/automations";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { StatusToggle } from "./status-toggle";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [automation, account] = await Promise.all([
    getAutomation(id),
    getInstagramAccount(),
  ]);

  if (!automation) {
    notFound();
  }

  const connected = account?.status === "connected";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={automation.name}
        description={`On “${automation.postCaption}"`}
        action={
          <Badge
            tone={
              automation.status === "active"
                ? "success"
                : automation.status === "paused"
                  ? "paused"
                  : "draft"
            }
          >
            {automation.status}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matched
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {automation.matchedCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            DMs sent
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {automation.dmSentCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Failed
          </p>
          <p
            className={`mt-1 text-2xl font-semibold tabular-nums ${
              automation.failedCount > 0 ? "text-danger" : "text-foreground"
            }`}
          >
            {automation.failedCount}
          </p>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        {/* Activation state (Task 024 §12–13) — honest waiting/failed copy,
            never a guaranteed-delivery promise. */}
        {automation.status === "active" && !connected ? (
          <Card className="border-danger/30 p-4">
            <p className="text-sm font-medium text-foreground">
              Active — but Instagram is not connected
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Matching still runs, but DM deliveries will fail until the
              account is connected or reconnected.
            </p>
            <Link
              href="/settings/social-accounts"
              className={`${buttonClasses("secondary")} mt-3`}
            >
              Open social accounts
            </Link>
          </Card>
        ) : automation.status === "active" ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">Active</Badge>
              <p className="text-sm font-medium text-foreground">
                {automation.matchedCount === 0
                  ? "Waiting for matching comments"
                  : "Running"}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              When someone comments containing{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm font-medium text-zinc-800">
                {automation.keyword}
              </code>{" "}
              on this post, SMMOMO sends the private DM.
              {automation.matchedCount === 0
                ? " No matches yet — matches and deliveries will appear in the inbox."
                : ""}
            </p>
          </Card>
        ) : automation.status === "draft" ? (
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="draft">Draft</Badge>
              <p className="text-sm font-medium text-foreground">
                Not watching for comments yet
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Press Activate to start matching comments — the server verifies
              your Instagram connection before it goes live.
            </p>
          </Card>
        ) : null}

        <Card className="p-5">
          <CardTitle>IF — keyword</CardTitle>
          <p className="mt-2">
            {/* Direct zinc utilities kept for one-off code-chip styling */}
            <code className="rounded bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-800">
              {automation.keyword}
            </code>
          </p>
        </Card>

        <Card className="p-5">
          <CardTitle>THEN — private DM</CardTitle>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
            {automation.privateReply}
          </p>
        </Card>

        <Card className="p-5">
          <CardTitle>Optionally — public reply</CardTitle>
          {automation.publicReply ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700">
              {automation.publicReply}
            </p>
          ) : (
            <p className="mt-2 text-sm text-subtle-foreground">
              No public reply.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/automations/new?edit=${automation.id}`}
          className={buttonClasses("secondary")}
        >
          Edit
        </Link>
        <StatusToggle id={automation.id} status={automation.status} />
        <Link
          href="/automations"
          className={`${buttonClasses("ghost")} ml-auto`}
        >
          Back to automations
        </Link>
      </div>
    </div>
  );
}
