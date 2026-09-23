"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import type {
  Automation,
  CommentEvent,
  MessageDelivery,
  Post,
} from "@/types";

type OutcomeFilter = "all" | "sent" | "failed" | "ignored";

const outcomeFilters: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "ignored", label: "Ignored" },
];

// Same tone/label maps as Dashboard — statuses come straight from
// MessageDelivery["status"]; no invented statuses.
const deliveryTone = {
  delivered: "success",
  sent: "info",
  queued: "draft",
  failed: "failed",
} as const;

const deliveryLabel: Record<MessageDelivery["status"], string> = {
  queued: "Queued",
  sent: "Sent",
  delivered: "Delivered",
  failed: "Failed",
};

// Comment outcome — same join logic as Dashboard (deliveries by commentId;
// no invented fields). filterKey maps to the toolbar filters; "queued"/
// "matched" outcomes have no filter button (none exist in current data) and
// stay visible under All only.
function commentOutcome(c: CommentEvent, deliveries: MessageDelivery[]) {
  if (!c.matched)
    return {
      tone: "neutral" as const,
      label: "Ignored",
      filterKey: "ignored" as const,
    };
  const dm = deliveries.find(
    (d) => d.commentId === c.id && d.kind === "private_dm",
  );
  if (dm?.status === "failed")
    return {
      tone: "failed" as const,
      label: "Failed",
      filterKey: "failed" as const,
    };
  if (dm?.status === "delivered" || dm?.status === "sent")
    return {
      tone: "success" as const,
      label: "DM sent",
      filterKey: "sent" as const,
    };
  if (dm?.status === "queued")
    return { tone: "draft" as const, label: "Queued", filterKey: null };
  return { tone: "info" as const, label: "Matched", filterKey: null };
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

// Client island: owns selection + search + filters only. Data arrives as
// props from the server page (still loaded through lib/api — no fetch, no
// direct mock imports here). Read-only: no reply/retry/delete actions
// (messaging belongs to Task 014+).
export function InboxView({
  comments,
  deliveries,
  automations,
  posts,
}: {
  comments: CommentEvent[];
  deliveries: MessageDelivery[];
  automations: Automation[];
  posts: Post[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    comments[0]?.id ?? null,
  );
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [postFilter, setPostFilter] = useState("all");
  const [query, setQuery] = useState("");

  // Posts that actually have activity — the post filter only offers these.
  const activePostIds = useMemo(
    () => [...new Set(comments.map((c) => c.postId))],
    [comments],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return comments.filter((c) => {
      const o = commentOutcome(c, deliveries);
      if (outcome !== "all" && o.filterKey !== outcome) return false;
      if (postFilter !== "all" && c.postId !== postFilter) return false;
      if (q === "") return true;
      // Search fields all live on CommentEvent — no invented join fields.
      return (
        c.text.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.postCaption.toLowerCase().includes(q) ||
        (c.automationName ?? "").toLowerCase().includes(q)
      );
    });
  }, [comments, deliveries, outcome, postFilter, query]);

  const isFiltered =
    outcome !== "all" || postFilter !== "all" || query.trim() !== "";

  // Keep a selection that survives filtering; fall back to the first
  // visible row (or none when the list is filtered empty).
  const active = visible.find((c) => c.id === selectedId) ?? visible[0] ?? null;

  function clearFilters() {
    setOutcome("all");
    setPostFilter("all");
    setQuery("");
  }

  const activeOutcome = active ? commentOutcome(active, deliveries) : null;
  // CommentEvent carries automationName (not an id) — name is the join key
  // the model provides (unique in mock data; a real automationId arrives
  // with the comments table in a later backend task).
  const activeAutomation = active?.automationName
    ? automations.find((a) => a.name === active.automationName)
    : undefined;
  const activePost = active
    ? posts.find((p) => p.id === active.postId)
    : undefined;
  const activeDeliveries = active
    ? deliveries.filter((d) => d.commentId === active.id)
    : [];
  const activeDm = activeDeliveries.find((d) => d.kind === "private_dm");
  const activeReply = activeDeliveries.find(
    (d) => d.kind === "public_reply",
  );

  return (
    <div>
      {/* Toolbar: outcome filters + post filter + search */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by outcome"
          className="flex flex-wrap gap-1.5"
        >
          {outcomeFilters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setOutcome(f.value)}
              aria-pressed={outcome === f.value}
              className={`rounded-control px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                outcome === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filter by post"
            value={postFilter}
            onChange={(e) => setPostFilter(e.target.value)}
            className="w-auto max-w-[16rem]"
          >
            <option value="all">All posts</option>
            {activePostIds.map((id) => {
              const p = posts.find((x) => x.id === id);
              return (
                <option key={id} value={id}>
                  {p ? truncate(p.caption, 60) : id}
                </option>
              );
            })}
          </Select>
          <Input
            type="search"
            aria-label="Search activity by comment, author, post, or automation"
            placeholder="Search activity…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {isFiltered && (
        <p aria-live="polite" className="mb-2 text-xs text-subtle-foreground">
          Showing {visible.length} of {comments.length}
        </p>
      )}

      {/* Two-panel: activity list (left) + selected detail (right).
          Stacks to a single column below lg. */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-5">
          <div className="border-b border-border-muted px-5 py-4">
            <CardTitle>Activity</CardTitle>
          </div>

          {visible.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No activity matches your filters.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className={`${buttonClasses("secondary")} mt-4`}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-border-muted">
              {visible.map((c) => {
                const o = commentOutcome(c, deliveries);
                const isActive = active?.id === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`w-full border-l-2 px-5 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                        isActive
                          ? "border-primary bg-primary-soft"
                          : "border-transparent hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          @{c.username}
                        </span>
                        <Badge tone={o.tone}>{o.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        “{c.text}”
                      </p>
                      <p
                        className="mt-1 truncate text-xs text-subtle-foreground"
                        title={`${c.postCaption} · ${
                          c.automationName
                            ? `Automation: ${c.automationName}`
                            : "No automation matched"
                        }`}
                      >
                        {c.postCaption} ·{" "}
                        {c.automationName
                          ? `Automation: ${c.automationName}`
                          : "No automation matched"}
                      </p>
                      <time
                        dateTime={c.createdAt}
                        className="mt-1 block text-xs text-subtle-foreground"
                      >
                        {relativeTime(c.createdAt)}
                      </time>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-7">
          {!active || !activeOutcome ? (
            <div className="px-5 py-10 text-center">
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                Select an activity to see the comment, automation, and delivery
                details.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border-muted px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    @{active.username}
                  </p>
                  <time
                    dateTime={active.createdAt}
                    className="text-xs text-subtle-foreground"
                  >
                    {absoluteTime(active.createdAt)} ·{" "}
                    {relativeTime(active.createdAt)}
                  </time>
                </div>
                <Badge tone={activeOutcome.tone}>{activeOutcome.label}</Badge>
              </div>

              <div className="space-y-5 px-5 py-5">
                {/* Comment */}
                <section aria-labelledby="inbox-comment-heading">
                  <h3
                    id="inbox-comment-heading"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Comment
                  </h3>
                  <blockquote className="mt-2 rounded-control bg-surface-muted px-3.5 py-2.5 text-sm text-foreground">
                    “{active.text}”
                  </blockquote>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="min-w-0 max-w-full">
                      {truncate(active.postCaption, 80)}
                    </span>
                    {activePost && <Badge tone="neutral">{activePost.type}</Badge>}
                    {activePost && (
                      <a
                        href={activePost.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View the post on Instagram (opens in a new tab)`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        View on Instagram
                      </a>
                    )}
                  </div>
                </section>

                {/* Automation */}
                <section aria-labelledby="inbox-automation-heading">
                  <h3
                    id="inbox-automation-heading"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Automation
                  </h3>
                  {active.automationName ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {activeAutomation ? (
                        <Link
                          href={`/automations/${activeAutomation.id}`}
                          className="text-sm font-medium text-primary hover:text-primary-hover"
                        >
                          {activeAutomation.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-foreground">
                          {active.automationName}
                        </span>
                      )}
                      {activeAutomation && (
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                          {activeAutomation.keyword}
                        </code>
                      )}
                      {activeAutomation && (
                        <Badge
                          tone={
                            activeAutomation.status === "active"
                              ? "success"
                              : activeAutomation.status === "paused"
                                ? "paused"
                                : "draft"
                          }
                        >
                          {activeAutomation.status}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No automation matched this comment.
                    </p>
                  )}
                </section>

                {/* Public reply — shown when configured or a delivery exists */}
                {(activeAutomation?.publicReply || activeReply) && (
                  <section aria-labelledby="inbox-reply-heading">
                    <h3
                      id="inbox-reply-heading"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Public reply
                    </h3>
                    {activeAutomation?.publicReply && (
                      <p className="mt-2 text-sm text-foreground">
                        {activeAutomation.publicReply}
                      </p>
                    )}
                    {activeReply ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={deliveryTone[activeReply.status]}>
                          {deliveryLabel[activeReply.status]}
                        </Badge>
                        <time
                          dateTime={activeReply.createdAt}
                          className="text-xs text-subtle-foreground"
                        >
                          {relativeTime(activeReply.createdAt)}
                        </time>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-subtle-foreground">
                        No public reply recorded for this comment.
                      </p>
                    )}
                    {activeReply?.error && (
                      <ErrorBlock
                        error={activeReply.error}
                        channel="public reply"
                      />
                    )}
                  </section>
                )}

                {/* Private DM — shown when automation configured or delivery exists */}
                {(activeAutomation?.privateReply || activeDm) && (
                  <section aria-labelledby="inbox-dm-heading">
                    <h3
                      id="inbox-dm-heading"
                      className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                    >
                      Private DM
                    </h3>
                    {activeAutomation?.privateReply && (
                      <blockquote className="mt-2 whitespace-pre-wrap rounded-control bg-primary-soft px-3.5 py-2.5 text-sm text-foreground">
                        {activeAutomation.privateReply}
                      </blockquote>
                    )}
                    {activeDm ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={deliveryTone[activeDm.status]}>
                          {deliveryLabel[activeDm.status]}
                        </Badge>
                        <time
                          dateTime={activeDm.createdAt}
                          className="text-xs text-subtle-foreground"
                        >
                          {relativeTime(activeDm.createdAt)}
                        </time>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-subtle-foreground">
                        No delivery recorded for this comment.
                      </p>
                    )}
                    {activeDm?.status === "failed" && activeDm.error && (
                      <ErrorBlock
                        error={activeDm.error}
                        channel="private message"
                      />
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// Delivery failure callout — user-safe copy only: channel sentence +
// the error string already on MessageDelivery (no stack traces, no internals).
function ErrorBlock({
  error,
  channel,
}: {
  error: string;
  channel: string;
}) {
  return (
    <div className="mt-3 rounded-control border border-danger/30 bg-danger-soft px-3.5 py-3">
      <p className="text-sm font-semibold text-danger-strong">
        Delivery failed
      </p>
      <p className="mt-0.5 text-sm text-foreground">
        Unable to send the {channel}.
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{error}</p>
    </div>
  );
}
