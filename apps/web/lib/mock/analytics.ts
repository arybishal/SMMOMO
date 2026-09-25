import type { AnalyticsOverview, AnalyticsSummary, UsageSummary } from "@/types";

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

// Zeroed shape for /analytics/overview — mock mode shows empty periods,
// never invented activity.
export const mockOverview: AnalyticsOverview = {
  range: {
    start: "2026-09-01T00:00:00.000Z",
    end: "2026-10-01T00:00:00.000Z",
    previousStart: "2026-08-02T00:00:00.000Z",
    previousEnd: "2026-09-01T00:00:00.000Z",
    tz: "UTC",
  },
  totals: { comments: 0, matched: 0, dmsSent: 0, failed: 0 },
  previous: { comments: 0, matched: 0, dmsSent: 0, failed: 0 },
  bucket: "day",
  series: [],
  automations: [],
  content: [],
  deliveryHealth: { queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0 },
  failures: [],
  truncated: false,
};
