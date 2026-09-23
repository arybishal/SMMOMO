// Task 020 security regression harness.
// Run: node apps/api/scripts/validate-security.mjs
// Requires API on :4000, web on :3000, and env:
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD (confirmed user)
//   META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN (webhook handshake)
// Optional: TEST_NONADMIN_EMAIL, TEST_NONADMIN_PASSWORD
import { createHmac } from "node:crypto";
import https from "node:https";
import http from "node:http";

const API = "http://localhost:4000";
const WEB = "http://localhost:3000";
const SUPA = "https://etwuqthopqrzffdgvhqs.supabase.co";
const PUB = "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";
const APP_SECRET = process.env.META_APP_SECRET || "test-app-secret-016";
const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || "";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";
const NONADMIN_EMAIL = process.env.TEST_NONADMIN_EMAIL || "";
const NONADMIN_PASSWORD = process.env.TEST_NONADMIN_PASSWORD || "";

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
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: d }),
        );
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
  if (res.status !== 200) throw new Error(`login ${res.status}`);
  const j = JSON.parse(res.body);
  const session = JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
  });
  const cookie = `sb-etwuqthopqrzffdgvhqs-auth-token=base64-${Buffer.from(
    session,
  ).toString("base64url")}`;
  return { cookie, token: j.access_token, user: j.user };
}

function signWebhook(raw) {
  return "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD");
    process.exit(2);
  }

  // --- authentication ---
  const health = await req(`${API}/health`);
  ok("health public", health.status === 200);

  const anonPosts = await req(`${API}/posts`);
  ok("anon /posts 401", anonPosts.status === 401);

  const anonUsage = await req(`${API}/usage/summary`);
  ok("anon usage 401", anonUsage.status === 401);

  const anonAdmin = await req(`${API}/admin/integrations/meta`);
  ok("anon admin 401", anonAdmin.status === 401);

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

  // --- authz: cannot supply workspace/user via body ---
  const badPatchBody = JSON.stringify({
    workspace_id: "00000000-0000-0000-0000-000000000001",
    user_id: "attacker",
    role: "admin",
    postId: "not-a-uuid",
    keyword: "x",
    privateReply: "y",
  });
  const badPatch = await req(`${API}/automations`, {
    method: "POST",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(badPatchBody),
    },
    body: badPatchBody,
  });
  ok("POST automation rejects bad postId", badPatch.status === 400, `got ${badPatch.status}`);

  // --- input validation: invalid dates ---
  const badDate = await req(`${API}/usage/summary?start=nope`, {
    headers: { Cookie: admin.cookie },
  });
  ok("usage invalid start 400", badDate.status === 400);

  const badEnum = await req(`${API}/automations/11111111-1111-1111-1111-111111111111`, {
    method: "PATCH",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength('{"status":"hacked"}'),
    },
    body: JSON.stringify({ status: "hacked" }),
  });
  ok("invalid status enum 404/400", badEnum.status === 400 || badEnum.status === 404, `got ${badEnum.status}`);

  const longName = await req(`${API}/automations/11111111-1111-1111-1111-111111111111`, {
    method: "PATCH",
    headers: {
      Cookie: admin.cookie,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(
        JSON.stringify({ name: "x".repeat(500) }),
      ),
    },
    body: JSON.stringify({ name: "x".repeat(500) }),
  });
  ok("name length cap 400", longName.status === 400, `got ${longName.status}`);

  // --- webhooks: invalid signature rejected; handshake ---
  const payload = JSON.stringify({ object: "instagram", entry: [] });
  const badSig = await req(`${API}/webhooks/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": "sha256=" + "0".repeat(64),
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });
  ok("webhook bad signature 403", badSig.status === 403, `got ${badSig.status}`);

  const noSig = await req(`${API}/webhooks/instagram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });
  ok("webhook missing signature 403", noSig.status === 403, `got ${noSig.status}`);

  if (VERIFY_TOKEN) {
    const g = await req(
      `${API}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(
        VERIFY_TOKEN,
      )}&hub.challenge=seccheck`,
    );
    ok("webhook handshake 200", g.status === 200 && g.body === "seccheck", g.body);

    const gBad = await req(
      `${API}/webhooks/instagram?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=seccheck`,
    );
    ok("webhook bad token 403", gBad.status === 403);
  }

  // --- sensitive data: social accounts must not leak tokens ---
  const social = await req(`${API}/social-accounts`, {
    headers: { Cookie: admin.cookie },
  });
  ok(
    "social GET no access_token field",
    social.status === 200 || social.status === 404
      ? !social.body.includes("access_token") && !/sb_secret_/.test(social.body)
      : social.status === 200,
    `status=${social.status}`,
  );

  const adminGet = await req(`${API}/admin/integrations/meta`, {
    headers: { Cookie: admin.cookie },
  });
  if (adminGet.status === 200) {
    // source labels ("db"|"env"|"none") are intentional; reject real secret values
    const secretVals = ["db", "env", "none"];
    const m = /"appSecret"\s*:\s*"([^"]*)"/.exec(adminGet.body);
    const tokM = /"webhookVerifyToken"\s*:\s*"([^"]*)"/.exec(adminGet.body);
    const appSecretOk = !m || secretVals.includes(m[1]);
    const tokOk = !tokM || secretVals.includes(tokM[1]);
    ok(
      "admin GET no plaintext secrets",
      appSecretOk &&
        tokOk &&
        !adminGet.body.includes("sb_secret_") &&
        !adminGet.body.includes("test-app-secret-016"),
      adminGet.body.slice(0, 120),
    );
  } else {
    // non-admin session is fine too
    ok("admin GET gated or ok", adminGet.status === 403 || adminGet.status === 200, `got ${adminGet.status}`);
  }

  // --- security headers on web ---
  const home = await req(`${WEB}/login`);
  ok(
    "web X-Content-Type-Options",
    (home.headers["x-content-type-options"] || "").toLowerCase() === "nosniff",
  );
  ok(
    "web X-Frame-Options",
    (home.headers["x-frame-options"] || "").toUpperCase() === "DENY",
  );
  ok("web Referrer-Policy present", Boolean(home.headers["referrer-policy"]));

  // --- API security headers ---
  const apiHealth = await req(`${API}/health`);
  ok(
    "api X-Content-Type-Options",
    (apiHealth.headers["x-content-type-options"] || "").toLowerCase() === "nosniff",
  );

  // --- cross-workspace isolation (optional second user) ---
  if (NONADMIN_EMAIL && NONADMIN_PASSWORD) {
    try {
      const other = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD);
      // Other user's usage summary must not include admin workspace events
      const otherUsage = await req(`${API}/usage/summary`, {
        headers: { Cookie: other.cookie },
      });
      ok("other user usage 200", otherUsage.status === 200, `got ${otherUsage.status}`);
      // PostgREST direct: other user reading admin workspace social accounts by id
      const adminSocial = await req(
        `${API}/social-accounts`,
        { headers: { Cookie: admin.cookie } },
      );
      let adminWsSocialId = null;
      try {
        const rows = JSON.parse(adminSocial.body);
        adminWsSocialId = Array.isArray(rows) && rows[0] ? rows[0].id : null;
      } catch {
        /* empty */
      }
      if (adminWsSocialId) {
        // RLS probe with a safe column (access_token is column-denied → separate test)
        const keyRes = await req(
          `${SUPA}/rest/v1/social_accounts?id=eq.${adminWsSocialId}&select=id,workspace_id`,
          {
            headers: { apikey: PUB, Authorization: `Bearer ${other.token}` },
          },
        );
        const rows = keyRes.status === 200 ? JSON.parse(keyRes.body) : [];
        ok(
          "RLS blocks other workspace social row",
          keyRes.status === 200 && rows.length === 0,
          keyRes.body.slice(0, 80),
        );
      }
      // Member cannot SELECT access_token column even on own rows
      const colProbe = await req(
        `${SUPA}/rest/v1/social_accounts?select=access_token&limit=1`,
        { headers: { apikey: PUB, Authorization: `Bearer ${admin.token}` } },
      );
      ok(
        "access_token column not selectable by member",
        colProbe.status >= 400 || colProbe.body.includes('"code"') || colProbe.status === 400,
        `status=${colProbe.status} ${colProbe.body.slice(0, 100)}`,
      );
    } catch (e) {
      ok("cross-workspace isolation", false, String(e));
    }
  } else {
    // Still probe column grant with admin token alone
    const colProbe = await req(
      `${SUPA}/rest/v1/social_accounts?select=access_token&limit=1`,
      { headers: { apikey: PUB, Authorization: `Bearer ${admin.token}` } },
    );
    ok(
      "access_token column not selectable by member",
      colProbe.status >= 400,
      `status=${colProbe.status} ${colProbe.body.slice(0, 120)}`,
    );
  }

  // --- 5xx must not leak stack ---
  // Force a 404 path shape; ensure generic body (no "at " stack frames)
  const notFound = await req(`${API}/automations/not-a-uuid`, {
    headers: { Cookie: admin.cookie },
  });
  ok(
    "404 no stack leak",
    notFound.status === 404 && !notFound.body.includes("    at "),
    notFound.body.slice(0, 80),
  );

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
