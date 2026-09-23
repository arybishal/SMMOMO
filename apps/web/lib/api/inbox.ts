import { request } from "./client";
import { mockComments } from "@/lib/mock/comments";
import { mockDeliveries } from "@/lib/mock/deliveries";
import type { CommentEvent, MessageDelivery } from "@/types";

export function listRecentComments(): Promise<CommentEvent[]> {
  return request("/comments/recent", () => mockComments);
}

export function listRecentDeliveries(): Promise<MessageDelivery[]> {
  return request("/deliveries/recent", () => mockDeliveries);
}
