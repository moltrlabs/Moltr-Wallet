/**
 * Health checks: DB and optional S3.
 * Used by GET /health for load balancers and orchestration.
 */

import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { prisma } from "./prisma.js";
import { s3 } from "./storage.js";

export async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function checkS3(): Promise<boolean> {
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_BUCKET) {
    return true; // skip if S3 not configured
  }
  try {
    const bucket = process.env.S3_BUCKET;
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}
