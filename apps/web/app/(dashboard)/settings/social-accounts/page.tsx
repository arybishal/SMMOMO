import { getInstagramAccount } from "@/lib/api/social-accounts";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconInstagram } from "@/components/layout/icons";
import { ConnectInstagram, DisconnectInstagram } from "./actions";

function formatConnectedDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// OAuth round-trip lands here with ?oauth=… from apps/api (meta.ts).
const OAUTH_NOTICES: Record<string, string> = {
  connected: "Instagram connected.",
  denied: "Meta authorization was cancelled.",
  invalid_state: "Connection session expired — try Connect again.",
  failed: "Could not complete the connection — check API logs.",
  not_configured:
    "Meta OAuth is not configured on the API (set META_APP_ID and META_APP_SECRET).",
};

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string }>;
}) {
  const { oauth } = await searchParams;
  const account = await getInstagramAccount();
  const connected = account?.status === "connected";
  const notice = oauth ? OAUTH_NOTICES[oauth] : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Social accounts"
        description="Platforms connected to SMMOMO."
      />

      {notice && (
        <p
          role={oauth === "connected" ? "status" : "alert"}
          className="mb-4 rounded-card border border-border bg-surface-muted px-4 py-3 text-sm text-foreground"
        >
          {notice}
        </p>
      )}

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
                : "Needs attention — reconnect to restore the connection."}
          </p>
        </div>
        <Badge tone={connected ? "success" : "failed"}>
          {connected ? "Connected" : "Needs attention"}
        </Badge>
      </Card>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-card border border-dashed border-zinc-300 bg-surface-muted p-4">
        <div>
          <p className="text-sm font-medium text-zinc-700">
            {account ? "Reconnect Instagram" : "Connect Instagram"}
          </p>
          <p className="text-xs text-muted-foreground">
            {account
              ? "Runs the Meta OAuth flow again and replaces the stored connection."
              : "Authorize via Meta OAuth — one professional account per workspace."}
          </p>
        </div>
        <ConnectInstagram />
      </div>

      {account && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-dashed border-zinc-300 bg-surface-muted p-4">
          <div>
            <p className="text-sm font-medium text-zinc-700">
              Disconnect {account.username}
            </p>
            <p className="text-xs text-muted-foreground">
              Removes the connection and stored access token from this
              workspace.
            </p>
          </div>
          <DisconnectInstagram username={account.username} />
        </div>
      )}
    </div>
  );
}
