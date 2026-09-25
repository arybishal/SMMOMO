import { request } from "./client";
import { mockAnalytics, mockOverview } from "@/lib/mock/analytics";
import type { AnalyticsOverview, AnalyticsSummary } from "@/types";

export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return request("/analytics/summary", () => mockAnalytics);
}

export interface OverviewParams {
  /** Inclusive ISO instant. */
  start: string;
  /** Exclusive ISO instant. */
  end: string;
  /** IANA timezone used to bucket/label the series. */
  tz: string;
  automationId?: string;
  postId?: string;
}

export function getAnalyticsOverview(
  params: OverviewParams,
): Promise<AnalyticsOverview> {
  const qs = new URLSearchParams({
    start: params.start,
    end: params.end,
    tz: params.tz,
  });
  if (params.automationId) qs.set("automationId", params.automationId);
  if (params.postId) qs.set("postId", params.postId);
  return request(`/analytics/overview?${qs.toString()}`, () => mockOverview);
}
