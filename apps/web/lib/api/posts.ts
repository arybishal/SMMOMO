import { request } from "./client";
import { mockPosts } from "@/lib/mock/posts";
import type { Post } from "@/types";

export function listPosts(): Promise<Post[]> {
  return request("/posts", () => mockPosts);
}

export function getPost(id: string): Promise<Post | undefined> {
  return request(`/posts/${id}`, () => mockPosts.find((p) => p.id === id));
}
