// Task 023: delivery state machine + Meta Graph client contract validation.
// Run: npx tsx apps/api/scripts/validate-delivery.ts
// Unit tests use injected fetch (no network). Integration (optional) needs
// SUPABASE_SERVICE_ROLE_KEY for stuck-reclaim + claim race probes.
import {
  classifyHttpStatus,
  renderDeliveryMessage,
  sendInstagramCommentReply,
  sendInstagramDm,
  type FetchLike,
  type GraphSendResult,
} from "../src/meta-client";
import { reclaimStuckDeliveries } from "../src/delivery";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = ""): void {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}${extra ? " " + extra : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${extra ? " " + extra : ""}`);
  }
}

function fetchReturning(
  status: number,
  body = "",
  delayMs = 0,
): FetchLike {
  return async (_url, init) => {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
      if (init?.signal?.aborted) {
        throw Object.assign(new Error("The operation was aborted"), {
          name: "TimeoutError",
        });
      }
    }
    return new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

function fetchThrowing(err: unknown): FetchLike {
  return async () => {
    throw err;
  };
}

const TOKEN = "IGQVJ-secret-token-do-not-log-abc123";

async function main(): Promise<void> {
  // --- classification table ---
  ok("401 → auth", classifyHttpStatus(401) === "auth");
  ok("403 → permission", classifyHttpStatus(403) === "permission");
  ok("429 → rate_limit", classifyHttpStatus(429) === "rate_limit");
  ok("400 → invalid_request", classifyHttpStatus(400) === "invalid_request");
  ok("404 → invalid_request", classifyHttpStatus(404) === "invalid_request");
  ok("500 → temporary", classifyHttpStatus(500) === "temporary");
  ok("503 → temporary", classifyHttpStatus(503) === "temporary");
  ok("200 → unknown (not used as error)", classifyHttpStatus(200) === "unknown");

  // --- Meta contract: success ---
  const success = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(200, JSON.stringify({ message_id: "mid.1" })),
  });
  ok("DM 200 ok", success.ok && success.httpStatus === 200);
  ok("DM 200 not retryable flag", success.retryable === false);

  // --- invalid token 401 ---
  const auth = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(
      401,
      JSON.stringify({ error: { message: "Invalid OAuth access token", token: TOKEN } }),
    ),
  });
  ok("DM 401 fail", !auth.ok && auth.errorClass === "auth");
  ok("DM 401 needsReconnect", auth.needsReconnect === true);
  ok("DM 401 not retryable", auth.retryable === false);
  ok(
    "DM 401 safe message no token",
    Boolean(auth.safeMessage) &&
      !auth.safeMessage!.includes(TOKEN) &&
      !auth.safeMessage!.includes("IGQVJ"),
    auth.safeMessage,
  );
  ok(
    "DM 401 diagnostic redacts token",
    Boolean(auth.diagnostic) && !auth.diagnostic!.includes(TOKEN),
    auth.diagnostic,
  );

  // --- permission 403 ---
  const perm = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(403, JSON.stringify({ error: { message: "Permission denied" } })),
  });
  ok("DM 403 permission", !perm.ok && perm.errorClass === "permission");
  ok("DM 403 needsReconnect", perm.needsReconnect === true);
  ok("DM 403 not retryable", perm.retryable === false);

  // --- 429 rate limit → retryable ---
  const rate = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(429, JSON.stringify({ error: { message: "rate limited" } })),
  });
  ok("DM 429 rate_limit", !rate.ok && rate.errorClass === "rate_limit");
  ok("DM 429 retryable", rate.retryable === true);
  ok("DM 429 no reconnect", rate.needsReconnect !== true);

  // --- 400 invalid request → not retryable ---
  const bad = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(400, JSON.stringify({ error: { message: "bad recipient" } })),
  });
  ok("DM 400 invalid_request", !bad.ok && bad.errorClass === "invalid_request");
  ok("DM 400 not retryable", bad.retryable === false);

  // --- 500 temporary → retryable ---
  const tmp = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(500, "upstream"),
  });
  ok("DM 500 temporary", !tmp.ok && tmp.errorClass === "temporary");
  ok("DM 500 retryable", tmp.retryable === true);

  // --- connection refused → network retryable ---
  const refused = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchThrowing(
      Object.assign(new TypeError("fetch failed"), {
        cause: Object.assign(new Error("connect ECONNREFUSED"), {
          code: "ECONNREFUSED",
        }),
      }),
    ),
  });
  ok("DM ECONNREFUSED network", !refused.ok && refused.errorClass === "network");
  ok("DM ECONNREFUSED retryable (never left)", refused.retryable === true);

  // --- timeout / abort → ambiguous, not retryable ---
  const timeout = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchThrowing(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    ),
  });
  ok("DM timeout network", !timeout.ok && timeout.errorClass === "network");
  ok("DM timeout not retryable (ambiguous)", timeout.retryable === false);
  ok(
    "DM timeout safe message no token",
    Boolean(timeout.safeMessage) && !timeout.safeMessage!.includes(TOKEN),
    timeout.safeMessage,
  );

  // --- malformed Graph body on error still classifies by status ---
  const malformed = await sendInstagramDm({
    token: TOKEN,
    igUserId: "123",
    recipient: "commenter",
    message: "hello",
    fetchImpl: fetchReturning(502, "<html>bad gateway</html>"),
  });
  ok("DM 502 malformed body temporary", !malformed.ok && malformed.errorClass === "temporary");
  ok("DM 502 retryable", malformed.retryable === true);

  // --- public reply contract ---
  const replyOk = await sendInstagramCommentReply({
    token: TOKEN,
    igCommentId: "cid.1",
    message: "thanks",
    fetchImpl: fetchReturning(200, JSON.stringify({ id: "reply.1" })),
  });
  ok("reply 200 ok", replyOk.ok);
  const replyAuth = await sendInstagramCommentReply({
    token: TOKEN,
    igCommentId: "cid.1",
    message: "thanks",
    fetchImpl: fetchReturning(401, JSON.stringify({ error: { message: "bad token" } })),
  });
  ok("reply 401 auth", !replyAuth.ok && replyAuth.errorClass === "auth");

  // --- template: first_name preserved (no fabricated names) ---
  const rendered = renderDeliveryMessage("Hi {{first_name}}, you won!");
  ok("render preserves {{first_name}}", rendered === "Hi {{first_name}}, you won!");
  ok("render no-op empty", renderDeliveryMessage("") === "");

  // --- redirect URI single source (Task 022/023 §25) ---
  const origins = await import("../src/origins");
  const a = origins.resolveRedirectUri();
  const b = origins.resolveRedirectUri();
  ok("resolveRedirectUri stable", a === b && a.length > 0, a);
  ok(
    "resolveRedirectUri is API origin + callback path by default",
    a.includes("/social-accounts/instagram/callback"),
    a,
  );

  // --- optional integration: stuck reclaim + claim ownership ---
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "https://etwuqthopqrzffdgvhqs.supabase.co";
  if (service) {
    const headers = {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    // Find a workspace for FK-safe probe rows.
    const wsRes = await fetch(
      `${url}/rest/v1/workspaces?select=id&limit=1`,
      { headers: { apikey: service, Authorization: `Bearer ${service}` } },
    );
    const wsRows = (await wsRes.json()) as { id: string }[];
    const wsId = wsRows[0]?.id;
    ok("probe workspace found", Boolean(wsId), wsId ?? "");

    if (wsId) {
      // Stuck processing row older than STUCK_MS (default 120s).
      const stuckId = crypto.randomUUID();
      const oldClaimed = new Date(Date.now() - 10 * 60_000).toISOString();
      const insert = await fetch(`${url}/rest/v1/deliveries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: stuckId,
          workspace_id: wsId,
          comment_id: null,
          recipient: "stuck-probe",
          kind: "private_dm",
          status: "processing",
          attempts: 1,
          claimed_at: oldClaimed,
        }),
      });
      ok("insert stuck processing", insert.status < 300, `status=${insert.status}`);

      const log = {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      } as unknown as Parameters<typeof reclaimStuckDeliveries>[0];
      const reclaimed = await reclaimStuckDeliveries(log);
      ok("reclaimStuckDeliveries ran", typeof reclaimed === "number", `count=${reclaimed}`);

      const after = await fetch(
        `${url}/rest/v1/deliveries?id=eq.${stuckId}&select=status,error,attempts`,
        { headers: { apikey: service, Authorization: `Bearer ${service}` } },
      );
      const rows = (await after.json()) as { status: string; error: string | null }[];
      ok(
        "stuck row → failed (no requeue)",
        rows[0]?.status === "failed",
        rows[0]?.status ?? "missing",
      );
      ok(
        "stuck error mentions duplicate avoidance",
        Boolean(rows[0]?.error?.includes("duplicate")),
        rows[0]?.error ?? "",
      );

      // Fresh processing row must NOT be reclaimed.
      const freshId = crypto.randomUUID();
      await fetch(`${url}/rest/v1/deliveries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: freshId,
          workspace_id: wsId,
          comment_id: null,
          recipient: "fresh-probe",
          kind: "private_dm",
          status: "processing",
          attempts: 1,
          claimed_at: new Date().toISOString(),
        }),
      });
      const reclaimed2 = await reclaimStuckDeliveries(log);
      const freshAfter = await fetch(
        `${url}/rest/v1/deliveries?id=eq.${freshId}&select=status`,
        { headers: { apikey: service, Authorization: `Bearer ${service}` } },
      );
      const freshRows = (await freshAfter.json()) as { status: string }[];
      ok(
        "fresh processing not reclaimed",
        freshRows[0]?.status === "processing" && reclaimed2 >= 0,
        freshRows[0]?.status ?? "missing",
      );

      // Claim race: second PATCH with status=eq.queued on processing → empty.
      const raceId = crypto.randomUUID();
      await fetch(`${url}/rest/v1/deliveries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: raceId,
          workspace_id: wsId,
          comment_id: null,
          recipient: "race-probe",
          kind: "private_dm",
          status: "processing",
          attempts: 1,
          claimed_at: new Date().toISOString(),
        }),
      });
      const race = await fetch(
        `${url}/rest/v1/deliveries?id=eq.${raceId}&status=eq.queued`,
        {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ status: "processing" }),
        },
      );
      const raceRows = (await race.json()) as unknown[];
      ok(
        "claim on non-queued returns empty (lost race)",
        Array.isArray(raceRows) && raceRows.length === 0,
      );

      // Cleanup probe rows.
      for (const id of [stuckId, freshId, raceId]) {
        await fetch(`${url}/rest/v1/deliveries?id=eq.${id}`, {
          method: "DELETE",
          headers: { apikey: service, Authorization: `Bearer ${service}` },
        });
      }
    }
  } else {
    console.log("SKIP DB integration (no SUPABASE_SERVICE_ROLE_KEY)");
  }

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
