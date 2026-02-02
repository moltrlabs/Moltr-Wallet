/**
 * Objects: upload token metadata/images to S3-compatible storage.
 * Allowed key prefixes: tokens/<mint>/logo.png, tokens/<mint>/metadata.json
 * Public write but restricted keys; max size 2MB.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { uploadObject, getPublicUrl } from "../lib/storage.js";

const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_PREFIX = /^tokens\/[^/]+\/(logo\.png|metadata\.json)$/;

export async function objectsRoutes(app: FastifyInstance): Promise<void> {
  // PUT /objects/* — key = params['*'] (e.g. tokens/mint/logo.png)
  app.put<{
    Params: { "*"?: string };
  }>(
    "/*",
    {
      bodyLimit: MAX_BODY_SIZE,
    },
    async (request: FastifyRequest<{ Params: { "*"?: string } }>, reply: FastifyReply) => {
      const rawKey = request.params["*"] ?? "";
      const key = decodeURIComponent(rawKey).replace(/^\/+/, "");
      if (!ALLOWED_PREFIX.test(key)) {
        return reply.code(400).send({
          message: "Invalid key. Allowed: tokens/<mint>/logo.png or tokens/<mint>/metadata.json",
        });
      }

      const contentType = (request.headers["content-type"] as string) ?? "application/octet-stream";
      const body = request.body;
      if (!body || !Buffer.isBuffer(body)) {
        return reply.code(400).send({ message: "Missing or invalid body (expected binary)" });
      }
      if (body.length > MAX_BODY_SIZE) {
        return reply.code(413).send({ message: "Payload too large (max 2MB)" });
      }
      if (body.length === 0) {
        return reply.code(400).send({ message: "Empty body not allowed" });
      }

      try {
        await uploadObject(key, body, contentType);
      } catch (err) {
        request.log.error({ err }, "Object upload failed");
        return reply.code(502).send({ message: "Upload failed" });
      }

      const publicUrl = getPublicUrl(key);
      return reply.send({ ok: true, publicUrl });
    }
  );
}
