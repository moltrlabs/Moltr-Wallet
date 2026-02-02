/**
 * Moltr API — Tags, Receipts, Objects.
 * Agent-native coordination layer; no custody.
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { tagsRoutes } from "./routes/tags.js";
import { receiptsRoutes } from "./routes/receipts.js";
import { objectsRoutes } from "./routes/objects.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "http://localhost:3000";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: CORS_ORIGIN.split(",").map((o) => o.trim()),
    allowedMethods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-api-key"],
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

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

  app.get("/health", async (_request, reply) => {
    return reply.send({ ok: true });
  });

  await app.listen({ port: PORT, host: HOST });
  console.log(`Moltr API listening on http://${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
