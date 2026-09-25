import type { FastifyInstance } from "fastify";
import { restService, serviceEnabled } from "./supabase";
import { fetchInstagramMedia, type InstagramMediaItem } from "./meta-client";
import { markAccountNeedsReconnect, resolveAccessToken } from "./delivery";

// Task 024: real content import. GET /{igUserId}/media through the shared
// meta-client boundary → idempotent upsert into posts keyed by
// (workspace_id, ig_media_id) (unique index migration 20260925000000).
// Service role only for the token read (members cannot see access_token);
// writes are workspace-scoped rows we just validated.

interface SyncAccountRow {
  id: string;
  username: string;
  ig_user_id: string | null;
  access_token: string | null;
  status: string;
}

interface SyncMediaRow {
  workspace_id: string;
  social_account_id: string;
  ig_media_id: string;
  media_url: string | null;
  caption: string;
  type: "IMAGE" | "REEL" | "CAROUSEL";
  permalink: string;
  comments_count: number;
  likes_count: number;
  posted_at: string;
}

// posts.type CHECK (IMAGE, REEL, CAROUSEL) — Graph reports reels as REEL, or
// as VIDEO with media_product_type=REELS depending on surface. Plain videos
// and stories are outside the schema → skipped (counted, never faked).
function toStoredType(
  item: InstagramMediaItem,
): "IMAGE" | "REEL" | "CAROUSEL" | null {
  if (item.media_type === "IMAGE") return "IMAGE";
  if (item.media_type === "REEL") return "REEL";
  if (item.media_type === "CAROUSEL_ALBUM") return "CAROUSEL";
  if (item.media_type === "VIDEO" && item.media_product_type === "REELS") {
    return "REEL";
  }
  return null;
}

export function registerContentSyncRoutes(app: FastifyInstance): void {
  // Session-authenticated (global preHandler) + IP rate limited in app.ts.
  // Always a real Graph call — no mock success path (USE_MOCK stays false).
  app.post("/social-accounts/instagram/sync", async (req, reply) => {
    // Global preHandler always sets workspaceId before this point; the guard
    // just narrows the optional type without a non-null assertion.
    if (!req.workspaceId) {
      return reply.code(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Not authenticated",
      });
    }
    const workspaceId = req.workspaceId;

    if (!serviceEnabled()) {
      return reply.code(503).send({
        statusCode: 503,
        error: "Service Unavailable",
        message: "Service role not configured on this API instance.",
      });
    }

    const acct = await restService<SyncAccountRow[]>(
      `social_accounts?workspace_id=eq.${encodeURIComponent(workspaceId)}` +
        `&platform=eq.instagram&select=id,username,ig_user_id,access_token,status&limit=1`,
    );
    if (acct.status >= 400) {
      req.log.error({ status: acct.status }, "sync: account lookup failed");
      throw Object.assign(new Error("failed to load connection"), {
        statusCode: 502,
      });
    }
    const row = acct.data?.[0];
    if (!row) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Connect Instagram before importing posts.",
      });
    }
    if (row.status !== "connected") {
      return reply.code(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Instagram needs attention — reconnect before importing posts.",
      });
    }

    const token = row.access_token
      ? await resolveAccessToken(workspaceId, row.access_token)
      : null;
    if (!token || !row.ig_user_id) {
      return reply.code(409).send({
        statusCode: 409,
        error: "Conflict",
        message: "Instagram authentication expired. Reconnect the account.",
      });
    }

    const outcome = await fetchInstagramMedia({
      token,
      igUserId: row.ig_user_id,
    });
    if (!outcome.ok) {
      if (outcome.needsReconnect) {
        await markAccountNeedsReconnect(workspaceId);
      }
      req.log.warn(
        {
          errorClass: outcome.errorClass,
          httpStatus: outcome.httpStatus,
          diagnostic: outcome.diagnostic,
        },
        "content sync graph error",
      );
      const status =
        outcome.errorClass === "auth" || outcome.errorClass === "permission"
          ? 409
          : 502;
      return reply.code(status).send({
        statusCode: status,
        error: status === 409 ? "Conflict" : "Bad Gateway",
        message:
          outcome.safeMessage ?? "Instagram content import failed.",
      });
    }

    const rows: SyncMediaRow[] = [];
    for (const item of outcome.items ?? []) {
      if (typeof item?.id !== "string" || item.id === "") continue;
      const type = toStoredType(item);
      if (!type) continue;
      if (typeof item.timestamp !== "string" || item.timestamp === "") continue;
      rows.push({
        workspace_id: workspaceId,
        social_account_id: row.id,
        ig_media_id: item.id,
        media_url: typeof item.media_url === "string" ? item.media_url : null,
        caption: typeof item.caption === "string" ? item.caption : "",
        type,
        permalink: typeof item.permalink === "string" ? item.permalink : "",
        comments_count: Number(item.comments_count ?? 0) || 0,
        likes_count: Number(item.like_count ?? 0) || 0,
        posted_at: item.timestamp,
      });
    }

    if (rows.length > 0) {
      const upsert = await restService<unknown[]>(
        "posts?on_conflict=workspace_id,ig_media_id",
        {
          method: "POST",
          prefer: "resolution=merge-duplicates,return=minimal",
          body: rows,
        },
      );
      if (upsert.status >= 400) {
        req.log.error(
          { status: upsert.status, code: upsert.errorCode },
          "content sync upsert failed",
        );
        throw Object.assign(new Error("failed to save imported posts"), {
          statusCode: 502,
        });
      }
    }

    const skipped = (outcome.items?.length ?? 0) - rows.length;
    req.log.info(
      { imported: rows.length, skipped },
      "content sync imported posts",
    );
    return { imported: rows.length, skipped };
  });
}
