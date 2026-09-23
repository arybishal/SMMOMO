import type { FastifyRequest } from "fastify";
import { restService } from "./supabase";
import { recordUsageEvent } from "./usage";

// Task 017: comment → keyword match engine. Runs inline on webhook persist
// (no Redis/BullMQ in this environment — 018 owns the queue + Graph send).
// Match policy: case-insensitive substring — comment text contains keyword
// ( "win" matches "I want to WIN!" ). First active automation wins
// (created_at asc). When comment.post_id is known, only that post's
// automations apply; while post_id is null (posts import pending), any
// active workspace automation is eligible — documented, not hidden.
// Idempotency: claim via PATCH comments WHERE matched=false — only the
// winning claim increments matched_count and enqueues deliveries.

interface ActiveAutomation {
  id: string;
  name: string;
  keyword: string;
  public_reply: string | null;
}

interface CommentMatchRow {
  id: string;
  post_id: string | null;
  username: string;
  matched: boolean;
}

export type EngineOutcome =
  | "matched"
  | "no_match"
  | "already"
  | "failed";

export async function runCommentEngine(
  workspaceId: string,
  igCommentId: string,
  text: string,
  log: FastifyRequest["log"],
): Promise<EngineOutcome> {
  const encWs = encodeURIComponent(workspaceId);
  const encIg = encodeURIComponent(igCommentId);

  const commentRes = await restService<CommentMatchRow[]>(
    `comments?workspace_id=eq.${encWs}&ig_comment_id=eq.${encIg}&select=id,post_id,username,matched&limit=1`,
  );
  const comment = commentRes.data?.[0];
  if (commentRes.status >= 400 || !comment) {
    log.error({ status: commentRes.status, igCommentId }, "engine: comment lookup failed");
    return "failed";
  }
  if (comment.matched) return "already";

  let autoPath =
    `automations?workspace_id=eq.${encWs}&status=eq.active` +
    `&select=id,name,keyword,public_reply&order=created_at.asc`;
  if (comment.post_id) {
    autoPath += `&post_id=eq.${encodeURIComponent(comment.post_id)}`;
  }
  const autoRes = await restService<ActiveAutomation[]>(autoPath);
  if (autoRes.status >= 400) {
    log.error({ status: autoRes.status, igCommentId }, "engine: automations lookup failed");
    return "failed";
  }
  const needle = text.toLowerCase();
  const match = (autoRes.data ?? []).find(
    (a) => a.keyword.trim() !== "" && needle.includes(a.keyword.toLowerCase()),
  );
  if (!match) return "no_match";

  // Claim: only one caller flips matched false→true for this comment.
  const claim = await restService<{ id: string }[]>(
    `comments?id=eq.${comment.id}&matched=eq.false`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        matched: true,
        automation_id: match.id,
        automation_name: match.name,
      },
    },
  );
  if (claim.status >= 400) {
    log.error({ status: claim.status, code: claim.errorCode, igCommentId }, "engine: claim failed");
    return "failed";
  }
  if (!claim.data?.length) return "already";

  // Usage: only the winning claim is a real match (webhook retries → already).
  const usage = await recordUsageEvent({
    workspaceId,
    eventType: "comment_matched",
    source: "engine",
    referenceType: "comment",
    referenceId: igCommentId,
  });
  if (usage === "failed") {
    log.error({ igCommentId }, "usage: comment_matched record failed");
  }

  // Counter: claim gate means this comment increments once. Read-modify-write
  // is enough at this scale (ponytail: no RPC; race across two different
  // comments hitting the same automation in the same millisecond is acceptable).
  const counterRes = await restService<{ matched_count: number }[]>(
    `automations?id=eq.${match.id}&select=matched_count`,
  );
  const current = Number(counterRes.data?.[0]?.matched_count ?? 0);
  const bump = await restService(`automations?id=eq.${match.id}`, {
    method: "PATCH",
    body: {
      matched_count: current + 1,
      updated_at: new Date().toISOString(),
    },
  });
  if (bump.status >= 400) {
    // Match is already claimed; counter miss is visible in analytics but must
    // not re-claim. Log loudly; treat as soft failure (comment stays matched).
    log.error({ status: bump.status, automationId: match.id }, "engine: matched_count increment failed");
  }

  // Enqueue delivery work for 018 (Graph send stays there). Private DM always;
  // public reply only when the automation configured one.
  const deliveries: {
    workspace_id: string;
    comment_id: string;
    recipient: string;
    kind: "private_dm" | "public_reply";
    status: "queued";
  }[] = [
    {
      workspace_id: workspaceId,
      comment_id: comment.id,
      recipient: comment.username,
      kind: "private_dm",
      status: "queued",
    },
  ];
  if (match.public_reply && match.public_reply.trim() !== "") {
    deliveries.push({
      workspace_id: workspaceId,
      comment_id: comment.id,
      recipient: comment.username,
      kind: "public_reply",
      status: "queued",
    });
  }
  const enqueue = await restService("deliveries", {
    method: "POST",
    prefer: "resolution=ignore-duplicates",
    body: deliveries,
  });
  if (enqueue.status >= 400) {
    log.error({ status: enqueue.status, code: enqueue.errorCode, igCommentId }, "engine: delivery enqueue failed");
    return "failed";
  }

  log.info(
    { igCommentId, automationId: match.id, keyword: match.keyword, deliveries: deliveries.length },
    "comment matched",
  );
  return "matched";
}
