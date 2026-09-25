import type { FastifyInstance } from "fastify";
import { authed, rest } from "./supabase";

// Task 027: period-scoped analytics for the redesigned Dashboard/Analytics.
// One endpoint, JS aggregation over RLS-scoped rows — calculations happen on
// the server (spec §34); workspace identity comes from the session, never the
// query (spec §39). /analytics/summary keeps its lifetime-counter authority
// (billing-adjacent); this endpoint reports what happened inside a window.
// ponytail: bounded PostgREST fetches (limit 10000) aggregated in JS — move
// to an SQL RPC when workspaces outgrow the cap (response.truncated flags it).

interface CommentRow {
  created_at: string;
  matched: boolean;
  post_id: string | null;
  automation_id: string | null;
}

// many-to-one embed — object | null (defensive: array tolerated).
interface DeliveryComment {
  post_id: string | null;
  automation_id: string | null;
  automation_name: string | null;
  username: string;
  text: string;
}

interface DeliveryRow {
  id: string;
  created_at: string;
  status: "queued" | "processing" | "sent" | "delivered" | "failed";
  kind: "private_dm" | "public_reply";
  recipient: string;
  error: string | null;
  comment: DeliveryComment | DeliveryComment[] | null;
}

interface AutomationRow {
  id: string;
  name: string;
  status: "active" | "paused" | "draft";
  keyword: string;
  post_id: string;
}

interface PostRow {
  id: string;
  caption: string;
  type: "IMAGE" | "REEL" | "CAROUSEL";
  media_url: string | null;
  permalink: string;
}

type Bucket = "hour" | "day";

interface Totals {
  comments: number;
  matched: number;
  dmsSent: number;
  failed: number;
}

function uuidOk(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

function deliveryComment(d: DeliveryRow): DeliveryComment | null {
  const c = d.comment;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

// Graph "sent" is acceptance; only `delivered` is a delivery receipt. DMs
// sent = private_dm accepted by Graph. Failed covers both kinds.
function isDmSent(d: DeliveryRow): boolean {
  return d.kind === "private_dm" && (d.status === "sent" || d.status === "delivered");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;
const MAX_SPAN_MS = 366 * 86_400_000;
const DEFAULT_SPAN_MS = 30 * 86_400_000;

type RangeResult =
  | { ok: true; start: Date; end: Date }
  | { ok: false; message: string };

function parseRange(startRaw?: string, endRaw?: string, now = new Date()): RangeResult {
  const hasStart = startRaw !== undefined && startRaw !== "";
  const hasEnd = endRaw !== undefined && endRaw !== "";
  const bad = (message: string): RangeResult => ({ ok: false, message });
  if (hasStart !== hasEnd) return bad("start and end must be provided together");
  if (!hasStart) {
    return { ok: true, start: new Date(now.getTime() - DEFAULT_SPAN_MS), end: now };
  }
  if (!ISO_DATE.test(startRaw!)) return bad("invalid start date");
  if (!ISO_DATE.test(endRaw!)) return bad("invalid end date");
  const start = new Date(startRaw!);
  const end = new Date(endRaw!);
  if (Number.isNaN(start.getTime())) return bad("invalid start date");
  if (Number.isNaN(end.getTime())) return bad("invalid end date");
  if (start.getTime() >= end.getTime()) return bad("start must be before end");
  if (end.getTime() - start.getTime() > MAX_SPAN_MS) {
    return bad("range too large — maximum is 366 days");
  }
  return { ok: true, start, end };
}

function tzOk(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Bucket key in the viewer's timezone: "YYYY-MM-DD" (day) or
// "YYYY-MM-DD HH" (hour, h23). Keys are lexicographically sortable.
function keyFormatter(tz: string, bucket: Bucket): (at: string) => string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(bucket === "hour" ? { hour: "2-digit" } : {}),
  });
  return (at: string) => {
    const parts = fmt.formatToParts(new Date(at));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const date = `${get("year")}-${get("month")}-${get("day")}`;
    return bucket === "hour" ? `${date} ${get("hour")}` : date;
  };
}

function keyLabel(key: string, bucket: Bucket): string {
  if (bucket === "hour") return `${key.split(" ")[1]}:00`;
  const [, month, day] = key.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

// Zero-fill by stepping the range in UTC — labels come from each instant's
// local (tz) rendering, so DST shifts stay correct. Dedupe via Set: a skipped
// local hour (spring forward) simply has no bucket; a repeated one (fall
// back) collapses to one. Event-derived keys are unioned in afterwards so a
// bucket that only exists for events is never dropped.
function bucketKeys(start: Date, end: Date, tz: string, bucket: Bucket): string[] {
  const fmt = keyFormatter(tz, bucket);
  const stepMs = bucket === "hour" ? 3_600_000 : 86_400_000;
  const keys = new Set<string>();
  for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
    keys.add(fmt(new Date(t).toISOString()));
  }
  return [...keys];
}

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  // GET /analytics/overview?start&end&tz&automationId&postId
  // start/end: ISO date or datetime, paired, [start, end), ≤366 days.
  app.get<{
    Querystring: {
      start?: string;
      end?: string;
      tz?: string;
      automationId?: string;
      postId?: string;
    };
  }>("/analytics/overview", async (req, reply) => {
    const q = req.query;
    const range = parseRange(q.start, q.end);
    if (!range.ok) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: range.message,
      });
    }
    const tz = q.tz === undefined || q.tz === "" ? "UTC" : q.tz;
    if (!tzOk(tz)) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "invalid timezone",
      });
    }
    const automationId = q.automationId?.trim() ?? "";
    const postId = q.postId?.trim() ?? "";
    if ((automationId !== "" && !uuidOk(automationId)) || (postId !== "" && !uuidOk(postId))) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "automationId and postId must be uuids",
      });
    }

    const user = authed(req);

    // Automations + posts: scoping, names, content rows, and 404-on-unknown
    // ids (validated against the caller's own RLS-visible rows).
    const [autosRes, postsRes] = await Promise.all([
      rest<AutomationRow[]>(
        user,
        "automations?select=id,name,status,keyword,post_id&order=created_at.desc&limit=10000",
      ),
      rest<PostRow[]>(user, "posts?select=id,caption,type,media_url,permalink&limit=10000"),
    ]);
    if (autosRes.status >= 400 || postsRes.status >= 400) {
      throw Object.assign(new Error("failed to load analytics"), { statusCode: 502 });
    }
    const automations = autosRes.data ?? [];
    const posts = postsRes.data ?? [];
    const scopedAutomation = automations.find((a) => a.id === automationId);
    if (automationId !== "" && !scopedAutomation) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Unknown automation" });
    }
    if (postId !== "" && !posts.some((p) => p.id === postId)) {
      return reply.code(404).send({ statusCode: 404, error: "Not Found", message: "Unknown post" });
    }

    // Comment base: the selected post, or the automation's post (comments
    // seen by that automation = comments on its post). Server-side filter.
    const postFilter = postId !== "" ? postId : scopedAutomation?.post_id ?? "";

    const spanMs = range.end.getTime() - range.start.getTime();
    const prevStart = new Date(range.start.getTime() - spanMs);
    const fetchStartIso = prevStart.toISOString();
    const startIso = range.start.toISOString();
    const endIso = range.end.toISOString();

    const [commentsRes, deliveriesRes] = await Promise.all([
      rest<CommentRow[]>(
        user,
        "comments" +
          `?created_at=gte.${encodeURIComponent(fetchStartIso)}` +
          `&created_at=lt.${encodeURIComponent(endIso)}` +
          (postFilter !== "" ? `&post_id=eq.${encodeURIComponent(postFilter)}` : "") +
          "&select=created_at,matched,post_id,automation_id" +
          "&order=created_at.asc&limit=10000",
      ),
      rest<DeliveryRow[]>(
        user,
        "deliveries" +
          `?created_at=gte.${encodeURIComponent(fetchStartIso)}` +
          `&created_at=lt.${encodeURIComponent(endIso)}` +
          "&select=id,created_at,status,kind,recipient,error," +
          "comment:comments(post_id,automation_id,automation_name,username,text)" +
          "&order=created_at.asc&limit=10000",
      ),
    ]);
    if (commentsRes.status >= 400 || deliveriesRes.status >= 400) {
      throw Object.assign(new Error("failed to load analytics"), { statusCode: 502 });
    }
    const comments = commentsRes.data ?? [];
    const deliveries = deliveriesRes.data ?? [];

    const startMs = range.start.getTime();
    const deliveryInScope = (d: DeliveryRow): boolean => {
      const c = deliveryComment(d);
      if (!c) return postId === "" && automationId === "";
      if (postId !== "" && c.post_id !== postId) return false;
      if (automationId !== "" && c.automation_id !== automationId) return false;
      return true;
    };
    const scopedDeliveries = deliveries.filter(deliveryInScope);
    const inCurrent = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= startMs && t < range.end.getTime();
    };
    const currentComments = comments.filter((c) => inCurrent(c.created_at));
    const currentDeliveries = scopedDeliveries.filter((d) => inCurrent(d.created_at));
    const prevComments = comments.filter((c) => {
      const t = new Date(c.created_at).getTime();
      return t >= prevStart.getTime() && t < startMs;
    });
    const prevDeliveries = scopedDeliveries.filter((d) => {
      const t = new Date(d.created_at).getTime();
      return t >= prevStart.getTime() && t < startMs;
    });

    // matched under scope: automation scope counts only its own matches;
    // otherwise every matched comment (post scope already applied server-side).
    const isMatched = (c: CommentRow) =>
      c.matched && (automationId === "" || c.automation_id === automationId);
    const sumTotals = (cs: CommentRow[], ds: DeliveryRow[]): Totals => ({
      comments: cs.length,
      matched: cs.filter(isMatched).length,
      dmsSent: ds.filter(isDmSent).length,
      failed: ds.filter((d) => d.status === "failed").length,
    });

    // --- series ---
    const bucket: Bucket = spanMs <= 48 * 3_600_000 ? "hour" : "day";
    const fmtKey = keyFormatter(tz, bucket);
    const seriesMap = new Map<string, Totals & { dms: number }>();
    const seriesBucket = (at: string) => {
      const key = fmtKey(at);
      let b = seriesMap.get(key);
      if (!b) {
        b = { comments: 0, matched: 0, dmsSent: 0, failed: 0, dms: 0 };
        seriesMap.set(key, b);
      }
      return b;
    };
    for (const c of currentComments) {
      const b = seriesBucket(c.created_at);
      b.comments += 1;
      if (isMatched(c)) b.matched += 1;
    }
    for (const d of currentDeliveries) {
      const b = seriesBucket(d.created_at);
      if (isDmSent(d)) b.dms += 1;
      if (d.status === "failed") b.failed += 1;
    }
    const keySet = new Set(bucketKeys(range.start, range.end, tz, bucket));
    for (const key of seriesMap.keys()) keySet.add(key);
    const series = [...keySet].sort().map((key) => {
      const b = seriesMap.get(key);
      return {
        key,
        label: keyLabel(key, bucket),
        comments: b?.comments ?? 0,
        matched: b?.matched ?? 0,
        dms: b?.dms ?? 0,
        failed: b?.failed ?? 0,
      };
    });

    // --- per-automation stats (comments on its post = opportunity) ---
    const postComments = new Map<string, number>();
    const postMatched = new Map<string, number>();
    const autoMatched = new Map<string, number>();
    for (const c of currentComments) {
      if (c.post_id) {
        postComments.set(c.post_id, (postComments.get(c.post_id) ?? 0) + 1);
        if (isMatched(c)) postMatched.set(c.post_id, (postMatched.get(c.post_id) ?? 0) + 1);
      }
      if (isMatched(c) && c.automation_id) {
        autoMatched.set(c.automation_id, (autoMatched.get(c.automation_id) ?? 0) + 1);
      }
    }
    const autoDms = new Map<string, number>();
    const autoFailed = new Map<string, number>();
    const postDms = new Map<string, number>();
    const postFailed = new Map<string, number>();
    for (const d of currentDeliveries) {
      const c = deliveryComment(d);
      if (isDmSent(d) && c?.post_id) postDms.set(c.post_id, (postDms.get(c.post_id) ?? 0) + 1);
      if (d.status === "failed" && c?.post_id) postFailed.set(c.post_id, (postFailed.get(c.post_id) ?? 0) + 1);
      if (!c?.automation_id) continue;
      if (isDmSent(d)) autoDms.set(c.automation_id, (autoDms.get(c.automation_id) ?? 0) + 1);
      if (d.status === "failed") autoFailed.set(c.automation_id, (autoFailed.get(c.automation_id) ?? 0) + 1);
    }

    const automationRows = automations
      .filter(
        (a) =>
          (automationId === "" || a.id === automationId) &&
          (postId === "" || a.post_id === postId),
      )
      .map((a) => {
        const nComments = postComments.get(a.post_id) ?? 0;
        const nMatched = autoMatched.get(a.id) ?? 0;
        return {
          id: a.id,
          name: a.name,
          status: a.status,
          keyword: a.keyword,
          postId: a.post_id,
          comments: nComments,
          matched: nMatched,
          dmsSent: autoDms.get(a.id) ?? 0,
          failed: autoFailed.get(a.id) ?? 0,
          matchRate: nComments > 0 ? nMatched / nComments : null,
        };
      });

    // --- content rows (only posts with activity in the window) ---
    const content = posts
      .map((p) => ({
        id: p.id,
        caption: p.caption,
        type: p.type,
        mediaUrl: p.media_url,
        permalink: p.permalink,
        comments: postComments.get(p.id) ?? 0,
        matched: postMatched.get(p.id) ?? 0,
        dmsSent: postDms.get(p.id) ?? 0,
        failed: postFailed.get(p.id) ?? 0,
      }))
      .filter((r) => r.comments > 0 || r.dmsSent > 0 || r.failed > 0)
      .sort((a, b) => b.comments - a.comments || b.matched - a.matched);

    // --- delivery health + failures ---
    const deliveryHealth = { queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0 };
    for (const d of currentDeliveries) deliveryHealth[d.status] += 1;
    const failures = currentDeliveries
      .filter((d) => d.status === "failed")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map((d) => {
        const c = deliveryComment(d);
        return {
          id: d.id,
          createdAt: d.created_at,
          error: d.error,
          recipient: d.recipient,
          kind: d.kind,
          automationName: c?.automation_name ?? null,
          username: c?.username ?? null,
          text: c?.text ?? null,
          postId: c?.post_id ?? null,
        };
      });

    return {
      range: {
        start: startIso,
        end: endIso,
        previousStart: fetchStartIso,
        previousEnd: startIso,
        tz,
      },
      totals: sumTotals(currentComments, currentDeliveries),
      previous: sumTotals(prevComments, prevDeliveries),
      bucket,
      series,
      automations: automationRows,
      content,
      deliveryHealth,
      failures,
      truncated: comments.length >= 10_000 || deliveries.length >= 10_000,
    };
  });
}
