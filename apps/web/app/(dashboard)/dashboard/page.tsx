import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/api/analytics";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { listRecentComments } from "@/lib/api/inbox";
import { listAutomations } from "@/lib/api/automations";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  IconArrowRight,
  IconAutomation,
  IconInstagram,
} from "@/components/layout/icons";

export default async function DashboardPage() {
  const [stats, account, comments, automations] = await Promise.all([
    getAnalyticsSummary(),
    getInstagramAccount(),
    listRecentComments(),
    listAutomations(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Dashboard"
        description="Your Instagram comment automations at a glance."
        action={
          <Link href="/automations/new" className={buttonClasses("primary")}>
            New automation
            <IconArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      {/* Connection — context for everything below */}
      <Card className="mb-6 flex items-center gap-4 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-foreground text-background">
          <IconInstagram className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {account ? `@${account.username}` : "No account connected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {account
              ? `${account.followers.toLocaleString()} followers · connected`
              : "Connect Instagram in Settings"}
          </p>
        </div>
        <Badge tone={account?.status === "connected" ? "success" : "failed"}>
          {account?.status === "connected" ? "Connected" : "Disconnected"}
        </Badge>
        <Link
          href="/settings/social-accounts"
          className="hidden text-sm font-medium text-primary hover:text-primary-hover sm:block"
        >
          Manage
        </Link>
      </Card>

      {/* Primary metrics — deliberately weighted, not a wall of equal cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Comments matched"
          value={stats.commentsMatched.toLocaleString()}
          emphasis
        />
        <Metric label="DMs sent" value={stats.dmsSent.toLocaleString()} />
        <Metric
          label="Failed deliveries"
          value={stats.failedDeliveries.toLocaleString()}
          danger={stats.failedDeliveries > 0}
        />
        <Metric
          label="Active automations"
          value={`${stats.activeAutomations} / ${automations.length}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Recent activity */}
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
            <CardTitle>Recent comment activity</CardTitle>
            <Link
              href="/inbox"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              View inbox
            </Link>
          </div>
          <ul className="divide-y divide-border-muted">
            {comments.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">@{c.username}</span>{" "}
                    <span className="text-muted-foreground">— “{c.text}”</span>
                  </p>
                  <p className="truncate text-xs text-subtle-foreground">
                    {c.automationName
                      ? `Matched: ${c.automationName}`
                      : "No automation matched"}
                  </p>
                </div>
                <Badge tone={c.matched ? "success" : "neutral"}>
                  {c.matched ? "Matched" : "Ignored"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Automations */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
            <CardTitle>Automations</CardTitle>
            <Link
              href="/automations"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-border-muted">
            {automations.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
                  <IconAutomation className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/automations/${a.id}`}
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-subtle-foreground">
                    Keyword “{a.keyword}” · {a.dmSentCount} DMs
                  </p>
                </div>
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
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <Card className={`p-5 ${emphasis ? "border-indigo-200 bg-primary-soft/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-semibold tabular-nums ${
          emphasis
            ? "text-3xl text-primary-strong"
            : danger
              ? "text-2xl text-danger"
              : "text-2xl text-foreground"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
