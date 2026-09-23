import { request, USE_MOCK } from "./client";
import { getServerSupabase } from "@/lib/supabase/server";
import { mockPosts } from "@/lib/mock/posts";
import type { Post } from "@/types";

// USE_MOCK=true  → mock layer (current default; auth/workspace context does
//                  not exist yet, so Supabase reads would be anonymous and
//                  RLS-denied).
// USE_MOCK=false → Supabase directly (RLS scopes rows to the caller's
//                  workspaces). The UI never sees this branch.
export function listPosts(): Promise<Post[]> {
  if (USE_MOCK) return request("/posts", () => mockPosts);
  return fetchPostsFromSupabase();
}

export function getPost(id: string): Promise<Post | undefined> {
  if (USE_MOCK) {
    return request(`/posts/${id}`, () => mockPosts.find((p) => p.id === id));
  }
  return fetchPostsFromSupabase().then((posts) =>
    posts.find((p) => p.id === id),
  );
}

// public.posts row shape (snake_case) until generated types arrive
// (`supabase gen types typescript` needs a CLI access token — deferred).
interface PostRow {
  id: string;
  media_url: string | null;
  caption: string;
  type: "IMAGE" | "REEL" | "CAROUSEL";
  permalink: string;
  comments_count: number;
  likes_count: number;
  posted_at: string;
}

async function fetchPostsFromSupabase(): Promise<Post[]> {
  const supabase = await getServerSupabase();
  // No workspace_id filter here on purpose: RLS is the isolation boundary —
  // `members_read_posts` only returns rows in the caller's workspaces.
  const { data, error } = await supabase
    .from("posts")
    .select(
      "id, media_url, caption, type, permalink, comments_count, likes_count, posted_at",
    )
    .order("posted_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load posts: ${error.message}`);
  }
  return ((data ?? []) as PostRow[]).map((row) => ({
    id: row.id,
    mediaUrl: row.media_url,
    caption: row.caption,
    type: row.type,
    permalink: row.permalink,
    commentsCount: row.comments_count,
    likesCount: row.likes_count,
    postedAt: row.posted_at,
  }));
}
