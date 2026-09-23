"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import { IconPosts } from "@/components/layout/icons";
import type { Automation, InstagramMediaType, Post } from "@/types";

type Filter = "all" | InstagramMediaType;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "REEL", label: "Reels" },
  { value: "IMAGE", label: "Posts" },
  { value: "CAROUSEL", label: "Carousels" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Client island: owns filter + search state only; posts and automations
// arrive as props from the server page (still loaded through lib/api —
// no fetch here). Automations are joined to posts by postId for the
// Automations column — real mock relationships, nothing manufactured.
export function PostsList({
  posts,
  automations,
}: {
  posts: Post[];
  automations: Automation[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter(
      (p) =>
        (filter === "all" || p.type === filter) &&
        (q === "" ||
          p.caption.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)),
    );
  }, [posts, filter, query]);

  const isFiltered = filter !== "all" || query.trim() !== "";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter by media type"
          className="flex flex-wrap gap-1.5"
        >
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={`rounded-control px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                filter === f.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Search posts by caption"
          placeholder="Search captions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      {isFiltered && (
        <p aria-live="polite" className="mb-2 text-xs text-subtle-foreground">
          Showing {visible.length} of {posts.length}
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Column headers: desktop only; cards below lg */}
        <div className="hidden border-b border-border-muted bg-surface-muted px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-12 lg:gap-4">
          <span className="lg:col-span-4">Post</span>
          <span className="lg:col-span-2">Type</span>
          <span className="lg:col-span-2">Published</span>
          <span className="lg:col-span-2">Automations</span>
          <span className="lg:col-span-2">Action</span>
        </div>

        {visible.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No posts match your filters.
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
            {visible.map((p) => {
              const linked = automations.filter((a) => a.postId === p.id);
              return (
                <li
                  key={p.id}
                  className="px-5 py-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4"
                >
                  <div className="flex min-w-0 items-start gap-3 lg:col-span-4">
                    {/* mediaUrl is null in mocks — gradient placeholder keeps
                        the app offline-friendly; real thumbnails get alt text. */}
                    {p.mediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.mediaUrl}
                        alt={p.caption}
                        className="h-10 w-10 shrink-0 rounded-control object-cover"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-gradient-to-br from-zinc-100 to-zinc-200"
                      >
                        <IconPosts className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-medium text-foreground"
                        title={p.caption}
                      >
                        {p.caption}
                      </p>
                      <p className="truncate text-xs text-subtle-foreground">
                        {p.likesCount.toLocaleString()} likes ·{" "}
                        {p.commentsCount} comments
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2 lg:col-span-2 lg:mt-0">
                    <span className="text-xs text-subtle-foreground lg:hidden">
                      Type
                    </span>
                    <Badge tone="neutral">{p.type}</Badge>
                  </div>

                  <div className="mt-2 lg:col-span-2 lg:mt-0">
                    <span className="mb-0.5 block text-xs text-subtle-foreground lg:hidden">
                      Published
                    </span>
                    <time
                      dateTime={p.postedAt}
                      className="text-xs text-muted-foreground"
                    >
                      {formatDate(p.postedAt)}
                    </time>
                  </div>

                  <div className="mt-2 min-w-0 lg:col-span-2 lg:mt-0">
                    <span className="mb-0.5 block text-xs text-subtle-foreground lg:hidden">
                      Automations
                    </span>
                    {linked.length === 0 ? (
                      <p className="text-xs text-subtle-foreground">
                        No automations
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-foreground">
                          {linked.length}{" "}
                          {linked.length === 1 ? "automation" : "automations"}
                        </p>
                        {linked.map((a) => (
                          <Link
                            key={a.id}
                            href={`/automations/${a.id}`}
                            className="block truncate text-xs font-medium text-primary hover:text-primary-hover"
                          >
                            {a.name}
                          </Link>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-2 lg:mt-0">
                    <Link
                      href={`/automations/new?post=${p.id}`}
                      className="text-xs font-medium text-primary hover:text-primary-hover"
                    >
                      Create automation
                    </Link>
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View “${p.caption}” on Instagram (opens in a new tab)`}
                      className="text-xs font-medium text-subtle-foreground hover:text-foreground"
                    >
                      View on Instagram
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
