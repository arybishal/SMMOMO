import Link from "next/link";
import { getAnalyticsSummary } from "@/lib/api/analytics";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { listAutomations } from "@/lib/api/automations";
import { listPosts } from "@/lib/api/posts";
import { getUsageSummary } from "@/lib/api/usage";
import { onboardingStep, setupChecklist, type OnboardingStep } from "@/lib/onboarding";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import {
  IconArrowRight,
  IconAutomation,
  IconInstagram,
} from "@/components/layout/icons";
import type { CommentEvent, MessageDelivery } from "@/types";

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

export default async function DashboardPage() {
  const [stats, account, comments, deliveries, automations, usage, posts] =
    await Promise.all([
      getAnalyticsSummary(),
      getInstagramAccount(),
      listRecentComments(),
      listRecentDeliveries(),
      listAutomations(),
      getUsageSummary(),
      listPosts(),
    ]);

  const connected = account?.status === "connected";
  const step: OnboardingStep = onboardingStep({
    account: account ? account.status : "none",
    postCount: posts.length,
    automationCount: automations.length,
    activeCount: automations.filter((a) => a.status === "active").length,
    hasActivity: comments.length > 0 || deliveries.length > 0,
  });

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
          {connected
            ? "Manage"
            : account
              ? "Reconnect"
              : "Connect Instagram"}
        </Link>
      </Card>

      {/* First-run checklist — derived state (lib/onboarding); hidden once the
          workspace is fully live so the dashboard never nags. */}
      {step !== "connect" && step !== "reconnect" && step !== "live" && (
        <SetupCard step={step} />
      )}

      {/* Primary metrics — deliberately weighted, not a wall of equal cards.
          No period label: AnalyticsSummary has no period field (not fabricated). */}
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

      {/* Usage snapshot — period comes from the UsageSummary contract */}
      <Card className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
        <span className="text-sm font-semibold text-foreground">
          Usage · {usage.period}
        </span>
        <Stat value={usage.dmsSent} label="DMs sent" />
        <Stat value={usage.commentsProcessed} label="comments processed" />
        <Stat value={usage.publicReplies} label="public replies" />
        <Stat
          value={usage.failedDeliveries}
          label="failed"
          danger={usage.failedDeliveries > 0}
        />
        <Link
          href="/settings/usage"
          className="ml-auto text-xs font-medium text-primary hover:text-primary-hover"
        >
          Details
        </Link>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Recent comment activity — state includes delivery outcome */}
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
          {comments.length === 0 ? (
            <EmptyState
              text="No recent comments. Comments on your posts will appear here."
              ctaLabel="Create automation"
              ctaHref="/automations/new"
            />
          ) : (
            <ul className="divide-y divide-border-muted">
              {comments.slice(0, 5).map((c) => {
                const state = commentState(c, deliveries);
                return (
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
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <time
                      dateTime={c.createdAt}
                      className="hidden shrink-0 text-xs text-subtle-foreground sm:block"
                    >
                      {relativeTime(c.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Automations */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
            <CardTitle>Automations</CardTitle>
            {automations.length > 0 && (
              <Link
                href="/automations"
                className="text-xs font-medium text-primary hover:text-primary-hover"
              >
                View all
              </Link>
            )}
          </div>
          {automations.length === 0 ? (
            <EmptyState
              text="No automations yet. Create one to start replying with DMs when followers comment your keyword."
              ctaLabel="Create automation"
              ctaHref="/automations/new"
              ctaVariant="primary"
            />
          ) : (
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
          )}
        </Card>
      </div>

      {/* Recent deliveries — DM / reply outcomes, automation joined via comment */}
      <Card className="mt-6">
        <div className="flex items-center justify-between border-b border-border-muted px-5 py-4">
          <CardTitle>Recent deliveries</CardTitle>
          <Link
            href="/inbox"
            className="text-xs font-medium text-primary hover:text-primary-hover"
          >
            View inbox
          </Link>
        </div>
        {deliveries.length === 0 ? (
          <EmptyState
            text="No delivery activity yet. DMs and replies will appear here after a keyword match."
            ctaLabel="Create automation"
            ctaHref="/automations/new"
          />
        ) : (
          <ul className="divide-y divide-border-muted">
            {deliveries.slice(0, 4).map((d) => {
              const comment = comments.find((c) => c.id === d.commentId);
              return (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-medium">@{d.recipient}</span>{" "}
                      <span className="text-muted-foreground">
                        — {d.kind === "private_dm" ? "Private DM" : "Public reply"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-subtle-foreground">
                      {d.error ??
                        (comment?.automationName
                          ? comment.automationName
                          : "Automation unknown")}
                    </p>
                  </div>
                  <Badge tone={deliveryTone[d.status]}>
                    {deliveryLabel[d.status]}
                  </Badge>
                  <time
                    dateTime={d.createdAt}
                    className="hidden shrink-0 text-xs text-subtle-foreground sm:block"
                  >
                    {relativeTime(d.createdAt)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
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
      {danger && (
        <p className="mt-1 text-xs text-danger-strong">Needs attention</p>
      )}
    </Card>
  );
}

function Stat({
  value,
  label,
  danger = false,
}: {
  value: number;
  label: string;
  danger?: boolean;
}) {
  return (
    <span className="text-xs text-muted-foreground">
      <span
        className={`font-semibold tabular-nums ${danger ? "text-danger" : "text-foreground"}`}
      >
        {value.toLocaleString()}
      </span>{" "}
      {label}
    </span>
  );
}

function EmptyState({
  text,
  ctaLabel,
  ctaHref,
  ctaVariant = "secondary",
}: {
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaVariant?: "primary" | "secondary";
}) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">{text}</p>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} className={`${buttonClasses(ctaVariant)} mt-4`}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

// First-run checklist (Task 024) — pure derived state from lib/onboarding.
// One current step, one CTA; done steps stay visible so progress reads at a
// glance. `waiting` = active + no activity yet (honest live state, no CTA).
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

// Outcome badge for a comment: Ignored / Failed / DM sent / Queued / Matched.
// Delivery looked up by commentId — no invented fields on either type.
function commentState(c: CommentEvent, deliveries: MessageDelivery[]) {
  if (!c.matched) return { tone: "neutral" as const, label: "Ignored" };
  const dm = deliveries.find(
    (d) => d.commentId === c.id && d.kind === "private_dm",
  );
  if (dm?.status === "failed") return { tone: "failed" as const, label: "Failed" };
  if (dm?.status === "delivered" || dm?.status === "sent")
    return { tone: "success" as const, label: "DM sent" };
  if (dm?.status === "queued") return { tone: "draft" as const, label: "Queued" };
  if (dm?.status === "processing")
    return { tone: "info" as const, label: "Processing" };
  return { tone: "info" as const, label: "Matched" };
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
