import Link from "next/link";
import { getUsageSummary } from "@/lib/api/usage";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function UsageSettingsPage() {
  const usage = await getUsageSummary();

  const rows = [
    {
      label: "DMs sent",
      hint: "Private messages Meta accepted this period (billable metric).",
      value: usage.dmsSent,
    },
    {
      label: "Comments received",
      hint: "Unique Instagram comments ingested via webhook.",
      value: usage.commentsProcessed,
    },
    {
      label: "Comments matched",
      hint: "Comments that triggered an automation keyword.",
      value: usage.commentsMatched ?? 0,
    },
    {
      label: "Public replies",
      hint: "Public comment replies Meta accepted.",
      value: usage.publicReplies,
    },
    {
      label: "Failed deliveries",
      hint: "Permanent send failures (retries not counted until final).",
      value: usage.failedDeliveries,
    },
  ];
  const isEmpty = rows.every((r) => r.value === 0);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Usage"
        description={`Activity for ${usage.period}. SMMOMO is free during launch testing.`}
      />

      <Card>
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <CardTitle>This period</CardTitle>
          <Badge tone="neutral">{usage.period}</Badge>
        </div>
        {isEmpty ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No usage recorded this period yet.
          </p>
        ) : (
          <ul className="divide-y divide-border-muted">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-start justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="text-sm text-muted-foreground">{r.label}</p>
                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    {r.hint}
                  </p>
                </div>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    r.label === "Failed deliveries" && r.value > 0
                      ? "text-danger"
                      : "text-foreground"
                  }`}
                >
                  {r.value.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {usage.failedDeliveries > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          Failed deliveries are broken down in{" "}
          <Link
            href="/analytics"
            className="rounded-control font-medium text-primary hover:text-primary-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Analytics
          </Link>
          .
        </p>
      )}

      <p className="mt-4 text-xs text-subtle-foreground">
        Usage is recorded from real product events (idempotent — Meta retries
        do not double-count). No plan limits or payments in V1.
      </p>
    </div>
  );
}
