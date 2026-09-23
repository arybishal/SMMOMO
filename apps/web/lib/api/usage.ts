import { request } from "./client";
import { mockUsage } from "@/lib/mock/analytics";
import type { UsageSummary } from "@/types";

export function getUsageSummary(): Promise<UsageSummary> {
  return request("/usage/summary", () => mockUsage);
}
