import { getInstagramAccount } from "@/lib/api/social-accounts";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconInstagram } from "@/components/layout/icons";

export default async function SocialAccountsPage() {
  const account = await getInstagramAccount();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Social accounts"
        description="Platforms connected to SMMOMO."
      />

      <Card className="flex items-center gap-4 p-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-white">
          <IconInstagram className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-900">
            {account ? `@${account.username}` : "Not connected"}
          </p>
          <p className="text-xs text-zinc-500">
            {account
              ? `${account.followers.toLocaleString()} followers · since ${new Date(
                  account.connectedAt,
                ).toLocaleDateString()}`
              : "Connect via official Instagram login (Task 015)."}
          </p>
        </div>
        {account && (
          <Badge tone={account.status === "connected" ? "success" : "failed"}>
            {account.status}
          </Badge>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
        <div>
          <p className="text-sm font-medium text-zinc-700">Add another account</p>
          <p className="text-xs text-zinc-500">
            Meta OAuth arrives with Task 015 — no fake connect flow yet.
          </p>
        </div>
        <Button variant="secondary" disabled>
          Connect
        </Button>
      </div>
    </div>
  );
}
