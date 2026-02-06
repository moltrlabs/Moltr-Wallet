/**
 * Tags: username -> wallet address registry.
 * No search/list endpoints (prevent enumeration).
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashApiKey, generateApiKey, requireApiKey } from "../lib/auth.js";

type RequestWithTag = FastifyRequest & { tag: { id: string; username: string } };

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
  }>(
    "/register",
    {
      schema: {
        tags: ["Tags"],
        summary: "Register tag",
        description: "Register a username → wallet address. Returns a one-time API key; store it securely.",
        body: {
          type: "object",
          required: ["username", "walletAddress"],
          properties: {
            username: { type: "string", minLength: 3, maxLength: 20, pattern: "^[a-z0-9_]+$" },
            walletAddress: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              username: { type: "string" },
              walletAddress: { type: "string" },
              apiKey: { type: "string", description: "One-time; store securely." },
            },
          },
          400: { type: "object", properties: { message: { type: "string" } } },
          409: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof registerBody> }>, reply: FastifyReply) => {
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

  // PATCH /api/v1/tags/me — update wallet address for the tag identified by x-api-key
  const updateWalletBody = z.object({
    walletAddress: z.string().min(1, "walletAddress is required"),
  });
  app.patch<{ Body: z.infer<typeof updateWalletBody> }>(
    "/me",
    {
      preHandler: [requireApiKey as (req: FastifyRequest, reply: FastifyReply) => Promise<void>],
      schema: {
        tags: ["Tags"],
        summary: "Update my wallet address",
        description: "Update the wallet address for the tag identified by the API key. Requires x-api-key.",
        security: [{ apiKey: [] }],
        body: {
          type: "object",
          required: ["walletAddress"],
          properties: { walletAddress: { type: "string" } },
        },
        response: {
          200: {
            type: "object",
            properties: { username: { type: "string" }, walletAddress: { type: "string" } },
          },
          400: { type: "object", properties: { message: { type: "string" } } },
          401: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof updateWalletBody> }>, reply: FastifyReply) => {
      const parsed = updateWalletBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Validation failed", errors: parsed.error.flatten() });
      }
      const { walletAddress } = parsed.data;
      const tag = (request as RequestWithTag).tag;

      const updated = await prisma.tag.update({
        where: { id: tag.id },
        data: { walletAddress },
        select: { username: true, walletAddress: true },
      });
      return reply.send({ username: updated.username, walletAddress: updated.walletAddress });
    }
  );

  // GET /api/v1/tags/:username — lookup by username (no enumeration)
  app.get<{
    Params: { username: string };
  }>(
    "/:username",
    {
      schema: {
        tags: ["Tags"],
        summary: "Get tag by username",
        description: "Lookup wallet address by exact username. No search or list (anti-enumeration).",
        params: { type: "object", required: ["username"], properties: { username: { type: "string" } } },
        response: {
          200: {
            type: "object",
            properties: { username: { type: "string" }, walletAddress: { type: "string" } },
          },
          400: { type: "object", properties: { message: { type: "string" } } },
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { username: string } }>, reply: FastifyReply) => {
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
