import { request } from "./client";
import { mockAnalytics } from "@/lib/mock/analytics";
import type { AnalyticsSummary } from "@/types";

export function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return request("/analytics/summary", () => mockAnalytics);
}
