import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAutomation } from "@/lib/api/automations";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { getAnalyticsOverview } from "@/lib/api/analytics";
import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { resolveRange, usableTz } from "@/lib/analytics/range";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { StatusToggle } from "./status-toggle";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const tz = usableTz(str(meta.timezone));
  const last30 = resolveRange({ preset: "30d", tz });

  const [automation, account, comments, deliveries] = await Promise.all([
    getAutomation(id),
    getInstagramAccount(),
    listRecentComments(),
    listRecentDeliveries(),
  ]);

  if (!automation) {
    notFound();
  }

  // Period stats scoped to this automation (server-aggregated, spec §31).
  const period =
    last30.ok
      ? await getAnalyticsOverview({
          start: last30.start,
          end: last30.end,
          tz,
          automationId: automation.id,
        })
      : null;
  const periodRow = period?.automations[0];
  const acceptance =
    periodRow && periodRow.matched > 0
      ? `${((periodRow.dmsSent / periodRow.matched) * 100).toFixed(1)}%`
      : null;

  // Real activity for THIS automation: comments it won (id match — precise,
  // names can repeat across posts) + deliveries of those comments.
  const myCommentIds = new Set(
    comments.filter((c) => c.automationId === automation.id).map((c) => c.id),
  );
  const activity = [
    ...comments
      .filter((c) => c.automationId === automation.id && c.matched)
      .map((c) => ({
        id: `c-${c.id}`,
        at: c.createdAt,
        label: "Keyword matched",
        detail: `@${c.username} — “${c.text}”`,
      })),
    ...deliveries
      .filter((d) => myCommentIds.has(d.commentId))
      .map((d) => ({
        id: `d-${d.id}`,
        at: d.createdAt,
        label: `${d.kind === "private_dm" ? "Private DM" : "Public reply"} ${
          d.status === "failed" ? "failed" : d.status === "queued" || d.status === "processing" ? d.status : "sent"
        }`,
        detail: `@${d.recipient}${d.error ? ` — ${d.error}` : ""}`,
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

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

      {/* Lifetime counters — model authority (labelled all-time; period stats
          below come from /analytics/overview instead of these). */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Matched · all time
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {automation.matchedCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            DMs sent · all time
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {automation.dmSentCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Failed · all time
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

      {/* Last 30 days — server-aggregated for this automation (spec §31) */}
      {period && periodRow && (
        <Card className="mt-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Last 30 days</CardTitle>
            <Badge tone="neutral">{last30.ok ? last30.label : ""}</Badge>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <PeriodStat label="Comments matched" value={periodRow.matched} />
            <PeriodStat label="DMs sent" value={periodRow.dmsSent} />
            <PeriodStat
              label="Failures"
              value={periodRow.failed}
              danger={periodRow.failed > 0}
            />
            <PeriodStat
              label="Match rate"
              text={
                periodRow.matchRate === null
                  ? "—"
                  : `${(periodRow.matchRate * 100).toFixed(1)}%`
              }
            />
            <PeriodStat label="Delivery acceptance" text={acceptance ?? "—"} />
          </dl>
          <p className="mt-3 text-xs text-subtle-foreground">
            {`Match rate = matched ÷ ${periodRow.comments} comments on this post in the period. Delivery acceptance = DMs sent ÷ matched (Graph “sent”).`}
          </p>
        </Card>
      )}

      {/* Automation activity — real records only (spec §31). Status-transition
          history does not exist in the schema, so no fabricated timeline. */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <CardTitle>Automation activity</CardTitle>
          <Link
            href="/inbox"
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            View inbox
          </Link>
        </div>
        {activity.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              No activity in the recent records yet. Matched comments and
              deliveries will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-muted">
            {activity.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3 px-5 py-3">
                <time
                  dateTime={item.at}
                  className="w-28 shrink-0 text-xs tabular-nums text-subtle-foreground"
                >
                  {new Date(item.at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border-muted px-5 py-3 text-xs text-subtle-foreground">
          Event-level status history (queued → processing → sent) is a future
          enhancement — only current records are shown.
        </p>
      </Card>

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

function PeriodStat({
  label,
  value,
  text,
  danger = false,
}: {
  label: string;
  value?: number;
  text?: string;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-xl font-semibold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {text ?? (value ?? 0).toLocaleString()}
      </dd>
    </div>
  );
}
