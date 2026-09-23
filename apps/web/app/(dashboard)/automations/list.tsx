"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import type { Automation, AutomationStatus } from "@/types";

type Filter = "all" | AutomationStatus;

const filters: Filter[] = ["all", "active", "paused", "draft"];

// Unknown statuses render as neutral — never coerced to active.
function statusTone(
  status: AutomationStatus,
): "success" | "paused" | "draft" | "neutral" {
  if (status === "active") return "success";
  if (status === "paused") return "paused";
  if (status === "draft") return "draft";
  return "neutral";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Client island: owns filter + search state only; data arrives as props from
// the server page (still loaded through lib/api/automations — no fetch here).
export function AutomationList({ automations }: { automations: Automation[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return automations.filter(
      (a) =>
        (filter === "all" || a.status === filter) &&
        (q === "" ||
          a.name.toLowerCase().includes(q) ||
          a.keyword.toLowerCase().includes(q)),
    );
  }, [automations, filter, query]);

  const isFiltered = filter !== "all" || query.trim() !== "";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by status"
          className="flex flex-wrap gap-1.5"
        >
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-control px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                filter === f
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Search automations by name or keyword"
          placeholder="Search name or keyword…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {isFiltered && (
        <p aria-live="polite" className="mb-2 text-xs text-subtle-foreground">
          Showing {visible.length} of {automations.length}
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Column headers: desktop only; cards below lg */}
        <div className="hidden border-b border-border-muted bg-surface-muted px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-12 lg:gap-4">
          <span className="lg:col-span-4">Automation</span>
          <span className="lg:col-span-2">Trigger</span>
          <span className="lg:col-span-2">Private DM</span>
          <span className="lg:col-span-1">Status</span>
          <span className="lg:col-span-3">Performance</span>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No automations match your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
              className={`${buttonClasses("secondary")} mt-4`}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-border-muted">
            {visible.map((a) => (
              <li
                key={a.id}
                className="px-5 py-4 lg:grid lg:grid-cols-12 lg:items-center lg:gap-4"
              >
                <div className="min-w-0 lg:col-span-4">
                  <Link
                    href={`/automations/${a.id}`}
                    className="block truncate text-sm font-medium text-foreground hover:text-primary"
                  >
                    {a.name}
                  </Link>
                  <p
                    className="truncate text-xs text-subtle-foreground"
                    title={a.postCaption}
                  >
                    {a.postCaption}
                  </p>
                  <p className="truncate text-xs text-subtle-foreground">
                    Updated{" "}
                    <time dateTime={a.updatedAt}>{formatDate(a.updatedAt)}</time>
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2 lg:col-span-2 lg:mt-0">
                  <span className="text-xs text-subtle-foreground lg:hidden">
                    Keyword
                  </span>
                  {/* Keyword chip: direct zinc utilities are fine for one-off code styling */}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700">
                    {a.keyword}
                  </code>
                </div>

                <div className="mt-2 min-w-0 lg:col-span-2 lg:mt-0">
                  <span className="mb-0.5 block text-xs text-subtle-foreground lg:hidden">
                    Private DM
                  </span>
                  <p
                    className="truncate text-xs text-muted-foreground"
                    title={a.privateReply}
                  >
                    {a.privateReply}
                  </p>
                </div>

                <div className="mt-2 lg:col-span-1 lg:mt-0">
                  <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 lg:col-span-3 lg:mt-0">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">
                        {a.matchedCount}
                      </span>{" "}
                      matched
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">
                        {a.dmSentCount}
                      </span>{" "}
                      DMs
                    </span>
                    <span
                      className={
                        a.failedCount > 0 ? "text-danger" : "text-muted-foreground"
                      }
                    >
                      <span className="font-semibold">{a.failedCount}</span>{" "}
                      failed
                    </span>
                  </div>
                  <Link
                    href={`/automations/${a.id}`}
                    className="shrink-0 text-xs font-medium text-primary hover:text-primary-hover lg:hidden"
                  >
                    View
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
