import Link from "next/link";
import { listRecentComments, listRecentDeliveries } from "@/lib/api/inbox";
import { listAutomations } from "@/lib/api/automations";
import { listPosts } from "@/lib/api/posts";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { InboxView } from "./inbox";

// Server page: loads everything through lib/api (mock seam — Task 008 stays
// UI-only), then delegates selection/search/filter to a client island — same
// architecture as Task 005/007.
export default async function InboxPage() {
  const [comments, deliveries, automations, posts] = await Promise.all([
    listRecentComments(),
    listRecentDeliveries(),
    listAutomations(),
    listPosts(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Inbox"
        description="Monitor comments, automation matches, and private DM activity from your Instagram content."
      />

      {comments.length === 0 ? (
        <Card className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No inbox activity yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Comments on your posts and the automated DMs they trigger will
            appear here as followers engage.
          </p>
          <Link
            href="/automations/new"
            className={`${buttonClasses("secondary")} mt-4`}
          >
            Create automation
          </Link>
        </Card>
      ) : (
        <InboxView
          comments={comments}
          deliveries={deliveries}
          automations={automations}
          posts={posts}
        />
      )}
    </div>
  );
}
