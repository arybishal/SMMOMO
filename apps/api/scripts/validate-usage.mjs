// Task 019 validation: usage recording, idempotency, range parse, isolation.
// Run: node $env:TEMP\smmomo_usage_validate.js  (from repo with API on :4000)
import { createHmac } from "node:crypto";
import https from "node:https";
import http from "node:http";

const API = "http://localhost:4000";
const WEB = "http://localhost:3000";
const SUPA = "https://etwuqthopqrzffdgvhqs.supabase.co";
const PUB = "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";
// Test credentials come from env — never hardcode passwords in the repo.
const APP_SECRET = process.env.META_APP_SECRET || "test-app-secret-016";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";
const NONADMIN_EMAIL = process.env.TEST_NONADMIN_EMAIL || "";
const NONADMIN_PASSWORD = process.env.TEST_NONADMIN_PASSWORD || "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in the environment before running this harness.",
  );
  process.exit(2);
}
const ADMIN = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "smmomo-verify-016";

let pass = 0;
let fail = 0;
function ok(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`PASS ${name}${extra ? " " + extra : ""}`);
  } else {
    fail += 1;
    console.log(`FAIL ${name}${extra ? " " + extra : ""}`);
  }
}

function req(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const r = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: opts.method || "GET",
        headers: opts.headers || {},
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
      },
    );
    r.on("error", reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

async function login(email, password) {
  const body = JSON.stringify({ email, password });
  const res = await req(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: PUB,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });
  if (res.status !== 200) throw new Error(`login ${res.status} ${res.body}`);
  const j = JSON.parse(res.body);
  const session = JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
  });
  const cookie = `sb-etwuqthopqrzffdgvhqs-auth-token=base64-${Buffer.from(session).toString("base64url")}`;
  return { cookie, token: j.access_token, user: j.user };
}

async function serviceKey() {
  const fs = await import("node:fs");
  const path = `${process.env.TEMP}\\smmomo_servicekey.txt`;
  return fs.readFileSync(path, "utf8").trim();
}

async function servicePost(path, body) {
  const key = await serviceKey();
  const payload = JSON.stringify(body);
  return req(`${SUPA}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });
}

async function serviceGet(path) {
  const key = await serviceKey();
  return req(`${SUPA}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

function signWebhook(raw) {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
}

async function main() {
  // 0. health
  const health = await req(`${API}/health`);
  ok("health", health.status === 200);

  // 1. auth
  const admin = await login(ADMIN.email, ADMIN.password);
  const anon = await req(`${API}/usage/summary`);
  ok("anon 401", anon.status === 401);

  // 2. default period summary (current month)
  const summary = await req(`${API}/usage/summary`, {
    headers: { Cookie: admin.cookie },
  });
  ok("summary 200", summary.status === 200, summary.body.slice(0, 200));
  const sum = JSON.parse(summary.body);
  ok("period is month label", /^[A-Za-z]+ \d{4}$/.test(sum.period), sum.period);
  ok("has start/end", Boolean(sum.start && sum.end));
  ok("limit null", sum.limit === null);
  ok("remaining null", sum.remaining === null);
  ok("byEventType shape", sum.byEventType && typeof sum.byEventType.private_dm_sent === "number");

  // 3. invalid dates
  const bad1 = await req(`${API}/usage/summary?start=not-a-date`, {
    headers: { Cookie: admin.cookie },
  });
  ok("invalid start 400", bad1.status === 400, bad1.body);
  const bad2 = await req(`${API}/usage/summary?start=2026-10-01&end=2026-09-01`, {
    headers: { Cookie: admin.cookie },
  });
  ok("inverted range 400", bad2.status === 400, bad2.body);
  const okRange = await req(`${API}/usage/summary?start=2026-09-01&end=2026-10-01`, {
    headers: { Cookie: admin.cookie },
  });
  ok("valid range 200", okRange.status === 200);

  // 4. RLS: end-user cannot see other workspace (empty table for fresh user ok;
  //    also verify member SELECT works after service insert into their workspace)
  const wsRes = await serviceGet(
    `workspace_members?user_id=eq.${admin.user.id}&select=workspace_id&limit=1`,
  );
  const wsId = JSON.parse(wsRes.body)[0].workspace_id;

  // 5. recordUsageEvent idempotency via service insert (same path as app)
  const evt = {
    workspace_id: wsId,
    event_type: "private_dm_sent",
    source: "delivery",
    reference_type: "delivery",
    reference_id: "test-delivery-idem-019",
    quantity: 1,
    metadata: {},
    occurred_at: new Date().toISOString(),
    idempotency_key: "delivery:test-delivery-idem-019",
  };
  const ins1 = await servicePost(
    "usage_events?on_conflict=workspace_id,event_type,idempotency_key",
    evt,
  );
  ok("insert1 ok", ins1.status < 300, `status=${ins1.status} ${ins1.body.slice(0, 120)}`);
  const ins2 = await servicePost(
    "usage_events?on_conflict=workspace_id,event_type,idempotency_key",
    evt,
  );
  ok("insert2 no dup", ins2.status < 300, `status=${ins2.status}`);
  const countRes = await serviceGet(
    `usage_events?workspace_id=eq.${wsId}&event_type=eq.private_dm_sent&reference_id=eq.test-delivery-idem-019&select=id`,
  );
  const rows = JSON.parse(countRes.body);
  ok("exactly 1 row", rows.length === 1, `len=${rows.length}`);

  // 6. different event_type same reference → separate row allowed
  const evt2 = {
    ...evt,
    event_type: "private_dm_failed",
    idempotency_key: "delivery:test-delivery-idem-019",
  };
  const ins3 = await servicePost(
    "usage_events?on_conflict=workspace_id,event_type,idempotency_key",
    evt2,
  );
  ok("other type ok", ins3.status < 300, `status=${ins3.status}`);
  const count2 = await serviceGet(
    `usage_events?workspace_id=eq.${wsId}&reference_id=eq.test-delivery-idem-019&select=id,event_type`,
  );
  const rows2 = JSON.parse(count2.body);
  ok("2 rows different types", rows2.length === 2, `len=${rows2.length}`);

  // 7. summary picks up the event in current period
  const sum2 = await req(`${API}/usage/summary`, {
    headers: { Cookie: admin.cookie },
  });
  const sum2j = JSON.parse(sum2.body);
  ok(
    "dmsSent includes event",
    sum2j.dmsSent >= 1 && sum2j.byEventType.private_dm_sent >= 1,
    `dms=${sum2j.dmsSent}`,
  );

  // 8. date filter excludes outside period
  const prev = await req(`${API}/usage/summary?start=2020-01-01&end=2020-02-01`, {
    headers: { Cookie: admin.cookie },
  });
  const prevj = JSON.parse(prev.body);
  ok("old period zero", prevj.dmsSent === 0 && prevj.byEventType.private_dm_sent === 0);

  // 9. webhook comment_received via signed POST (engine + usage)
  const igUserId = "usage-test-ig-019";
  // ensure social account for workspace
  await servicePost("social_accounts", {
    workspace_id: wsId,
    platform: "instagram",
    username: "usage_probe",
    name: "usage_probe",
    followers: 0,
    status: "connected",
    ig_user_id: igUserId,
    access_token: "not-a-real-token",
  }).catch(() => {});

  // upsert if exists
  const key = await serviceKey();
  await req(`${SUPA}/rest/v1/social_accounts?ig_user_id=eq.${igUserId}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ workspace_id: wsId, status: "connected" }),
  });

  const commentId = `usage-c-${Date.now()}`;
  const payload = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: igUserId,
        changes: [
          {
            field: "comments",
            value: {
              comment_id: commentId,
              text: "hello usage",
              from: { username: "usage_follower" },
            },
          },
        ],
      },
    ],
  });
  const wh1 = await req(`${API}/webhooks/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signWebhook(payload),
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });
  ok("webhook 200", wh1.status === 200, wh1.body);

  // duplicate webhook
  const wh2 = await req(`${API}/webhooks/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signWebhook(payload),
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });
  ok("dup webhook 200", wh2.status === 200);

  const cr = await serviceGet(
    `usage_events?workspace_id=eq.${wsId}&event_type=eq.comment_received&reference_id=eq.${commentId}&select=id`,
  );
  ok("comment_received once", JSON.parse(cr.body).length === 1, cr.body);

  // comment may or may not match (no active automation) — if matched, usage exists
  const cm = await serviceGet(
    `usage_events?workspace_id=eq.${wsId}&event_type=eq.comment_matched&reference_id=eq.${commentId}&select=id`,
  );
  ok("comment_matched 0 or 1", JSON.parse(cm.body).length <= 1);

  // 10. RLS: another user's JWT cannot read this workspace's usage
  // create/use non-admin if present
  try {
    if (!NONADMIN_EMAIL || !NONADMIN_PASSWORD) throw new Error("skip");
    const non = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD);
    // non-admin has own workspace — should not see wsId events via RLS
    const key2 = await serviceKey();
    // Actually verify via PostgREST with non-admin token
    const rls = await req(
      `${SUPA}/rest/v1/usage_events?workspace_id=eq.${wsId}&select=id`,
      { headers: { apikey: PUB, Authorization: `Bearer ${non.token}` } },
    );
    ok("RLS blocks other ws", rls.status === 200 && JSON.parse(rls.body).length === 0, rls.body);
  } catch (e) {
    ok("RLS blocks other ws", false, String(e));
  }

  // 11. admin member can read own usage via RLS
  const memberRead = await req(`${SUPA}/rest/v1/usage_events?select=id&limit=5`, {
    headers: { apikey: PUB, Authorization: `Bearer ${admin.token}` },
  });
  ok("member RLS read", memberRead.status === 200 && JSON.parse(memberRead.body).length >= 1);

  // 12. web usage page
  const page = await req(`${WEB}/settings/usage`, {
    headers: { Cookie: admin.cookie },
  });
  ok("usage page 200", page.status === 200, String(page.status));
  ok("period not All time", !page.body.includes("All time"));

  // 13. regression routes
  for (const p of ["/posts", "/automations", "/analytics/summary", "/comments/recent", "/deliveries/recent"]) {
    const r = await req(`${API}${p}`, { headers: { Cookie: admin.cookie } });
    ok(`route ${p}`, r.status === 200, String(r.status));
  }

  // 14. webhook GET still works
  const gwh = await req(
    `${API}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=abc`,
  );
  ok("webhook GET", gwh.status === 200 || gwh.status === 403, String(gwh.status));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
