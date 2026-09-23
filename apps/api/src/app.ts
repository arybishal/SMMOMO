import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  authed,
  ensureWorkspace,
  requireUser,
  rest,
} from "./supabase";
import { registerMetaRoutes } from "./meta";

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

function postCaption(post: AutomationRow["post"]): string {
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

export async function buildApp() {
  const app = Fastify({ logger: true });

  // Credentialed cross-origin from the web app (localhost:3000 → :4000):
  // a concrete origin + credentials, never `*` with cookies.
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  // Every product route: resolve the cookie session, then ensure the caller
  // has a workspace (idempotent bootstrap — RLS reads still gate all rows).
  // Exceptions: /health (public); Instagram OAuth callback (auth handled
  // inline so an expired session mid-redirect becomes a login URL, not 401).
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0];
    if (req.method === "GET" && path === "/health") return;
    if (req.method === "GET" && path === "/social-accounts/instagram/callback") {
      return;
    }
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
        typeof publicReply !== "string")
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
    if (typeof body.name === "string" && body.name.trim() !== "")
      patch.name = body.name.trim();
    if (typeof body.keyword === "string" && body.keyword.trim() !== "")
      patch.keyword = body.keyword.trim();
    if (typeof body.privateReply === "string" && body.privateReply.trim() !== "")
      patch.private_reply = body.privateReply.trim();
    if (typeof body.publicReply === "string")
      patch.public_reply = body.publicReply === "" ? null : body.publicReply;
    else if (body.publicReply === null) patch.public_reply = null;
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

  // --- analytics / usage -----------------------------------------------------
  // Derived only from automations lifetime counters (real columns). No
  // deliveries/comments tables yet (016–019) — those metrics stay 0 and
  // `daily` stays empty so the UI's honest empty-chart branch renders.

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

  app.get("/usage/summary", async (req) => {
    const result = await rest<AutomationCounters[]>(
      authed(req),
      "automations?select=matched_count,dm_sent_count,failed_count",
    );
    if (result.status >= 400) {
      throw Object.assign(new Error("failed to load usage"), {
        statusCode: 502,
      });
    }
    const rows = result.data ?? [];
    return {
      // Counters are lifetime values (no per-period event table yet) —
      // label says so instead of pretending to be a calendar month.
      period: "All time",
      dmsSent: sum(rows, "dm_sent_count"),
      commentsProcessed: 0,
      publicReplies: 0,
      failedDeliveries: sum(rows, "failed_count"),
    };
  });

  // --- inbox -----------------------------------------------------------------
  // comments/deliveries tables arrive with Tasks 016–019 — honest empties,
  // never fabricated rows.

  app.get("/comments/recent", async () => []);

  app.get("/deliveries/recent", async () => []);

  // Meta/Instagram OAuth connect + callback + disconnect (Task 015).
  registerMetaRoutes(app);

  return app;
}
