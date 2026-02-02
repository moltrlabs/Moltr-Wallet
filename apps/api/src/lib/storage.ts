/**
 * S3-compatible object storage (AWS S3 or Cloudflare R2).
 * Used for token metadata/images (objects) only.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET ?? "moltr-objects";
const region = process.env.S3_REGION ?? "auto";
const endpoint = process.env.S3_ENDPOINT ?? undefined;
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

export const s3 = new S3Client({
  region,
  ...(endpoint && { endpoint }),
  forcePathStyle,
  credentials: process.env.S3_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

export function getPublicUrl(key: string): string {
  const base = process.env.CDN_BASE_URL ?? process.env.S3_PUBLIC_BASE ?? `https://cdn.moltr.app`;
  const trimmed = base.replace(/\/$/, "");
  return `${trimmed}/${key}`;
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}
