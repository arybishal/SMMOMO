// Task 024: onboarding + activation gate + content sync validation.
// Run: npx tsx apps/api/scripts/validate-onboarding.ts
// Needs: API on :4000, TEST_ADMIN_EMAIL/PASSWORD + TEST_NONADMIN_* in env,
// service key at %TEMP%\smmomo_servicekey.txt. Optional: WEB on :3000 for
// page smokes; META_GRAPH_BASE stub (see Task 024 notes) for sync happy path
// — without it, sync runs degrade to the auth-failure branch (asserted too).
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  onboardingStep,
  setupChecklist,
  type OnboardingInput,
} from "../../web/lib/onboarding";

const API = "http://localhost:4000";
const WEB = "http://localhost:3000";
const SUPA = "https://etwuqthopqrzffdgvhqs.supabase.co";
const PUB = "sb_publishable_ptMvNEqjdAJoPys6NbpleA_Yu0swj50";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "";
const NONADMIN_EMAIL = process.env.TEST_NONADMIN_EMAIL || "";
const NONADMIN_PASSWORD = process.env.TEST_NONADMIN_PASSWORD || "";
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !NONADMIN_EMAIL || !NONADMIN_PASSWORD) {
  console.error(
    "Set TEST_ADMIN_* and TEST_NONADMIN_* email/password env vars first.",
  );
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

interface Res {
  status: number;
  body: string;
}

function req(
  url: string,
  opts: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<Res> {
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
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: d }));
      },
    );
    r.on("error", reject);
    if (opts.body) r.write(opts.body);
    r.end();
  });
}

async function api(
  pathName: string,
  cookie: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<Res> {
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
  return req(`${API}${pathName}`, {
    method: opts.method ?? "GET",
    headers: {
      Cookie: cookie,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
  });
}

async function login(email: string, password: string) {
  const body = JSON.stringify({ email, password });
  const res = await req(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: PUB,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
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
  const cookie = `sb-etwuqthopqrzffdgvhqs-auth-token=base64-${Buffer.from(
    session,
  ).toString("base64url")}`;
  return { cookie, token: j.access_token, user: j.user };
}

function serviceKey(): string {
  return fs
    .readFileSync(path.join(process.env.TEMP ?? ".", "smmomo_servicekey.txt"), "utf8")
    .trim();
}

async function serviceGet(query: string): Promise<Res> {
  const key = serviceKey();
  return req(`${SUPA}/rest/v1/${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

async function serviceSend(
  query: string,
  method: string,
  payload: unknown,
): Promise<Res> {
  const key = serviceKey();
  const isDelete = method === "DELETE";
  const body = isDelete ? undefined : JSON.stringify(payload);
  return req(`${SUPA}/rest/v1/${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      Prefer: "return=representation",
      ...(body ? { "Content-Length": String(Buffer.byteLength(body)) } : {}),
    },
    body,
  });
}

function step(partial: Partial<OnboardingInput>): string {
  return onboardingStep({
    account: "none",
    postCount: 0,
    automationCount: 0,
    activeCount: 0,
    hasActivity: false,
    ...partial,
  });
}

async function main(): Promise<void> {
  // --- A. pure derived-state function -------------------------------------
  ok("no account → connect", step({}) === "connect");
  ok("error → reconnect", step({ account: "error" }) === "reconnect");
  ok("connected, no posts → import", step({ account: "connected" }) === "import");
  ok(
    "posts, no automations → create",
    step({ account: "connected", postCount: 3 }) === "create",
  );
  ok(
    "automations but none active → activate",
    step({ account: "connected", postCount: 3, automationCount: 2 }) ===
      "activate",
  );
  ok(
    "active but no activity → waiting",
    step({
      account: "connected",
      postCount: 3,
      automationCount: 2,
      activeCount: 1,
    }) === "waiting",
  );
  ok(
    "active + activity → live",
    step({
      account: "connected",
      postCount: 3,
      automationCount: 2,
      activeCount: 1,
      hasActivity: true,
    }) === "live",
  );
  const cl = setupChecklist("connect");
  ok(
    "checklist connect: first current",
    cl.length === 4 &&
      cl[0].state === "current" &&
      cl[1].state === "pending" &&
      cl[0].href === "/settings/social-accounts",
  );
  const waiting = setupChecklist("waiting");
  ok("checklist waiting: all done", waiting.every((i) => i.state === "done"));
  const recon = setupChecklist("reconnect");
  ok(
    "checklist reconnect label",
    recon[0].label === "Reconnect Instagram",
  );

  // --- B. auth gates -------------------------------------------------------
  const health = await req(`${API}/health`);
  ok("health", health.status === 200);

  const anonSync = await api("/social-accounts/instagram/sync", "", {
    method: "POST",
  });
  ok("anon sync 401", anonSync.status === 401, String(anonSync.status));
  const anonPatch = await api("/automations/00000000-0000-4000-8000-000000000000", "", {
    method: "PATCH",
    body: { status: "active" },
  });
  ok("anon patch 401", anonPatch.status === 401, String(anonPatch.status));

  const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const non = await login(NONADMIN_EMAIL, NONADMIN_PASSWORD);

  // Workspace ids (service read) — admin ws owns the social account.
  const adminWs = JSON.parse(
    (
      await serviceGet(
        `workspace_members?user_id=eq.${admin.user.id}&select=workspace_id&limit=1`,
      )
    ).body,
  )[0].workspace_id as string;
  const nonWs = JSON.parse(
    (
      await serviceGet(
        `workspace_members?user_id=eq.${non.user.id}&select=workspace_id&limit=1`,
      )
    ).body,
  )[0].workspace_id as string;

  // Normalize account state for the run; restore at the end.
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "connected" },
  );

  // --- C. content sync -----------------------------------------------------
  const sync1 = await api("/social-accounts/instagram/sync", admin.cookie, {
    method: "POST",
  });
  const stubMode = sync1.status === 200;
  ok(
    "sync returns 200 (stub) or 409/502 (real Graph, fake token)",
    stubMode || sync1.status === 409 || sync1.status === 502,
    `status=${sync1.status} ${sync1.body.slice(0, 160)}`,
  );
  ok(
    "sync response has no token material",
    !/access_token|sb_secret|Bearer\s+\S/i.test(sync1.body),
  );

  if (stubMode) {
    const j = JSON.parse(sync1.body);
    ok("sync imported ≥1", typeof j.imported === "number" && j.imported >= 1);
    ok(
      "sync skipped VIDEO (schema type filter)",
      typeof j.skipped === "number" && j.skipped >= 1,
      `skipped=${j.skipped}`,
    );
    const rows = JSON.parse(
      (await serviceGet(
        `posts?workspace_id=eq.${adminWs}&ig_media_id=not.is.null&select=id,ig_media_id,type`,
      )).body,
    );
    ok("posts rows with ig_media_id", rows.length >= 1, `rows=${rows.length}`);
    const sync2 = await api("/social-accounts/instagram/sync", admin.cookie, {
      method: "POST",
    });
    const rows2 = JSON.parse(
      (
        await serviceGet(
          `posts?workspace_id=eq.${adminWs}&ig_media_id=not.is.null&select=id`,
        )
      ).body,
    );
    ok(
      "re-sync idempotent (no duplicate rows)",
      sync2.status === 200 && rows2.length === rows.length,
      `count=${rows2.length} before=${rows.length}`,
    );
  } else {
    console.log(
      "SKIP import happy-path assertions (degraded mode: real Graph + fake token)",
    );
    // Auth failure must flip the account into reconnect-needed state.
    const acct = JSON.parse(
      (
        await serviceGet(
          `social_accounts?workspace_id=eq.${adminWs}&select=status`,
        )
      ).body,
    )[0];
    ok(
      "sync auth failure → account needs reconnect (or network 502 keeps state)",
      sync1.status === 409 ? acct.status === "error" : true,
      `status=${acct.status}`,
    );
    await serviceSend(
      `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
      "PATCH",
      { status: "connected" },
    );
  }

  // Error-state account blocks sync BEFORE any Graph call (deterministic).
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "error" },
  );
  const syncErr = await api("/social-accounts/instagram/sync", admin.cookie, {
    method: "POST",
  });
  ok(
    "sync with error account → 409 reconnect message",
    syncErr.status === 409 && /reconnect/i.test(syncErr.body),
    `status=${syncErr.status} ${syncErr.body.slice(0, 140)}`,
  );
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "connected" },
  );

  // --- D. activation gate --------------------------------------------------
  // Seed one post directly (service role) so activation tests do not depend
  // on Graph mode. Cleaned up at the end (automations cascade).
  const seeded = JSON.parse(
    (
      await serviceSend("posts", "POST", {
        workspace_id: adminWs,
        social_account_id: JSON.parse(
          (
            await serviceGet(
              `social_accounts?workspace_id=eq.${adminWs}&select=id&limit=1`,
            )
          ).body,
        )[0].id,
        ig_media_id: `onb-manual-${Date.now()}`,
        caption: "Onboarding harness post",
        type: "IMAGE",
        permalink: "https://instagram.test/p/onb",
        posted_at: new Date().toISOString(),
      })
    ).body,
  )[0] as { id: string };

  const draft = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: seeded.id,
      keyword: "ZZONB",
      privateReply: "Harness DM",
      publicReply: null,
      name: "ZZONB draft",
    },
  });
  ok("create draft 201", draft.status === 201, draft.body.slice(0, 140));
  ok("draft status", JSON.parse(draft.body).status === "draft");

  const badActivate = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: seeded.id,
      keyword: "ZZONB2",
      privateReply: "Harness DM",
      publicReply: null,
      activate: "yes",
    },
  });
  ok("activate non-boolean → 400", badActivate.status === 400);

  const unknownPost = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: "11111111-2222-4333-8444-555555555555",
      keyword: "ZZONB3",
      privateReply: "Harness DM",
      publicReply: null,
      activate: true,
    },
  });
  ok(
    "activate unknown post → 400",
    unknownPost.status === 400 && /Post no longer exists/i.test(unknownPost.body),
    unknownPost.body.slice(0, 140),
  );

  const active1 = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: seeded.id,
      keyword: "ZZONB",
      privateReply: "Harness DM",
      publicReply: null,
      name: "ZZONB live",
      activate: true,
    },
  });
  ok(
    "create & activate 201",
    active1.status === 201,
    active1.body.slice(0, 160),
  );
  ok("created active", active1.status === 201 && JSON.parse(active1.body).status === "active");
  const activeId = active1.status === 201 ? JSON.parse(active1.body).id : "";

  const dup = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: seeded.id,
      keyword: "zzonb",
      privateReply: "Harness DM",
      publicReply: null,
      name: "ZZONB dup",
      activate: true,
    },
  });
  ok(
    "duplicate active keyword → 409 (case-insensitive)",
    dup.status === 409 && /already uses/i.test(dup.body),
    dup.body.slice(0, 160),
  );

  const diffKw = await api("/automations", admin.cookie, {
    method: "POST",
    body: {
      postId: seeded.id,
      keyword: "ZZOTHER",
      privateReply: "Harness DM",
      publicReply: null,
      name: "ZZOTHER live",
      activate: true,
    },
  });
  ok("different keyword activates", diffKw.status === 201, diffKw.body.slice(0, 140));
  const otherId = diffKw.status === 201 ? JSON.parse(diffKw.body).id : "";

  // PATCH path: duplicate blocked with merged keyword, then allowed after fix.
  const patchDup = await api(`/automations/${otherId}`, admin.cookie, {
    method: "PATCH",
    body: { keyword: "ZZONB", status: "active" },
  });
  ok(
    "PATCH activation duplicate → 409",
    patchDup.status === 409 && /already uses/i.test(patchDup.body),
    patchDup.body.slice(0, 140),
  );
  const patchOk = await api(`/automations/${otherId}`, admin.cookie, {
    method: "PATCH",
    body: { keyword: "ZZOTHER2", status: "active" },
  });
  ok(
    "PATCH activation with unique keyword → 200",
    patchOk.status === 200,
    patchOk.body.slice(0, 140),
  );
  const selfPatch = await api(`/automations/${activeId}`, admin.cookie, {
    method: "PATCH",
    body: { status: "active" },
  });
  ok("PATCH re-activate self → 200", selfPatch.status === 200);

  const pause = await api(`/automations/${activeId}`, admin.cookie, {
    method: "PATCH",
    body: { status: "paused" },
  });
  ok("pause → 200", pause.status === 200 && JSON.parse(pause.body).status === "paused");

  // Error account blocks activation (before any Graph work).
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "error" },
  );
  const actErr = await api(`/automations/${activeId}`, admin.cookie, {
    method: "PATCH",
    body: { status: "active" },
  });
  ok(
    "activate while error → 409 reconnect message",
    actErr.status === 409 && /reconnect/i.test(actErr.body),
    actErr.body.slice(0, 140),
  );
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "connected" },
  );
  const actAgain = await api(`/automations/${activeId}`, admin.cookie, {
    method: "PATCH",
    body: { status: "active" },
  });
  ok("activate after restore → 200", actAgain.status === 200);

  // --- E. no-connection workspace (non-admin: no social account) -----------
  const nonSync = await api("/social-accounts/instagram/sync", non.cookie, {
    method: "POST",
  });
  ok(
    "no account: sync → 400 connect message",
    nonSync.status === 400 && /Connect Instagram/i.test(nonSync.body),
    nonSync.body.slice(0, 140),
  );
  const nonAct = await api("/automations", non.cookie, {
    method: "POST",
    body: {
      postId: "11111111-2222-4333-8444-555555555555",
      keyword: "ZZNON",
      privateReply: "DM",
      publicReply: null,
      activate: true,
    },
  });
  ok(
    "no account: activate → 409 connect message",
    nonAct.status === 409 && /Connect Instagram/i.test(nonAct.body),
    nonAct.body.slice(0, 140),
  );

  // --- F. no token leakage -------------------------------------------------
  for (const p of [
    "/social-accounts",
    "/social-accounts/instagram",
    "/posts",
    "/automations",
  ]) {
    const r = await api(p, admin.cookie);
    const leak =
      r.status === 400 ||
      r.status === 404
        ? false
        : /access_token|"v1\.|Bearer\s+[A-Za-z0-9]/.test(r.body);
    ok(`no token in ${p}`, r.status < 400 && !leak, `status=${r.status}`);
  }

  // --- G. web page smokes (skip when Next is down) -------------------------
  let webUp = false;
  try {
    const probe = await req(`${WEB}/login`);
    webUp = probe.status === 200 || probe.status === 307;
  } catch {
    webUp = false;
  }
  if (webUp) {
    for (const p of ["/dashboard", "/posts", "/automations/new", "/settings/social-accounts"]) {
      const page = await req(`${WEB}${p}`, {
        headers: { Cookie: admin.cookie },
      });
      ok(`web ${p} 200`, page.status === 200, String(page.status));
    }
    const postsPage = await req(`${WEB}/posts`, {
      headers: { Cookie: admin.cookie },
    });
    ok(
      "posts page exposes Sync CTA",
      postsPage.body.includes("Sync posts"),
    );
    const dash = await req(`${WEB}/dashboard`, {
      headers: { Cookie: admin.cookie },
    });
    ok("dashboard mentions Instagram", dash.body.includes("Instagram"));
  } else {
    console.log("SKIP web smokes — Next dev server not reachable");
  }

  // --- cleanup: seeded post cascades its automations -----------------------
  await serviceSend(`posts?id=eq.${seeded.id}`, "DELETE", {});
  await serviceSend(
    `social_accounts?workspace_id=eq.${adminWs}&platform=eq.instagram`,
    "PATCH",
    { status: "connected" },
  );

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
