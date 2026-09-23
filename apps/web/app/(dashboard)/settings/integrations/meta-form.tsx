"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AdminMetaConfig } from "@/lib/api/admin-meta";
import { saveAdminMetaConfig, testAdminMetaConfig } from "@/lib/api/admin-meta";

type Status =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function MetaForm({ initial }: { initial: AdminMetaConfig }) {
  const [appId, setAppId] = useState(initial.appId);
  const [appSecret, setAppSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus({ kind: "idle" });
    try {
      const body: { appId: string; appSecret?: string; webhookVerifyToken?: string } = {
        appId: appId.trim(),
      };
      // Blank password fields mean "keep current" — only send non-empty secrets.
      if (appSecret !== "") body.appSecret = appSecret;
      if (verifyToken !== "") body.webhookVerifyToken = verifyToken;
      await saveAdminMetaConfig(body);
      setAppSecret("");
      setVerifyToken("");
      setStatus({ kind: "success", message: "Saved." });
    } catch {
      setStatus({
        kind: "error",
        message: "Could not save. Check admin access and PLATFORM_ENCRYPTION_KEY.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testAdminMetaConfig();
      setTestResult(
        r.metaConfigured && r.webhookReady
          ? "Configured — OAuth and webhook ready."
          : r.metaConfigured
            ? "App credentials present; webhook verify token missing."
            : "Not fully configured.",
      );
    } catch {
      setTestResult("Could not run configuration check.");
    } finally {
      setTesting(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(initial.redirectUri);
      setStatus({ kind: "success", message: "Redirect URI copied." });
    } catch {
      setStatus({ kind: "error", message: "Could not copy." });
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {status.kind === "success" && (
        <p role="status" className="rounded-control bg-success-soft px-3 py-2 text-sm text-success-strong">
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-strong">
          {status.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge tone={initial.metaConfigured ? "success" : "failed"}>
          Meta app {initial.metaConfigured ? "configured" : "not configured"}
        </Badge>
        <Badge tone={initial.oauthReady ? "success" : "neutral"}>
          OAuth {initial.oauthReady ? "ready" : "not ready"}
        </Badge>
        <Badge tone={initial.webhookReady ? "success" : "neutral"}>
          Webhook {initial.webhookReady ? "ready" : "not ready"}
        </Badge>
      </div>

      <div className="space-y-4 rounded-card border border-border bg-surface p-6 shadow-card">
        <div className="space-y-1.5">
          <Label htmlFor="app-id">App ID</Label>
          <Input
            id="app-id"
            name="app-id"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            placeholder="Instagram app id"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Source: {initial.source.appId}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="app-secret">App secret</Label>
          <Input
            id="app-secret"
            name="app-secret"
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder={
              initial.appSecretConfigured ? "•••••••• (configured — leave blank to keep)" : "App secret"
            }
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            {initial.appSecretConfigured
              ? `Configured · source: ${initial.source.appSecret} · leave blank to keep`
              : `Not set · source: ${initial.source.appSecret}`}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="webhook-verify">Webhook verify token</Label>
          <Input
            id="webhook-verify"
            name="webhook-verify"
            type="password"
            value={verifyToken}
            onChange={(e) => setVerifyToken(e.target.value)}
            placeholder={
              initial.webhookVerifyTokenConfigured
                ? "•••••••• (configured — leave blank to keep)"
                : "hub.challenge verify token"
            }
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            {initial.webhookVerifyTokenConfigured
              ? `Configured · source: ${initial.source.webhookVerifyToken} · leave blank to keep`
              : `Not set · source: ${initial.source.webhookVerifyToken}`}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="redirect-uri">Redirect URI</Label>
          <div className="flex gap-2">
            <Input
              id="redirect-uri"
              name="redirect-uri"
              value={initial.redirectUri}
              readOnly
              aria-readonly
            />
            <Button type="button" variant="secondary" onClick={handleCopy}>
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Deployment config (META_REDIRECT_URI) — read-only. Must match a
            Valid OAuth Redirect URI on the Meta app.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
          {testing ? "Checking…" : "Test configuration"}
        </Button>
      </div>
      {testResult && (
        <p role="status" className="text-sm text-muted-foreground">
          {testResult}
        </p>
      )}
      <p className="text-xs text-subtle-foreground">
        Secrets are stored encrypted server-side and never returned to the
        browser. Platform admins: PLATFORM_ADMIN_EMAILS on the API.
      </p>
    </form>
  );
}
