import type { FastifyBaseLogger } from "fastify";
import { restService, serviceEnabled } from "./supabase";
import { recordUsageEvent, type UsageEventType } from "./usage";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "./crypto";
import {
  renderDeliveryMessage,
  sendInstagramCommentReply,
  sendInstagramDm,
  type GraphSendResult,
} from "./meta-client";

// Task 018/023: outbound delivery worker. No Redis/BullMQ in this environment
// — honest inline poll on the API process (same documented gap as 017).
// Claim → Graph send (via meta-client boundary) → finalize.
//
// State machine (migration 20260923200000):
//   queued → processing → sent | failed
//   processing (stuck past DELIVERY_STUCK_MS) → failed  (Task 023 reclaim)
//
// Ambiguity policy (Task 023): a stuck `processing` row means the process
// died/hung after claim (attempts already bumped). We cannot know whether
// Meta received the request — reclaim marks **failed** (no requeue) so a
// possible partial send is never duplicated. Retryable Graph failures requeue
// only via the explicit retry path below (status → queued while still owned).

const MAX_ATTEMPTS = Number(process.env.DELIVERY_MAX_ATTEMPTS ?? 3);
const POLL_MS = Number(process.env.DELIVERY_POLL_MS ?? 5000);
const BATCH = Number(process.env.DELIVERY_BATCH ?? 10);
// Must exceed META_GRAPH_TIMEOUT_MS (default 15s) + worker overhead so a
// live send is never reclaimed mid-request in a single process.
const STUCK_MS = Number(process.env.DELIVERY_STUCK_MS ?? 120_000);

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

/**
 * Resolve the stored access token for a Graph send.
 * Encrypted (`v1.…`) → decrypt (auth tag verified; tamper → null).
 * Legacy plaintext (pre-021) → use once and re-encrypt in place so the
 * compatibility path only ever moves toward ciphertext, never away from it.
 * New OAuth writes are always encrypted (meta.ts) — no new plaintext rows.
 */
async function resolveAccessToken(
  workspaceId: string,
  stored: string,
): Promise<string | null> {
  if (isEncryptedSecret(stored)) {
    return decryptSecret(stored);
  }
  if (!stored) return null;
  try {
    const enc = encryptSecret(stored);
    await restService(
      `social_accounts?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.instagram`,
      { method: "PATCH", prefer: "return=minimal", body: { access_token: enc } },
    );
  } catch {
    // Missing PLATFORM_ENCRYPTION_KEY — deliver with plaintext once; migration
    // script + restart with key finishes conversion. Never writes new plaintext.
  }
  return stored;
}

/** Surface reconnect need on the account row — never auto-disconnect. */
async function markAccountNeedsReconnect(workspaceId: string): Promise<void> {
  await restService(
    `social_accounts?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.instagram`,
    { method: "PATCH", prefer: "return=minimal", body: { status: "error" } },
  );
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

/**
 * Finalize only while still `processing` (ownership guard). If a reclaim or
 * another worker already moved the row, return false and skip side effects
 * (usage / counters) so we never double-count a lost race.
 */
async function finalize(
  id: string,
  status: "sent" | "failed" | "queued",
  error: string | null,
): Promise<boolean> {
  const res = await restService<ClaimRow[]>(
    `deliveries?id=eq.${encodeURIComponent(id)}&status=eq.processing`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: { status, error },
    },
  );
  if (res.status >= 400) return false;
  return Boolean(res.data?.length);
}

// Usage only on terminal outcomes (sent | permanent failed) — requeue retries
// are intermediate and must not count. Idempotent on delivery id.
async function recordDeliveryUsage(
  row: { id: string; workspace_id: string; kind: "private_dm" | "public_reply" },
  outcome: "sent" | "failed",
  log: FastifyBaseLogger,
): Promise<void> {
  const eventType: UsageEventType =
    row.kind === "private_dm"
      ? outcome === "sent"
        ? "private_dm_sent"
        : "private_dm_failed"
      : outcome === "sent"
        ? "public_reply_sent"
        : "public_reply_failed";
  const result = await recordUsageEvent({
    workspaceId: row.workspace_id,
    eventType,
    source: "delivery",
    referenceType: "delivery",
    referenceId: row.id,
  });
  if (result === "failed") {
    log.error({ deliveryId: row.id, eventType }, "usage: delivery event record failed");
  }
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
  // attempts already bumped by claimDelivery — use as-is (do not +1 again).
  const attempts = Number(row.attempts ?? 0);

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

  // {{first_name}} stays literal — webhook has username only (meta-client docs).
  message = renderDeliveryMessage(message);

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
  const accessToken = account?.access_token
    ? await resolveAccessToken(row.workspace_id, account.access_token)
    : null;
  if (social.status >= 400 || !accessToken || !account?.ig_user_id) {
    await finalize(row.id, "failed", "no_ig_connection");
    if (automationId) await bumpAutomation(automationId, "failed_count");
    log.warn({ deliveryId: row.id }, "delivery: no usable IG token");
    return;
  }

  let outcome: GraphSendResult;
  if (row.kind === "private_dm") {
    outcome = await sendInstagramDm({
      token: accessToken,
      igUserId: account.ig_user_id,
      recipient: row.recipient,
      message,
    });
  } else {
    if (!comment?.ig_comment_id) {
      await finalize(row.id, "failed", "missing_ig_comment_id");
      if (automationId) await bumpAutomation(automationId, "failed_count");
      return;
    }
    outcome = await sendInstagramCommentReply({
      token: accessToken,
      igCommentId: comment.ig_comment_id,
      message,
    });
  }

  if (outcome.ok) {
    const owned = await finalize(row.id, "sent", null);
    if (!owned) {
      log.warn({ deliveryId: row.id }, "delivery: lost ownership before sent finalize");
      return;
    }
    await recordDeliveryUsage(row, "sent", log);
    if (automationId && row.kind === "private_dm") {
      await bumpAutomation(automationId, "dm_sent_count");
    }
    // Successful send clears a prior error-state account flag only via OAuth
    // reconnect — do not auto-set connected here.
    log.info({ deliveryId: row.id, kind: row.kind }, "delivery sent");
    return;
  }

  // Persist safe message only; diagnostic stays in server logs.
  const safeError = outcome.safeMessage ?? "Instagram delivery failed.";
  if (outcome.needsReconnect) {
    await markAccountNeedsReconnect(row.workspace_id);
  }
  log.warn(
    {
      deliveryId: row.id,
      attempts,
      errorClass: outcome.errorClass,
      httpStatus: outcome.httpStatus,
      diagnostic: outcome.diagnostic,
    },
    "delivery graph error",
  );

  if (outcome.retryable && attempts < MAX_ATTEMPTS) {
    const owned = await finalize(row.id, "queued", safeError);
    if (owned) {
      log.warn(
        { deliveryId: row.id, attempts, errorClass: outcome.errorClass },
        "delivery retry scheduled",
      );
      return;
    }
    // Lost ownership mid-retry — do not leave processing.
    return;
  }

  const owned = await finalize(row.id, "failed", safeError);
  if (!owned) return;
  await recordDeliveryUsage(row, "failed", log);
  if (automationId) await bumpAutomation(automationId, "failed_count");
  log.error(
    { deliveryId: row.id, attempts, errorClass: outcome.errorClass },
    "delivery failed",
  );
}

/**
 * Task 023: reclaim rows stuck in `processing` (crash/hang after claim).
 * Cannot prove Meta did not receive the send → permanent failed (no requeue).
 * Atomic guard: still processing + claimed_at older than STUCK_MS.
 */
export async function reclaimStuckDeliveries(
  log: FastifyBaseLogger,
): Promise<number> {
  if (!serviceEnabled()) return 0;
  const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
  const stuck = await restService<
    (QueuedDelivery & { attempts: number })[]
  >(
    `deliveries?status=eq.processing&claimed_at=lt.${encodeURIComponent(cutoff)}` +
      `&select=id,workspace_id,comment_id,recipient,kind,attempts&limit=${BATCH}`,
  );
  if (stuck.status >= 400 || !stuck.data?.length) return 0;

  let reclaimed = 0;
  for (const row of stuck.data) {
    const res = await restService<ClaimRow[]>(
      `deliveries?id=eq.${encodeURIComponent(row.id)}` +
        `&status=eq.processing&claimed_at=lt.${encodeURIComponent(cutoff)}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: {
          status: "failed",
          error: "Delivery interrupted. Not retried to avoid duplicate messages.",
        },
      },
    );
    if (res.status < 400 && res.data?.length) {
      reclaimed += 1;
      await recordDeliveryUsage(row, "failed", log);
      if (row.comment_id) {
        const c = await restService<{ automation_id: string | null }[]>(
          `comments?id=eq.${encodeURIComponent(row.comment_id)}&select=automation_id&limit=1`,
        );
        const automationId = c.data?.[0]?.automation_id;
        if (automationId) await bumpAutomation(automationId, "failed_count");
      }
      log.warn(
        { deliveryId: row.id, attempts: row.attempts },
        "delivery: stuck processing reclaimed → failed",
      );
    }
  }
  return reclaimed;
}

/** One poll cycle — exported for validation scripts (no interval). */
export async function processQueuedDeliveries(
  log: FastifyBaseLogger,
): Promise<{ claimed: number; done: number; reclaimed: number }> {
  if (!serviceEnabled()) return { claimed: 0, done: 0, reclaimed: 0 };

  const reclaimed = await reclaimStuckDeliveries(log);

  const batch = await restService<(QueuedDelivery & { attempts?: number })[]>(
    `deliveries?status=eq.queued&order=created_at.asc&limit=${BATCH}&select=id,workspace_id,comment_id,recipient,kind,attempts`,
  );
  if (batch.status >= 400 || !batch.data?.length) {
    return { claimed: 0, done: 0, reclaimed };
  }

  let claimed = 0;
  let done = 0;
  for (const row of batch.data) {
    const nextAttempt = Number(row.attempts ?? 0) + 1;
    const ok = await claimDelivery(row.id, nextAttempt);
    if (!ok) continue;
    claimed += 1;
    try {
      await processOne({ ...row, attempts: nextAttempt }, log);
      done += 1;
    } catch (err) {
      log.error({ err, deliveryId: row.id }, "delivery worker crashed mid-job");
    }
  }
  return { claimed, done, reclaimed };
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
  log.info(
    {
      pollMs: POLL_MS,
      batch: BATCH,
      maxAttempts: MAX_ATTEMPTS,
      stuckMs: STUCK_MS,
    },
    "delivery worker started",
  );
  return timer;
}
