import Link from "next/link";
import { listPosts } from "@/lib/api/posts";
import { listAutomations } from "@/lib/api/automations";
import { getInstagramAccount } from "@/lib/api/social-accounts";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { PostsList } from "./list";
import { SyncPosts } from "./sync-button";

// Server page: loads posts + automations (for the relationship column) +
// Instagram connection context, then delegates filter/search to a client
// island — same architecture as Task 005's automations list.
export default async function PostsPage() {
  const [posts, automations, account] = await Promise.all([
    listPosts(),
    listAutomations(),
    getInstagramAccount(),
  ]);

  const connected = account?.status === "connected";

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Posts"
        description="View the Instagram posts and reels available for your comment-to-DM automations."
        action={connected ? <SyncPosts /> : undefined}
      />

      {/* Connection context — derived only from getInstagramAccount(). */}
      {connected ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge tone="success">Connected</Badge>
          <span className="text-sm text-muted-foreground">
            Instagram · @{account?.username}
          </span>
        </div>
      ) : (
        <Card className="mb-5 border-danger/30 p-4">
          <p className="text-sm font-medium text-foreground">
            {account ? "Instagram needs attention" : "Instagram not connected"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {account
              ? "The connection reported an error, so posts may be out of date."
              : "Posts and reels become available after you connect your Instagram account."}
          </p>
          <Link
            href="/settings/social-accounts"
            className={`${buttonClasses("secondary")} mt-3`}
          >
            Open social accounts
          </Link>
        </Card>
      )}

      {posts.length === 0 ? (
        connected ? (
          <Card className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              No Instagram content yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Your account is connected, but no posts have been imported yet.
              Sync to pull in your latest posts and reels.
            </p>
            <div className="mt-4 flex justify-center">
              <SyncPosts />
            </div>
          </Card>
        ) : (
          // The connection notice above already explains that posts become
          // available after connecting — no duplicate card, no fake sync CTA.
          null
        )
      ) : (
        <PostsList posts={posts} automations={automations} />
      )}
    </div>
  );
}
