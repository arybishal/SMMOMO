// Frontend domain types. Shaped to match the eventual Fastify API responses
// so swapping mock -> real data requires no UI changes.

export type InstagramMediaType = "IMAGE" | "REEL" | "CAROUSEL";
export type AutomationStatus = "active" | "paused" | "draft";
export type DeliveryStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "failed";

export interface SocialAccount {
  id: string;
  platform: "instagram";
  username: string;
  name: string;
  followers: number;
  status: "connected" | "error";
  connectedAt: string;
}

export interface Post {
  id: string;
  mediaUrl: string | null;
  caption: string;
  type: InstagramMediaType;
  permalink: string;
  commentsCount: number;
  likesCount: number;
  postedAt: string;
}

export interface Automation {
  id: string;
  name: string;
  status: AutomationStatus;
  postId: string;
  postCaption: string;
  keyword: string;
  privateReply: string;
  publicReply: string | null;
  matchedCount: number;
  dmSentCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentEvent {
  id: string;
  postId: string;
  postCaption: string;
  username: string;
  text: string;
  matched: boolean;
  automationName: string | null;
  /** Winning automation (present when matched; omitted by mock rows). */
  automationId?: string;
  createdAt: string;
}

export interface MessageDelivery {
  id: string;
  commentId: string;
  recipient: string;
  kind: "private_dm" | "public_reply";
  status: DeliveryStatus;
  error: string | null;
  createdAt: string;
}

export interface AnalyticsPoint {
  label: string;
  comments: number;
  dms: number;
}

export interface AnalyticsSummary {
  commentsMatched: number;
  dmsSent: number;
  publicReplies: number;
  failedDeliveries: number;
  activeAutomations: number;
  daily: AnalyticsPoint[];
}

// Task 027 — GET /analytics/overview (period-scoped, server-aggregated).
export interface AnalyticsRange {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  tz: string;
}

export interface AnalyticsTotals {
  comments: number;
  matched: number;
  dmsSent: number;
  failed: number;
}

export interface AnalyticsSeriesPoint {
  key: string;
  label: string;
  comments: number;
  matched: number;
  dms: number;
  failed: number;
}

export interface AutomationPeriodStats {
  id: string;
  name: string;
  status: AutomationStatus;
  keyword: string;
  postId: string;
  comments: number;
  matched: number;
  dmsSent: number;
  failed: number;
  /** matched ÷ comments on its post; null when there were no comments. */
  matchRate: number | null;
}

export interface ContentPeriodStats {
  id: string;
  caption: string;
  type: InstagramMediaType;
  mediaUrl: string | null;
  permalink: string;
  comments: number;
  matched: number;
  dmsSent: number;
  failed: number;
}

export interface DeliveryHealth {
  queued: number;
  processing: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface AnalyticsFailure {
  id: string;
  createdAt: string;
  error: string | null;
  recipient: string;
  kind: "private_dm" | "public_reply";
  automationName: string | null;
  username: string | null;
  text: string | null;
  postId: string | null;
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  totals: AnalyticsTotals;
  previous: AnalyticsTotals;
  bucket: "hour" | "day";
  series: AnalyticsSeriesPoint[];
  automations: AutomationPeriodStats[];
  content: ContentPeriodStats[];
  deliveryHealth: DeliveryHealth;
  failures: AnalyticsFailure[];
  truncated: boolean;
}

export interface UsageSummary {
  period: string;
  /** ISO window for the period (inclusive start, exclusive end). */
  start?: string;
  end?: string;
  dmsSent: number;
  commentsProcessed: number;
  publicReplies: number;
  failedDeliveries: number;
  /** Task 019 extras — present when the API serves usage_events. */
  commentsReceived?: number;
  commentsMatched?: number;
  privateDmFailed?: number;
  publicReplyFailed?: number;
  byEventType?: Record<string, number>;
  /** Future plan hooks — null until a plan system exists (never fake). */
  used?: number;
  limit?: number | null;
  remaining?: number | null;
}
