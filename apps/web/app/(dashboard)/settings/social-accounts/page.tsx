import { getInstagramAccount } from "@/lib/api/social-accounts";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconInstagram } from "@/components/layout/icons";

function formatConnectedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function SocialAccountsPage() {
  const account = await getInstagramAccount();
  const connected = account?.status === "connected";

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Social accounts"
        description="Platforms connected to SMMOMO."
      />

      <Card
        className={`flex items-center gap-4 p-5 ${
          account && !connected ? "border-danger" : ""
        }`}
      >
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-pill ${
            account
              ? "bg-foreground text-background"
              : "bg-surface-muted text-subtle-foreground"
          }`}
        >
          <IconInstagram className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {account ? `@${account.username}` : "Not connected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {!account
              ? "Connect an Instagram professional account to run automations."
              : connected
                ? `${account.followers.toLocaleString()} followers · connected ${formatConnectedDate(
                    account.connectedAt,
                  )}`
                : "Needs attention — reconnect once Instagram login ships (Task 015)."}
          </p>
        </div>
        <Badge tone={connected ? "success" : "failed"}>
          {connected ? "Connected" : "Needs attention"}
        </Badge>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-dashed border-zinc-300 bg-surface-muted p-4">
        <div>
          <p className="text-sm font-medium text-zinc-700">
            Add another account
          </p>
          <p className="text-xs text-muted-foreground">
            Meta OAuth arrives with Task 015 — no fake connect flow yet.
          </p>
        </div>
        <Button variant="secondary" disabled>
          Connect
        </Button>
      </div>

      {account && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-dashed border-zinc-300 bg-surface-muted p-4">
          <div>
            <p className="text-sm font-medium text-zinc-700">
              Disconnect {account.username}
            </p>
            <p className="text-xs text-muted-foreground">
              Disconnecting ships with Meta OAuth (Task 015).
            </p>
          </div>
          <Button variant="secondary" disabled>
            Disconnect
          </Button>
        </div>
      )}
    </div>
  );
}
