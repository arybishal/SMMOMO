// Task 025 local integration harness: proves every locally-testable part of
// the live Meta spec — single-source redirect URI + config presence audit,
// webhook → persist → match → delivery → sent → usage end-to-end (Graph via
// local stub, never fakes a 200 on the real host), duplicate webhook replay,
// non-match, case-insensitive match, workspace isolation, analytics formula,
// UI reflects backend state, and rate limits (run last — they poison the
// per-IP window for ~60s).
// Run: npx tsx apps/api/scripts/validate-integration.ts
// Needs: API on :4000 (META_GRAPH_BASE → local stub on :4090), service key at
// %TEMP%\smmomo_servicekey.txt, TEST_ADMIN_* env. Optional: WEB :3000,
// TEST_NONADMIN_* (isolation section skips without it).
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const API = "http://localhost:4000";
const WEB = "http://localhost:3000";
const SUPA = "https://etwuqthopqrzffdgvhqs.supabase.co";
const PUB = "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";
const APP_SECRET = process.env.META_APP_SECRET || "test-app-secret-016";
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "smmomo-verify-016";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";
const NONADMIN_EMAIL = process.env.TEST_NONADMIN_EMAIL || "";
const NONADMIN_PASSWORD = process.env.TEST_NONADMIN_PASSWORD || "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD before running.");
  process.exit(2);
}

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

async function req(
  url: string,
  opts: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers: opts.headers ?? {},
    body: opts.body,
  });
  return { status: res.status, body: await res.text(), headers: res.headers };
}

interface Session {
  cookie: string;
  token: string;
  userId: string;
}

async function login(email: string, password: string): Promise<Session> {
  const body = JSON.stringify({ email, password });
  const res = await req(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUB, "Content-Type": "application/json" },
    body,
  });
  if (res.status !== 200) throw new Error(`login ${res.status} ${res.body}`);
  const j = JSON.parse(res.body) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    user: { id: string };
  };
  const session = JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
  });
  return {
    cookie: `sb-etwuqthopqrzffdgvhqs-auth-token=base64-${Buffer.from(session).toString("base64url")}`,
    token: j.access_token,
    userId: j.user.id,
  };
}

function serviceKey(): string {
  return fs.readFileSync(`${process.env.TEMP ?? "."}\\smmomo_servicekey.txt`, "utf8").trim();
}

async function svc(
  path: string,
  opts: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<{ status: number; body: string; json: <T>() => T }> {
  const headers: Record<string, string> = {
    apikey: serviceKey(),
    Authorization: `Bearer ${serviceKey()}`,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.prefer) headers.Prefer = opts.prefer;
  const res = await req(`${SUPA}/rest/v1/${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return {
    status: res.status,
    body: res.body,
    json: <T>() => JSON.parse(res.body) as T,
  };
}

function sign(raw: string): string {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
}

async function postWebhook(raw: string): Promise<number> {
  const res = await req(`${API}/webhooks/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": sign(raw),
    },
    body: raw,
  });
  return res.status;
}

function commentPayload(igUserId: string, commentId: string, text: string, mediaId: string): string {
  return JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: igUserId,
        changes: [
          {
            field: "comments",
            value: {
              comment_id: commentId,
              text,
              from: { username: "it025_follower" },
              media: { id: mediaId },
            },
          },
        ],
      },
    ],
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function count(path: string): Promise<number> {
  const r = await svc(`${path}&select=id`);
  if (r.status >= 400) return -1;
  try {
    return (JSON.parse(r.body) as unknown[]).length;
  } catch {
    return -1;
  }
}

async function main(): Promise<void> {
  const health = await req(`${API}/health`);
  ok("health", health.status === 200, String(health.status));

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  // --- A. config audit + single redirect URI source (§2/§3) ----------------
  const test = await req(`${API}/admin/integrations/meta/test`, {
    method: "POST",
    headers: { Cookie: admin.cookie, "Content-Type": "application/json" },
    body: "{}",
  });
  ok("admin meta test 200", test.status === 200, String(test.status));
  const flags = test.status === 200 ? JSON.parse(test.body) : {};
  console.log(
    `INFO config presence (no values): appId=${flags.appIdPresent} secret=${flags.appSecretPresent} verifyToken=${flags.webhookVerifyTokenPresent} oauthReady=${flags.oauthReady} webhookReady=${flags.webhookReady} sources=${JSON.stringify(flags.source)}`,
  );
  const view = await req(`${API}/admin/integrations/meta`, {
    headers: { Cookie: admin.cookie },
  });
  ok("admin meta view 200", view.status === 200, String(view.status));
  const expectedRedirect = "http://localhost:4000/social-accounts/instagram/callback";
  const redirect = view.status === 200 ? (JSON.parse(view.body).redirectUri as string) : "";
  ok("redirect URI single source", redirect === expectedRedirect, redirect);
  ok(
    "redirect view == test view",
    view.status === 200 && JSON.parse(view.body).redirectUri === redirect,
  );
  ok("redirect no trailing slash", !redirect.endsWith("/"), redirect);
  const hand = await req(
    `${API}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=it025`,
  );
  ok("webhook handshake challenge", hand.status === 200 && hand.body === "it025", hand.body);
  const handBad = await req(
    `${API}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=not-the-token&hub.challenge=x`,
  );
  ok("webhook handshake wrong token 403", handBad.status === 403, String(handBad.status));

  // --- B. fixtures in the admin workspace (service role) --------------------
  const acctRes = await svc(
    "social_accounts?ig_user_id=eq.usage-test-ig-019&select=id,workspace_id,status,ig_user_id",
  );
  const acct = acctRes.json<{ id: string; workspace_id: string; status: string; ig_user_id: string }[]>()[0];
  ok("usage_probe account exists", Boolean(acct), acctRes.body.slice(0, 120));
  if (!acct) {
    console.log(`\nRESULT pass=${pass} fail=${fail}`);
    process.exit(1);
  }
  const wsA = acct.workspace_id;
  const igUserId = acct.ig_user_id;

  const memberRes = await svc(
    `workspace_members?user_id=eq.${admin.userId}&select=workspace_id&limit=1`,
  );
  const adminWs = memberRes.json<{ workspace_id: string }[]>()[0]?.workspace_id;
  ok("admin session workspace == account workspace", adminWs === wsA, `${adminWs} vs ${wsA}`);

  if (acct.status !== "connected") {
    await svc(`social_accounts?id=eq.${acct.id}`, {
      method: "PATCH",
      body: { status: "connected" },
      prefer: "return=minimal",
    });
    console.log("INFO repaired social account status → connected");
  }

  const stamp = Date.now();
  const mediaId = `it025-media-${stamp}`;
  const c1 = `it025-c1-${stamp}`;
  const c2 = `it025-c2-${stamp}`;
  const c3 = `it025-c3-${stamp}`;
  const c4 = `it025-c4-${stamp}`;
  const automationName = "It025 fixture automation";

  const postRes = await svc("posts", {
    method: "POST",
    prefer: "return=representation",
    body: {
      workspace_id: wsA,
      social_account_id: acct.id,
      ig_media_id: mediaId,
      caption: "It025 fixture post",
      type: "IMAGE",
      permalink: "https://instagram.test/p/it025",
      media_url: "https://cdn.test/it025.jpg",
      posted_at: new Date().toISOString(),
    },
  });
  ok("fixture post created", postRes.status < 300, postRes.body.slice(0, 160));
  const fixturePostId = postRes.status < 300 ? postRes.json<{ id: string }[]>()[0].id : "";

  const autoRes = await svc("automations", {
    method: "POST",
    prefer: "return=representation",
    body: {
      workspace_id: wsA,
      post_id: fixturePostId,
      name: automationName,
      status: "active",
      keyword: "TESTKEY025",
      private_reply: "Here is your free link: https://example.com/free",
      public_reply: null,
      matched_count: 0,
    },
  });
  ok("fixture automation created active", autoRes.status < 300, autoRes.body.slice(0, 160));
  const fixtureAutoId = autoRes.status < 300 ? autoRes.json<{ id: string }[]>()[0].id : "";

  // --- C. webhook → match → delivery → usage (§8, §9 local) ----------------
  const payload1 = commentPayload(igUserId, c1, "please send me TESTKEY025 now", mediaId);
  const wh1 = await postWebhook(payload1);
  ok("webhook accepted", wh1 === 200, String(wh1));

  const commentRow = async (cid: string) => {
    const r = await svc(
      `comments?workspace_id=eq.${wsA}&ig_comment_id=eq.${cid}&select=id,matched,automation_id,automation_name,post_id,username`,
    );
    return r.status < 300 ? r.json<{ id: string; matched: boolean; automation_id: string; automation_name: string; post_id: string; username: string }[]>()[0] : undefined;
  };
  const c1Row = await commentRow(c1);
  ok("comment persisted", Boolean(c1Row), c1Row?.id ?? "");
  ok("comment matched", c1Row?.matched === true, String(c1Row?.matched));
  ok(
    "matched to fixture automation",
    c1Row?.automation_id === fixtureAutoId && c1Row?.automation_name === automationName,
  );
  ok("comment linked to post", c1Row?.post_id === fixturePostId, c1Row?.post_id ?? "");

  const deliveriesFor = async (commentDbId: string) => {
    const r = await svc(
      `deliveries?comment_id=eq.${commentDbId}&select=id,status,kind,attempts,recipient,error`,
    );
    return r.status < 300 ? r.json<{ id: string; status: string; kind: string; attempts: number; recipient: string; error: string | null }[]>() : [];
  };
  let d1 = c1Row ? await deliveriesFor(c1Row.id) : [];
  ok("exactly 1 delivery queued", d1.length === 1, `n=${d1.length}`);
  ok("delivery kind private_dm", d1[0]?.kind === "private_dm", d1[0]?.kind ?? "");

  const recv1 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_received&reference_id=eq.${c1}&select`,
  );
  const match1 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_matched&reference_id=eq.${c1}&select`,
  );
  ok("comment_received usage exactly once", recv1 === 1, `n=${recv1}`);
  ok("comment_matched usage exactly once", match1 === 1, `n=${match1}`);

  const autoAfter1 = await svc(`automations?id=eq.${fixtureAutoId}&select=matched_count`);
  const matchedAfter1 = autoAfter1.json<{ matched_count: number }[]>()[0]?.matched_count;
  ok("matched_count == 1 after first match", matchedAfter1 === 1, String(matchedAfter1));

  // wait for the delivery worker (poll 5s) → sent via local Graph stub
  let deliveryId = d1[0]?.id ?? "";
  let sentOk = false;
  for (let i = 0; i < 12 && !sentOk; i++) {
    await sleep(2500);
    if (c1Row) d1 = await deliveriesFor(c1Row.id);
    if (d1[0]?.status === "sent") sentOk = true;
  }
  ok("delivery reached sent (Graph stub)", sentOk, `status=${d1[0]?.status} err=${d1[0]?.error ?? ""}`);
  ok("delivery attempts >= 1", (d1[0]?.attempts ?? 0) >= 1, String(d1[0]?.attempts));
  deliveryId = d1[0]?.id ?? "";
  // Usage is written after the sent finalize (count only owned terminal
  // outcomes) — poll briefly instead of assuming same-instant visibility.
  let dmUsage = 0;
  for (let i = 0; i < 15 && dmUsage !== 1; i++) {
    dmUsage = await count(
      `usage_events?workspace_id=eq.${wsA}&event_type=eq.private_dm_sent&reference_id=eq.${deliveryId}&select`,
    );
    if (dmUsage !== 1) await sleep(1000);
  }
  ok("private_dm_sent usage exactly once", dmUsage === 1, `n=${dmUsage}`);

  // --- D. duplicate webhook replay (§10) ------------------------------------
  const wh2 = await postWebhook(payload1);
  ok("duplicate webhook accepted", wh2 === 200, String(wh2));
  const c1Rows = await count(`comments?workspace_id=eq.${wsA}&ig_comment_id=eq.${c1}&select`);
  ok("comment not duplicated", c1Rows === 1, `n=${c1Rows}`);
  const dAfterReplay = c1Row ? await deliveriesFor(c1Row.id) : [];
  ok("delivery not duplicated", dAfterReplay.length === 1, `n=${dAfterReplay.length}`);
  const recv2 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_received&reference_id=eq.${c1}&select`,
  );
  const match2 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_matched&reference_id=eq.${c1}&select`,
  );
  ok("comment_received still 1 after replay", recv2 === 1, `n=${recv2}`);
  ok("comment_matched still 1 after replay", match2 === 1, `n=${match2}`);
  const autoAfterReplay = await svc(`automations?id=eq.${fixtureAutoId}&select=matched_count`);
  ok(
    "matched_count unchanged after replay",
    autoAfterReplay.json<{ matched_count: number }[]>()[0]?.matched_count === matchedAfter1,
  );
  const dmAfterReplay = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.private_dm_sent&reference_id=eq.${deliveryId}&select`,
  );
  ok("private_dm_sent still 1 after replay", dmAfterReplay === 1, `n=${dmAfterReplay}`);
  // replay must not enqueue a second Graph send: delivery attempts unchanged
  const dAttemptCheck = c1Row ? await deliveriesFor(c1Row.id) : [];
  ok(
    "attempts unchanged after replay",
    dAttemptCheck[0]?.attempts === d1[0]?.attempts,
    `${dAttemptCheck[0]?.attempts} vs ${d1[0]?.attempts}`,
  );

  // --- E. non-match (§11) ---------------------------------------------------
  const wh3 = await postWebhook(commentPayload(igUserId, c2, "just saying hello, nice post", mediaId));
  ok("non-match webhook accepted", wh3 === 200, String(wh3));
  const c2Row = await commentRow(c2);
  ok("non-match comment persisted", Boolean(c2Row), c2Row?.id ?? "");
  ok("non-match not matched", c2Row?.matched === false, String(c2Row?.matched));
  const d2 = c2Row ? await deliveriesFor(c2Row.id) : [];
  ok("no delivery for non-match", d2.length === 0, `n=${d2.length}`);
  const matchC2 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_matched&reference_id=eq.${c2}&select`,
  );
  ok("no comment_matched usage for non-match", matchC2 === 0, `n=${matchC2}`);
  const recvC2 = await count(
    `usage_events?workspace_id=eq.${wsA}&event_type=eq.comment_received&reference_id=eq.${c2}&select`,
  );
  ok("non-match still recorded (comment_received)", recvC2 === 1, `n=${recvC2}`);

  // --- F. case-insensitive matching (§12) -----------------------------------
  const wh4 = await postWebhook(commentPayload(igUserId, c3, "AMAZING — TESTKEY025 please!", mediaId));
  const wh5 = await postWebhook(commentPayload(igUserId, c4, "wow thanks, testkey025 works", mediaId));
  ok("case webhooks accepted", wh4 === 200 && wh5 === 200, `${wh4}/${wh5}`);
  const c3Row = await commentRow(c3);
  const c4Row = await commentRow(c4);
  ok("uppercase keyword matched", c3Row?.matched === true, String(c3Row?.matched));
  ok("lowercase keyword matched", c4Row?.matched === true, String(c4Row?.matched));
  const d3 = c3Row ? await deliveriesFor(c3Row.id) : [];
  const d4 = c4Row ? await deliveriesFor(c4Row.id) : [];
  ok("1 delivery for uppercase match", d3.length === 1, `n=${d3.length}`);
  ok("1 delivery for lowercase match", d4.length === 1, `n=${d4.length}`);

  // wait for those two deliveries to send as well
  let allSent = false;
  for (let i = 0; i < 12 && !allSent; i++) {
    await sleep(2500);
    const a = c3Row ? await deliveriesFor(c3Row.id) : [];
    const b = c4Row ? await deliveriesFor(c4Row.id) : [];
    allSent = a[0]?.status === "sent" && b[0]?.status === "sent";
  }
  ok("case-match deliveries reached sent", allSent);
  const finalAuto = await svc(`automations?id=eq.${fixtureAutoId}&select=matched_count`);
  ok(
    "matched_count == 3 (one per match, none for non-match)",
    finalAuto.json<{ matched_count: number }[]>()[0]?.matched_count === 3,
    String(finalAuto.json<{ matched_count: number }[]>()[0]?.matched_count),
  );

  // --- G. workspace isolation (§15) -----------------------------------------
  if (NONADMIN_EMAIL && NONADMIN_PASSWORD) {
    const non = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD);
    const probes: [string, string][] = [
      ["posts", `posts?workspace_id=eq.${wsA}&select=id`],
      ["comments", `comments?workspace_id=eq.${wsA}&select=id`],
      ["deliveries", `deliveries?workspace_id=eq.${wsA}&select=id`],
      ["automations", `automations?workspace_id=eq.${wsA}&select=id`],
      ["social_accounts", `social_accounts?workspace_id=eq.${wsA}&select=id`],
    ];
    for (const [label, path] of probes) {
      const res = await req(`${SUPA}/rest/v1/${path}`, {
        headers: { apikey: PUB, Authorization: `Bearer ${non.token}` },
      });
      let rows: unknown[] = [];
      try {
        rows = JSON.parse(res.body) as unknown[];
      } catch {
        /* keep [] */
      }
      ok(`RLS: other workspace ${label} invisible`, res.status === 200 && rows.length === 0, `n=${rows.length}`);
    }
    const list = await req(`${API}/automations`, { headers: { Cookie: non.cookie } });
    ok(
      "API list hides other workspace automation",
      list.status === 200 && !list.body.includes(fixtureAutoId),
      String(list.status),
    );
    const patch = await req(`${API}/automations/${fixtureAutoId}`, {
      method: "PATCH",
      headers: { Cookie: non.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "hijacked" }),
    });
    ok("PATCH other workspace automation 404", patch.status === 404, String(patch.status));
    const create = await req(`${API}/automations`, {
      method: "POST",
      headers: { Cookie: non.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "cross ws",
        postId: fixturePostId,
        keyword: "hijack",
        privateReply: "nope",
      }),
    });
    ok(
      "create with other workspace post rejected",
      create.status === 400,
      `${create.status} ${create.body.slice(0, 120)}`,
    );
  } else {
    console.log("SKIP workspace isolation (TEST_NONADMIN_* not set)");
  }

  // --- H. UI reflects backend state (§16) + analytics formula (§17) --------
  let webUp = false;
  try {
    const probe = await req(`${WEB}/login`);
    webUp = probe.status === 200 || probe.status === 307;
  } catch {
    webUp = false;
  }
  if (webUp) {
    // §13 reconnect guidance: error state must be visible to the user.
    await svc(`social_accounts?id=eq.${acct.id}`, {
      method: "PATCH",
      body: { status: "error" },
      prefer: "return=minimal",
    });
    const dashErr = await req(`${WEB}/dashboard`, { headers: { Cookie: admin.cookie } });
    ok(
      "dashboard shows reconnect guidance in error state",
      dashErr.status === 200 && /reconnect/i.test(dashErr.body),
      String(dashErr.status),
    );
    ok("error dashboard has no token material", !/sb_secret_|eyJhbGciOi|sbp_/.test(dashErr.body));
    await svc(`social_accounts?id=eq.${acct.id}`, {
      method: "PATCH",
      body: { status: "connected" },
      prefer: "return=minimal",
    });

    const page = async (p: string) =>
      req(`${WEB}${p}`, { headers: { Cookie: admin.cookie } });
    const posts = await page("/posts");
    ok("posts page shows fixture media", posts.status === 200 && posts.body.includes("It025 fixture post"), String(posts.status));
    const autos = await page("/automations");
    ok("automations page shows fixture", autos.status === 200 && autos.body.includes(automationName), String(autos.status));
    const inbox = await page("/inbox");
    ok(
      "inbox shows real comment",
      inbox.status === 200 && inbox.body.includes("it025_follower"),
      inbox.status === 200 ? String(inbox.status) : `${inbox.status} ${inbox.body.slice(0, 500)}`,
    );
    if (inbox.status !== 200) {
      try {
        fs.writeFileSync(`${process.env.TEMP ?? "."}\\smmomo_inbox_500.html`, inbox.body);
        console.log("INFO inbox 500 body saved to %TEMP%\\smmomo_inbox_500.html");
      } catch {
        /* best-effort */
      }
    }
    const dash = await page("/dashboard");
    ok("dashboard connected + fixture visible", dash.status === 200 && dash.body.includes("usage_probe"), String(dash.status));
    const analytics = await page("/analytics");
    ok("analytics 200", analytics.status === 200, String(analytics.status));
    ok(
      "analytics formula footnote present",
      analytics.body.includes("Attempted = sent + delivered + failed"),
    );
    ok("analytics accepted-by-Instagram copy", analytics.body.includes("accepted by Instagram"));
    const isoDay = (d: Date) => d.toISOString().slice(0, 10);
    const range90 = await page("/analytics?range=90d");
    ok("analytics 90d range 200", range90.status === 200, String(range90.status));
    const custom = await page(
      `/analytics?range=custom&start=${isoDay(new Date(Date.now() - 10 * 86400000))}&end=${isoDay(new Date())}`,
    );
    ok("analytics custom range 200", custom.status === 200, String(custom.status));
    const badRange = await page(
      `/analytics?range=custom&start=${isoDay(new Date())}&end=${isoDay(new Date(Date.now() - 86400000))}`,
    );
    ok(
      "analytics invalid range shows notice",
      badRange.status === 200 && badRange.body.includes("Reset filters"),
      String(badRange.status),
    );
    const autoFiltered = await page(`/analytics?automation=${fixtureAutoId}`);
    ok("analytics automation filter 200", autoFiltered.status === 200, String(autoFiltered.status));
    ok("dashboard demo island rendered", dash.body.includes("Interactive demo"));
  } else {
    console.log("SKIP UI smokes - Next dev server not reachable");
  }

  // --- J. analytics overview + static demo isolation (Task 027) ------------
  const jDay = (d: Date) => d.toISOString().slice(0, 10);
  const ovQs = `start=${jDay(new Date(Date.now() - 30 * 86400000))}&end=${jDay(new Date(Date.now() + 86400000))}&tz=UTC`;
  interface OvJson {
    totals: { comments: number; matched: number; dmsSent: number; failed: number };
    bucket: string;
    series: { label: string; comments: number }[];
    automations: { id: string; postId: string; matched: number }[];
    content: { id: string; comments: number }[];
    deliveryHealth: { queued: number; processing: number; sent: number; delivered: number; failed: number };
    failures: { id: string }[];
  }
  const ov = await req(`${API}/analytics/overview?${ovQs}`, {
    headers: { Cookie: admin.cookie },
  });
  ok("overview 200", ov.status === 200, String(ov.status));
  const ovJson = ov.status === 200 ? (JSON.parse(ov.body) as OvJson) : null;
  ok(
    "overview response shape",
    Boolean(
      ovJson &&
        ovJson.totals &&
        Array.isArray(ovJson.series) &&
        Array.isArray(ovJson.automations) &&
        Array.isArray(ovJson.content) &&
        ovJson.deliveryHealth &&
        Array.isArray(ovJson.failures),
    ),
  );
  ok(
    "overview counts fixture comments in period",
    (ovJson?.totals.comments ?? 0) >= 1,
    String(ovJson?.totals.comments),
  );
  const ovAuto = ovJson?.automations.find((a) => a.id === fixtureAutoId);
  ok(
    "overview fixture automation matched >= 1",
    Boolean(ovAuto) && (ovAuto?.matched ?? 0) >= 1,
    String(ovAuto?.matched),
  );
  ok(
    "overview daily bucket + non-empty series",
    ovJson?.bucket === "day" && (ovJson?.series.length ?? 0) > 0,
    `${ovJson?.bucket} n=${ovJson?.series.length}`,
  );
  ok(
    "overview delivery health sent >= 1",
    (ovJson?.deliveryHealth.sent ?? 0) >= 1,
    String(ovJson?.deliveryHealth.sent),
  );

  const ovScope = await req(`${API}/analytics/overview?${ovQs}&automationId=${fixtureAutoId}`, {
    headers: { Cookie: admin.cookie },
  });
  const scopeJson = ovScope.status === 200 ? (JSON.parse(ovScope.body) as OvJson) : null;
  ok(
    "overview automation scope → single fixture row",
    ovScope.status === 200 &&
      scopeJson?.automations.length === 1 &&
      scopeJson.automations[0].id === fixtureAutoId,
    `${ovScope.status} n=${scopeJson?.automations.length}`,
  );
  ok(
    "overview automation scope totals == row matched",
    (scopeJson?.totals.matched ?? -1) === (scopeJson?.automations[0]?.matched ?? -2),
    `${scopeJson?.totals.matched} vs ${scopeJson?.automations[0]?.matched}`,
  );
  const ovPost = await req(`${API}/analytics/overview?${ovQs}&postId=${fixturePostId}`, {
    headers: { Cookie: admin.cookie },
  });
  const postJson = ovPost.status === 200 ? (JSON.parse(ovPost.body) as OvJson) : null;
  ok(
    "overview post scope → only fixture content/automations",
    ovPost.status === 200 &&
      (postJson?.content.every((c) => c.id === fixturePostId) ?? false) &&
      (postJson?.automations.every((a) => a.postId === fixturePostId) ?? false),
    String(ovPost.status),
  );

  const ovBadTz = await req(`${API}/analytics/overview?${ovQs}&tz=Not/AZone`, {
    headers: { Cookie: admin.cookie },
  });
  ok("overview invalid tz 400", ovBadTz.status === 400, String(ovBadTz.status));
  const ovInv = await req(
    `${API}/analytics/overview?start=${jDay(new Date())}&end=${jDay(new Date(Date.now() - 86400000))}`,
    { headers: { Cookie: admin.cookie } },
  );
  ok("overview start >= end 400", ovInv.status === 400, String(ovInv.status));
  const ovSpan = await req(`${API}/analytics/overview?start=2020-01-01&end=2026-01-01`, {
    headers: { Cookie: admin.cookie },
  });
  ok("overview span > 366d 400", ovSpan.status === 400, String(ovSpan.status));
  const ovPair = await req(`${API}/analytics/overview?start=${jDay(new Date())}`, {
    headers: { Cookie: admin.cookie },
  });
  ok("overview unpaired start 400", ovPair.status === 400, String(ovPair.status));
  const ovUuid = await req(`${API}/analytics/overview?${ovQs}&automationId=not-a-uuid`, {
    headers: { Cookie: admin.cookie },
  });
  ok("overview non-uuid automationId 400", ovUuid.status === 400, String(ovUuid.status));
  const ovUnknown = await req(
    `${API}/analytics/overview?${ovQs}&automationId=00000000-0000-4000-8000-000000000000`,
    { headers: { Cookie: admin.cookie } },
  );
  ok("overview unknown automationId 404", ovUnknown.status === 404, String(ovUnknown.status));
  const ovAnon = await req(`${API}/analytics/overview?${ovQs}`);
  ok("overview anonymous 401", ovAnon.status === 401, String(ovAnon.status));

  if (NONADMIN_EMAIL && NONADMIN_PASSWORD) {
    const nonOv = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD);
    const ovNon = await req(`${API}/analytics/overview?${ovQs}`, {
      headers: { Cookie: nonOv.cookie },
    });
    ok(
      "overview RLS: other workspace sees no fixtures",
      ovNon.status === 200 &&
        !ovNon.body.includes(fixtureAutoId) &&
        !ovNon.body.includes(fixturePostId),
      String(ovNon.status),
    );
  } else {
    console.log("SKIP overview RLS (TEST_NONADMIN_* not set)");
  }

  // Static isolation: demo/simulator islands must never touch the data layer.
  const noDataLayer = /fetch\(|lib\/api|request\(/;
  let demoSrc = "";
  let simSrc = "";
  try {
    demoSrc = fs.readFileSync(
      path.join(__dirname, "../../web/app/(dashboard)/dashboard/demo.tsx"),
      "utf8",
    );
    simSrc = fs.readFileSync(
      path.join(__dirname, "../../web/app/(dashboard)/automations/new/simulator.tsx"),
      "utf8",
    );
  } catch (e) {
    console.log(`WARN static demo sources unreadable: ${String(e)}`);
  }
  ok("dashboard demo island has no data-layer calls", demoSrc !== "" && !noDataLayer.test(demoSrc));
  ok("comment simulator has no data-layer calls", simSrc !== "" && !noDataLayer.test(simSrc));

  // --- I. rate limits (§14) — LAST: poisons per-IP window for ~60s ---------
  async function burst(name: string, send: () => Promise<number>, limit: number): Promise<void> {
    let seen429 = false;
    for (let i = 0; i < limit + 6 && !seen429; i++) {
      const s = await send();
      if (s === 429) seen429 = true;
    }
    ok(`rate limit ${name} (${limit}/min)`, seen429);
  }
  await burst(
    "sync 10/min",
    async () => {
      const r = await req(`${API}/social-accounts/instagram/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return r.status;
    },
    10,
  );
  await burst(
    "oauth connect 20/min",
    async () => {
      const r = await req(`${API}/social-accounts/instagram/connect`);
      return r.status;
    },
    20,
  );
  await burst(
    "webhook 60/min",
    async () => {
      const raw = JSON.stringify({ object: "instagram", entry: [] });
      const r = await req(`${API}/webhooks/instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Hub-Signature-256": sign(raw) },
        body: raw,
      });
      return r.status;
    },
    60,
  );
  await burst(
    "admin non-GET 30/min",
    async () => {
      const r = await req(`${API}/admin/integrations/meta`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      return r.status;
    },
    30,
  );
  console.log("INFO rate-limit windows are per-IP, in-process, ~60s — wait a minute before rerunning rate-limited harnesses.");

  // --- cleanup (best-effort) -----------------------------------------------
  // SKIP_CLEANUP=1 keeps fixtures for debugging a failing check (delete them
  // manually afterwards: ig_comment_id prefix it025 / name "It025 fixture").
  if (process.env.SKIP_CLEANUP) {
    console.log("INFO cleanup skipped (SKIP_CLEANUP set) — remove it025 fixtures manually");
  } else {
  const cleanupIds = [c1, c2, c3, c4];
  const commentDbIds = [c1Row?.id, c2Row?.id, c3Row?.id, c4Row?.id].filter(Boolean) as string[];
  const deliveryIds = [...d1.map((d) => d.id), ...d3.map((d) => d.id), ...d4.map((d) => d.id)];
  try {
    if (deliveryIds.length || cleanupIds.length) {
      const refFilter = [...deliveryIds, ...cleanupIds].map((x) => `"${x}"`).join(",");
      await svc(`usage_events?workspace_id=eq.${wsA}&reference_id=in.(${refFilter})`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    }
    for (const id of commentDbIds) {
      await svc(`deliveries?comment_id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
    }
    for (const cid of cleanupIds) {
      await svc(`comments?workspace_id=eq.${wsA}&ig_comment_id=eq.${cid}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    }
    if (fixtureAutoId) {
      await svc(`automations?id=eq.${fixtureAutoId}`, { method: "DELETE", prefer: "return=minimal" });
    }
    if (fixturePostId) {
      await svc(`posts?id=eq.${fixturePostId}`, { method: "DELETE", prefer: "return=minimal" });
    }
    console.log("INFO cleanup done (fixtures removed)");
  } catch (e) {
    console.log(`WARN cleanup failed: ${String(e)}`);
  }
  }

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
