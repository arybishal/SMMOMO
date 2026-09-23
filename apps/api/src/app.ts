import Fastify from "fastify";
import cors from "@fastify/cors";

// Keep aligned with apps/api/package.json "version" when bumping.
const SERVICE = "smmomo-api";
const VERSION = "0.1.0";

// Foundation only: CORS + /health. Product routes belong to Task 014;
// 404 and error responses use Fastify's built-in JSON shape
// (statusCode/error/message; stack never sent when NODE_ENV=production).
export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  });

  app.get("/health", async () => ({
    status: "ok",
    service: SERVICE,
    version: VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  return app;
}
