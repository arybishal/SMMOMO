import Link from "next/link";
import { listAutomations } from "@/lib/api/automations";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { IconArrowRight } from "@/components/layout/icons";

export default async function AutomationsPage() {
  const automations = await listAutomations();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Automations"
        description="Keyword-triggered comment → DM workflows for your posts."
        action={
          <Link href="/automations/new" className={buttonClasses("primary")}>
            New automation
            <IconArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <table className="min-w-full divide-y divide-border-muted text-sm">
          <thead className="bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Automation</th>
              <th className="px-5 py-3">Keyword</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Matched</th>
              <th className="px-5 py-3 text-right">DMs sent</th>
              <th className="px-5 py-3 text-right">Failed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted bg-surface">
            {automations.map((a) => (
              <tr key={a.id} className="hover:bg-surface-muted/60">
                <td className="px-5 py-3.5">
                  <Link
                    href={`/automations/${a.id}`}
                    className="font-medium text-foreground hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p className="max-w-md truncate text-xs text-subtle-foreground">
                    {a.postCaption}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  {/* Keyword chip: direct zinc utilities are fine for one-off code styling */}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                    {a.keyword}
                  </code>
                </td>
                <td className="px-5 py-3.5">
                  <Badge
                    tone={
                      a.status === "active"
                        ? "success"
                        : a.status === "paused"
                          ? "paused"
                          : "draft"
                    }
                  >
                    {a.status}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-zinc-700">
                  {a.matchedCount}
                </td>
                <td className="px-5 py-3.5 text-right tabular-nums text-zinc-700">
                  {a.dmSentCount}
                </td>
                <td
                  className={`px-5 py-3.5 text-right tabular-nums ${
                    a.failedCount > 0 ? "text-danger" : "text-subtle-foreground"
                  }`}
                >
                  {a.failedCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
