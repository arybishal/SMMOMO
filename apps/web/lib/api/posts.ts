import { request } from "./client";
import { mockPosts } from "@/lib/mock/posts";
import type { Post } from "@/types";

// Same seam as every other module — real rows come from apps/api (RLS-
// scoped to the signed-in member); mocks only when USE_MOCK=true.

export function listPosts(): Promise<Post[]> {
  return request("/posts", () => mockPosts);
}

export function getPost(id: string): Promise<Post | undefined> {
  return request(`/posts/${id}`, () => mockPosts.find((p) => p.id === id));
}

export interface SyncResult {
  imported: number;
  skipped: number;
}

function mockSync(): never {
  throw new Error("mock sync not implemented — use the real API (Task 024)");
}

// Real content import: POST → apps/api → Graph /media → posts upsert.
export function syncPosts(): Promise<SyncResult> {
  return request("/social-accounts/instagram/sync", mockSync, {
    method: "POST",
  });
}
