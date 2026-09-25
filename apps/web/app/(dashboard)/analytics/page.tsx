import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/api/analytics";
import { listAutomations } from "@/lib/api/automations";
import { listPosts } from "@/lib/api/posts";
import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import type { Automation, MessageDelivery, Post } from "@/types";

// Tone/label maps shared with Dashboard + Inbox — same statuses, same words.
const deliveryTone = {
  delivered: "success",
  sent: "info",
  processing: "info",
  queued: "draft",
  failed: "failed",
} as const;

const deliveryLabel: Record<MessageDelivery["status"], string> = {
  queued: "Queued",
  processing: "Processing",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
};

const deliveryStatuses: MessageDelivery["status"][] = [
  "queued",
  "processing",
  "sent",
  "delivered",
  "failed",
];

function statusTone(
  status: Automation["status"],
): "success" | "paused" | "draft" | "neutral" {
  if (status === "active") return "success";
  if (status === "paused") return "paused";
  if (status === "draft") return "draft";
  return "neutral";
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Server page. Every number below is derived from existing lib/api
// contracts — no fabricated metrics, chart points, or percentages.
// Two honest data layers (Dashboard precedent): AnalyticsSummary aggregates
// for KPIs/chart; recent event records for delivery breakdown/failures
// (each section labeled with its scope).
export default async function AnalyticsPage() {
  const [stats, automations, posts, comments, deliveries] =
    await Promise.all([
      getAnalyticsSummary(),
      listAutomations(),
      listPosts(),
      listRecentComments(),
      listRecentDeliveries(),
    ]);

  // --- Chart derivation (daily[] is the 7-day contract) ---
  const daily = stats.daily;
  const dailyMatchedTotal = daily.reduce((sum, d) => sum + d.comments, 0);
  const dailyDmsTotal = daily.reduce((sum, d) => sum + d.dms, 0);
  const maxBar = Math.max(
    ...daily.map((d) => Math.max(d.comments, d.dms)),
    1,
  );
  const chartUnavailable =
    daily.length === 0 ||
    (dailyMatchedTotal === 0 && dailyDmsTotal === 0);

  let chartSummary: string | null = null;
  if (!chartUnavailable && daily.length > 0) {
    const parts: string[] = [];
    if (dailyMatchedTotal > 0) {
      const min = daily.reduce((a, b) => (b.comments < a.comments ? b : a));
      const max = daily.reduce((a, b) => (b.comments > a.comments ? b : a));
      parts.push(
        `Matched comments ranged from ${min.comments.toLocaleString()} (${min.label}) to ${max.comments.toLocaleString()} (${max.label}) and totaled ${dailyMatchedTotal.toLocaleString()}.`,
      );
    } else {
      parts.push("No matched comments in the last 7 days.");
    }
    parts.push(
      dailyDmsTotal > 0
        ? `DMs sent totaled ${dailyDmsTotal.toLocaleString()}.`
        : "No DMs sent in the last 7 days.",
    );
    chartSummary = parts.join(" ");
  }

  // --- Delivery breakdown (event records; queued/processing never "successful") ---
  const counts: Record<MessageDelivery["status"], number> = {
    queued: 0,
    processing: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
  };
  for (const d of deliveries) counts[d.status] += 1;
  const attempted = counts.sent + counts.delivered + counts.failed;
  // `delivered` rows only appear if a delivery webhook is ever added; today
  // accepted-by-Instagram lands as `sent`. Never report 0% on sent-only data.
  const accepted = counts.sent + counts.delivered;
  const successRate =
    attempted > 0 ? Math.round((accepted / attempted) * 100) : null;

  // --- Automation performance (model lifetime counters; matched desc) ---
  const automationRows: Automation[] = [...automations].sort(
    (a, b) => b.matchedCount - a.matchedCount,
  );

  // --- Content performance (postId joins — real relationships) ---
  const postRows = posts.map((post) => {
    const linked = automations.filter((a) => a.postId === post.id);
    return {
      post,
      matched: linked.reduce((sum, a) => sum + a.matchedCount, 0),
      dms: linked.reduce((sum, a) => sum + a.dmSentCount, 0),
    };
  });

  // --- Failures (event records only — no invented errors) ---
  const failures = deliveries
    .filter((d) => d.status === "failed")
    .map((delivery) => ({
      delivery,
      comment: comments.find((c) => c.id === delivery.commentId),
    }));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Understand comment activity and automation delivery performance across your Instagram content."
      />

      {/* KPIs — same four metrics and language as Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Comments matched"
          value={stats.commentsMatched.toLocaleString()}
          emphasis
        />
        <Kpi label="DMs sent" value={stats.dmsSent.toLocaleString()} />
        <Kpi
          label="Failed deliveries"
          value={stats.failedDeliveries.toLocaleString()}
          danger={stats.failedDeliveries > 0}
        />
        <Kpi
          label="Active automations"
          value={`${stats.activeAutomations} / ${automations.length}`}
        />
      </div>

      {/* Daily activity — the only period-scoped view (7 labeled days) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3 border-b border-border-muted px-5 py-4">
          <CardTitle>Daily activity</CardTitle>
          <Badge tone="neutral">Last 7 days</Badge>
        </div>
        <div className="px-5 py-5">
          {chartUnavailable ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity recorded in the last 7 days yet. Comment and
              delivery trends will appear here once automations run.
            </p>
          ) : (
            <>
              {/* Bars are decorative for AT — the summary below is the
                  equivalent textual description (spec §14). */}
              <div
                className="flex h-48 items-end gap-3"
                aria-hidden="true"
              >
                {daily.map((d) => (
                  <div
                    key={d.label}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 items-end justify-center gap-1">
                      <div
                        className="w-1/2 rounded-t bg-indigo-500"
                        style={{ height: `${(d.comments / maxBar) * 100}%` }}
                        title={`${d.comments} matched comments`}
                      />
                      <div
                        className="w-1/2 rounded-t bg-indigo-200"
                        style={{ height: `${(d.dms / maxBar) * 100}%` }}
                        title={`${d.dms} DMs sent`}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm bg-indigo-500"
                  />{" "}
                  Comments matched
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-sm bg-indigo-200"
                  />{" "}
                  DMs sent
                </span>
              </div>
              <p className="mt-3 text-xs text-subtle-foreground">
                {chartSummary}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* Automation performance | Delivery breakdown */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border-muted px-5 py-4">
            <CardTitle>Automation performance</CardTitle>
          </div>
          {automationRows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                No automations yet. Performance by automation will appear
                once you create one.
              </p>
              <Link href="/automations/new" className={`${buttonClasses("secondary")} mt-4`}>
                Create automation
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-3">
                      Automation
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Matched
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      DMs sent
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      Failed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {automationRows.map((a) => (
                    <tr key={a.id} className="text-sm">
                      <td className="min-w-0 px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/automations/${a.id}`}
                            className="truncate text-sm font-medium text-primary hover:text-primary-hover"
                          >
                            {a.name}
                          </Link>
                          <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                        </div>
                        <code className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                          {a.keyword}
                        </code>
                      </td>
                      <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                        {a.matchedCount.toLocaleString()}
                      </td>
                      <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                        {a.dmSentCount.toLocaleString()}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right tabular-nums ${
                          a.failedCount > 0
                            ? "font-medium text-danger"
                            : "text-muted-foreground"
                        }`}
                      >
                        {a.failedCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border-muted px-5 py-4">
            <CardTitle>Delivery breakdown</CardTitle>
            <span className="text-xs text-subtle-foreground">
              Recent records
            </span>
          </div>
          <div className="px-5 py-5">
            {successRate !== null ? (
              <div>
                <p className="text-3xl font-semibold tabular-nums text-foreground">
                  {successRate}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Delivery success — {accepted} of {attempted} attempted
                  accepted by Instagram.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {deliveries.length === 0
                  ? "No delivery records yet."
                  : `No delivery attempts yet — ${counts.queued} queued.`}
              </p>
            )}

            <ul className="mt-4 divide-y divide-border-muted">
              {deliveryStatuses.map((status) => (
                <li
                  key={status}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <Badge tone={deliveryTone[status]}>
                    {deliveryLabel[status]}
                  </Badge>
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {counts[status]}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-subtle-foreground">
              Based on {deliveries.length} recent delivery record
              {deliveries.length === 1 ? "" : "s"}. Attempted = sent +
              delivered + failed (queued/processing not yet attempted). Success
              rate = (sent + delivered) ÷ attempted.
            </p>
          </div>
        </Card>
      </div>

      {/* Content performance | Failed deliveries */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-border-muted px-5 py-4">
            <CardTitle>Content performance</CardTitle>
          </div>
          {postRows.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                No posts yet. Performance by post will appear once your
                Instagram content is available.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border-muted bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-3">
                      Post
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Comments
                    </th>
                    <th scope="col" className="px-2 py-3 text-right">
                      Matched
                    </th>
                    <th scope="col" className="px-5 py-3 text-right">
                      DMs sent
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-muted">
                  {postRows.map(({ post, matched, dms }) => (
                    <PostRow
                      key={post.id}
                      post={post}
                      matched={matched}
                      dms={dms}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border-muted px-5 py-4">
            <CardTitle>Failed deliveries</CardTitle>
            <span className="text-xs text-subtle-foreground">
              Recent records
            </span>
          </div>
          {failures.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                No failed deliveries in recent activity.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border-muted">
              {failures.map(({ delivery, comment }) => (
                <li key={delivery.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone="failed">Failed</Badge>
                      <span className="truncate text-sm font-medium text-foreground">
                        {comment?.automationName ?? "Automation unknown"}
                      </span>
                    </span>
                    <time
                      dateTime={delivery.createdAt}
                      className="shrink-0 text-xs text-subtle-foreground"
                    >
                      {absoluteTime(delivery.createdAt)}
                    </time>
                  </div>
                  {/* Model-provided, user-facing error string — never
                      stack traces or invented errors. */}
                  <p className="mt-2 text-sm text-foreground">
                    {delivery.error}
                  </p>
                  {comment && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      @{comment.username} — “{comment.text}” ·{" "}
                      {truncate(comment.postCaption, 60)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function PostRow({
  post,
  matched,
  dms,
}: {
  post: Post;
  matched: number;
  dms: number;
}) {
  return (
    <tr className="text-sm">
      <td className="min-w-0 max-w-[16rem] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{post.type}</Badge>
          <span className="truncate text-sm text-foreground" title={post.caption}>
            {post.caption}
          </span>
        </div>
      </td>
      <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
        {post.commentsCount.toLocaleString()}
      </td>
      <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
        {matched.toLocaleString()}
      </td>
      <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
        {dms.toLocaleString()}
      </td>
    </tr>
  );
}

function Kpi({
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
    <Card
      className={`p-5 ${emphasis ? "border-indigo-200 bg-primary-soft/40" : ""}`}
    >
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
      {danger && <p className="mt-1 text-xs text-danger-strong">Needs attention</p>}
    </Card>
  );
}
