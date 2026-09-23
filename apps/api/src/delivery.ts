import type { FastifyBaseLogger } from "fastify";
import { restService, serviceEnabled } from "./supabase";

// Task 018: outbound delivery worker. No Redis/BullMQ in this environment
// (same gap as 017) — honest inline poll on the API process. Claim → Graph
// send → finalize. Claim is status=queued → processing (migration
// 20260923200000) so redelivery/crash cannot double-send.
//
// Graph base is env-overridable for validation only (local stub returns
// 200 without Meta messaging perms). Production default is the real Graph
// host — never fakes success in the default path.

const GRAPH_BASE = process.env.META_GRAPH_BASE ?? "https://graph.instagram.com";
const MAX_ATTEMPTS = 3;
const POLL_MS = Number(process.env.DELIVERY_POLL_MS ?? 5000);
const BATCH = Number(process.env.DELIVERY_BATCH ?? 10);

interface QueuedDelivery {
  id: string;
  workspace_id: string;
  comment_id: string | null;
  recipient: string;
  kind: "private_dm" | "public_reply";
}

interface ClaimRow {
  id: string;
}

interface CommentWork {
  id: string;
  ig_comment_id: string;
  automation_id: string | null;
  username: string;
}

interface AutomationWork {
  private_reply: string;
  public_reply: string | null;
}

interface SocialWork {
  access_token: string | null;
  ig_user_id: string | null;
  status: string;
}

type SendOutcome =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

async function sendPrivateDm(
  token: string,
  igUserId: string,
  recipient: string,
  message: string,
): Promise<SendOutcome> {
  // Instagram Messaging API (IG Login token). Recipient is the commenter
  // username from the webhook — Graph may require a recipient id depending
  // on app mode; non-2xx is captured as failed with Meta's error text.
  try {
    const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(igUserId)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { username: recipient },
        message,
      }),
    });
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `graph_dm_${res.status}: ${text.slice(0, 200)}`,
      retryable: res.status >= 500 || res.status === 429,
    };
  } catch (err) {
    return {
      ok: false,
      error: `graph_dm_network: ${(err as Error).message.slice(0, 200)}`,
      retryable: true,
    };
  }
}

async function sendPublicReply(
  token: string,
  igCommentId: string,
  message: string,
): Promise<SendOutcome> {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(igCommentId)}/replies`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      },
    );
    if (res.ok) return { ok: true };
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      error: `graph_reply_${res.status}: ${text.slice(0, 200)}`,
      retryable: res.status >= 500 || res.status === 429,
    };
  } catch (err) {
    return {
      ok: false,
      error: `graph_reply_network: ${(err as Error).message.slice(0, 200)}`,
      retryable: true,
    };
  }
}

// Claim: only one caller moves queued → processing for this row.
// attempts is bumped on the same claim filter so a crash after claim still
// records the attempt (requeue path sets status back to queued separately).
async function claimDelivery(id: string, attempts: number): Promise<boolean> {
  const res = await restService<ClaimRow[]>(
    `deliveries?id=eq.${encodeURIComponent(id)}&status=eq.queued`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        status: "processing",
        claimed_at: new Date().toISOString(),
        attempts,
      },
    },
  );
  if (res.status >= 400) return false;
  return Boolean(res.data?.length);
}

async function finalize(
  id: string,
  status: "sent" | "failed" | "queued",
  error: string | null,
): Promise<void> {
  await restService(`deliveries?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { status, error },
  });
}

async function bumpAutomation(
  automationId: string,
  field: "dm_sent_count" | "failed_count",
): Promise<void> {
  const current = await restService<Record<string, number>[]>(
    `automations?id=eq.${encodeURIComponent(automationId)}&select=${field}`,
  );
  const value = Number(current.data?.[0]?.[field] ?? 0);
  await restService(`automations?id=eq.${encodeURIComponent(automationId)}`, {
    method: "PATCH",
    body: {
      [field]: value + 1,
      updated_at: new Date().toISOString(),
    },
  });
}

async function processOne(
  row: QueuedDelivery & { attempts?: number },
  log: FastifyBaseLogger,
): Promise<void> {
  const attempts = Number(row.attempts ?? 0) + 1;
  // attempt number is written by claimDelivery (queued → processing).

  // Load comment (ig_comment_id + automation join) when needed.
  let comment: CommentWork | null = null;
  if (row.comment_id) {
    const c = await restService<CommentWork[]>(
      `comments?id=eq.${encodeURIComponent(row.comment_id)}&select=id,ig_comment_id,automation_id,username&limit=1`,
    );
    comment = c.data?.[0] ?? null;
    if (c.status >= 400 || !comment) {
      await finalize(row.id, "failed", "comment_missing");
      log.error({ deliveryId: row.id }, "delivery: comment lookup failed");
      return;
    }
  }

  let automationId = comment?.automation_id ?? null;
  let message = "";
  if (automationId) {
    const a = await restService<AutomationWork[]>(
      `automations?id=eq.${encodeURIComponent(automationId)}&select=private_reply,public_reply&limit=1`,
    );
    const auto = a.data?.[0];
    if (a.status >= 400 || !auto) {
      await finalize(row.id, "failed", "automation_missing");
      await bumpAutomation(automationId, "failed_count");
      log.error({ deliveryId: row.id }, "delivery: automation lookup failed");
      return;
    }
    message =
      row.kind === "private_dm" ? auto.private_reply : (auto.public_reply ?? "");
  }

  if (!message.trim()) {
    await finalize(row.id, "failed", "empty_message");
    if (automationId) await bumpAutomation(automationId, "failed_count");
    log.warn({ deliveryId: row.id, kind: row.kind }, "delivery: empty message");
    return;
  }

  const social = await restService<SocialWork[]>(
    `social_accounts?workspace_id=eq.${encodeURIComponent(row.workspace_id)}&platform=eq.instagram&select=access_token,ig_user_id,status&limit=1`,
  );
  const account = social.data?.[0];
  if (social.status >= 400 || !account?.access_token || !account.ig_user_id) {
    await finalize(row.id, "failed", "no_ig_connection");
    if (automationId) await bumpAutomation(automationId, "failed_count");
    log.warn({ deliveryId: row.id }, "delivery: no connected IG token");
    return;
  }

  let outcome: SendOutcome;
  if (row.kind === "private_dm") {
    outcome = await sendPrivateDm(
      account.access_token,
      account.ig_user_id,
      row.recipient,
      message,
    );
  } else {
    if (!comment?.ig_comment_id) {
      await finalize(row.id, "failed", "missing_ig_comment_id");
      if (automationId) await bumpAutomation(automationId, "failed_count");
      return;
    }
    outcome = await sendPublicReply(
      account.access_token,
      comment.ig_comment_id,
      message,
    );
  }

  if (outcome.ok) {
    await finalize(row.id, "sent", null);
    if (automationId && row.kind === "private_dm") {
      await bumpAutomation(automationId, "dm_sent_count");
    }
    log.info({ deliveryId: row.id, kind: row.kind }, "delivery sent");
    return;
  }

  // Retryable + attempts left → requeue (still no double-claim: next claim
  // only succeeds from status=queued). Otherwise permanent failed.
  if (outcome.retryable && attempts < MAX_ATTEMPTS) {
    await finalize(row.id, "queued", outcome.error);
    log.warn(
      { deliveryId: row.id, attempts, error: outcome.error },
      "delivery retry scheduled",
    );
    return;
  }

  await finalize(row.id, "failed", outcome.error);
  if (automationId) await bumpAutomation(automationId, "failed_count");
  log.error(
    { deliveryId: row.id, attempts, error: outcome.error },
    "delivery failed",
  );
}

/** One poll cycle — exported for validation scripts (no interval). */
export async function processQueuedDeliveries(
  log: FastifyBaseLogger,
): Promise<{ claimed: number; done: number }> {
  if (!serviceEnabled()) return { claimed: 0, done: 0 };

  const batch = await restService<(QueuedDelivery & { attempts?: number })[]>(
    `deliveries?status=eq.queued&order=created_at.asc&limit=${BATCH}&select=id,workspace_id,comment_id,recipient,kind,attempts`,
  );
  if (batch.status >= 400 || !batch.data?.length) {
    return { claimed: 0, done: 0 };
  }

  let claimed = 0;
  let done = 0;
  for (const row of batch.data) {
    const nextAttempt = Number(row.attempts ?? 0) + 1;
    const ok = await claimDelivery(row.id, nextAttempt);
    if (!ok) continue; // lost the claim race — another worker owns it
    claimed += 1;
    try {
      await processOne({ ...row, attempts: nextAttempt }, log);
      done += 1;
    } catch (err) {
      // Unexpected throw after claim: leave processing + log (no silent
      // requeue that could double-send after a partial Graph success).
      log.error({ err, deliveryId: row.id }, "delivery worker crashed mid-job");
    }
  }
  return { claimed, done };
}

/** Start the inline poller on the API process (Task 018). */
export function startDeliveryWorker(log: FastifyBaseLogger): NodeJS.Timeout {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    processQueuedDeliveries(log)
      .catch((err) => log.error({ err }, "delivery poll failed"))
      .finally(() => {
        running = false;
      });
  }, POLL_MS);
  timer.unref?.();
  log.info({ pollMs: POLL_MS, batch: BATCH, graph: GRAPH_BASE }, "delivery worker started");
  return timer;
}
