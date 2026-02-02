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

export async function receiptsRoutes(app: FastifyInstance): Promise<void> {
  // All receipt routes require API key
  app.addHook("preHandler", requireApiKey);

  // POST /api/v1/receipts/create — only fromTag or toTag key can create
  app.post<{
    Body: z.infer<typeof createBody>;
  }>("/create", async (request: FastifyRequest<{ Body: z.infer<typeof createBody> }>, reply: FastifyReply) => {
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

  // GET /api/v1/receipts/ — only receipts where apiKey belongs to fromTag or toTag
  app.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const reqTag = (request as RequestWithTag).tag;

    const receipts = await prisma.receipt.findMany({
      where: {
        OR: [{ fromTagId: reqTag.id }, { toTagId: reqTag.id }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        fromTag: { select: { username: true } },
        toTag: { select: { username: true } },
      },
    });

    const items = receipts.map((r) => ({
      id: r.id,
      signature: r.signature,
      memo: r.memo,
      fromTag: r.fromTag.username,
      toTag: r.toTag.username,
      amountLamports: Number(r.amountLamports),
      createdAt: r.createdAt.toISOString(),
      url: `${RECEIPT_BASE_URL.replace(/\/$/, "")}/${r.id}`,
    }));

    return reply.send({ items });
  });
}
