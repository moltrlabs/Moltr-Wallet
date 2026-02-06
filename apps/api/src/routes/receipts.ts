/**
 * Receipts: private proof records readable only by fromTag and toTag.
 * Create requires API key of fromTag or toTag.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireApiKey } from "../lib/auth.js";

type RequestWithTag = FastifyRequest & { tag: { id: string; username: string } };

const createBody = z.object({
  signature: z.string().min(1, "signature is required"),
  memo: z.string().min(0),
  fromTag: z.string().min(1, "fromTag is required"),
  toTag: z.string().min(1, "toTag is required"),
  amountLamports: z.number().int().nonnegative(),
});

const RECEIPT_BASE_URL = process.env.RECEIPT_BASE_URL ?? "https://api.moltr.app/r";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function toReceiptItem(r: {
  id: string;
  signature: string;
  memo: string;
  fromTag: { username: string };
  toTag: { username: string };
  amountLamports: bigint;
  createdAt: Date;
}) {
  return {
    id: r.id,
    signature: r.signature,
    memo: r.memo,
    fromTag: r.fromTag.username,
    toTag: r.toTag.username,
    amountLamports: Number(r.amountLamports),
    createdAt: r.createdAt.toISOString(),
    url: `${RECEIPT_BASE_URL.replace(/\/$/, "")}/${r.id}`,
  };
}

export async function receiptsRoutes(app: FastifyInstance): Promise<void> {
  // All receipt routes require API key
  app.addHook("preHandler", requireApiKey);

  // POST /api/v1/receipts/create — only fromTag or toTag key can create
  app.post<{
    Body: z.infer<typeof createBody>;
  }>(
    "/create",
    {
      schema: {
        tags: ["Receipts"],
        summary: "Create receipt",
        description: "Create a private proof record. Only the fromTag or toTag API key may create.",
        security: [{ apiKey: [] }],
        body: {
          type: "object",
          required: ["signature", "fromTag", "toTag", "amountLamports"],
          properties: {
            signature: { type: "string" },
            memo: { type: "string" },
            fromTag: { type: "string" },
            toTag: { type: "string" },
            amountLamports: { type: "integer", minimum: 0 },
          },
        },
        response: {
          201: {
            type: "object",
            properties: { id: { type: "string" }, url: { type: "string", format: "uri" } },
          },
          400: { type: "object", properties: { message: { type: "string" } } },
          403: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof createBody> }>, reply: FastifyReply) => {
    const parsed = createBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Validation failed", errors: parsed.error.flatten() });
    }
    const { signature, memo, fromTag: fromUsername, toTag: toUsername, amountLamports } = parsed.data;

    const reqTag = (request as RequestWithTag).tag;
    if (reqTag.username !== fromUsername && reqTag.username !== toUsername) {
      return reply.code(403).send({ message: "Only fromTag or toTag API key can create this receipt" });
    }

    const fromTag = await prisma.tag.findUnique({ where: { username: fromUsername } });
    const toTag = await prisma.tag.findUnique({ where: { username: toUsername } });
    if (!fromTag || !toTag) {
      return reply.code(400).send({ message: "fromTag or toTag not found" });
    }

    const receipt = await prisma.receipt.create({
      data: {
        signature,
        memo,
        fromTagId: fromTag.id,
        toTagId: toTag.id,
        amountLamports: BigInt(amountLamports),
      },
    });

    const url = `${RECEIPT_BASE_URL.replace(/\/$/, "")}/${receipt.id}`;
    return reply.code(201).send({ id: receipt.id, url });
  });

  // GET /api/v1/receipts/ — list with pagination (cursor-based)
  app.get<{ Querystring: { limit?: string; cursor?: string } }>(
    "/",
    {
      schema: {
        tags: ["Receipts"],
        summary: "List receipts",
        description: "List receipts where the API key's tag is fromTag or toTag. Cursor-based pagination.",
        security: [{ apiKey: [] }],
        querystring: {
          type: "object",
          properties: {
            limit: { type: "string", description: "Max items (default 20, max 100)" },
            cursor: { type: "string", description: "Receipt id for next page" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    signature: { type: "string" },
                    memo: { type: "string" },
                    fromTag: { type: "string" },
                    toTag: { type: "string" },
                    amountLamports: { type: "integer" },
                    createdAt: { type: "string", format: "date-time" },
                    url: { type: "string" },
                  },
                },
              },
              nextCursor: { type: "string", description: "Present when more results exist" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { limit?: string; cursor?: string } }>, reply: FastifyReply) => {
      const reqTag = (request as RequestWithTag).tag;
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(request.query.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
      );
      const cursor = request.query.cursor?.trim() || undefined;

      const receipts = await prisma.receipt.findMany({
        where: {
          OR: [{ fromTagId: reqTag.id }, { toTagId: reqTag.id }],
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          fromTag: { select: { username: true } },
          toTag: { select: { username: true } },
        },
      });

      const hasMore = receipts.length > limit;
      const items = receipts.slice(0, limit).map(toReceiptItem);
      const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : undefined;

      return reply.send({ items, ...(nextCursor ? { nextCursor } : {}) });
    }
  );

  // GET /api/v1/receipts/:id — single receipt (only if apiKey is fromTag or toTag)
  app.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        tags: ["Receipts"],
        summary: "Get receipt by ID",
        description: "Fetch a single receipt. Only allowed if API key is fromTag or toTag.",
        security: [{ apiKey: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              signature: { type: "string" },
              memo: { type: "string" },
              fromTag: { type: "string" },
              toTag: { type: "string" },
              amountLamports: { type: "integer" },
              createdAt: { type: "string", format: "date-time" },
              url: { type: "string" },
            },
          },
          404: { type: "object", properties: { message: { type: "string" } } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const reqTag = (request as RequestWithTag).tag;
      const { id } = request.params;

      const receipt = await prisma.receipt.findUnique({
        where: { id },
        include: {
          fromTag: { select: { username: true } },
          toTag: { select: { username: true } },
        },
      });
      if (!receipt) {
        return reply.code(404).send({ message: "Receipt not found" });
      }
      if (receipt.fromTagId !== reqTag.id && receipt.toTagId !== reqTag.id) {
        return reply.code(404).send({ message: "Receipt not found" });
      }
      return reply.send(toReceiptItem(receipt));
    }
  );
}
