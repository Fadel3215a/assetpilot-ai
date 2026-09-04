import type { Readable } from "node:stream";

/**
 * Stage 2.1 — Storage adapter contract.
 *
 * Abstraction over object storage (AWS S3, Cloudflare R2) and the local
 * filesystem so feature code (uploads, media serving, rendition staging) never
 * touches a concrete backend directly. Keys are forward-slash logical paths
 * without a leading slash, e.g. `assets/{assetId}/original.png`.
 */

/** Bodies accepted by putObject: raw bytes or a web ReadableStream. */
export type UploadableBody = Buffer | Uint8Array | ReadableStream<Uint8Array>;

/** Stream shapes returned by getObjectStream (web or Node stream), or null when missing. */
export type ObjectStream = ReadableStream<Uint8Array> | Readable;

export interface StorageAdapter {
  /** Persists an object under `key` and returns the same logical key. */
  putObject(key: string, body: UploadableBody, contentType: string): Promise<string>;

  /** Opens the object as a readable stream, or null when it does not exist. */
  getObjectStream(key: string): Promise<ObjectStream | null>;

  /**
   * Time-limited upload URL. On S3/R2 this is a presigned PUT URL; on the local
   * backend it is a stand-in describing where the object would live.
   */
  getPresignedUploadUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;

  /** Removes the object. Deleting a key that does not exist is a no-op. */
  deleteObject(key: string): Promise<void>;
}