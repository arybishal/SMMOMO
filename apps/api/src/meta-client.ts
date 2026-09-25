// Task 023: explicit Meta Graph API boundary for outbound Instagram sends.
// Every network call leaves through here so tests can mock at the HTTP/fetch
// edge. Tokens never leave this module in logs or return values.

export type GraphErrorClass =
  | "auth"
  | "permission"
  | "rate_limit"
  | "invalid_request"
  | "temporary"
  | "network"
  | "unknown";

export interface GraphSendResult {
  ok: boolean;
  /** HTTP status when Meta responded; undefined for network failures. */
  httpStatus?: number;
  errorClass?: GraphErrorClass;
  /** Safe, user-facing text — never raw Graph bodies or tokens. */
  safeMessage?: string;
  /** Sanitized diagnostic for server logs only (no tokens). */
  diagnostic?: string;
  /**
   * True only when a retry cannot produce a duplicate DM:
   * clear 429/5xx responses (Meta did not accept) or connection-refused
   * (request never left). Network timeouts after connect are ambiguous → false.
   */
  retryable: boolean;
  /** Auth/permission failures → mark account needs reconnect (not disconnect). */
  needsReconnect?: boolean;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SAFE: Record<GraphErrorClass, string> = {
  auth: "Instagram authentication expired. Reconnect the account.",
  permission: "Instagram permission missing for this action. Reconnect the account.",
  rate_limit: "Instagram rate limit hit. Will retry.",
  invalid_request: "Instagram rejected the message request.",
  temporary: "Instagram is temporarily unavailable. Will retry.",
  network: "Could not confirm Instagram accepted the message.",
  unknown: "Instagram delivery failed.",
};

function graphBase(): string {
  // Read at call time so tests can set META_GRAPH_BASE after import.
  return process.env.META_GRAPH_BASE ?? "https://graph.instagram.com";
}

function sanitizeGraphError(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\bIGQV[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/(EAA[A-Za-z0-9]+)/g, "[redacted]")
    .slice(0, 200);
}

export function classifyHttpStatus(status: number): GraphErrorClass {
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 429) return "rate_limit";
  if (status >= 400 && status < 500) return "invalid_request";
  if (status >= 500) return "temporary";
  return "unknown";
}

/** Connection never established → safe to retry. Anything else → ambiguous. */
function classifyNetworkError(err: unknown): {
  errorClass: GraphErrorClass;
  retryable: boolean;
} {
  const cause = (err as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? "";
  const msg = String((err as Error)?.message ?? "");
  // fetch failed with ECONNREFUSED/ENOTFOUND → never reached Meta.
  // AbortError / timeout / socket hang up after connect → ambiguous.
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    /getaddrinfo|ECONNREFUSED|ENOTFOUND/i.test(msg)
  ) {
    return { errorClass: "network", retryable: true };
  }
  return { errorClass: "network", retryable: false };
}

async function graph(
  method: "GET" | "POST",
  path: string,
  token: string,
  body: unknown | undefined,
  fetchImpl: FetchLike,
): Promise<GraphSendResult & { data?: unknown }> {
  const url = `${graphBase()}${path}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(
        Number(process.env.META_GRAPH_TIMEOUT_MS ?? 15_000),
      ),
    });
  } catch (err) {
    const { errorClass, retryable } = classifyNetworkError(err);
    return {
      ok: false,
      errorClass,
      safeMessage: SAFE[errorClass],
      diagnostic: `graph_network: ${String((err as Error)?.message ?? err).slice(0, 200)}`,
      retryable,
      needsReconnect: false,
    };
  }

  if (res.ok) {
    const data = await res.json().catch(() => undefined);
    return { ok: true, httpStatus: res.status, retryable: false, data };
  }

  const text = await res.text().catch(() => "");
  const errorClass = classifyHttpStatus(res.status);
  const diagnostic = `graph_${res.status}: ${sanitizeGraphError(text)}`;
  const retryable =
    errorClass === "rate_limit" || errorClass === "temporary";
  return {
    ok: false,
    httpStatus: res.status,
    errorClass,
    safeMessage: SAFE[errorClass],
    diagnostic,
    retryable,
    needsReconnect: errorClass === "auth" || errorClass === "permission",
  };
}

async function postGraph(
  path: string,
  token: string,
  body: unknown,
  fetchImpl: FetchLike,
): Promise<GraphSendResult> {
  return graph("POST", path, token, body, fetchImpl);
}

/** Instagram Messaging API — private DM to a commenter username. */
export async function sendInstagramDm(opts: {
  token: string;
  igUserId: string;
  recipient: string;
  message: string;
  fetchImpl?: FetchLike;
}): Promise<GraphSendResult> {
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  return postGraph(
    `/${encodeURIComponent(opts.igUserId)}/messages`,
    opts.token,
    {
      recipient: { username: opts.recipient },
      message: opts.message,
    },
    fetchImpl,
  );
}

/** Instagram comment reply API — public reply on an existing comment. */
export async function sendInstagramCommentReply(opts: {
  token: string;
  igCommentId: string;
  message: string;
  fetchImpl?: FetchLike;
}): Promise<GraphSendResult> {
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  return postGraph(
    `/${encodeURIComponent(opts.igCommentId)}/replies`,
    opts.token,
    { message: opts.message },
    fetchImpl,
  );
}

export interface InstagramMediaItem {
  id: string;
  caption?: string | null;
  media_type?: string | null;
  media_product_type?: string | null;
  media_url?: string | null;
  permalink?: string | null;
  timestamp?: string | null;
  like_count?: number;
  comments_count?: number;
}

/**
 * Content import (Task 024): one page of the /{igUserId}/media edge.
 * ponytail: single page (50 items) — enough to unblock the first automation;
 * cursor pagination when workspaces routinely exceed 50 posts.
 */
export async function fetchInstagramMedia(opts: {
  token: string;
  igUserId: string;
  fetchImpl?: FetchLike;
}): Promise<GraphSendResult & { items?: InstagramMediaItem[] }> {
  const fetchImpl = opts.fetchImpl ?? (fetch as FetchLike);
  const out = await graph(
    "GET",
    `/${encodeURIComponent(opts.igUserId)}/media?fields=id,caption,media_type,media_product_type,media_url,permalink,timestamp,like_count,comments_count&limit=50`,
    opts.token,
    undefined,
    fetchImpl,
  );
  if (!out.ok) return out;
  const page = out.data as { data?: unknown } | undefined;
  const items = Array.isArray(page?.data)
    ? (page.data as InstagramMediaItem[])
    : [];
  return { ...out, items };
}

/**
 * Template rendering for delivery messages.
 * Webhook payload only carries `from.username` — no verified first name.
 * `{{first_name}}` is left as the literal token (personalization deferred);
 * never invent follower names. Substitute here only when a verified source
 * is added to the webhook/comment row.
 */
export function renderDeliveryMessage(template: string): string {
  return template;
}
