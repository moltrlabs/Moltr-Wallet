/**
 * Tags: username -> wallet address registry.
 * No search/list endpoints (prevent enumeration).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashApiKey, generateApiKey } from "../lib/auth.js";

const registerBody = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, digits, or underscore")
    .transform((s) => s.toLowerCase()),
  walletAddress: z.string().min(1, "walletAddress is required"),
});

export async function tagsRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/tags/register — create tag, return one-time apiKey
  app.post<{
    Body: z.infer<typeof registerBody>;
  }>("/register", async (request: FastifyRequest<{ Body: z.infer<typeof registerBody> }>, reply: FastifyReply) => {
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { username, walletAddress } = parsed.data;

    const existing = await prisma.tag.findUnique({ where: { username } });
    if (existing) {
      return reply.code(409).send({ message: "Username already registered" });
    }

    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);

    const tag = await prisma.tag.create({
      data: { username, walletAddress, apiKeyHash },
    });

    return reply.code(201).send({
      username: tag.username,
      walletAddress: tag.walletAddress,
      apiKey, // one-time: only shown here
    });
  });

  // GET /api/v1/tags/:username — lookup by username (no enumeration)
  app.get<{
    Params: { username: string };
  }>("/:username", async (request: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
    const username = request.params.username?.toLowerCase();
    if (!username || username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
      return reply.code(400).send({ message: "Invalid username" });
    }

    const tag = await prisma.tag.findUnique({
      where: { username },
      select: { username: true, walletAddress: true },
    });
    if (!tag) {
      return reply.code(404).send({ message: "Tag not found" });
    }
    return reply.send({ username: tag.username, walletAddress: tag.walletAddress });
  });
}
