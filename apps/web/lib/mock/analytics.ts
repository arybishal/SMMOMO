import type { AnalyticsSummary, UsageSummary } from "@/types";

export const mockAnalytics: AnalyticsSummary = {
  commentsMatched: 619,
  dmsSent: 611,
  publicReplies: 198,
  failedDeliveries: 8,
  activeAutomations: 2,
  daily: [
    { label: "Mon", comments: 74, dms: 73 },
    { label: "Tue", comments: 91, dms: 90 },
    { label: "Wed", comments: 68, dms: 67 },
    { label: "Thu", comments: 112, dms: 110 },
    { label: "Fri", comments: 98, dms: 97 },
    { label: "Sat", comments: 87, dms: 86 },
    { label: "Sun", comments: 89, dms: 88 },
  ],
};

export const mockUsage: UsageSummary = {
  period: "September 2026",
  dmsSent: 611,
  commentsProcessed: 1842,
  publicReplies: 198,
  failedDeliveries: 8,
};
