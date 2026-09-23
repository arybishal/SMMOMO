import { restService, type AuthUser } from "./supabase";
import { decryptSecret, encryptSecret } from "./crypto";

// Platform Meta config (Task 018A). One resolved object is the single source
// of truth for OAuth (015), webhooks (016), and admin status — never a second
// App ID/Secret path. Workspace rows (social_accounts.access_token) stay
// separate and are never written here. AES-256-GCM helpers live in crypto.ts
// (shared with IG token encryption at rest).

export { encryptionReady } from "./crypto";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";
const CALLBACK_PATH = "/social-accounts/instagram/callback";

export interface ResolvedMetaConfig {
  appId: string;
  appSecret: string;
  webhookVerifyToken: string;
  redirectUri: string;
}

export interface MetaConfigPublic {
  appId: string;
  appSecretConfigured: boolean;
  webhookVerifyTokenConfigured: boolean;
  redirectUri: string;
  source: {
    appId: "db" | "env" | "none";
    appSecret: "db" | "env" | "none";
    webhookVerifyToken: "db" | "env" | "none";
  };
  metaConfigured: boolean;
  oauthReady: boolean;
  webhookReady: boolean;
  updatedAt: string | null;
}

interface PlatformSettingsRow {
  meta_app_id: string | null;
  meta_app_secret_encrypted: string | null;
  webhook_verify_token_encrypted: string | null;
  updated_at: string;
}

// Precedence (one rule for every consumer): a non-empty DB field wins over
// env; empty/missing DB field falls back to the matching META_* env var.
// Redirect URI is deployment config (env only) — not admin-editable.
export function resolveRedirectUri(): string {
  return (
    process.env.META_REDIRECT_URI ?? `${API_ORIGIN}${CALLBACK_PATH}`
  );
}

function envAppId(): string {
  return process.env.META_APP_ID ?? "";
}
function envAppSecret(): string {
  return process.env.META_APP_SECRET ?? "";
}
function envVerifyToken(): string {
  return process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
}

async function loadRow(): Promise<PlatformSettingsRow | null> {
  const res = await restService<PlatformSettingsRow[]>(
    "platform_settings?id=eq.true&select=*&limit=1",
  );
  if (res.status >= 400 || !res.data?.[0]) return null;
  return res.data[0];
}

function resolveFrom(
  row: PlatformSettingsRow | null,
): {
  config: ResolvedMetaConfig;
  publicView: MetaConfigPublic;
} {
  const redirectUri = resolveRedirectUri();

  const dbAppId = row?.meta_app_id?.trim() || "";
  const dbSecret = row?.meta_app_secret_encrypted
    ? decryptSecret(row.meta_app_secret_encrypted)
    : null;
  const dbToken = row?.webhook_verify_token_encrypted
    ? decryptSecret(row.webhook_verify_token_encrypted)
    : null;

  const envId = envAppId();
  const envSecret = envAppSecret();
  const envToken = envVerifyToken();

  const appId = dbAppId || envId;
  const appSecret = dbSecret || envSecret;
  const webhookVerifyToken = dbToken || envToken;

  return {
    config: { appId, appSecret, webhookVerifyToken, redirectUri },
    publicView: {
      appId,
      appSecretConfigured: Boolean(appSecret),
      webhookVerifyTokenConfigured: Boolean(webhookVerifyToken),
      redirectUri,
      source: {
        appId: dbAppId ? "db" : envId ? "env" : "none",
        appSecret: dbSecret ? "db" : envSecret ? "env" : "none",
        webhookVerifyToken: dbToken ? "db" : envToken ? "env" : "none",
      },
      metaConfigured: Boolean(appId && appSecret),
      oauthReady: Boolean(appId && appSecret && redirectUri),
      webhookReady: Boolean(appSecret && webhookVerifyToken),
      updatedAt: row?.updated_at ?? null,
    },
  };
}

// In-process cache so OAuth/webhook hot paths don't hit PostgREST every hop.
// Invalidated on every admin save. ponytail: process-local only; multi-instance
// deploy would need a short TTL or pub/sub if saves must be instant everywhere.
let cache: ResolvedMetaConfig | null = null;

export function invalidateMetaConfig(): void {
  cache = null;
}

export async function getMetaConfig(): Promise<ResolvedMetaConfig> {
  if (cache) return cache;
  const row = await loadRow();
  const { config } = resolveFrom(row);
  cache = config;
  return config;
}

export async function getMetaConfigPublic(): Promise<MetaConfigPublic> {
  const row = await loadRow();
  return resolveFrom(row).publicView;
}

export interface SaveMetaConfigInput {
  appId?: string;
  /** Non-empty → replace; empty string → clear; undefined → leave unchanged. */
  appSecret?: string;
  webhookVerifyToken?: string;
}

export async function saveMetaConfig(
  user: AuthUser,
  input: SaveMetaConfigInput,
): Promise<void> {
  const existing = await loadRow();
  const next: Record<string, unknown> = {
    id: true,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };

  if (input.appId !== undefined) {
    next.meta_app_id = input.appId.trim() === "" ? null : input.appId.trim();
  }
  if (input.appSecret !== undefined) {
    if (input.appSecret === "") {
      next.meta_app_secret_encrypted = null;
    } else {
      next.meta_app_secret_encrypted = encryptSecret(input.appSecret);
    }
  }
  if (input.webhookVerifyToken !== undefined) {
    if (input.webhookVerifyToken === "") {
      next.webhook_verify_token_encrypted = null;
    } else {
      next.webhook_verify_token_encrypted = encryptSecret(
        input.webhookVerifyToken,
      );
    }
  }

  if (existing) {
    // Merge onto the existing row so omitted fields are not wiped.
    const body = {
      ...existing,
      ...next,
    };
    const res = await restService(`platform_settings?id=eq.true`, {
      method: "PATCH",
      prefer: "return=representation",
      body,
    });
    if (res.status >= 400) {
      throw Object.assign(new Error("failed to save platform settings"), {
        statusCode: 502,
      });
    }
  } else {
    const res = await restService("platform_settings", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: next,
    });
    if (res.status >= 400) {
      throw Object.assign(new Error("failed to save platform settings"), {
        statusCode: 502,
      });
    }
  }

  invalidateMetaConfig();
}
