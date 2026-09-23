import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authed, ensureWorkspace, rest, requireUser, type AuthUser } from "./supabase";

// Meta/Instagram OAuth (Task 015) — Instagram API with Instagram Login.
// App id/secret + redirect live in API env only (never apps/web, never repo).
const META_APP_ID = process.env.META_APP_ID ?? "";
const META_APP_SECRET = process.env.META_APP_SECRET ?? "";
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? "http://localhost:3000";
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";
// Must match a Valid OAuth Redirect URI on the Meta app.
const REDIRECT_URI =
  process.env.META_REDIRECT_URI ??
  `${API_ORIGIN}/social-accounts/instagram/callback`;
const CALLBACK_PATH = "/social-accounts/instagram/callback";

// Instagram professional scopes: read profile, comments (webhooks 016),
// messages (DMs 018). No page/Pages permissions — IG Login is IG-only.
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
].join(",");

const STATE_TTL_MS = 10 * 60 * 1000;

function oauthConfigured(): boolean {
  return Boolean(META_APP_ID && META_APP_SECRET);
}

// state = base64url(userId.expiry.hmac) — binds the Meta round-trip to the
// session user (callback re-reads the cookie; mismatched/stale state → reject).
function signState(userId: string): string {
  const exp = Date.now() + STATE_TTL_MS;
  const payload = `${userId}.${exp}`;
  const mac = createHmac("sha256", META_APP_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${mac}`, "utf8").toString("base64url");
}

function verifyState(state: string, userId: string): boolean {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const [uid, expStr, mac] = raw.split(".");
    if (!uid || !expStr || !mac || uid !== userId) return false;
    if (Date.now() > Number(expStr)) return false;
    const expected = createHmac("sha256", META_APP_SECRET)
      .update(`${uid}.${expStr}`)
      .digest("hex");
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function webRedirect(
  reply: FastifyReply,
  path: string,
  params: Record<string, string> = {},
  code = 302,
): FastifyReply {
  const url = new URL(WEB_ORIGIN + path);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return reply.redirect(url.toString(), code);
}

interface IgProfile {
  userId: string;
  username: string;
  followers: number;
}

// Exchange the authorization code, then load the IG professional profile.
// Instagram Login token endpoint → graph.instagram.com /me for username.
async function exchangeCode(code: string): Promise<
  { ok: true; token: string; profile: IgProfile } | { ok: false; reason: string }
> {
  let tokenRes: Response;
  try {
    tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (!tokenRes.ok) {
    return { ok: false, reason: "failed" };
  }
  const tokenBody = (await tokenRes.json()) as {
    access_token?: string;
    user_id?: string;
  };
  if (!tokenBody.access_token) {
    return { ok: false, reason: "failed" };
  }
  const token = tokenBody.access_token;

  let profileRes: Response;
  try {
    profileRes = await fetch(
      `https://graph.instagram.com/me?fields=user_id,username,followers_count&access_token=${encodeURIComponent(token)}`,
    );
  } catch {
    return { ok: false, reason: "failed" };
  }
  // Profile fetch is best-effort: username is required, followers may be
  // unavailable under some app modes — fall back to 0 rather than fail connect.
  let username = "";
  let followers = 0;
  let igUserId = tokenBody.user_id ?? "";
  if (profileRes.ok) {
    const profile = (await profileRes.json()) as {
      username?: string;
      user_id?: string;
      followers_count?: number;
    };
    username = profile.username ?? "";
    igUserId = profile.user_id || igUserId;
    followers = Number(profile.followers_count ?? 0) || 0;
  }
  if (!username) {
    return { ok: false, reason: "failed" };
  }
  return {
    ok: true,
    token,
    profile: { userId: igUserId, username, followers },
  };
}

async function upsertConnection(
  user: AuthUser,
  workspaceId: string,
  profile: IgProfile,
  accessToken: string,
): Promise<void> {
  const body = {
    workspace_id: workspaceId,
    platform: "instagram",
    username: profile.username,
    name: profile.username,
    followers: profile.followers,
    status: "connected",
    connected_at: new Date().toISOString(),
    access_token: accessToken,
    ig_user_id: profile.userId,
    // Instagram Login long-lived tokens ~60 days — refresh belongs to 016+.
    token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const existing = await rest<{ id: string }[]>(
    user,
    `social_accounts?workspace_id=eq.${workspaceId}&platform=eq.instagram&select=id`,
  );
  if (existing.status >= 400) {
    throw new Error(`social account lookup failed (${existing.status})`);
  }
  const row = existing.data?.[0];
  if (row) {
    const updated = await rest(
      user,
      `social_accounts?id=eq.${row.id}`,
      { method: "PATCH", body, prefer: "return=minimal" },
    );
    if (updated.status >= 400) {
      throw new Error(`social account update failed (${updated.status})`);
    }
    return;
  }
  const created = await rest(user, "social_accounts", {
    method: "POST",
    body,
    prefer: "return=representation",
  });
  if (created.status >= 400) {
    throw new Error(`social account insert failed (${created.status})`);
  }
}

// Best-effort app-level webhook subscription (Task 016). Fails open: no Meta
// app / wrong env → connect still succeeds; operator can subscribe in the
// Meta dashboard (documented in README).
const WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";

async function subscribeWebhookTopics(log: FastifyInstance["log"]): Promise<void> {
  if (!META_APP_ID || !META_APP_SECRET || !WEBHOOK_VERIFY_TOKEN) return;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${META_APP_ID}/subscriptions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          object: "instagram",
          callback_url: `${API_ORIGIN}/webhooks/instagram`,
          verify_token: WEBHOOK_VERIFY_TOKEN,
          access_token: `${META_APP_ID}|${META_APP_SECRET}`,
          fields: "comments,messages",
        }),
      },
    );
    if (!res.ok) {
      log.warn({ status: res.status }, "instagram webhook subscribe failed");
    }
  } catch (err) {
    log.warn({ err }, "instagram webhook subscribe failed");
  }
}

export function registerMetaRoutes(app: FastifyInstance): void {
  // Browser navigation (not XHR) — friendly redirect when unconfigured.
  app.get("/social-accounts/instagram/connect", async (req, reply) => {
    if (!oauthConfigured()) {
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "not_configured",
      });
    }
    const user = authed(req);
    const state = signState(user.id);
    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.set("client_id", META_APP_ID);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);
    return reply.redirect(url.toString(), 302);
  });

  // Meta redirects the browser here with the session cookie still present
  // (localhost is host-scoped, not port-scoped). Own auth handling so an
  // expired session becomes a login redirect, not a JSON 401.
  app.get(CALLBACK_PATH, async (req: FastifyRequest, reply) => {
    if (!oauthConfigured()) {
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "not_configured",
      });
    }
    const user = await requireUser(req, reply);
    if (!user) {
      if (reply.sent) return reply;
      return webRedirect(reply, "/login", {
        next: "/settings/social-accounts",
      });
    }

    const query = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };
    if (query.error) {
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "denied",
      });
    }
    if (!query.code || !query.state || !verifyState(query.state, user.id)) {
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "invalid_state",
      });
    }

    try {
      const workspaceId = await ensureWorkspace(user);
      const exchanged = await exchangeCode(query.code);
      if (!exchanged.ok) {
        return webRedirect(reply, "/settings/social-accounts", {
          oauth: exchanged.reason,
        });
      }
      await upsertConnection(
        user,
        workspaceId,
        exchanged.profile,
        exchanged.token,
      );
      await subscribeWebhookTopics(req.log);
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "connected",
      });
    } catch (err) {
      req.log.error({ err }, "instagram oauth callback failed");
      return webRedirect(reply, "/settings/social-accounts", {
        oauth: "failed",
      });
    }
  });

  app.delete("/social-accounts/instagram", async (req) => {
    const user = authed(req);
    const result = await rest(
      user,
      `social_accounts?workspace_id=eq.${req.workspaceId}&platform=eq.instagram`,
      { method: "DELETE" },
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("disconnect failed"), {
        statusCode: 502,
      });
    }
    return { ok: true };
  });
}
