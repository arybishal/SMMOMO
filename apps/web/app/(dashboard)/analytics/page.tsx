import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAnalyticsOverview } from "@/lib/api/analytics";
import { listAutomations } from "@/lib/api/automations";
import { listPosts } from "@/lib/api/posts";
import { resolveRange, usableTz } from "@/lib/analytics/range";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import type {
  AnalyticsSeriesPoint,
  Automation,
  AutomationPeriodStats,
  ContentPeriodStats,
} from "@/types";
import AnalyticsFilters from "./filters";

// Task 027 — dedicated analytics workspace (spec §21–§30, §42): URL-driven
// filters → KPIs vs previous period → activity chart → funnel → automation /
// content performance → delivery health → factual insights. Every number is
// server-aggregated by /analytics/overview over RLS-scoped rows.

type SearchParams = Promise<{
  range?: string;
  start?: string;
  end?: string;
  automation?: string;
  post?: string;
}>;

const deliveryTone = {
  delivered: "success",
  sent: "info",
  processing: "info",
  queued: "draft",
  failed: "failed",
} as const;

const deliveryLabel: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
};

function statusTone(status: Automation["status"]): "success" | "paused" | "draft" {
  if (status === "active") return "success";
  if (status === "paused") return "paused";
  return "draft";
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Period comparison — only when the previous period gives a real denominator. */
function pctDelta(current: number, previous: number): string | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  if (change === 0) return null;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs previous period`;
}

/** >31 buckets → weeks of 7 (day series only; hourly is capped at 48). */
function aggregate(points: AnalyticsSeriesPoint[]): {
  points: AnalyticsSeriesPoint[];
  weekly: boolean;
} {
  if (points.length <= 31) return { points, weekly: false };
  const out: AnalyticsSeriesPoint[] = [];
  for (let i = 0; i < points.length; i += 7) {
    const group = points.slice(i, i + 7);
    out.push({
      key: group[0].key,
      label: group[0].label,
      comments: group.reduce((s, p) => s + p.comments, 0),
      matched: group.reduce((s, p) => s + p.matched, 0),
      dms: group.reduce((s, p) => s + p.dms, 0),
      failed: group.reduce((s, p) => s + p.failed, 0),
    });
  }
  return { points: out, weekly: true };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const tz = usableTz(
    typeof meta.timezone === "string" ? meta.timezone : null,
  );

  const [automations, posts] = await Promise.all([
    listAutomations(),
    listPosts(),
  ]);
  const automationOptions = automations.map((a) => ({
    id: a.id,
    label: a.name,
  }));
  const postOptions = posts.map((p) => ({
    id: p.id,
    label: truncate(p.caption, 40) || p.type,
  }));

  // Unknown ids are ignored rather than 404ing the page (builder-prefill
  // precedent) — the selects fall back to "All".
  const automationId = automations.some((a) => a.id === params.automation)
    ? (params.automation ?? "")
    : "";
  const postId = posts.some((p) => p.id === params.post)
    ? (params.post ?? "")
    : "";

  const range = resolveRange({
    preset: params.range,
    start: params.start,
    end: params.end,
    tz,
  });

  const filtersCard = (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Filters</CardTitle>
        {range.ok && <Badge tone="neutral">{range.label}</Badge>}
      </div>
      <AnalyticsFilters
        preset={range.ok ? range.preset : (params.range ?? "30d")}
        start={params.start ?? ""}
        end={params.end ?? ""}
        automationId={automationId}
        postId={postId}
        automations={automationOptions}
        posts={postOptions}
      />
    </Card>
  );

  if (!range.ok) {
    // Invalid/unknown range — honest notice instead of fabricated numbers.
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Analytics"
          description="Understand comment activity and automation delivery performance across your Instagram content."
        />
        {filtersCard}
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-muted-foreground">{range.message}</p>
          <Link href="/analytics" className={`${buttonClasses("secondary")} mt-4 inline-flex`}>
            Reset filters
          </Link>
        </Card>
      </div>
    );
  }

  const overview = await getAnalyticsOverview({
    start: range.start,
    end: range.end,
    tz,
    automationId: automationId || undefined,
    postId: postId || undefined,
  });

  const { totals, previous, deliveryHealth } = overview;
  const attempted = deliveryHealth.sent + deliveryHealth.delivered + deliveryHealth.failed;
  const accepted = deliveryHealth.sent + deliveryHealth.delivered;
  const successRate = attempted > 0 ? (accepted / attempted) * 100 : null;
  const matchRate = totals.comments > 0 ? (totals.matched / totals.comments) * 100 : null;
  const acceptance = totals.matched > 0 ? (totals.dmsSent / totals.matched) * 100 : null;

  // --- chart ---
  const chart = aggregate(overview.series);
  const chartMax = Math.max(
    ...chart.points.map((p) => Math.max(p.comments, p.matched, p.dms)),
    1,
  );
  const chartEmpty = chart.points.every(
    (p) => p.comments === 0 && p.matched === 0 && p.dms === 0 && p.failed === 0,
  );
  const peak = chart.points.reduce(
    (best, p) => (p.comments > best.comments ? p : best),
    chart.points[0],
  );
  const labelEvery = Math.max(1, Math.ceil(chart.points.length / 10));
  const chartSummary = chartEmpty
    ? "No activity in this period."
    : [
        `${totals.comments.toLocaleString()} comments, ${totals.matched.toLocaleString()} matched, ${totals.dmsSent.toLocaleString()} DMs sent across ${chart.points.length} ${chart.weekly ? "weekly buckets" : overview.bucket === "hour" ? "hourly buckets" : "daily buckets"}.`,
        peak && peak.comments > 0
          ? `Peak: ${peak.label} with ${peak.comments.toLocaleString()} comments.`
          : null,
        totals.failed > 0
          ? `${totals.failed} failed deliveries in this period.`
          : "No failed deliveries in this period.",
      ]
        .filter(Boolean)
        .join(" ");

  // --- performance tables (factual sort: highest matched first) ---
  const automationRows: AutomationPeriodStats[] = [...overview.automations].sort(
    (a, b) => b.matched - a.matched || b.comments - a.comments,
  );
  const contentRows: ContentPeriodStats[] = overview.content;

  // --- factual insights only (spec §30) ---
  const insights: { title: string; body: string }[] = [];
  if (previous.comments > 0 && totals.comments !== previous.comments) {
    const change = ((totals.comments - previous.comments) / previous.comments) * 100;
    insights.push({
      title: "Activity insight",
      body: `Comments ${change > 0 ? "increased" : "decreased"} ${Math.abs(change).toFixed(0)}% compared with the previous period.`,
    });
  }
  const topAutomation = [...overview.automations].sort(
    (a, b) => b.matched - a.matched,
  )[0];
  if (topAutomation && topAutomation.matched > 0) {
    insights.push({
      title: "Automation insight",
      body: `${topAutomation.name} received the highest number of matched comments during this period.`,
    });
  }
  if (totals.failed > 0) {
    insights.push({
      title: "Delivery insight",
      body: `${totals.failed} delivery attempt${totals.failed === 1 ? "" : "s"} failed during this period.`,
    });
  }
  if (totals.comments > 0 && totals.matched === 0) {
    insights.push({
      title: "Activity insight",
      body: "No comments matched an automation keyword in this period.",
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Analytics"
        description="Understand comment activity and automation delivery performance across your Instagram content."
      />

      {filtersCard}

      {/* Overview KPIs — comparison only when the previous period is a real
          denominator (spec §23). */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Comments"
          value={totals.comments}
          delta={pctDelta(totals.comments, previous.comments)}
          emphasis
        />
        <Kpi
          label="Matched"
          value={totals.matched}
          delta={pctDelta(totals.matched, previous.matched)}
        />
        <Kpi
          label="DMs sent"
          value={totals.dmsSent}
          delta={pctDelta(totals.dmsSent, previous.dmsSent)}
        />
        <Kpi
          label="Failed"
          value={totals.failed}
          delta={pctDelta(totals.failed, previous.failed)}
          danger={totals.failed > 0}
        />
      </div>

      {/* Activity chart — server-rendered bars + textual summary (spec §24/§36) */}
      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3 border-b border-border-muted px-5 py-4">
          <CardTitle>Activity</CardTitle>
          <span className="text-xs text-subtle-foreground">
            {chart.weekly ? "Weekly buckets" : overview.bucket === "hour" ? "Hourly" : "Daily"}
          </span>
        </div>
        <div className="px-5 py-5">
          {chartEmpty ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No activity in this period. Comment and delivery trends will
              appear here once automations run.
            </p>
          ) : (
            <>
              <div className="flex h-48 items-end gap-1.5" aria-hidden="true">
                {chart.points.map((p, i) => (
                  <div
                    key={p.key}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div className="flex w-full flex-1 items-end justify-center gap-px">
                      <div
                        className="w-1/3 rounded-t bg-indigo-500"
                        style={{ height: `${(p.comments / chartMax) * 100}%` }}
                      />
                      <div
                        className="w-1/3 rounded-t bg-indigo-300"
                        style={{ height: `${(p.matched / chartMax) * 100}%` }}
                      />
                      <div
                        className="w-1/3 rounded-t bg-indigo-700"
                        style={{ height: `${(p.dms / chartMax) * 100}%` }}
                      />
                    </div>
                    {i % labelEvery === 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {p.label}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-indigo-500" />{" "}
                  Comments
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-indigo-300" />{" "}
                  Matched
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-indigo-700" />{" "}
                  DMs sent
                </span>
              </div>
              <p className="mt-3 text-xs text-subtle-foreground">{chartSummary}</p>
            </>
          )}
        </div>
      </Card>

      {/* Automation funnel (spec §25) */}
      <Card className="mt-6 p-5">
        <CardTitle>Automation funnel</CardTitle>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          <FunnelStage label="Comments" value={totals.comments} />
          <FunnelStage label="Matched" value={totals.matched} />
          <FunnelStage label="DM sent" value={totals.dmsSent} />
        </ol>
        <p className="mt-4 text-xs text-subtle-foreground">
          {[
            matchRate !== null ? `Match rate ${matchRate.toFixed(1)}%` : null,
            acceptance !== null
              ? `DM acceptance rate ${acceptance.toFixed(1)}%`
              : null,
            matchRate === null && acceptance === null
              ? "No comments in this period — rates appear once activity occurs."
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </Card>

      {/* Automation performance (spec §26) */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border-muted px-5 py-4">
          <CardTitle>Automation performance</CardTitle>
        </div>
        {automationRows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              No automations yet. Performance by automation will appear once
              you create one.
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
                  <th scope="col" className="px-5 py-3">Automation</th>
                  <th scope="col" className="px-2 py-3 text-right">Comments</th>
                  <th scope="col" className="px-2 py-3 text-right">Matches</th>
                  <th scope="col" className="px-2 py-3 text-right">DMs</th>
                  <th scope="col" className="px-2 py-3 text-right">Failures</th>
                  <th scope="col" className="px-5 py-3 text-right">Match rate</th>
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
                      {a.comments.toLocaleString()}
                    </td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                      {a.matched.toLocaleString()}
                    </td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                      {a.dmsSent.toLocaleString()}
                    </td>
                    <td
                      className={`px-2 py-3.5 text-right tabular-nums ${
                        a.failed > 0 ? "font-medium text-danger" : "text-muted-foreground"
                      }`}
                    >
                      {a.failed.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-foreground">
                      {a.matchRate === null ? "—" : `${(a.matchRate * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Content performance (spec §27) */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-border-muted px-5 py-4">
          <CardTitle>Content performance</CardTitle>
        </div>
        {contentRows.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              No comment activity on your posts in this period. Content
              performance appears once comments arrive.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-muted bg-surface-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-5 py-3">Post</th>
                  <th scope="col" className="px-2 py-3 text-right">Comments</th>
                  <th scope="col" className="px-2 py-3 text-right">Matches</th>
                  <th scope="col" className="px-2 py-3 text-right">DMs</th>
                  <th scope="col" className="px-5 py-3 text-right">Failures</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted">
                {contentRows.map((row) => (
                  <tr key={row.id} className="text-sm">
                    <td className="min-w-0 max-w-[22rem] px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {row.mediaUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.mediaUrl}
                            alt={row.caption}
                            className="h-10 w-10 shrink-0 rounded-control object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-10 w-10 shrink-0 rounded-control bg-gradient-to-br from-indigo-400 to-fuchsia-400"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone="neutral">{row.type}</Badge>
                            <span
                              className="truncate text-sm text-foreground"
                              title={row.caption}
                            >
                              {row.caption || "Untitled post"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                      {row.comments.toLocaleString()}
                    </td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                      {row.matched.toLocaleString()}
                    </td>
                    <td className="px-2 py-3.5 text-right tabular-nums text-foreground">
                      {row.dmsSent.toLocaleString()}
                    </td>
                    <td
                      className={`px-5 py-3.5 text-right tabular-nums ${
                        row.failed > 0 ? "font-medium text-danger" : "text-muted-foreground"
                      }`}
                    >
                      {row.failed.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delivery health + failed-delivery summary (spec §28/§29) */}
      <Card className="mt-6 p-5">
        <CardTitle>Delivery health</CardTitle>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            {successRate !== null ? (
              <div>
                <p className="text-3xl font-semibold tabular-nums text-foreground">
                  {successRate.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {`Delivery success — ${accepted} of ${attempted} attempted accepted by Instagram.`}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {attempted === 0 && deliveryHealth.queued + deliveryHealth.processing > 0
                  ? `No delivery attempts yet — ${deliveryHealth.queued} queued, ${deliveryHealth.processing} processing.`
                  : "No delivery records in this period."}
              </p>
            )}
            <ul className="mt-4 divide-y divide-border-muted">
              {(["queued", "processing", "sent", "delivered", "failed"] as const).map(
                (status) => (
                  <li key={status} className="flex items-center justify-between gap-3 py-2.5">
                    <Badge tone={deliveryTone[status]}>{deliveryLabel[status]}</Badge>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {deliveryHealth[status].toLocaleString()}
                    </span>
                  </li>
                ),
              )}
            </ul>
            <p className="mt-3 text-xs text-subtle-foreground">
              {
                "Attempted = sent + delivered + failed (queued/processing not yet attempted). Success rate = (sent + delivered) ÷ attempted. Covers private DMs and public replies."
              }
            </p>
          </div>

          <div className="rounded-control border border-border-muted bg-surface-muted/50 p-4">
            <p className="text-sm font-semibold text-foreground">Failed deliveries</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-danger">
              {totals.failed.toLocaleString()} failure{totals.failed === 1 ? "" : "s"}
            </p>
            {totals.failed > 0 ? (
              <>
                <ul className="mt-3 space-y-2">
                  {overview.failures.slice(0, 5).map((f) => (
                    <li key={f.id} className="text-sm">
                      <p className="text-foreground">
                        {f.automationName ?? "Automation unknown"}
                        {f.error ? ` — ${f.error}` : ""}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {f.username ? `@${f.username} — “${f.text ?? ""}”` : f.recipient}
                      </p>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/inbox?outcome=failed"
                  className={`${buttonClasses("secondary")} mt-4 inline-flex`}
                >
                  View failed deliveries
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No failed deliveries in this period.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Factual insights (spec §30) */}
      <Card className="mt-6 p-5">
        <CardTitle>Insights</CardTitle>
        {insights.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No insights yet — insights appear when the period has activity to
            describe.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {insights.map((insight) => (
              <li key={insight.body}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {insight.title}
                </p>
                <p className="mt-0.5 text-sm text-foreground">{insight.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: number;
  delta: string | null;
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
        {value.toLocaleString()}
      </p>
      <p className="mt-1 min-h-[1rem] text-xs text-subtle-foreground">{delta ?? ""}</p>
      {danger && <p className="mt-1 text-xs text-danger-strong">Needs attention</p>}
    </Card>
  );
}

function FunnelStage({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-control border border-border-muted bg-surface p-4 text-center">
      <p className="text-2xl font-semibold tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </li>
  );
}
