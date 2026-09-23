// Frontend domain types. Shaped to match the eventual Fastify API responses
// so swapping mock -> real data requires no UI changes.

export type InstagramMediaType = "IMAGE" | "REEL" | "CAROUSEL";
export type AutomationStatus = "active" | "paused" | "draft";
export type DeliveryStatus = "queued" | "sent" | "delivered" | "failed";

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
