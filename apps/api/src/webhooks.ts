import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { restService, serviceEnabled } from "./supabase";

// Meta webhooks (Task 016): GET verify handshake + POST signature-checked
// comment events → comments table. Meta servers have no session cookie —
// writes use SUPABASE_SERVICE_ROLE_KEY (API env only, never apps/web).
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN ?? "";
const APP_SECRET = process.env.META_APP_SECRET ?? "";

interface CommentChange {
  from?: { username?: string };
  media?: { id?: string };
  comment_id?: string;
  text?: string;
  post_id?: string;
}

interface WebhookEntry {
  id?: string;
  changes?: { field?: string; value?: CommentChange }[];
}

interface WebhookBody {
  entry?: WebhookEntry[];
  object?: string;
}

function verifySignature(raw: string, header: string | undefined): boolean {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const provided = header.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ig_user_id (webhook entry.id) → workspace via connected social_accounts.
async function workspaceForIgUser(igUserId: string): Promise<string | null> {
  const res = await restService<{ workspace_id: string }[]>(
    `social_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&platform=eq.instagram&select=workspace_id&limit=1`,
  );
  if (res.status >= 400 || !res.data?.[0]) return null;
  return res.data[0].workspace_id;
}

// Resolve IG media id → local post id when content import already ran.
async function postIdForMedia(
  workspaceId: string,
  igMediaId: string | null,
): Promise<string | null> {
  if (!igMediaId) return null;
  const res = await restService<{ id: string }[]>(
    `posts?workspace_id=eq.${workspaceId}&ig_media_id=eq.${encodeURIComponent(igMediaId)}&select=id&limit=1`,
  );
  if (res.status >= 400 || !res.data?.[0]) return null;
  return res.data[0].id;
}

async function persistComment(
  workspaceId: string,
  igUserId: string,
  change: CommentChange,
  log: FastifyRequest["log"],
): Promise<"inserted" | "duplicate" | "failed"> {
  if (!change.comment_id || !change.text) return "failed";
  const username = change.from?.username ?? "unknown";
  const igMediaId = change.media?.id ?? change.post_id ?? null;
  const postId = await postIdForMedia(workspaceId, igMediaId);
  const res = await restService(
    `comments?on_conflict=workspace_id,ig_comment_id`,
    {
      method: "POST",
      prefer: "resolution=ignore-duplicates,return=representation",
      body: {
        workspace_id: workspaceId,
        post_id: postId,
        ig_comment_id: change.comment_id,
        ig_media_id: igMediaId,
        username,
        text: change.text,
        matched: false,
        automation_id: null,
        automation_name: null,
      },
    },
  );
  if (res.status >= 400) {
    // Unique violation without Prefer honored → still a duplicate Meta retry.
    if (res.errorCode === "23505") return "duplicate";
    log.error({ status: res.status, code: res.errorCode, igUserId }, "comment insert failed");
    return "failed";
  }
  if (res.status === 204 || res.data === null) return "duplicate";
  return Array.isArray(res.data) && res.data.length === 0 ? "duplicate" : "inserted";
}

export function registerWebhookRoutes(app: FastifyInstance): void {
  // GET verify handshake — Meta confirms the callback URL before subscribing.
  app.get("/webhooks/instagram", async (req, reply) => {
    const q = req.query as {
      "hub.mode"?: string;
      "hub.verify_token"?: string;
      "hub.challenge"?: string;
    };
    if (!VERIFY_TOKEN) {
      return reply
        .code(503)
        .send({ statusCode: 503, error: "Service Unavailable", message: "webhook not configured" });
    }
    if (q["hub.mode"] === "subscribe" && q["hub.verify_token"] === VERIFY_TOKEN) {
      return reply.type("text/plain").send(q["hub.challenge"] ?? "");
    }
    return reply.code(403).send({ statusCode: 403, error: "Forbidden" });
  });

  // POST event delivery — signature over raw body; 200 only after durable persist.
  // Raw body attached by the application/json content-type parser in app.ts.
  app.post("/webhooks/instagram", async (req, reply) => {
    if (!APP_SECRET) {
      return reply
        .code(503)
        .send({ statusCode: 503, error: "Service Unavailable", message: "META_APP_SECRET not set" });
    }
    if (!serviceEnabled()) {
      return reply
        .code(503)
        .send({ statusCode: 503, error: "Service Unavailable", message: "service key not configured" });
    }
    const raw = (req as FastifyRequest & { rawBody?: string }).rawBody ?? "";
    const sig = req.headers["x-hub-signature-256"];
    if (!verifySignature(raw, typeof sig === "string" ? sig : undefined)) {
      return reply.code(403).send({ statusCode: 403, error: "Forbidden", message: "invalid signature" });
    }

    let body: WebhookBody;
    try {
      body = JSON.parse(raw) as WebhookBody;
    } catch {
      return reply.code(400).send({ statusCode: 400, error: "Bad Request" });
    }

    const failures: string[] = [];
    for (const entry of body.entry ?? []) {
      const igUserId = entry.id ?? "";
      if (!igUserId) continue;
      const workspaceId = await workspaceForIgUser(igUserId);
      if (!workspaceId) {
        // Unknown IG user (not connected here) — ack so Meta stops retrying.
        req.log.warn({ igUserId }, "webhook for unknown ig_user_id");
        continue;
      }
      for (const change of entry.changes ?? []) {
        if (change.field !== "comments" || !change.value) continue;
        const outcome = await persistComment(workspaceId, igUserId, change.value, req.log);
        if (outcome === "failed") failures.push(change.value.comment_id ?? "?");
        if (outcome === "inserted" || outcome === "duplicate") {
          req.log.info(
            { igUserId, commentId: change.value.comment_id, outcome },
            "webhook comment persisted",
          );
        }
      }
    }
    if (failures.length > 0) {
      // Meta retries on non-2xx — only ack once everything is durable.
      return reply
        .code(502)
        .send({ statusCode: 502, error: "Bad Gateway", message: "persist failed" });
    }
    return reply.code(200).send({ ok: true });
  });
}
