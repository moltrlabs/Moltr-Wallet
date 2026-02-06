/**
 * Moltr API — Tags, Receipts, Objects.
 * Agent-native coordination layer; no custody.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { tagsRoutes } from "./routes/tags.js";
import { receiptsRoutes } from "./routes/receipts.js";
import { objectsRoutes } from "./routes/objects.js";
import { checkDb, checkS3 } from "./lib/health.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";
const BASE_URL = process.env.BASE_URL ?? `http://${HOST}:${PORT}`;

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Moltr API",
        description: "Agent-native crypto wallet and coordination layer. Tags (username → wallet), Receipts (private proof records), Objects (token metadata/images). No custody.",
        version: "1.0.0",
      },
      servers: [{ url: BASE_URL }],
      components: {
        securitySchemes: {
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
            description: "API key (from tag registration). Required for receipt endpoints.",
          },
        },
      },
      tags: [
        { name: "Tags", description: "Username → wallet registry" },
        { name: "Receipts", description: "Private proof records" },
        { name: "Objects", description: "Token metadata/images upload" },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list" },
  });

  // Health: DB + optional S3
  app.get(
    "/health",
    {
      schema: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns 200 if DB (and S3 when configured) are reachable. Use for load balancers and orchestration.",
        response: {
          200: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              db: { type: "string", enum: ["ok", "error"] },
              s3: { type: "string", enum: ["ok", "error", "skipped"] },
            },
          },
          503: {
            type: "object",
            properties: {
              ok: { type: "boolean" },
              db: { type: "string" },
              s3: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      const dbOk = await checkDb();
      const s3Ok = await checkS3();
      const s3Status = !process.env.S3_ACCESS_KEY_ID ? "skipped" : s3Ok ? "ok" : "error";
      if (!dbOk) {
        return reply.code(503).send({ ok: false, db: "error", s3: s3Status });
      }
      if (process.env.S3_ACCESS_KEY_ID && !s3Ok) {
        return reply.code(503).send({ ok: false, db: "ok", s3: "error" });
      }
      return reply.send({ ok: true, db: "ok", s3: s3Status });
    }
  );

  // API v1
  await app.register(
    async (instance) => {
      await instance.register(tagsRoutes, { prefix: "/tags" });
      await instance.register(receiptsRoutes, { prefix: "/receipts" });
    },
    { prefix: "/api/v1" }
  );

  // Objects (PUT /objects/*) — key = path after /objects/
  await app.register(
    (instance) => {
      instance.addContentTypeParser("application/octet-stream", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
      instance.addContentTypeParser("image/png", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
      instance.addContentTypeParser("image/jpeg", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
      instance.addContentTypeParser("image/webp", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
      instance.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
      return instance.register(objectsRoutes, { prefix: "/objects" });
    },
    { prefix: "" }
  );

  await app.listen({ port: PORT, host: HOST });
  console.log(`Moltr API listening on http://${HOST}:${PORT}`);
  console.log(`Docs: ${BASE_URL}/docs`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
