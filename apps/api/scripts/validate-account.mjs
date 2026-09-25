// Task 026 account/settings regression harness.
// Run: node apps/api/scripts/validate-account.mjs
// Requires API on :4000, web on :3000, and env:
//   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD (confirmed user)
//   SUPABASE_SERVICE_ROLE_KEY (disposable user create/delete only)
// Covers: avatar auth/validation/cross-user, profile metadata persistence,
// email-change flow (invalid + pending), password change, session
// revocation (scope=others), workspace read/rename/role gate, settings
// pages, safe errors, avatar rate limit (runs LAST — poisons the IP
// window for ~60s).
import https from "node:https";
import http from "node:http";

const API = "http://localhost:4000";
const WEB = "http://localhost:3000";
const SUPA = "https://etwuqthopqrzffdgvhqs.supabase.co";
const PUB = "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GIF_1PX =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

let pass = 0;
let fail = 0;
let leaks = [];
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

function json(method, url, body, token) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return req(url, {
    method,
    headers: {
      apikey: PUB,
      "Content-Type": "application/json",
      ...(payload
        ? { "Content-Length": Buffer.byteLength(payload) }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload,
  });
}

async function login(email, password) {
  const res = await json("POST", `${SUPA}/auth/v1/token?grant_type=password`, {
    email,
    password,
  });
  if (res.status !== 200) throw new Error(`login ${res.status}: ${res.body}`);
  const j = JSON.parse(res.body);
  const session = JSON.stringify({
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
  });
  const cookie = `sb-etwuqthopqrzffdgvhqs-auth-token=base64-${Buffer.from(
    session,
  ).toString("base64url")}`;
  return { cookie, token: j.access_token, refresh: j.refresh_token, user: j.user };
}

function scanLeak(name, body) {
  if (!body) return;
  const re = /sb_secret_|service_role|postgres|pg_|stack\s+at |at Object\.<anonymous>|Error:/i;
  if (re.test(body)) leaks.push(`${name}: ${body.slice(0, 200)}`);
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !SERVICE) {
    console.log(
      "SKIP: set TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const adminId = admin.user.id;

  // API calls authenticate via the session cookie (Fastify reads cookies).
  // Content-Length is mandatory: Node chunked-encodes bodies without it, and
  // the HTTP parser rejects chunked DELETE outright (socket-level 400).
  const avPost = (image) => {
    const payload = JSON.stringify({ image });
    return req(`${API}/account/avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Cookie: admin.cookie,
      },
      body: payload,
    });
  };
  const avDelete = (path) => {
    const payload = JSON.stringify({ path });
    return req(`${API}/account/avatar`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        Cookie: admin.cookie,
      },
      body: payload,
    });
  };

  // --- disposable user (auth-only flows; no workspace bootstrap) ----------
  const stamp = Date.now();
  const disposableEmail = `validate-account-${stamp}@smmomo-test.com`;
  const initPassword = "Validator-Init-Pw!2026";
  const newPassword = "Validator-New-Pw!2026";
  let disposableId = null;

  try {
    const created = await json(
      "POST",
      `${SUPA}/auth/v1/admin/users`,
      {
        email: disposableEmail,
        password: initPassword,
        email_confirm: true,
      },
      SERVICE,
    );
    ok(
      "disposable user created (admin API)",
      created.status === 200 || created.status === 201,
      `status=${created.status}`,
    );
    if (created.status !== 200 && created.status !== 201) {
      throw new Error("cannot create disposable user");
    }
    disposableId = JSON.parse(created.body).id;
    const user = await login(disposableEmail, initPassword);

    // --- unauthenticated + garbage session --------------------------------
    {
      const a = await json("POST", `${API}/account/avatar`, { image: PNG_1PX });
      ok("unauth avatar upload -> 401", a.status === 401, `status=${a.status}`);
      scanLeak("unauth avatar", a.body);
      const b = await json("DELETE", `${API}/account/avatar`, { path: `${adminId}/avatar.png` });
      ok("unauth avatar delete -> 401", b.status === 401, `status=${b.status}`);
      const c = await req(`${API}/workspace`);
      ok("unauth workspace read -> 401", c.status === 401, `status=${c.status}`);
      const d = await json("PATCH", `${API}/workspace`, { name: "X" });
      ok("unauth workspace rename -> 401", d.status === 401, `status=${d.status}`);
      const e = await req(`${API}/workspace`, {
        headers: { Cookie: "sb-etwuqthopqrzffdgvhqs-auth-token=base64-bogus" },
      });
      ok("garbage session -> 401", e.status === 401, `status=${e.status}`);
      const f = await req(`${WEB}/settings/account`);
      ok(
        "anon settings page redirects to login",
        f.status >= 300 && f.status < 400 && String(f.headers.location || f.body).includes("/login"),
        `status=${f.status}`,
      );
    }

    // --- avatar validation (admin session) --------------------------------
    const junk = await avPost("not-base64!!");
    ok("avatar non-base64 -> 400", junk.status === 400, `status=${junk.status}`);
    scanLeak("avatar junk", junk.body);

    const gif = await avPost(GIF_1PX);
    ok("avatar GIF bytes (wrong type) -> 400 unsupported", gif.status === 400 && /Unsupported/.test(gif.body), `status=${gif.status}`);

    const big = await avPost(Buffer.alloc(2 * 1024 * 1024 + 100, 0x41).toString("base64"));
    ok("avatar oversize -> 400 size", big.status === 400 && /2MB/.test(big.body), `status=${big.status}`);

    const up = await avPost(PNG_1PX);
    ok("avatar valid PNG -> 200", up.status === 200, `status=${up.status} ${up.body.slice(0, 160)}`);
    scanLeak("avatar upload", up.body);
    let avatarUrl = "";
    let avatarPath = "";
    if (up.status === 200) {
      const j = JSON.parse(up.body);
      avatarUrl = j.url;
      avatarPath = j.path;
      ok(
        "avatar path scoped to owner",
        avatarPath === `${adminId}/avatar.png`,
        avatarPath,
      );
      const got = await req(avatarUrl);
      ok("avatar public URL serves image/png", got.status === 200 && (got.headers["content-type"] || "").includes("image/png"), `status=${got.status}`);

      // Cross-user: disposable tries admin's path (API + raw storage).
      const crossPayload = JSON.stringify({ path: avatarPath });
      const cross = await req(`${API}/account/avatar`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(crossPayload),
          Cookie: user.cookie,
        },
        body: crossPayload,
      });
      ok("cross-user avatar delete -> 400", cross.status === 400, `status=${cross.status}`);
      scanLeak("cross delete", cross.body);

      const storageCross = await json(
        "PUT",
        `${SUPA}/storage/v1/object/${avatarPath}`,
        { x: 1 },
        user.token,
      );
      ok(
        "cross-user storage write rejected (400/403)",
        storageCross.status === 400 || storageCross.status === 403,
        `status=${storageCross.status}`,
      );
    }

    // --- workspace read / rename / role gate (admin) ----------------------
    let originalName = "";
    {
      const ws = await req(`${API}/workspace`, { headers: { Cookie: admin.cookie } });
      ok("workspace read -> 200", ws.status === 200, `status=${ws.status}`);
      scanLeak("workspace read", ws.body);
      if (ws.status === 200) {
        const j = JSON.parse(ws.body);
        originalName = j.name;
        ok(
          "workspace shape (id/name/createdAt/role/memberCount)",
          Boolean(j.id && j.name && j.createdAt && j.role && typeof j.memberCount === "number"),
          JSON.stringify({ role: j.role, memberCount: j.memberCount }),
        );
        ok("workspace role is owner for admin user", j.role === "owner", j.role);
      } else {
        originalName = "SMMOMO";
      }

      const empty = await req(`${API}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: admin.cookie },
        body: JSON.stringify({ name: "   " }),
      });
      ok("workspace rename empty -> 400", empty.status === 400, `status=${empty.status}`);

      const ren = await req(`${API}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: admin.cookie },
        body: JSON.stringify({ name: `${originalName} (smoke)` }),
      });
      ok("workspace rename -> 200", ren.status === 200, `status=${ren.status}`);
      scanLeak("workspace rename", ren.body);

      const back = await req(`${API}/workspace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: admin.cookie },
        body: JSON.stringify({ name: originalName }),
      });
      ok("workspace rename restore -> 200", back.status === 200, `status=${back.status}`);

      const backGet = await req(`${API}/workspace`, { headers: { Cookie: admin.cookie } });
      ok(
        "workspace name restored",
        backGet.status === 200 && JSON.parse(backGet.body).name === originalName,
        backGet.status === 200 ? JSON.parse(backGet.body).name : `status=${backGet.status}`,
      );
    }

    // --- profile metadata persistence (disposable, Auth-owned) ------------
    {
      const put = await json(
        "PUT",
        `${SUPA}/auth/v1/user`,
        {
          data: {
            name: "Validate Account",
            country: "NP",
            timezone: "Asia/Kathmandu",
            phone_cc: "+977",
            phone_number: "9800000000",
            avatar_url: null,
          },
        },
        user.token,
      );
      ok("profile metadata update -> 200", put.status === 200, `status=${put.status}`);
      scanLeak("profile update", put.body);

      const get = await json("GET", `${SUPA}/auth/v1/user`, undefined, user.token);
      const meta = get.status === 200 ? JSON.parse(get.body).user_metadata || {} : {};
      ok(
        "profile metadata persisted",
        meta.name === "Validate Account" &&
          meta.country === "NP" &&
          meta.timezone === "Asia/Kathmandu" &&
          meta.phone_cc === "+977" &&
          meta.phone_number === "9800000000",
        JSON.stringify(meta).slice(0, 160),
      );

      // Cross-user read: admin's metadata must not contain the other user's.
      const adminGet = await json("GET", `${SUPA}/auth/v1/user`, undefined, admin.token);
      const adminMeta = adminGet.status === 200 ? JSON.parse(adminGet.body).user_metadata || {} : {};
      ok(
        "metadata is per-user (admin unaffected)",
        adminMeta.name !== "Validate Account",
      );
    }

    // --- email change flow (disposable) ------------------------------------
    let pendingChangeExpected = false;
    {
      const badEmail = await json(
        "PUT",
        `${SUPA}/auth/v1/user`,
        { email: "not-an-email" },
        user.token,
      );
      ok("email change invalid -> 4xx", badEmail.status >= 400 && badEmail.status < 500, `status=${badEmail.status}`);
      scanLeak("email invalid", badEmail.body);
      const badJ = badEmail.status >= 400 ? JSON.parse(badEmail.body) : {};
      ok(
        "email invalid error is safe (msg/code only)",
        !("stack" in badJ) && !("details" in badJ) && !/postgres/i.test(badEmail.body),
        JSON.stringify(badJ).slice(0, 160),
      );

      // Happy path depends on Supabase's free-tier email send quota —
      // skip honestly when exhausted (never fake a pending state). Observed
      // exhaustions: 429 over_email_send_rate_limit, bare 429, and 400
      // email_address_invalid (anti-abuse rejecting the target pattern).
      const newEmail = `validate-account-change-${stamp}@smmomo-test.com`;
      const change = await json(
        "PUT",
        `${SUPA}/auth/v1/user`,
        { email: newEmail },
        user.token,
      );
      if (change.status === 200) {
        pendingChangeExpected = true;
        ok("email change request -> 200", true);
      } else if (
        change.status === 429 ||
        (change.status === 400 && /email_address_invalid/i.test(change.body))
      ) {
        ok(
          "email change request",
          true,
          `SKIP (email send quota/policy exhausted: ${change.status} ${change.body.slice(0, 80)})`,
        );
      } else {
        ok("email change request -> 200", false, `status=${change.status} ${change.body.slice(0, 160)}`);
      }
      scanLeak("email change", change.body);

      const after = await json("GET", `${SUPA}/auth/v1/user`, undefined, user.token);
      if (pendingChangeExpected) {
        const newEmailField = after.status === 200 ? JSON.parse(after.body).new_email : "";
        ok("pending email visible as new_email", newEmailField === newEmail, String(newEmailField));
        ok(
          "old email still active while pending",
          JSON.parse(after.body).email === disposableEmail,
        );
      } else {
        const activeEmail = after.status === 200 ? JSON.parse(after.body).email : "";
        ok("old email unchanged after skipped/failed change", activeEmail === disposableEmail, String(activeEmail));
      }
    }

    // --- password change (disposable) --------------------------------------
    {
      const changePw = await json(
        "PUT",
        `${SUPA}/auth/v1/user`,
        { password: newPassword },
        user.token,
      );
      ok("password change -> 200", changePw.status === 200, `status=${changePw.status}`);
      scanLeak("password change", changePw.body);

      const oldLogin = await json("POST", `${SUPA}/auth/v1/token?grant_type=password`, {
        email: disposableEmail,
        password: initPassword,
      });
      ok("old password rejected after change", oldLogin.status >= 400, `status=${oldLogin.status}`);

      const newLogin = await json("POST", `${SUPA}/auth/v1/token?grant_type=password`, {
        email: disposableEmail,
        password: newPassword,
      });
      ok("new password works", newLogin.status === 200, `status=${newLogin.status}`);
      const sessionA = newLogin.status === 200 ? JSON.parse(newLogin.body) : null;

      // --- session management: scope=others revokes other sessions ---------
      if (sessionA) {
        const sessionB = await json("POST", `${SUPA}/auth/v1/token?grant_type=password`, {
          email: disposableEmail,
          password: newPassword,
        });
        const b = sessionB.status === 200 ? JSON.parse(sessionB.body) : null;
        ok("second session created", Boolean(b));

        const others = await req(`${SUPA}/auth/v1/logout?scope=others`, {
          method: "POST",
          headers: {
            apikey: PUB,
            Authorization: `Bearer ${sessionA.access_token}`,
          },
        });
        ok("sign out other sessions -> 2xx", others.status >= 200 && others.status < 300, `status=${others.status}`);

        if (b) {
          const refreshB = await json("POST", `${SUPA}/auth/v1/token?grant_type=refresh_token`, {
            refresh_token: b.refresh_token,
          });
          ok("other session refresh revoked", refreshB.status >= 400, `status=${refreshB.status}`);
        }
        const stillA = await json("GET", `${SUPA}/auth/v1/user`, undefined, sessionA.access_token);
        ok("current session stays valid", stillA.status === 200, `status=${stillA.status}`);
      }
    }

    // --- avatar cleanup (restore admin to no avatar) -----------------------
    if (avatarPath) {
      const del = await avDelete(avatarPath);
      ok("own avatar delete -> 200", del.status === 200, `status=${del.status}`);
      const again = await avDelete(avatarPath);
      ok("avatar delete idempotent -> 200", again.status === 200, `status=${again.status}`);
      if (avatarUrl) {
        const gone = await req(avatarUrl);
        // Deletion truth comes from storage metadata (proven by the idempotent
        // DELETE above). The public URL can serve a stale Cloudflare copy
        // (cf-cache-status: HIT) for a while — only a non-cached live 200
        // means the object survived.
        const cf = gone.headers["cf-cache-status"] || "";
        const goneOk =
          gone.status === 404 ||
          (gone.status === 400 && gone.body.includes('"statusCode":"404"')) ||
          (gone.status === 200 && /HIT|STALE/i.test(cf));
        ok("avatar gone after delete (404)", goneOk, `status=${gone.status} cf=${cf}`);
      }
      const foreignPayload = JSON.stringify({
        path: `${disposableId}/avatar.png`,
      });
      const delCross = await req(`${API}/account/avatar`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(foreignPayload),
          Cookie: admin.cookie,
        },
        body: foreignPayload,
      });
      ok("foreign prefix path rejected -> 400", delCross.status === 400, `status=${delCross.status}`);
    }

    // --- settings pages (admin session) ------------------------------------
    {
      const pages = [
        ["/settings/account", "Profile"],
        ["/settings/security", "Change password"],
        ["/settings/workspace", "Workspace"],
        ["/settings/notifications", "Coming soon"],
        ["/settings/usage", "Usage"],
        ["/settings/social-accounts", "Social accounts"],
      ];
      for (const [path, marker] of pages) {
        const res = await req(`${WEB}${path}`, { headers: { Cookie: admin.cookie } });
        ok(
          `page ${path} -> 200 + "${marker}"`,
          res.status === 200 && res.body.includes(marker),
          `status=${res.status}`,
        );
        scanLeak(`page ${path}`, res.body.includes("sb_secret_") ? res.body : "");
      }
      const hub = await req(`${WEB}/settings`, { headers: { Cookie: admin.cookie } });
      const loc = String(hub.headers.location || "");
      ok(
        "/settings hub redirects to profile",
        hub.status >= 300 && hub.status < 400 && loc.includes("/settings/account"),
        `status=${hub.status} loc=${loc}`,
      );
      const nav = await req(`${WEB}/settings/account`, { headers: { Cookie: admin.cookie } });
      ok(
        "settings nav present (Profile/Security/Workspace)",
        nav.body.includes("/settings/security") &&
          nav.body.includes("/settings/workspace") &&
          nav.body.includes("/settings/account"),
      );
    }
  } finally {
    if (disposableId) {
      const del = await json("DELETE", `${SUPA}/auth/v1/admin/users/${disposableId}`, undefined, SERVICE);
      ok("disposable user cleaned up", del.status === 200 || del.status === 204, `status=${del.status}`);
    }
  }

  // --- avatar rate limit (LAST: locks /account/avatar for ~60s per IP) ----
  {
    let saw429 = false;
    for (let i = 0; i < 15 && !saw429; i++) {
      const r = await avPost("!!");
      if (r.status === 429) saw429 = true;
    }
    ok("avatar burst hits 429 within 15 requests", saw429);
  }

  ok("no secret/stack leaks in scanned responses", leaks.length === 0, leaks.join(" | ").slice(0, 300));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("HARNESS ERROR", err);
  process.exit(1);
});
