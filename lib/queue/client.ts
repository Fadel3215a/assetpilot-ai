import { EventEmitter } from "node:events";
import Redis from "ioredis";
import type { ConnectionOptions, RedisOptions } from "bullmq";

/**
 * Stage 1.1 — Redis connection bootstrap.
 *
 * Provides a single source of truth for the Redis connection configuration,
 * derived from environment variables:
 *
 *   REDIS_URL                                        (preferred, e.g. "redis://user:pass@host:6379/0")
 *   REDIS_HOST + REDIS_PORT (+ REDIS_PASSWORD, REDIS_DB, REDIS_USERNAME)
 *
 * Two consumers are supported:
 *   - getQueueConnection(): connection *options* handed directly to BullMQ, so
 *     each queue builds its own dedicated internal connection (the recommended,
 *     warning-free BullMQ pattern). Never share a single client across queues.
 *   - getRedisClient(): a lazily-created, reusable ioredis instance for direct
 *     Redis operations (workers, one-off commands, cache reads).
 *
 * A mock stub is substituted in environments with no Redis configured (e.g. at
 * build time or local dev without a broker), so importing queue infrastructure
 * never crashes. Real jobs still require a live Redis.
 */

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
}

/** True when the environment declares an explicit Redis endpoint. */
export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

/** Parses the worker/queue-safe connection options from the environment. */
export function getRedisConfig(): RedisConfig {
  const url = process.env.REDIS_URL?.trim();
  if (url) {
    return { url };
  }
  const host = process.env.REDIS_HOST?.trim() || "localhost";
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const username = process.env.REDIS_USERNAME?.trim() || undefined;
  const password = process.env.REDIS_PASSWORD || undefined;
  const db = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined;
  return {
    host,
    port,
    username,
    password,
    ...(db !== undefined ? { db } : {}),
  };
}

/** Connection options to pass to BullMQ queues. */
export function getQueueConnection(): ConnectionOptions & RedisOptions {
  const config = getRedisConfig();
  return {
    ...config,
    // Consumers must be able to queue while Redis is briefly unreachable.
    enableOfflineQueue: true,
    // BullMQ prefers null here (infinite retries handled by its own retry logic).
    maxRetriesPerRequest: null,
  };
}

const globalForRedis = globalThis as unknown as { assetpilotRedis?: Redis };

/** Lazily-created shared ioredis instance for direct Redis access. */
export function getRedisClient(): Redis {
  if (!isRedisConfigured()) {
    throw new Error(
      "Redis is not configured. Set REDIS_URL (or REDIS_HOST/REDIS_PORT) to use the shared Redis client.",
    );
  }
  if (!globalForRedis.assetpilotRedis) {
    globalForRedis.assetpilotRedis = new Redis({
      ...getRedisConfig(),
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });
  }
  return globalForRedis.assetpilotRedis;
}

/**
 * Minimal mock that quacks like a BullMQ connection so queue infrastructure can
 * be imported safely without a live Redis instance. Extends EventEmitter so the
 * full listener API (getMaxListeners, once, on, emit, ...) BullMQ relies on is
 * available at runtime without any real socket being opened.
 */
export class MockRedisConnection extends EventEmitter {
  private readonly keyPrefix: string;
  isCluster = false;

  constructor(keyPrefix = "") {
    super();
    this.keyPrefix = keyPrefix;
    this.setMaxListeners(0);
  }

  get status(): "wait" | "ready" {
    return "wait";
  }

  async connect(): Promise<this> {
    return this;
  }

  async disconnect(): Promise<void> {
    void 0;
  }

  async close(): Promise<void> {
    void 0;
  }

  duplicate(prefix = ""): MockRedisConnection {
    return new MockRedisConnection(prefix);
  }

  sendCommand(): Promise<string> {
    return Promise.resolve("OK");
  }

  send(): Promise<string> {
    return Promise.resolve("OK");
  }

  async info(): Promise<string> {
    // Minimal, valid Redis INFO payload satisfying BullMQ's version check.
    return "# Server\r\nredis_version:7.4.0\r\nredis_mode:standalone\r\n\r\n";
  }

  defineCommand(): undefined {
    return undefined;
  }

  getConnectionName(): string {
    return `mock:${this.keyPrefix}`;
  }

  get options(): { keyPrefix: string } {
    return { keyPrefix: this.keyPrefix };
  }
}
