import Link from "next/link";
import { notFound } from "next/navigation";
import { getAutomation } from "@/lib/api/automations";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const automation = await getAutomation(id);

  if (!automation) {
    notFound();
  }

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
        <button type="button" className={buttonClasses("secondary")} disabled>
          {automation.status === "active" ? "Pause" : "Activate"}
        </button>
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
