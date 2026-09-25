"use client";

import { useRouter } from "next/navigation";
import { Label, Select, Input } from "@/components/ui/input";
import { RANGE_PRESETS } from "@/lib/analytics/range";

// Task 027 — URL-driven analytics filters (spec §22). Every control writes
// query params the server page resolves; no client-side data fetching.

export interface FilterOption {
  id: string;
  label: string;
}

export interface AnalyticsFiltersProps {
  preset: string;
  start: string;
  end: string;
  automationId: string;
  postId: string;
  automations: FilterOption[];
  posts: FilterOption[];
}

export default function AnalyticsFilters({
  preset,
  start,
  end,
  automationId,
  postId,
  automations,
  posts,
}: AnalyticsFiltersProps) {
  const router = useRouter();

  function go(update: Record<string, string>) {
    const next = {
      preset,
      start,
      end,
      automation: automationId,
      post: postId,
      ...update,
    };
    const qs = new URLSearchParams();
    if (next.preset) qs.set("range", next.preset);
    if (next.preset === "custom") {
      if (next.start) qs.set("start", next.start);
      if (next.end) qs.set("end", next.end);
    }
    if (next.automation) qs.set("automation", next.automation);
    if (next.post) qs.set("post", next.post);
    router.replace(`/analytics?${qs.toString()}`, { scroll: false });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Label htmlFor="filter-range">Date range</Label>
        <Select
          id="filter-range"
          className="mt-1.5"
          value={preset}
          onChange={(e) => go({ preset: e.target.value, start: "", end: "" })}
        >
          {RANGE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>

      {preset === "custom" && (
        <>
          <div>
            <Label htmlFor="filter-start">Start date</Label>
            <Input
              id="filter-start"
              type="date"
              className="mt-1.5"
              value={start}
              onChange={(e) => go({ preset: "custom", start: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="filter-end">End date</Label>
            <Input
              id="filter-end"
              type="date"
              className="mt-1.5"
              value={end}
              onChange={(e) => go({ preset: "custom", end: e.target.value })}
            />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="filter-automation">Automation</Label>
        <Select
          id="filter-automation"
          className="mt-1.5"
          value={automationId}
          onChange={(e) => go({ automation: e.target.value })}
        >
          <option value="">All automations</option>
          {automations.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="filter-post">Post</Label>
        <Select
          id="filter-post"
          className="mt-1.5"
          value={postId}
          onChange={(e) => go({ post: e.target.value })}
        >
          <option value="">All posts</option>
          {posts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
