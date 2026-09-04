import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { access, constants, mkdir, unlink, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import type { ObjectStream, StorageAdapter, UploadableBody } from "./types";

/**
 * Stage 2.1 — Storage adapters (S3 / Cloudflare R2 + local filesystem fallback).
 *
 * `S3StorageAdapter` talks to AWS S3 or any S3-compatible store (Cloudflare R2,
 * MinIO, ...) via the AWS SDK v3. `LocalStorageAdapter` writes to the
 * `storage/uploads/` directory under the project root and is used when S3
 * credentials are not configured (local development / demo mode).
 *
 * `getStorageAdapter()` returns the single configured adapter; S3 wins when
 * `S3_BUCKET_NAME` + `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` are set,
 * otherwise the local fallback is used.
 */

export interface S3StorageConfig {
  bucketName?: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

/** Parses the S3/R2 configuration from the environment. */
export function getS3Config(): S3StorageConfig {
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  return {
    bucketName: process.env.S3_BUCKET_NAME?.trim() || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || undefined,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || undefined,
    endpoint,
    region: process.env.S3_REGION?.trim() || (endpoint ? "auto" : "us-east-1"),
  };
}

/** True when a full S3/R2 credential set is present in the environment. */
export function isS3Configured(): boolean {
  const config = getS3Config();
  return Boolean(config.bucketName && config.accessKeyId && config.secretAccessKey);
}

function isNotFound(error: unknown): boolean {
  if (error instanceof NoSuchKey) return true;
  if (error instanceof Error && error.name === "NoSuchKey") return true;
  const meta = (error as { $metadata?: { httpStatusCode?: number } }).$metadata;
  return meta?.httpStatusCode === 404;
}

/** AWS S3 / Cloudflare R2 adapter. */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: S3StorageConfig) {
    if (!config.bucketName || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error("S3StorageAdapter requires S3_BUCKET_NAME, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
    }

    const clientConfig: S3ClientConfig = {
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // S3-compatible stores (Cloudflare R2, MinIO, ...) need path-style URLs.
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    };
    this.client = new S3Client(clientConfig);
    this.bucketName = config.bucketName;
  }

  async putObject(key: string, body: UploadableBody, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return key;
  }

  async getObjectStream(key: string): Promise<ObjectStream | null> {
    try {
      const output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
      );
      if (!output.Body) return null;
      return output.Body as unknown as Readable;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn },
    );
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
  }
}

/** Local filesystem adapter rooted at `storage/uploads/`. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root = join(process.cwd(), "storage", "uploads");

  /** Maps a logical key to a contained absolute path, sanitizing each segment. */
  private resolveKey(key: string): string {
    const segments = key
      .split("/")
      .filter(Boolean)
      .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "_"));
    const target = resolve(this.root, ...segments);
    if (!target.startsWith(this.root + sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return target;
  }

  async putObject(key: string, body: UploadableBody, contentType: string): Promise<string> {
    void contentType;
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });

    if (Buffer.isBuffer(body)) {
      await writeFile(target, body);
    } else if (body instanceof Uint8Array) {
      await writeFile(target, Buffer.from(body));
    } else {
      await writeFile(target, await webStreamToBuffer(body));
    }
    return key;
  }

  async getObjectStream(key: string): Promise<ObjectStream | null> {
    const target = this.resolveKey(key);
    try {
      await access(target, constants.R_OK);
    } catch {
      return null;
    }
    return createReadStream(target);
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string> {
    // The local backend has no presigned-URL concept: uploads flow directly to
    // putObject(), so this returns the logical key as the upload target.
    void contentType;
    void expiresIn;
    return key;
  }

  async deleteObject(key: string): Promise<void> {
    const target = this.resolveKey(key);
    try {
      await unlink(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

/** Consumes a web ReadableStream into a Buffer (for local file writes). */
async function webStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  return Buffer.concat(chunks, total);
}

const globalForStorage = globalThis as unknown as { assetpilotStorageAdapter?: StorageAdapter };

/**
 * Returns the configured storage adapter. The instance is created once and
 * cached for the process lifetime.
 */
export function getStorageAdapter(): StorageAdapter {
  if (!globalForStorage.assetpilotStorageAdapter) {
    globalForStorage.assetpilotStorageAdapter = isS3Configured()
      ? new S3StorageAdapter(getS3Config())
      : new LocalStorageAdapter();
  }
  return globalForStorage.assetpilotStorageAdapter;
}