import { rest, restService, serviceEnabled } from "./supabase";

// Task 019: usage event layer — one clear authority for product usage /
// future billing. Not a row-count of operational tables: Meta retries and
// delivery retries must not double-count. DB unique
// (workspace_id, event_type, idempotency_key) is the final guard.
//
// Authority map:
//   deliveries.status     → operational delivery state
//   automations.*_count   → analytics / product reporting
//   usage_events          → usage + future billing

export const USAGE_EVENT_TYPES = [
  "comment_received",
  "comment_matched",
  "private_dm_sent",
  "private_dm_failed",
  "public_reply_sent",
  "public_reply_failed",
] as const;

export type UsageEventType = (typeof USAGE_EVENT_TYPES)[number];

export type UsageSource = "webhook" | "engine" | "delivery";
export type UsageReferenceType = "comment" | "delivery";

const EVENT_SET = new Set<string>(USAGE_EVENT_TYPES);

export interface RecordUsageInput {
  workspaceId: string;
  eventType: UsageEventType;
  source: UsageSource;
  referenceType: UsageReferenceType;
  /** Deterministic id: ig_comment_id or delivery uuid — never a random UUID. */
  referenceId: string;
  quantity?: number;
  /** Minimal keys only — no tokens, message bodies, or comment text. */
  metadata?: Record<string, string | number | boolean>;
  occurredAt?: string;
}

export type RecordUsageResult = "recorded" | "duplicate" | "failed";

/** Idempotency key derived from the authoritative record (not random). */
export function usageIdempotencyKey(
  referenceType: UsageReferenceType,
  referenceId: string,
): string {
  return referenceType === "comment"
    ? `comment:${referenceId}`
    : `delivery:${referenceId}`;
}

/**
 * Insert one usage event. Duplicates (same workspace + type + key) are
 * success no-ops — Meta webhook retries / worker re-entries stay single-count.
 * Service-role path (webhook/engine/delivery only — never browser).
 */
export async function recordUsageEvent(
  input: RecordUsageInput,
): Promise<RecordUsageResult> {
  if (!EVENT_SET.has(input.eventType)) return "failed";
  if (!input.workspaceId || !input.referenceId) return "failed";
  if (!serviceEnabled()) return "failed";

  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1) return "failed";

  const res = await restService(
    "usage_events?on_conflict=workspace_id,event_type,idempotency_key",
    {
      method: "POST",
      prefer: "resolution=ignore-duplicates",
      body: {
        workspace_id: input.workspaceId,
        event_type: input.eventType,
        source: input.source,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        quantity,
        metadata: input.metadata ?? {},
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        idempotency_key: usageIdempotencyKey(
          input.referenceType,
          input.referenceId,
        ),
      },
    },
  );

  if (res.status >= 400) {
    // Unique violation without Prefer honored → still a duplicate.
    if (res.errorCode === "23505") return "duplicate";
    return "failed";
  }
  // ignore-duplicates + representation: empty array / 204 → already existed.
  if (res.status === 204 || res.data === null) return "duplicate";
  if (Array.isArray(res.data) && res.data.length === 0) return "duplicate";
  return "recorded";
}

// --- read / summary ---------------------------------------------------------

const BILLABLE_EVENT: UsageEventType = "private_dm_sent";

function emptyTotals(): Record<UsageEventType, number> {
  return {
    comment_received: 0,
    comment_matched: 0,
    private_dm_sent: 0,
    private_dm_failed: 0,
    public_reply_sent: 0,
    public_reply_failed: 0,
  };
}

/** Calendar month in UTC: [start inclusive, end exclusive). */
export function currentUsagePeriod(now = new Date()): {
  start: Date;
  end: Date;
  label: string;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const label = start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, label };
}

export function parseUsageRange(
  startRaw?: string,
  endRaw?: string,
  now = new Date(),
): { ok: true; start: Date; end: Date; label: string } | { ok: false; message: string } {
  const fallback = currentUsagePeriod(now);
  const isoDate = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;

  const bad = (name: string) =>
    ({ ok: false as const, message: `invalid ${name} date` });

  let start = fallback.start;
  let end = fallback.end;
  let custom = false;

  if (startRaw !== undefined && startRaw !== "") {
    if (!isoDate.test(startRaw)) return bad("start");
    const d = new Date(startRaw);
    if (Number.isNaN(d.getTime())) return bad("start");
    start = d;
    custom = true;
  }
  if (endRaw !== undefined && endRaw !== "") {
    if (!isoDate.test(endRaw)) return bad("end");
    const d = new Date(endRaw);
    if (Number.isNaN(d.getTime())) return bad("end");
    end = d;
    custom = true;
  }
  // End is exclusive when a bare date is given (YYYY-MM-DD → midnight UTC).
  // If only time components, Date() already parsed them; keep as-is.
  if (start.getTime() >= end.getTime()) {
    return { ok: false, message: "start must be before end" };
  }

  const label = custom
    ? `${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`
    : fallback.label;
  return { ok: true, start, end, label };
}

export interface UsageSummaryResult {
  period: string;
  start: string;
  end: string;
  totals: Record<UsageEventType, number>;
  /** Primary V1 billable metric (private_dm_sent). No plan system yet. */
  used: number;
  limit: number | null;
  remaining: number | null;
}

/**
 * Aggregate usage_events for the authenticated workspace over [start, end).
 * End-user JWT + RLS — never accepts a browser-supplied workspace id.
 */
export async function getWorkspaceUsage(
  user: { id: string; token: string },
  start: Date,
  end: Date,
): Promise<UsageSummaryResult | null> {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const path =
    "usage_events" +
    `?occurred_at=gte.${encodeURIComponent(startIso)}` +
    `&occurred_at=lt.${encodeURIComponent(endIso)}` +
    "&select=event_type,quantity" +
    "&limit=10000";

  const res = await rest<{ event_type: string; quantity: number }[]>(
    user,
    path,
  );
  if (res.status >= 400) return null;

  const totals = emptyTotals();
  for (const row of res.data ?? []) {
    if (EVENT_SET.has(row.event_type)) {
      totals[row.event_type as UsageEventType] += Number(row.quantity ?? 0);
    }
  }

  const used = totals[BILLABLE_EVENT];
  return {
    period: "",
    start: startIso,
    end: endIso,
    totals,
    used,
    limit: null,
    remaining: null,
  };
}
