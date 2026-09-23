import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const deliveryTone = {
  delivered: "success",
  sent: "info",
  queued: "draft",
  failed: "failed",
} as const;

export default async function InboxPage() {
  const [comments, deliveries] = await Promise.all([
    listRecentComments(),
    listRecentDeliveries(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Inbox"
        description="Recent comment events and DM delivery results."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border-muted px-5 py-4">
            <CardTitle>Comments</CardTitle>
          </div>
          <ul className="divide-y divide-border-muted">
            {comments.map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">@{c.username}</span>{" "}
                      <span className="text-muted-foreground">— “{c.text}”</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                      {c.automationName
                        ? `→ ${c.automationName}`
                        : "no automation matched"}{" "}
                      · {new Date(c.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={c.matched ? "success" : "neutral"}>
                    {c.matched ? "Matched" : "Ignored"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="border-b border-border-muted px-5 py-4">
            <CardTitle>Deliveries</CardTitle>
          </div>
          <ul className="divide-y divide-border-muted">
            {deliveries.map((d) => (
              <li key={d.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">@{d.recipient}</span>{" "}
                      <span className="text-muted-foreground">
                        — {d.kind === "private_dm" ? "Private DM" : "Public reply"}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-subtle-foreground">
                      {d.error ?? new Date(d.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={deliveryTone[d.status]}>{d.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
