import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authed, type AuthUser } from "./supabase";
import {
  encryptionReady,
  getMetaConfigPublic,
  saveMetaConfig,
  type SaveMetaConfigInput,
} from "./platform-config";

// Platform admin gates (Task 018A). No platform-admin role exists in the
// schema — membership is API env only (PLATFORM_ADMIN_EMAILS, comma-separated).
// Server-side check after the normal session preHandler; never a client flag.

function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isPlatformAdmin(user: AuthUser): boolean {
  const email = user.email?.toLowerCase();
  if (!email) return false;
  return platformAdminEmails().has(email);
}

async function requirePlatformAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  const user = authed(req);
  if (isPlatformAdmin(user)) return user;
  await reply.code(403).send({
    statusCode: 403,
    error: "Forbidden",
    message: "Platform admin required",
  });
  return null;
}

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

export function registerAdminRoutes(app: FastifyInstance): void {
  // Never returns plaintext secrets — only configured flags + sources.
  app.get("/admin/integrations/meta", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return reply;
    return getMetaConfigPublic();
  });

  app.put<{
    Body: {
      appId?: unknown;
      appSecret?: unknown;
      webhookVerifyToken?: unknown;
    };
  }>("/admin/integrations/meta", async (req, reply) => {
    const user = await requirePlatformAdmin(req, reply);
    if (!user) return reply;

    const body = req.body ?? {};
    const has =
      body.appId !== undefined ||
      body.appSecret !== undefined ||
      body.webhookVerifyToken !== undefined;
    if (!has) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "no updatable fields",
      });
    }
    if (
      (body.appId !== undefined && !isStr(body.appId)) ||
      (body.appSecret !== undefined && !isStr(body.appSecret)) ||
      (body.webhookVerifyToken !== undefined &&
        !isStr(body.webhookVerifyToken))
    ) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "appId, appSecret, and webhookVerifyToken must be strings",
      });
    }
    const wantsSecretWrite =
      (isStr(body.appSecret) && body.appSecret !== "") ||
      (isStr(body.webhookVerifyToken) && body.webhookVerifyToken !== "");
    if (wantsSecretWrite && !encryptionReady()) {
      return reply.code(503).send({
        statusCode: 503,
        error: "Service Unavailable",
        message: "PLATFORM_ENCRYPTION_KEY not configured",
      });
    }

    const input: SaveMetaConfigInput = {};
    if (isStr(body.appId)) input.appId = body.appId;
    if (isStr(body.appSecret)) input.appSecret = body.appSecret;
    if (isStr(body.webhookVerifyToken)) {
      input.webhookVerifyToken = body.webhookVerifyToken;
    }
    await saveMetaConfig(user, input);
    return getMetaConfigPublic();
  });

  // Presence-only readiness check — never calls Meta, never echoes secrets.
  app.post("/admin/integrations/meta/test", async (req, reply) => {
    if (!(await requirePlatformAdmin(req, reply))) return reply;
    const cfg = await getMetaConfigPublic();
    return {
      appIdPresent: Boolean(cfg.appId),
      appSecretPresent: cfg.appSecretConfigured,
      webhookVerifyTokenPresent: cfg.webhookVerifyTokenConfigured,
      redirectUriPresent: Boolean(cfg.redirectUri),
      metaConfigured: cfg.metaConfigured,
      oauthReady: cfg.oauthReady,
      webhookReady: cfg.webhookReady,
      source: cfg.source,
    };
  });
}
