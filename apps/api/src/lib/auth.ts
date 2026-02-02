/**
 * API key auth: hash with argon2, verify on request.
 * Never log API keys or secrets.
 */

import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./prisma.js";

const API_KEY_HEADER = "x-api-key";

export async function hashApiKey(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyApiKey(plain: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

export function generateApiKey(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Resolve API key from header and return the Tag record (or null).
 * Use for routes that require a valid API key.
 */
export async function resolveTagFromApiKey(apiKey: string | undefined): Promise<{ id: string; username: string } | null> {
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 16) return null;
  const tags = await prisma.tag.findMany();
  for (const tag of tags) {
    const ok = await verifyApiKey(apiKey, tag.apiKeyHash);
    if (ok) return { id: tag.id, username: tag.username };
  }
  return null;
}

/**
 * Fastify preHandler: require x-api-key and set request.tag.
 * Reply 401 if missing or invalid.
 */
export async function requireApiKey(
  request: FastifyRequest<{ Headers: { "x-api-key"?: string } }>,
  reply: FastifyReply
): Promise<void> {
  const raw = request.headers[API_KEY_HEADER];
  const tag = await resolveTagFromApiKey(raw);
  if (!tag) {
    reply.code(401).send({ message: "Invalid or missing API key" });
    return;
  }
  (request as FastifyRequest & { tag: { id: string; username: string } }).tag = tag;
}

export function getApiKeyFromRequest(request: FastifyRequest): string | undefined {
  const raw = request.headers[API_KEY_HEADER];
  return typeof raw === "string" ? raw : undefined;
}
