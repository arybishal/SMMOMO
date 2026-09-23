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

async function postGraph(
  path: string,
  token: string,
  body: unknown,
  fetchImpl: FetchLike,
): Promise<GraphSendResult> {
  const url = `${graphBase()}${path}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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
    return { ok: true, httpStatus: res.status, retryable: false };
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
