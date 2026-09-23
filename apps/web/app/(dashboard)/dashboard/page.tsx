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
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white">
          <IconInstagram className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {account ? `@${account.username}` : "No account connected"}
          </p>
          <p className="text-xs text-zinc-500">
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
          className="hidden text-sm font-medium text-indigo-600 hover:text-indigo-500 sm:block"
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
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <CardTitle>Recent comment activity</CardTitle>
            <Link
              href="/inbox"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              View inbox
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {comments.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-900">
                    <span className="font-medium">@{c.username}</span>{" "}
                    <span className="text-zinc-500">— “{c.text}”</span>
                  </p>
                  <p className="truncate text-xs text-zinc-400">
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
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <CardTitle>Automations</CardTitle>
            <Link
              href="/automations"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all
            </Link>
          </div>
          <ul className="divide-y divide-zinc-100">
            {automations.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                  <IconAutomation className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/automations/${a.id}`}
                    className="block truncate text-sm font-medium text-zinc-900 hover:text-indigo-600"
                  >
                    {a.name}
                  </Link>
                  <p className="truncate text-xs text-zinc-400">
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
    <Card className={`p-5 ${emphasis ? "border-indigo-200 bg-indigo-50/40" : ""}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-2 font-semibold tabular-nums ${
          emphasis
            ? "text-3xl text-indigo-700"
            : danger
              ? "text-2xl text-red-600"
              : "text-2xl text-zinc-900"
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
