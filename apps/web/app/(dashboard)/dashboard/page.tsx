import Link from "next/link";
import { getServerSupabase } from "@/lib/supabase/server";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { listAutomations } from "@/lib/api/automations";
import { listPosts } from "@/lib/api/posts";
import { getAnalyticsOverview } from "@/lib/api/analytics";
import { resolveRange, usableTz } from "@/lib/analytics/range";
import { onboardingStep, setupChecklist, type OnboardingStep } from "@/lib/onboarding";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { IconInstagram } from "@/components/layout/icons";
import type { CommentEvent } from "@/types";
import Demo from "./demo";

// Task 027 — command-center Dashboard: status → flow → today → attention →
// activity → education → actions (spec §3/§42). Every production number comes
// from /analytics/overview (today, viewer tz), real records, or lifetime
// automations state — demo values live only inside ./demo.tsx (spec §37).

const deliveryTone = {
  delivered: "success",
  sent: "info",
  processing: "info",
  queued: "draft",
  failed: "failed",
} as const;

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export default async function DashboardPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const profileName = str(meta.name);
  const tz = usableTz(str(meta.timezone));

  const today = resolveRange({ preset: "today", tz });
  if (!today.ok) {
    // Unreachable: preset "today" always resolves (tz falls back to UTC).
    throw new Error(today.message);
  }

  const [account, automations, posts, overview, comments, deliveries] =
    await Promise.all([
      getInstagramAccount(),
      listAutomations(),
      listPosts(),
      getAnalyticsOverview({ start: today.start, end: today.end, tz }),
      listRecentComments(),
      listRecentDeliveries(),
    ]);

  const connected = account?.status === "connected";
  const accountError = Boolean(account) && !connected;
  const totals = overview.totals;
  const activeCount = automations.filter((a) => a.status === "active").length;
  const pausedCount = automations.filter((a) => a.status === "paused").length;

  const step: OnboardingStep = onboardingStep({
    account: account ? account.status : "none",
    postCount: posts.length,
    automationCount: automations.length,
    activeCount,
    hasActivity: comments.length > 0 || deliveries.length > 0,
  });

  // Greeting from the profile timezone (spec §4) — no fake personalization.
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = profileName.split(/\s+/)[0] ?? "";
  const greeting = firstName ? `${part}, ${firstName}` : "Welcome back";

  // Attention items — only real issues (spec §8); onboarding covers the
  // no-posts / no-automations cases via SetupCard.
  const attention: { title: string; body: string; cta: string; href: string }[] = [];
  if (accountError) {
    attention.push({
      title: "Instagram connection requires attention",
      body: "Reconnect your Instagram account to continue receiving comments.",
      cta: "Reconnect",
      href: "/settings/social-accounts",
    });
  }
  if (totals.failed > 0) {
    attention.push({
      title: `${totals.failed} ${totals.failed === 1 ? "delivery" : "deliveries"} failed`,
      body: "Review the failed deliveries.",
      cta: "View failures",
      href: "/inbox?outcome=failed",
    });
  }

  // Recent activity — matched comments + real delivery outcomes, newest first.
  const feed = [
    ...comments
      .filter((c) => c.matched)
      .map((c) => ({
        id: `c-${c.id}`,
        at: c.createdAt,
        label: "Comment matched",
        detail: `@${c.username} — “${c.text}”`,
        sub: c.automationName ?? "Automation",
        badge: "Matched",
        tone: "neutral" as const,
      })),
    ...deliveries.map((d) => ({
      id: `d-${d.id}`,
      at: d.createdAt,
      label: `${d.kind === "private_dm" ? "Private DM" : "Public reply"} ${
        d.status === "delivered" || d.status === "sent" ? "sent" : d.status
      }`,
      detail: `@${d.recipient}`,
      sub: d.error
        ? `${commentAutomation(comments, d.commentId)} — ${d.error}`
        : commentAutomation(comments, d.commentId),
      badge:
        d.status === "delivered"
          ? "Delivered"
          : d.status === "sent"
            ? "Sent"
            : d.status === "queued"
              ? "Queued"
              : d.status === "processing"
                ? "Processing"
                : "Failed",
      tone: deliveryTone[d.status],
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const flowEmpty = totals.comments === 0;
  const matchRate =
    totals.comments > 0 ? (totals.matched / totals.comments) * 100 : null;
  const acceptance =
    totals.matched > 0 ? (totals.dmsSent / totals.matched) * 100 : null;

  const primaryAction = !account
    ? { label: "Connect Instagram", href: "/settings/social-accounts" }
    : accountError
      ? { label: "Reconnect", href: "/settings/social-accounts" }
      : posts.length === 0
        ? { label: "Sync posts", href: "/posts" }
        : { label: "Create automation", href: "/automations/new" };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={greeting}
        description="Here's what's happening with your automations today."
        action={
          posts.length > 0 && account && !accountError ? (
            <Link href="/automations/new" className={buttonClasses("primary")}>
              Create automation
            </Link>
          ) : undefined
        }
      />

      {/* Connection — context for everything below. Three honest branches:
          connected / needs attention (reconnect) / never connected. */}
      <Card
        className={`mb-6 flex items-center gap-4 p-4 ${
          connected || !account ? "" : "border-danger/30"
        }`}
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-pill ${
            connected
              ? "bg-foreground text-background"
              : account
                ? "bg-danger-soft text-danger"
                : "bg-surface-muted text-subtle-foreground"
          }`}
        >
          <IconInstagram className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {connected && account
              ? `@${account.username}`
              : account
                ? "Instagram needs attention"
                : "Instagram not connected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {connected && account
              ? `${account.followers.toLocaleString()} followers · connected since ${new Date(
                  account.connectedAt,
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : account
                ? "The connection reported an error — reconnect to keep automations running."
                : "Connect your Instagram professional account to run comment-to-DM automations."}
          </p>
        </div>
        <Badge tone={connected ? "success" : account ? "failed" : "neutral"}>
          {connected ? "Connected" : account ? "Needs attention" : "Not connected"}
        </Badge>
        <Link
          href="/settings/social-accounts"
          className={
            connected
              ? "shrink-0 text-sm font-medium text-primary hover:text-primary-hover"
              : `${buttonClasses("secondary")} shrink-0`
          }
        >
          {connected ? "Manage" : account ? "Reconnect" : "Connect Instagram"}
        </Link>
      </Card>

      {/* First-run checklist — derived state (lib/onboarding); hidden once the
          workspace is fully live so the dashboard never nags. */}
      {step !== "connect" && step !== "reconnect" && step !== "live" && (
        <SetupCard step={step} />
      )}

      {/* Automation flow — the product's core loop with today's real numbers
          (spec §6 + §10). Stage 2 has no number: keyword detection and the
          match claim are one event, counting both would double-count. */}
      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Your automation flow</CardTitle>
          <span className="text-xs text-subtle-foreground">Today</span>
        </div>
        {flowEmpty ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-foreground">No activity yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your automation flow will appear here once comments start arriving.
            </p>
          </div>
        ) : (
          <>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FlowStage value={totals.comments.toLocaleString()} label="Comments" />
              <FlowStage label="Keyword detected" />
              <FlowStage value={totals.matched.toLocaleString()} label="Matched" />
              <FlowStage value={totals.dmsSent.toLocaleString()} label="DMs sent" />
            </ol>
            {(matchRate !== null || acceptance !== null) && (
              <p className="mt-4 text-xs text-subtle-foreground">
                {[
                  matchRate !== null ? `${matchRate.toFixed(1)}% match rate` : null,
                  acceptance !== null
                    ? `${acceptance.toFixed(1)}% delivery acceptance rate`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </>
        )}
      </Card>

      {/* Today's activity + Automation health (spec §7/§19) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Today&apos;s activity</CardTitle>
            <span className="text-xs text-subtle-foreground">{today.label}</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-4">
            <TodayStat label="Comments" value={totals.comments} />
            <TodayStat label="Matched" value={totals.matched} />
            <TodayStat label="DMs sent" value={totals.dmsSent} />
            <TodayStat label="Failed" value={totals.failed} danger={totals.failed > 0} />
          </dl>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Automation health</CardTitle>
            <Link
              href="/automations"
              className="text-xs font-medium text-primary hover:text-primary-hover"
            >
              Manage automations
            </Link>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-pill ${
                accountError || totals.failed > 0 ? "bg-danger" : "bg-success"
              }`}
            />
            {accountError || totals.failed > 0
              ? "Attention needed"
              : "All systems healthy"}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <HealthRow label="Active" value={`${activeCount} of ${automations.length}`} />
            <HealthRow label="Paused" value={`${pausedCount}`} />
            <HealthRow
              label="Failed today"
              value={`${totals.failed}`}
              danger={totals.failed > 0}
            />
            <HealthRow
              label="Instagram"
              value={connected ? "Connected" : account ? "Needs attention" : "Not connected"}
              danger={accountError}
            />
          </dl>
        </Card>
      </div>

      {/* Needs Attention — rendered only when real issues exist (spec §8) */}
      {attention.length > 0 && (
        <Card className="mt-6 border-danger/30 p-5">
          <CardTitle>Needs attention</CardTitle>
          <ul className="mt-3 space-y-4">
            {attention.map((item) => (
              <li key={item.title} className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body}</p>
                </div>
                <Link href={item.href} className={buttonClasses("secondary")}>
                  {item.cta}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Recent activity — real records only, labeled "Recent activity"
          (never "Live Activity" — no realtime subscription, spec §9). */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <CardTitle>Recent activity</CardTitle>
          <Link
            href="/inbox"
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            View inbox
          </Link>
        </div>
        {feed.length === 0 ? (
          <EmptyState
            text="No recent activity. Matched comments and delivery outcomes will appear here."
            ctaLabel="Create automation"
            ctaHref="/automations/new"
          />
        ) : (
          <ul className="divide-y divide-border-muted">
            {feed.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">
                    <span className="font-medium">{item.label}</span>{" "}
                    <span className="text-muted-foreground">— {item.detail}</span>
                  </p>
                  <p className="truncate text-xs text-subtle-foreground">{item.sub}</p>
                </div>
                <Badge tone={item.tone}>{item.badge}</Badge>
                <time
                  dateTime={item.at}
                  className="hidden shrink-0 text-xs text-subtle-foreground sm:block"
                >
                  {relativeTime(item.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Interactive demo — client island, demo data never leaves it (§12–§17). */}
      <Demo />

      {/* Quick actions — contextual, never offering an action that cannot work
          (spec §11). */}
      <Card className="mt-6 p-5">
        <CardTitle>Quick actions</CardTitle>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={primaryAction.href} className={buttonClasses("primary")}>
            {primaryAction.label}
          </Link>
          <Link href="/inbox" className={buttonClasses("secondary")}>
            View inbox
          </Link>
        </div>
      </Card>
    </div>
  );
}

function FlowStage({ value, label }: { value?: string; label: string }) {
  return (
    <li className="rounded-control border border-border-muted bg-surface p-4 text-center">
      <p className="min-h-[2rem] text-2xl font-semibold tabular-nums text-foreground">
        {value ?? <span aria-hidden="true" className="text-subtle-foreground">·</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </li>
  );
}

function TodayStat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function HealthRow({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border-muted pb-1.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`text-sm font-semibold tabular-nums ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState({
  text,
  ctaLabel,
  ctaHref,
}: {
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">{text}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className={`${buttonClasses("secondary")} mt-4`}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function commentAutomation(comments: CommentEvent[], commentId: string): string {
  return comments.find((c) => c.id === commentId)?.automationName ?? "Automation unknown";
}

// First-run checklist (Task 024) — pure derived state from lib/onboarding.
function SetupCard({ step }: { step: OnboardingStep }) {
  const items = setupChecklist(step);
  const current = items.find((i) => i.state === "current");

  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>
          {step === "waiting" ? "Automation is live" : "Get started"}
        </CardTitle>
        {step === "waiting" && <Badge tone="info">Waiting for comments</Badge>}
      </div>
      {step === "waiting" ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Your automation is active. When a comment matches the keyword,
          SMMOMO sends the private DM — matches and deliveries will appear in
          the inbox.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill text-xs ${
                    item.state === "done"
                      ? "bg-success-soft text-success-strong"
                      : item.state === "current"
                        ? "bg-primary-soft text-primary"
                        : "bg-surface-muted text-subtle-foreground"
                  }`}
                >
                  {item.state === "done" ? "✓" : item.state === "current" ? "→" : ""}
                </span>
                <span
                  className={
                    item.state === "current"
                      ? "font-medium text-foreground"
                      : item.state === "done"
                        ? "text-muted-foreground"
                        : "text-subtle-foreground"
                  }
                >
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
          {current && (
            <Link href={current.href} className={`${buttonClasses("secondary")} mt-4`}>
              {current.label}
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
