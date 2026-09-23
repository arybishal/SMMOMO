import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import {
  authed,
  ensureWorkspace,
  requireUser,
  rest,
} from "./supabase";
import { registerMetaRoutes } from "./meta";
import { registerWebhookRoutes } from "./webhooks";
import { registerAdminRoutes } from "./admin";
import { getWorkspaceUsage, parseUsageRange } from "./usage";

// Keep aligned with apps/api/package.json "version" when bumping.
const SERVICE = "smmomo-api";
const VERSION = "0.1.0";

// Row shapes (snake_case PostgREST) → frontend contracts in types/index.ts.
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

interface AutomationRow {
  id: string;
  name: string;
  status: "active" | "paused" | "draft";
  keyword: string;
  private_reply: string;
  public_reply: string | null;
  matched_count: number;
  dm_sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
  post_id: string;
  post?: { caption: string } | { caption: string }[];
}

interface SocialAccountRow {
  id: string;
  platform: "instagram";
  username: string;
  name: string;
  followers: number;
  status: "connected" | "error";
  connected_at: string;
}

interface AutomationCounters {
  status: string;
  matched_count: number;
  dm_sent_count: number;
  failed_count: number;
}

const AUTOMATION_STATUS = new Set(["active", "paused", "draft"]);

function mapPost(row: PostRow) {
  return {
    id: row.id,
    mediaUrl: row.media_url,
    caption: row.caption,
    type: row.type,
    permalink: row.permalink,
    commentsCount: row.comments_count,
    likesCount: row.likes_count,
    postedAt: row.posted_at,
  };
}

function postCaption(
  post:
    | { caption: string }
    | { caption: string }[]
    | null
    | undefined,
): string {
  if (!post) return "";
  if (Array.isArray(post)) return post[0]?.caption ?? "";
  return post.caption;
}

function mapAutomation(row: AutomationRow) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    postId: row.post_id,
    postCaption: postCaption(row.post),
    keyword: row.keyword,
    privateReply: row.private_reply,
    publicReply: row.public_reply,
    matchedCount: row.matched_count,
    dmSentCount: row.dm_sent_count,
    failedCount: row.failed_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSocialAccount(row: SocialAccountRow) {
  return {
    id: row.id,
    platform: row.platform,
    username: row.username,
    name: row.name,
    followers: row.followers,
    status: row.status,
    connectedAt: row.connected_at,
  };
}

function sum(rows: AutomationCounters[], key: keyof AutomationCounters): number {
  return rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);
}

function uuidOk(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

// Minimal fixed-window rate limit (in-process). Single API instance by
// design (inline delivery worker, no Redis) — multi-instance deploys need a
// shared store (documented in docs/security.md). ponytail: Map + interval,
// not a plugin dependency. Cap the key space so a spoofed-IP flood cannot
// grow the Map without bound.
function rateLimit(
  app: FastifyInstance,
  opts: {
    max: number;
    windowMs: number;
    match: (path: string, method: string) => boolean;
    keys: (req: FastifyRequest) => string;
  },
): void {
  const hits = new Map<string, { n: number; t: number }>();
  const MAX_KEYS = 10_000;
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      if (now - v.t > opts.windowMs) hits.delete(k);
    }
  }, opts.windowMs).unref?.();
  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (!opts.match(path, req.method)) return;
    const key = opts.keys(req);
    const now = Date.now();
    let bucket = hits.get(key);
    if (!bucket || now - bucket.t > opts.windowMs) {
      if (hits.size >= MAX_KEYS) hits.clear();
      bucket = { n: 0, t: now };
      hits.set(key, bucket);
    }
    bucket.n += 1;
    if (bucket.n > opts.max) {
      await reply.code(429).send({
        statusCode: 429,
        error: "Too Many Requests",
        message: "rate limit exceeded",
      });
      return reply;
    }
  });
}

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Client-facing errors: no stack traces or internal details.
  app.setErrorHandler((err, req, reply) => {
    const e = err as { statusCode?: number; message?: string };
    const status =
      typeof e.statusCode === "number" && e.statusCode >= 400
        ? e.statusCode
        : 500;
    if (status >= 500) {
      req.log.error({ err }, "unhandled error");
    }
    reply.code(status).send({
      statusCode: status,
      error: status >= 500 ? "Internal Server Error" : "Bad Request",
      message:
        status >= 500
          ? "Internal error"
          : (e.message ?? "Bad Request"),
    });
  });

  // Minimal security headers on every API response (API serves JSON only —
  // no HTML, so CSP/frame-ancestors belong on the Next app).
  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    return payload;
  });

  // Credentialed cross-origin from the web app (localhost:3000 → :4000):
  // a concrete origin + credentials, never `*` with cookies.
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  // Abuse-sensitive surfaces: webhook ingest (HMAC already gates it — this
  // bounds flood cost), platform-admin config writes, and OAuth connect /
  // callback (token exchange is expensive; IP-keyed before session resolve).
  rateLimit(app, {
    max: 60,
    windowMs: 60_000,
    match: (path, method) => path.startsWith("/webhooks/") && method === "POST",
    keys: (req) => req.ip,
  });
  rateLimit(app, {
    max: 30,
    windowMs: 60_000,
    match: (path, method) => path.startsWith("/admin/") && method !== "GET",
    keys: (req) => req.ip,
  });
  rateLimit(app, {
    max: 20,
    windowMs: 60_000,
    match: (path, method) =>
      (path === "/social-accounts/instagram/connect" ||
        path === "/social-accounts/instagram/callback") &&
      method === "GET",
    keys: (req) => req.ip,
  });

  // Keep the raw body for webhook HMAC (X-Hub-Signature-256) while still
  // parsing JSON for every other route. Strip UTF-8 BOM if present (some
  // clients send it; Meta does not — still safe for signature input).
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      let raw = typeof body === "string" ? body : body.toString("utf8");
      if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
      (_req as FastifyRequest & { rawBody?: string }).rawBody = raw;
      if (raw === "") {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // Every product route: resolve the cookie session, then ensure the caller
  // has a workspace (idempotent bootstrap — RLS reads still gate all rows).
  // Exceptions: /health (public); Instagram OAuth callback (auth handled
  // inline so an expired session mid-redirect becomes a login URL, not 401);
  // /webhooks/* (Meta servers send no cookie — signature + service_role gate).
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (req.method === "GET" && path === "/health") return;
    if (req.method === "GET" && path === "/social-accounts/instagram/callback") {
      return;
    }
    if (path.startsWith("/webhooks/")) return;
    const user = await requireUser(req, reply);
    if (!user) return reply;
    try {
      req.user = user;
      req.workspaceId = await ensureWorkspace(user);
    } catch (err) {
      req.log.error({ err }, "workspace bootstrap failed");
      await reply.code(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "Workspace setup failed",
      });
      return reply;
    }
  });

  app.get("/health", async () => ({
    status: "ok",
    service: SERVICE,
    version: VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // --- posts -----------------------------------------------------------------

  app.get("/posts", async (req) => {
    const result = await rest<PostRow[]>(
      authed(req),
      "posts?select=*&order=posted_at.desc",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load posts"), {
        statusCode: 502,
      });
    }
    return (result.data ?? []).map(mapPost);
  });

  app.get<{ Params: { id: string } }>("/posts/:id", async (req, reply) => {
    if (!uuidOk(req.params.id)) {
      // Mock-era ids like `post_1` are not uuids — same not-found outcome.
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    const result = await rest<PostRow[]>(
      authed(req),
      `posts?id=eq.${req.params.id}&select=*`,
    );
    const row = result.data?.[0];
    if (result.status >= 400 || !row) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    return mapPost(row);
  });

  // --- automations -----------------------------------------------------------

  const AUTOMATION_SELECT =
    "select=*,post:posts(caption)&order=created_at.desc";

  app.get("/automations", async (req) => {
    const result = await rest<AutomationRow[]>(
      authed(req),
      `automations?${AUTOMATION_SELECT}`,
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load automations"), {
        statusCode: 502,
      });
    }
    return (result.data ?? []).map(mapAutomation);
  });

  app.get<{ Params: { id: string } }>("/automations/:id", async (req, reply) => {
    if (!uuidOk(req.params.id)) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    const result = await rest<AutomationRow[]>(
      authed(req),
      `automations?id=eq.${req.params.id}&select=*,post:posts(caption)`,
    );
    const row = result.data?.[0];
    if (result.status >= 400 || !row) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    return mapAutomation(row);
  });

  app.post<{
    Body: {
      name?: unknown;
      postId?: unknown;
      keyword?: unknown;
      privateReply?: unknown;
      publicReply?: unknown;
    };
  }>("/automations", async (req, reply) => {
    const { name, postId, keyword, privateReply, publicReply } = req.body ?? {};
    if (
      typeof postId !== "string" ||
      postId === "" ||
      typeof keyword !== "string" ||
      keyword.trim() === "" ||
      typeof privateReply !== "string" ||
      privateReply.trim() === "" ||
      !uuidOk(postId) ||
      (publicReply !== null &&
        publicReply !== undefined &&
        typeof publicReply !== "string") ||
      keyword.length > 120 ||
      privateReply.length > 4000 ||
      (typeof publicReply === "string" && publicReply.length > 1000) ||
      (typeof name === "string" && name.length > 200)
    ) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "postId, keyword, and privateReply are required",
      });
    }
    const label =
      typeof name === "string" && name.trim() !== ""
        ? name.trim()
        : keyword.trim();

    const result = await rest<AutomationRow[]>(authed(req), "automations", {
      method: "POST",
      prefer: "return=representation",
      body: {
        workspace_id: req.workspaceId,
        post_id: postId,
        name: label,
        keyword: keyword.trim(),
        private_reply: privateReply.trim(),
        public_reply:
          typeof publicReply === "string" && publicReply !== ""
            ? publicReply
            : null,
        status: "draft",
      },
    });
    if (result.status === 409 || result.errorCode === "23503") {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Unknown post",
      });
    }
    if (result.status >= 400 || !result.data?.[0]) {
      req.log.error({ status: result.status, code: result.errorCode }, "insert automations failed");
      throw Object.assign(new Error("failed to create automation"), {
        statusCode: 502,
      });
    }
    // Representation without the embedded post — fetch caption for the response.
    const created = await rest<AutomationRow[]>(
      authed(req),
      `automations?id=eq.${result.data[0].id}&select=*,post:posts(caption)`,
    );
    const row = created.data?.[0] ?? result.data[0];
    return reply.code(201).send(mapAutomation(row));
  });

  app.patch<{
    Params: { id: string };
    Body: {
      name?: unknown;
      keyword?: unknown;
      privateReply?: unknown;
      publicReply?: unknown;
      status?: unknown;
      postId?: unknown;
    };
  }>("/automations/:id", async (req, reply) => {
    if (!uuidOk(req.params.id)) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    const body = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim() !== "") {
      if (body.name.length > 200) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "name too long",
        });
      }
      patch.name = body.name.trim();
    }
    if (typeof body.keyword === "string" && body.keyword.trim() !== "") {
      if (body.keyword.length > 120) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "keyword too long",
        });
      }
      patch.keyword = body.keyword.trim();
    }
    if (typeof body.privateReply === "string" && body.privateReply.trim() !== "") {
      if (body.privateReply.length > 4000) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "privateReply too long",
        });
      }
      patch.private_reply = body.privateReply.trim();
    }
    if (typeof body.publicReply === "string") {
      if (body.publicReply.length > 1000) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "publicReply too long",
        });
      }
      patch.public_reply = body.publicReply === "" ? null : body.publicReply;
    } else if (body.publicReply === null) patch.public_reply = null;
    if (typeof body.status === "string") {
      if (!AUTOMATION_STATUS.has(body.status)) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "status must be active, paused, or draft",
        });
      }
      patch.status = body.status;
    }
    if (Object.keys(patch).length === 0) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "no updatable fields",
      });
    }
    patch.updated_at = new Date().toISOString();

    const result = await rest<AutomationRow[]>(authed(req), `automations?id=eq.${req.params.id}`, {
      method: "PATCH",
      prefer: "return=representation",
      body: patch,
    });
    if (result.status >= 400 || !result.data?.[0]) {
      if (result.status < 400) {
        return reply.code(404).send({ statusCode: 404, error: "Not Found" });
      }
      throw Object.assign(new Error("failed to update automation"), {
        statusCode: 502,
      });
    }
    const row = await rest<AutomationRow[]>(
      authed(req),
      `automations?id=eq.${req.params.id}&select=*,post:posts(caption)`,
    );
    return mapAutomation(row.data?.[0] ?? result.data[0]);
  });

  // --- social accounts -------------------------------------------------------

  app.get("/social-accounts", async (req) => {
    const result = await rest<SocialAccountRow[]>(
      authed(req),
      // Explicit columns: access_token/ig_user_id stay API-side only.
      "social_accounts?select=id,platform,username,name,followers,status,connected_at&order=connected_at.desc",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load social accounts"), {
        statusCode: 502,
      });
    }
    return (result.data ?? []).map(mapSocialAccount);
  });

  app.get("/social-accounts/instagram", async (req, reply) => {
    const result = await rest<SocialAccountRow[]>(
      authed(req),
      "social_accounts?select=id,platform,username,name,followers,status,connected_at&platform=eq.instagram&limit=1",
    );
    const row = result.data?.[0];
    if (result.status >= 400 || !row) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found" });
    }
    return mapSocialAccount(row);
  });

  // --- usage (Task 019) ------------------------------------------------------
  // Authority: usage_events (idempotent product usage), not automations
  // lifetime counters. Optional start/end (ISO date); defaults to current
  // UTC calendar month. Workspace comes from the session — never from query.
  app.get<{
    Querystring: { start?: string; end?: string };
  }>("/usage/summary", async (req, reply) => {
    const range = parseUsageRange(req.query.start, req.query.end);
    if (!range.ok) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: range.message,
      });
    }
    const user = authed(req);
    const summary = await getWorkspaceUsage(user, range.start, range.end);
    if (!summary) {
      throw Object.assign(new Error("failed to load usage"), {
        statusCode: 502,
      });
    }
    const t = summary.totals;
    return {
      period: range.label,
      start: summary.start,
      end: summary.end,
      // Existing UsageSummary contract (UI keeps working) + real event totals.
      dmsSent: t.private_dm_sent,
      commentsProcessed: t.comment_received,
      publicReplies: t.public_reply_sent,
      failedDeliveries: t.private_dm_failed + t.public_reply_failed,
      commentsReceived: t.comment_received,
      commentsMatched: t.comment_matched,
      privateDmFailed: t.private_dm_failed,
      publicReplyFailed: t.public_reply_failed,
      byEventType: t,
      // No plan system in V1 — never invent a limit.
      used: summary.used,
      limit: summary.limit,
      remaining: summary.remaining,
    };
  });

  // --- analytics -------------------------------------------------------------
  // Authority: automations lifetime counters (product reporting). Usage
  // events own billing metrics — do not conflate the two.
  app.get("/analytics/summary", async (req) => {
    const result = await rest<AutomationCounters[]>(
      authed(req),
      "automations?select=status,matched_count,dm_sent_count,failed_count",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load analytics"), {
        statusCode: 502,
      });
    }
    const rows = result.data ?? [];
    return {
      commentsMatched: sum(rows, "matched_count"),
      dmsSent: sum(rows, "dm_sent_count"),
      publicReplies: 0,
      failedDeliveries: sum(rows, "failed_count"),
      activeAutomations: rows.filter((r) => r.status === "active").length,
      daily: [],
    };
  });

  // --- inbox -----------------------------------------------------------------
  // comments arrive via webhook (016); deliveries rows land with engine (017+).
  // Member-scoped reads via the caller's JWT (RLS).

  interface CommentRow {
    id: string;
    post_id: string | null;
    username: string;
    text: string;
    matched: boolean;
    automation_name: string | null;
    created_at: string;
    post?: { caption: string } | { caption: string }[] | null | undefined;
  }

  interface DeliveryRow {
    id: string;
    comment_id: string | null;
    recipient: string;
    kind: "private_dm" | "public_reply";
    status: "queued" | "sent" | "delivered" | "failed";
    error: string | null;
    created_at: string;
  }

  app.get("/comments/recent", async (req) => {
    const result = await rest<CommentRow[]>(
      authed(req),
      "comments?select=id,post_id,username,text,matched,automation_name,created_at,post:posts(caption)&order=created_at.desc&limit=50",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load comments"), {
        statusCode: 502,
      });
    }
    return (result.data ?? []).map((row) => ({
      id: row.id,
      postId: row.post_id ?? "",
      postCaption: postCaption(row.post),
      username: row.username,
      text: row.text,
      matched: row.matched,
      automationName: row.automation_name,
      createdAt: row.created_at,
    }));
  });

  app.get("/deliveries/recent", async (req) => {
    const result = await rest<DeliveryRow[]>(
      authed(req),
      "deliveries?select=id,comment_id,recipient,kind,status,error,created_at&order=created_at.desc&limit=50",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load deliveries"), {
        statusCode: 502,
      });
    }
    return (result.data ?? []).map((row) => ({
      id: row.id,
      commentId: row.comment_id ?? "",
      recipient: row.recipient,
      kind: row.kind,
      status: row.status,
      error: row.error,
      createdAt: row.created_at,
    }));
  });

  // Meta/Instagram OAuth connect + callback + disconnect (Task 015).
  registerMetaRoutes(app);

  // Meta webhooks: verify handshake + signed event ingest (Task 016).
  registerWebhookRoutes(app);

  // Platform admin: Meta app credentials (Task 018A). Session preHandler runs;
  // platform-admin email gate is inside these handlers.
  registerAdminRoutes(app);

  return app;
}
