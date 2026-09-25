import type { FastifyInstance } from "fastify";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  authed,
  rest,
  type AuthUser,
} from "./supabase";

// Task 026 (Settings & Profile): avatar storage + workspace info/rename.
// Everything runs behind the global session preHandler (requireUser +
// ensureWorkspace) — no route here resolves identity itself.

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar\.(?:jpe?g|png|webp)$/i;

// Magic-byte sniff — the declared MIME (or a client filename) is never
// trusted; the stored extension comes from what the bytes actually are.
function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  ) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString("latin1") === "RIFF" &&
    buf.subarray(8, 12).toString("latin1") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

// Storage REST with the caller's own JWT: the bucket policies (migration
// 20260925120000) scope writes to the caller's {uid}/ folder, so a crafted
// path can never land in someone else's folder — RLS is the boundary, this
// handler just validates shape.
async function storageFetch(
  user: AuthUser,
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: Buffer },
): Promise<{ status: number; body: string }> {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${AVATAR_BUCKET}/${path}`,
    {
      method: init.method,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${user.token}`,
        ...(init.headers ?? {}),
      },
      body: init.body,
    },
  );
  return { status: res.status, body: await res.text().catch(() => "") };
}

// Supabase storage reports missing objects as HTTP 400 with a JSON body
// carrying "statusCode":404 (verified against DELETE and public GET).
function isStorageNotFound(res: { status: number; body: string }): boolean {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  try {
    return String(JSON.parse(res.body)?.statusCode) === "404";
  } catch {
    return false;
  }
}

interface WorkspaceRow {
  id: string;
  name: string;
  created_at: string;
  members: { user_id: string; role: string }[] | null;
}

function mapWorkspace(
  row: WorkspaceRow,
  userId: string,
): {
  id: string;
  name: string;
  createdAt: string;
  role: string;
  memberCount: number;
} {
  const members = row.members ?? [];
  const role =
    members.find((m) => m.user_id === userId)?.role ?? "member";
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    role,
    memberCount: members.length,
  };
}

export function registerAccountRoutes(app: FastifyInstance): void {
  // Avatar upload: base64 JSON (no multipart dependency). bodyLimit raised
  // per-route only — global default stays 1MB. 2MB decoded cap keeps CPU
  // and storage abuse bounded (rate-limited separately in app.ts).
  app.post<{ Body: { image?: unknown } }>(
    "/account/avatar",
    { bodyLimit: 4_000_000 },
    async (req, reply) => {
      const user = authed(req);
      const { image } = req.body ?? {};
      if (
        typeof image !== "string" ||
        image === "" ||
        image.length > 4_000_000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(image)
      ) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "image must be base64-encoded image data",
        });
      }
      const bytes = Buffer.from(image, "base64");
      if (bytes.length === 0) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "image is empty",
        });
      }
      if (bytes.length > MAX_AVATAR_BYTES) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Image must be 2MB or smaller",
        });
      }
      const sniff = sniffImage(bytes);
      if (!sniff) {
        return reply.code(400).send({
          statusCode: 400,
          error: "Bad Request",
          message: "Unsupported image type — use JPG, PNG, or WebP",
        });
      }

      const path = `${user.id}/avatar.${sniff.ext}`;
      let status: number;
      try {
        ({ status } = await storageFetch(user, path, {
          method: "PUT",
          headers: {
            "Content-Type": sniff.mime,
            "x-upsert": "true",
          },
          body: bytes,
        }));
      } catch (err) {
        req.log.error({ err }, "avatar storage upload failed");
        return reply.code(502).send({
          statusCode: 502,
          error: "Bad Gateway",
          message: "Could not store image — try again",
        });
      }
      if (status < 200 || status >= 300) {
        req.log.error({ status }, "avatar storage rejected upload");
        return reply.code(502).send({
          statusCode: 502,
          error: "Bad Gateway",
          message: "Could not store image — try again",
        });
      }

      return reply.code(200).send({
        url: `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`,
        path,
      });
    },
  );

  // Avatar removal: client sends the path derived from its own avatar URL;
  // shape + owner-prefix are enforced here (policy enforces again server-side).
  // Idempotent: deleting an already-gone object is success.
  app.delete<{ Body: { path?: unknown } }>("/account/avatar", async (req, reply) => {
    const user = authed(req);
    const { path } = req.body ?? {};
    if (
      typeof path !== "string" ||
      !AVATAR_PATH_RE.test(path) ||
      !path.startsWith(`${user.id}/`)
    ) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Invalid avatar path",
      });
    }
    let res: { status: number; body: string };
    try {
      res = await storageFetch(user, path, { method: "DELETE" });
    } catch (err) {
      req.log.error({ err }, "avatar storage delete failed");
      return reply.code(502).send({
        statusCode: 502,
        error: "Bad Gateway",
        message: "Could not remove image — try again",
      });
    }
    if (!isStorageNotFound(res) && (res.status < 200 || res.status >= 300)) {
      req.log.error({ status: res.status }, "avatar storage delete rejected");
      return reply.code(502).send({
        statusCode: 502,
        error: "Bad Gateway",
        message: "Could not remove image — try again",
      });
    }
    return reply.code(200).send({ ok: true });
  });

  // Workspace summary for Settings (member-visible: name, created, own
  // role, member count). One PostgREST query via reverse embed.
  app.get("/workspace", async (req, reply) => {
    const user = authed(req);
    const result = await rest<WorkspaceRow[]>(
      user,
      `workspaces?id=eq.${req.workspaceId}&select=id,name,created_at,members:workspace_members(user_id,role)`,
    );
    const row = result.data?.[0];
    if (result.status >= 400 || !row) {
      req.log.error({ status: result.status }, "workspace read failed");
      return reply.code(result.status >= 400 ? result.status : 404).send({
        statusCode: result.status >= 400 ? result.status : 404,
        error: result.status >= 400 ? "Bad Gateway" : "Not Found",
        message:
          result.status >= 400 ? "Workspace unavailable" : "No workspace",
      });
    }
    return reply.code(200).send(mapWorkspace(row, user.id));
  });

  // Rename: role checked here (explicit 403 message) AND by the
  // owner/admin RLS update policy — defense in depth, no trust in the client.
  app.patch<{ Body: { name?: unknown } }>("/workspace", async (req, reply) => {
    const user = authed(req);
    const body = req.body ?? {};
    if (
      typeof body.name !== "string" ||
      body.name.trim() === "" ||
      body.name.trim().length > 100
    ) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "name must be 1-100 characters",
      });
    }

    const membership = await rest<{ role: string }[]>(
      user,
      `workspace_members?workspace_id=eq.${req.workspaceId}&user_id=eq.${user.id}&select=role`,
    );
    const role = membership.data?.[0]?.role;
    if (role !== "owner" && role !== "admin") {
      return reply.code(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Only workspace owners and admins can rename the workspace",
      });
    }

    const patched = await rest<WorkspaceRow[]>(
      user,
      `workspaces?id=eq.${req.workspaceId}&select=id,name,created_at,members:workspace_members(user_id,role)`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: { name: body.name.trim() },
      },
    );
    const row = patched.data?.[0];
    if (patched.status >= 400 || !row) {
      req.log.error(
        { status: patched.status, code: patched.errorCode },
        "workspace rename failed",
      );
      return reply.code(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Only workspace owners and admins can rename the workspace",
      });
    }
    return reply.code(200).send(mapWorkspace(row, user.id));
  });
}
