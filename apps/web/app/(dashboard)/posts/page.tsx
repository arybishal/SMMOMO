import { listPosts } from "@/lib/api/posts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";

export default async function PostsPage() {
  const posts = await listPosts();

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Posts"
        description="Instagram posts and reels you can attach automations to."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {posts.map((post) => (
          <div
            key={post.id}
            className="overflow-hidden rounded-card border border-border bg-surface shadow-card"
          >
            {/* No remote images yet: neutral media placeholder keeps the app
                offline-friendly until real post media comes from the API. */}
            <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200">
              <Badge tone="neutral">{post.type}</Badge>
            </div>
            <div className="p-4">
              <p className="line-clamp-2 min-h-10 text-sm text-foreground">
                {post.caption}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{post.commentsCount} comments</span>
                <span>{post.likesCount.toLocaleString()} likes</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
